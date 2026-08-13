-- Additive metadata for the prediction history.
-- Existing JSONB results remain the source of truth for backward compatibility;
-- these columns make filtering and settlement idempotent for new and old rows.

ALTER TABLE public.ai_analyses
  ADD COLUMN IF NOT EXISTS prediction_market TEXT,
  ADD COLUMN IF NOT EXISTS prediction_pick TEXT,
  ADD COLUMN IF NOT EXISTS prediction_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS prediction_odd NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_outcome TEXT,
  ADD COLUMN IF NOT EXISTS final_score TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE public.ai_analyses
  DROP CONSTRAINT IF EXISTS ai_analyses_settlement_status_check;

ALTER TABLE public.ai_analyses
  ADD CONSTRAINT ai_analyses_settlement_status_check
  CHECK (settlement_status IN ('pending', 'won', 'lost', 'unresolvable'));

CREATE INDEX IF NOT EXISTS idx_ai_analyses_history_status
  ON public.ai_analyses(user_id, settlement_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_history_market
  ON public.ai_analyses(user_id, prediction_market, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_prediction_history_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market JSONB;
  v_settlement JSONB;
  v_confidence TEXT;
BEGIN
  IF NEW.result IS NULL THEN
    RETURN NEW;
  END IF;

  v_market := COALESCE(NEW.result->'markets'->0, '{}'::jsonb);
  v_settlement := COALESCE(NEW.result->'_settlement', '{}'::jsonb);
  v_confidence := v_market->>'confidence';

  NEW.prediction_market := COALESCE(NEW.prediction_market, NULLIF(v_market->>'label', ''));
  NEW.prediction_pick := COALESCE(NEW.prediction_pick, NULLIF(v_market->>'pick', ''));
  IF NEW.prediction_confidence IS NULL AND v_confidence ~ '^\d+(\.\d+)?$' THEN
    NEW.prediction_confidence := ROUND(v_confidence::NUMERIC)::INTEGER;
  END IF;
  NEW.settlement_status := COALESCE(
    NULLIF(NEW.settlement_status, 'pending'),
    CASE
      WHEN v_settlement->>'status' IN ('won', 'lost', 'unresolvable') THEN v_settlement->>'status'
      WHEN v_settlement->>'hit' = 'true' THEN 'won'
      WHEN v_settlement->>'hit' = 'false' THEN 'lost'
      ELSE 'pending'
    END
  );
  NEW.settlement_outcome := COALESCE(NEW.settlement_outcome, NULLIF(v_settlement->>'outcome', ''));
  NEW.final_score := COALESCE(NEW.final_score, NULLIF(v_settlement->>'score', ''));
  IF NEW.settled_at IS NULL AND v_settlement->>'settledAt' IS NOT NULL THEN
    NEW.settled_at := (v_settlement->>'settledAt')::TIMESTAMPTZ;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_prediction_history_metadata_trigger ON public.ai_analyses;
CREATE TRIGGER sync_prediction_history_metadata_trigger
BEFORE INSERT OR UPDATE OF result, prediction_market, prediction_pick,
  prediction_confidence, prediction_odd, settlement_status, settlement_outcome,
  final_score, settled_at
ON public.ai_analyses
FOR EACH ROW
EXECUTE FUNCTION public.sync_prediction_history_metadata();

-- Backfill rows created before this migration without overwriting any existing
-- settlement state.
UPDATE public.ai_analyses
SET result = result
WHERE prediction_market IS NULL
   OR prediction_pick IS NULL
   OR prediction_confidence IS NULL;
