/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, ChatSession, Message } from "../types";

// Dynamic loading of environment variables with absolute fallback to the user's provided credentials
const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || "https://pfblkhotgrsabagnyxgn.supabase.co").trim();
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_hhuGx6O2DN3KjivIi7CNMA_q9c9woiT").trim();

console.log("[Nexa Supabase] Initializing client with URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Interface representing the integration health and table checks
 */
export interface SupabaseHealthStatus {
  connected: boolean;
  message: string;
  error?: string;
  tables: {
    users: boolean;
    chats: boolean;
    messages: boolean;
    waitlist: boolean;
  };
}

/**
 * Direct check of Supabase database table availability and credentials.
 * Runs queries on each table to verify if the tables exist and the RLS or anon key has read permission.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const status: SupabaseHealthStatus = {
    connected: false,
    message: "Initializing connection checks...",
    tables: {
      users: false,
      chats: false,
      messages: false,
      waitlist: false,
    }
  };

  try {
    // 1. Check basic client connectivity by attempting to fetch something or checking domain
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      status.message = "Supabase configuration missing.";
      return status;
    }

    // 2. Test 'users' table
    const { error: usersError } = await supabase.from("users").select("id").limit(1);
    status.tables.users = !usersError || (usersError.code !== "PGRST116" && usersError.code !== "42P01");

    // 3. Test 'chats' table
    const { error: chatsError } = await supabase.from("chats").select("id").limit(1);
    status.tables.chats = !chatsError || (chatsError.code !== "PGRST116" && chatsError.code !== "42P01");

    // 4. Test 'messages' table
    const { error: messagesError } = await supabase.from("messages").select("id").limit(1);
    status.tables.messages = !messagesError || (messagesError.code !== "PGRST116" && messagesError.code !== "42P01");

    // 5. Test 'waitlist' table
    const { error: waitlistError } = await supabase.from("waitlist").select("email").limit(1);
    status.tables.waitlist = !waitlistError || (waitlistError.code !== "PGRST116" && waitlistError.code !== "42P01");

    // Connection is considered active if we didn't receive a connection/network-level exception
    status.connected = true;
    status.message = "Supabase API Connection online. Some tables may require schema creation.";
  } catch (err: any) {
    status.connected = false;
    status.message = "Failed to connect to Supabase database.";
    status.error = err.message || String(err);
  }

  return status;
}

/**
 * Sync user profile details to Supabase.
 * Checks for table existence first and gracefully logs if schema has not yet been initialized.
 */
export async function syncUserProfileToSupabase(profile: UserProfile): Promise<boolean> {
  if (!profile || profile.isGuest || !profile.uid) {
    return false;
  }

  try {
    console.log("[Nexa Supabase] Syncing user profile for:", profile.email);
    const { error } = await supabase
      .from("users")
      .upsert({
        id: profile.uid,
        email: profile.email,
        full_name: profile.fullName,
        is_guest: false,
        avatar_url: profile.avatarUrl || null,
        preferences: profile.preferences || null,
        gamification: profile.gamification || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (error) {
      if (error.code === "42P01") {
        console.warn("[Nexa Supabase] 'users' table does not exist in Supabase yet. Please execute the SQL schema.");
      } else {
        console.error("[Nexa Supabase] Error syncing user profile:", error.message);
      }
      return false;
    }

    console.log("[Nexa Supabase] Successfully synced user profile to Supabase!");
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Unexpected error during profile sync:", err);
    return false;
  }
}

/**
 * Sync a chat session metadata to Supabase.
 */
export async function syncChatToSupabase(chat: ChatSession, userEmail?: string): Promise<boolean> {
  if (!chat || !chat.id) return false;

  try {
    console.log("[Nexa Supabase] Syncing chat session metadata:", chat.id);
    const { error } = await supabase
      .from("chats")
      .upsert({
        id: chat.id,
        user_id: chat.messages?.[0] ? undefined : undefined, // Can optionally map to current active user if tables support it
        title: chat.title || "Untitled Session",
        created_at: chat.createdAt || new Date().toISOString(),
        updated_at: chat.updatedAt || new Date().toISOString(),
        is_pinned: chat.isPinned || false,
        pin_order: chat.pinOrder || null,
        mode: chat.mode || "general",
        selected_engine_id: chat.selectedEngineId || null,
        user_email: userEmail || chat.userEmail || null
      }, { onConflict: "id" });

    if (error) {
      if (error.code === "42P01") {
        console.warn("[Nexa Supabase] 'chats' table does not exist in Supabase yet. Please execute the SQL schema.");
      } else {
        console.error("[Nexa Supabase] Error syncing chat:", error.message);
      }
      return false;
    }

    console.log("[Nexa Supabase] Successfully synced chat to Supabase!");
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Unexpected error during chat sync:", err);
    return false;
  }
}

/**
 * Sync an individual chat message to Supabase.
 */
export async function syncMessageToSupabase(chatId: string, message: Message): Promise<boolean> {
  if (!chatId || !message || !message.id) return false;

  try {
    console.log("[Nexa Supabase] Syncing message:", message.id);
    const { error } = await supabase
      .from("messages")
      .upsert({
        id: message.id,
        chat_id: chatId,
        role: message.role,
        content: message.content || "",
        timestamp: message.timestamp || new Date().toISOString(),
        engine_id: message.engineId || null,
        sources: message.sources || null,
        fact_check: message.factCheck || null,
        research_report: message.researchReport || null,
        quiz: message.quiz || null,
        attachment: message.attachment || null,
        reaction: message.reaction || null
      }, { onConflict: "id" });

    if (error) {
      if (error.code === "42P01") {
        console.warn("[Nexa Supabase] 'messages' table does not exist in Supabase yet.");
      } else {
        console.error("[Nexa Supabase] Error syncing message:", error.message);
      }
      return false;
    }

    console.log("[Nexa Supabase] Successfully synced message to Supabase!");
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Unexpected error during message sync:", err);
    return false;
  }
}

/**
 * Sync waitlist join entry to Supabase.
 */
export async function syncWaitlistToSupabase(entry: {
  email: string;
  uid?: string;
  userId?: string;
  timestamp: string;
  source: string;
  fullName?: string;
  plan?: string;
}): Promise<{ success: boolean; error?: any }> {
  if (!entry || !entry.email) {
    return { success: false, error: { message: "Invalid waitlist entry input." } };
  }

  try {
    console.log("[Nexa Supabase] Syncing premium waitlist entry for:", entry.email);
    
    // We do NOT insert "id" or "created_at"; let Supabase generate them automatically.
    // Insert with exactly: email, full_name, plan
    const { error } = await supabase
      .from("waitlist")
      .insert({
        email: entry.email.toLowerCase().trim(),
        full_name: entry.fullName || "Nexa User",
        plan: entry.plan || "Premium"
      });

    if (error) {
      console.error("[Nexa Supabase] Detailed Supabase Error caught:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { success: false, error };
    }

    console.log("[Nexa Supabase] Successfully synced waitlist entry to Supabase!");
    return { success: true };
  } catch (err: any) {
    console.error("[Nexa Supabase] Unexpected error during waitlist sync:", err);
    return { success: false, error: err };
  }
}

/**
 * Diagnostic helper SQL script to copy-paste into the Supabase SQL editor.
 */
export const SUPABASE_SQL_SCHEMA = `-- Nexa Supabase Database Schema
-- Execute this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/pfblkhotgrsabagnyxgn/sql/new)

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    preferences JSONB,
    gamification JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create Chats Table
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN DEFAULT FALSE,
    pin_order INTEGER,
    mode TEXT DEFAULT 'general',
    selected_engine_id TEXT,
    user_email TEXT
);

-- 3. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    engine_id TEXT,
    sources JSONB,
    fact_check JSONB,
    research_report JSONB,
    quiz JSONB,
    attachment JSONB,
    reaction TEXT
);

-- 4. Create Waitlist Table (Updated)
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL CONSTRAINT unique_waitlist_email UNIQUE,
    full_name TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Realtime for dynamic state updates (Optional)
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.waitlist;

-- Set up Row Level Security (RLS) Rules (Optional - or disable RLS for direct client operations)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write access for all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.waitlist FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Fetch all chat summaries from Supabase for a specific user email
 */
export async function fetchChatsFromSupabase(userEmail: string): Promise<ChatSession[]> {
  try {
    console.log("[Nexa Supabase] Fetching chats for:", userEmail);
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_email", userEmail.toLowerCase().trim())
      .order("updated_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        console.warn("[Nexa Supabase] 'chats' table does not exist. Returning empty.");
      } else {
        console.error("[Nexa Supabase] Error fetching chats:", error.message);
      }
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isPinned: row.is_pinned || false,
      pinOrder: row.pin_order,
      mode: row.mode || "general",
      selectedEngineId: row.selected_engine_id,
      userEmail: row.user_email,
      messages: [] // loaded separately
    })) as ChatSession[];
  } catch (err) {
    console.error("[Nexa Supabase] Failed to fetch chats:", err);
    return [];
  }
}

/**
 * Fetch all messages for a specific chat ID from Supabase
 */
export async function fetchMessagesFromSupabase(chatId: string): Promise<Message[]> {
  try {
    console.log("[Nexa Supabase] Fetching messages for chat:", chatId);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true });

    if (error) {
      if (error.code === "42P01") {
        console.warn("[Nexa Supabase] 'messages' table does not exist.");
      } else {
        console.error("[Nexa Supabase] Error fetching messages:", error.message);
      }
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      engineId: row.engine_id,
      sources: row.sources,
      factCheck: row.fact_check,
      researchReport: row.research_report,
      quiz: row.quiz,
      attachment: row.attachment,
      reaction: row.reaction
    })) as Message[];
  } catch (err) {
    console.error("[Nexa Supabase] Failed to fetch messages:", err);
    return [];
  }
}

/**
 * Delete a chat session completely from Supabase
 */
export async function deleteChatFromSupabase(chatId: string): Promise<boolean> {
  try {
    console.log("[Nexa Supabase] Deleting chat:", chatId);
    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId);

    if (error) {
      console.error("[Nexa Supabase] Error deleting chat from Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Failed to delete chat from Supabase:", err);
    return false;
  }
}

/**
 * Delete a single message from Supabase
 */
export async function deleteMessageFromSupabase(messageId: string): Promise<boolean> {
  try {
    console.log("[Nexa Supabase] Deleting message:", messageId);
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("[Nexa Supabase] Error deleting message from Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Failed to delete message from Supabase:", err);
    return false;
  }
}

