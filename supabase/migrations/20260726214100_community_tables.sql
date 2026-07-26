-- Create community_messages table
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'Fan',
  user_avatar TEXT,
  message TEXT NOT NULL,
  match_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for community_messages
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read messages
CREATE POLICY "Anyone can read community_messages" ON public.community_messages
  FOR SELECT USING (true);

-- Allow authenticated users to insert messages
CREATE POLICY "Authenticated users can post community_messages" ON public.community_messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create community_predictions table
CREATE TABLE IF NOT EXISTS public.community_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT 'Fan',
  fixture_id INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  prediction TEXT NOT NULL CHECK (prediction IN ('home', 'draw', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fixture_id)
);

-- Enable RLS for community_predictions
ALTER TABLE public.community_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read predictions
CREATE POLICY "Anyone can read community_predictions" ON public.community_predictions
  FOR SELECT USING (true);

-- Allow authenticated users to vote/predict once per match
CREATE POLICY "Authenticated users can place community_predictions" ON public.community_predictions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their community_predictions" ON public.community_predictions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_predictions;
