CREATE TABLE public.shot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mode TEXT NOT NULL,
  model_id TEXT,
  model_label TEXT,
  ball_id TEXT NOT NULL,
  mass DOUBLE PRECISION NOT NULL,
  angle_deg DOUBLE PRECISION NOT NULL,
  power DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL,
  gravity DOUBLE PRECISION NOT NULL,
  target_distance DOUBLE PRECISION NOT NULL,
  impact_x DOUBLE PRECISION NOT NULL,
  error DOUBLE PRECISION NOT NULL,
  hit BOOLEAN NOT NULL,
  flight_time DOUBLE PRECISION NOT NULL,
  auto BOOLEAN NOT NULL DEFAULT false
);

GRANT SELECT, INSERT ON public.shot_logs TO anon;
GRANT SELECT, INSERT ON public.shot_logs TO authenticated;
GRANT ALL ON public.shot_logs TO service_role;

ALTER TABLE public.shot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shot logs" ON public.shot_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can add shot logs" ON public.shot_logs FOR INSERT WITH CHECK (true);

CREATE INDEX shot_logs_created_at_idx ON public.shot_logs (created_at DESC);