-- Idempotency for explicit analysis submissions.
-- Legacy analyses keep a NULL request_id; new submissions can safely be retried.
ALTER TABLE public.ai_analyses
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analyses_user_request
  ON public.ai_analyses(user_id, request_id)
  WHERE request_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.consume_analysis_credit(
  p_user_id UUID,
  p_cost INTEGER,
  p_home_team TEXT,
  p_away_team TEXT,
  p_match_id TEXT,
  p_result JSONB,
  p_request_id UUID DEFAULT NULL,
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

  -- A retry of the same explicit submission returns the original analysis.
  -- It never consumes a second credit and remains safe under concurrent calls.
  IF p_request_id IS NOT NULL THEN
    SELECT a.id, p.credits
    INTO v_analysis_id, v_balance
    FROM public.ai_analyses AS a
    JOIN public.profiles AS p ON p.id = a.user_id
    WHERE a.user_id = p_user_id AND a.request_id = p_request_id
    LIMIT 1;

    IF v_analysis_id IS NOT NULL THEN
      RETURN QUERY SELECT v_analysis_id, v_balance;
      RETURN;
    END IF;
  END IF;

  UPDATE public.profiles
  SET credits = credits - p_cost
  WHERE id = p_user_id AND credits >= p_cost
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.ai_analyses (
    user_id, home_team, away_team, match_id, request_id, result,
    engine_version, calibration_version, ai_status, data_quality_level,
    data_quality_score, ai_latency_ms, available_sections, unavailable_sections
  )
  VALUES (
    p_user_id,
    p_home_team,
    p_away_team,
    p_match_id,
    p_request_id,
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
EXCEPTION
  WHEN unique_violation THEN
    -- Two requests with the same request_id can race after the balance update.
    -- The unique index makes the second one return the already-created record.
    SELECT a.id, p.credits
    INTO v_analysis_id, v_balance
    FROM public.ai_analyses AS a
    JOIN public.profiles AS p ON p.id = a.user_id
    WHERE a.user_id = p_user_id AND a.request_id = p_request_id
    LIMIT 1;
    IF v_analysis_id IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_analysis_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB, UUID, JSONB) TO service_role;
