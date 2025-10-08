-- Create sessions table to store conversation sessions
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Session metadata
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  voice TEXT NOT NULL,
  bot_prompt TEXT NOT NULL,
  
  -- Pricing configuration
  pricing_config JSONB NOT NULL,
  
  -- Session data
  session_stats JSONB NOT NULL,
  timeline_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_data_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Session timing
  session_start_time BIGINT,
  session_end_time BIGINT,
  duration_ms BIGINT
);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (public access)
CREATE POLICY "Allow all operations on sessions" 
ON public.sessions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index on created_at for faster sorting
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_sessions_updated_at();