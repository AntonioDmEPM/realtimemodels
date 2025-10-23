-- Fix critical RLS policy gaps identified in security scan

-- 1. Add INSERT policy for profiles to prevent unauthorized profile creation
-- Note: Profiles are created via trigger on auth.users, but we need explicit policy
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Add DELETE policy for profiles (GDPR compliance - right to be forgotten)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- 3. Add DELETE policy for rate_limits (complete CRUD operations)
CREATE POLICY "Users can delete their own rate limits"
ON public.rate_limits
FOR DELETE
USING (auth.uid() = user_id);

-- 4. Add UPDATE policy for document_chunks (complete CRUD operations)
CREATE POLICY "Users can update chunks from their documents"
ON public.document_chunks
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.documents
  WHERE documents.id = document_chunks.document_id
  AND documents.user_id = auth.uid()
));