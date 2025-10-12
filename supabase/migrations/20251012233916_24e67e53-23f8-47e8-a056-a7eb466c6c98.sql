-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, function_name, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limits
CREATE POLICY "Users can view their own rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own rate limits
CREATE POLICY "Users can insert their own rate limits"
ON public.rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own rate limits
CREATE POLICY "Users can update their own rate limits"
ON public.rate_limits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Auto-delete old rate limit entries (older than 1 hour)
CREATE INDEX idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- Function to clean up old rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < (now() - interval '1 hour');
END;
$$;