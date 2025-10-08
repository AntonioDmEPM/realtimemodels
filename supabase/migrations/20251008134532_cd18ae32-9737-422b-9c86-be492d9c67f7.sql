-- Step 1: Add user_id column as nullable first
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Delete existing sessions without user_id (they're from before auth was implemented)
DELETE FROM public.sessions WHERE user_id IS NULL;

-- Step 3: Now make user_id required for all future sessions
ALTER TABLE public.sessions 
ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on sessions" ON public.sessions;

-- Step 5: Create proper RLS policies that restrict access to session owners
CREATE POLICY "Users can view their own sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 6: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);