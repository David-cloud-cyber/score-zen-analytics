-- Versioned prediction metadata. The public result JSON remains backward
-- compatible; these fields are reserved for server-side quality monitoring.
ALTER TABLE public.ai_analyses
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS calibration_version TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'statistical_only',
  ADD COLUMN IF NOT EXISTS data_quality_level TEXT NOT NULL DEFAULT 'partial',
  ADD COLUMN IF NOT EXISTS data_quality_score SMALLINT,
  ADD COLUMN IF NOT EXISTS ai_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS available_sections TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unavailable_sections TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ai_analyses
  DROP CONSTRAINT IF EXISTS ai_analyses_ai_status_check,
  DROP CONSTRAINT IF EXISTS ai_analyses_data_quality_level_check,
  DROP CONSTRAINT IF EXISTS ai_analyses_data_quality_score_check,
  DROP CONSTRAINT IF EXISTS ai_analyses_ai_latency_check;

ALTER TABLE public.ai_analyses
  ADD CONSTRAINT ai_analyses_ai_status_check
    CHECK (ai_status IN ('ai_enriched', 'ai_fallback', 'statistical_only', 'no_recommendation')),
  ADD CONSTRAINT ai_analyses_data_quality_level_check
    CHECK (data_quality_level IN ('complete', 'partial', 'identity')),
  ADD CONSTRAINT ai_analyses_data_quality_score_check
    CHECK (data_quality_score IS NULL OR data_quality_score BETWEEN 0 AND 100),
  ADD CONSTRAINT ai_analyses_ai_latency_check
    CHECK (ai_latency_ms IS NULL OR ai_latency_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_engine_status
  ON public.ai_analyses(engine_version, ai_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_quality
  ON public.ai_analyses(data_quality_level, created_at DESC);

-- Replace the old six-argument function with an additive metadata argument.
-- Credit deduction and analysis insertion remain one atomic transaction.
DROP FUNCTION IF EXISTS public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.consume_analysis_credit(
  p_user_id UUID,
  p_cost INTEGER,
  p_home_team TEXT,
  p_away_team TEXT,
  p_match_id TEXT,
  p_result JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (analysis_id UUID, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_analysis_id UUID;
  v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF p_cost <= 0 OR p_home_team IS NULL OR p_away_team IS NULL OR p_result IS NULL THEN
    RAISE EXCEPTION 'INVALID_ANALYSIS_CREDIT_REQUEST';
  END IF;

  UPDATE public.profiles
  SET credits = credits - p_cost
  WHERE id = p_user_id AND credits >= p_cost
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.ai_analyses (
    user_id, home_team, away_team, match_id, result,
    engine_version, calibration_version, ai_status, data_quality_level,
    data_quality_score, ai_latency_ms, available_sections, unavailable_sections
  )
  VALUES (
    p_user_id,
    p_home_team,
    p_away_team,
    p_match_id,
    p_result,
    COALESCE(NULLIF(v_metadata->>'engineVersion', ''), 'v2.0.0'),
    COALESCE(NULLIF(v_metadata->>'calibrationVersion', ''), 'guarded-v1'),
    COALESCE(NULLIF(v_metadata->>'aiStatus', ''), 'statistical_only'),
    COALESCE(NULLIF(v_metadata->>'dataQualityLevel', ''), 'partial'),
    NULLIF(v_metadata->>'dataQualityScore', '')::SMALLINT,
    NULLIF(v_metadata->>'aiLatencyMs', '')::INTEGER,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_metadata->'availableSections', '[]'::jsonb))), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_metadata->'unavailableSections', '[]'::jsonb))), '{}')
  )
  RETURNING id INTO v_analysis_id;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (p_user_id, 'analysis', -p_cost, v_balance, 'Analyse ' || p_home_team || ' vs ' || p_away_team);

  RETURN QUERY SELECT v_analysis_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB) TO service_role;
