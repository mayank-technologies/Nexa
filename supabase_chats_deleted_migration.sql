-- Supabase Migration: Add Soft Delete / Recently Deleted Columns to Chats Table
-- Target: Supabase SQL Editor (https://supabase.com/dashboard/project/<your-project>/sql/new)

-- 1. Add is_deleted column
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add deleted_at column
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Add auto_delete_at column
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS auto_delete_at TIMESTAMP WITH TIME ZONE;

-- 4. Create index for deleted chats optimization
CREATE INDEX IF NOT EXISTS chats_deleted_idx 
ON public.chats(user_email, is_deleted, deleted_at DESC);

COMMENT ON COLUMN public.chats.is_deleted IS 'Indicates if the chat was soft-deleted.';
COMMENT ON COLUMN public.chats.deleted_at IS 'Timestamp of when the chat was moved to Recently Deleted.';
COMMENT ON COLUMN public.chats.auto_delete_at IS 'Timestamp after which the chat will be permanently deleted.';
