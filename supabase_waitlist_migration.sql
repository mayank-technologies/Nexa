-- Supabase Migration: Recreate Waitlist Table with correct schema
-- Target: Supabase SQL Editor (https://supabase.com/dashboard/project/pfblkhotgrsabagnyxgn/sql/new)

-- 1. Safely remove the old waitlist table and any dependencies
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- 2. Create the Waitlist Table with required schema
CREATE TABLE public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL CONSTRAINT unique_waitlist_email UNIQUE,
    full_name TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 4. Create public read/write access policy
CREATE POLICY "Allow public read and write access for all" 
ON public.waitlist 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Enable Realtime for the waitlist table
alter publication supabase_realtime add table public.waitlist;

-- Log schema update confirmation
COMMENT ON TABLE public.waitlist IS 'Premium Waitlist table with automated gen_random_uuid IDs, unique emails, full_name, plan, and RLS policies.';
