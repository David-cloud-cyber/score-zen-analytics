CREATE INDEX IF NOT EXISTS idx_community_messages_created_at
  ON public.community_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_messages_user_created_at
  ON public.community_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_predictions_fixture_created_at
  ON public.community_predictions (fixture_id, created_at DESC);
