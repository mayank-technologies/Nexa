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
    detectSessionInUrl: true,
  }
});

console.log("Supabase URL:", SUPABASE_URL);

/**
 * Helper to identify whether a Supabase query error is due to missing tables or uninitialized schema cache.
 */
export function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const details = (error.details || "").toLowerCase();
  const hint = (error.hint || "").toLowerCase();
  const code = (error.code || "").toString().toUpperCase();
  return (
    code === "42P01" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "PGRST301" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    details.includes("schema cache") ||
    hint.includes("schema cache") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

/**
 * Helper to identify network connectivity issues or fetch failure exceptions from Supabase.
 */
export function isFetchOrNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === "string" ? error.toLowerCase() : (error.message || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetcherror") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    name.includes("typeerror") ||
    msg.includes("typeerror")
  );
}

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
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] 'users' table does not exist in Supabase yet or not found in schema cache. Please execute the SQL schema.");
      } else if (isFetchOrNetworkError(error)) {
        console.warn("[Nexa Supabase] Network connection to Supabase unavailable when syncing user profile:", error.message);
      } else {
        console.error("[Nexa Supabase] Error syncing user profile:", error.message);
      }
      return false;
    }

    console.log("[Nexa Supabase] Successfully synced user profile to Supabase!");
    return true;
  } catch (err: any) {
    if (isFetchOrNetworkError(err)) {
      console.warn("[Nexa Supabase] Network exception during user profile sync:", err?.message || err);
    } else {
      console.error("[Nexa Supabase] Unexpected error during profile sync:", err);
    }
    return false;
  }
}

/**
 * Sync a chat session metadata to Supabase.
 */
export async function syncChatToSupabase(chat: ChatSession, userEmail?: string, userId?: string): Promise<boolean> {
  if (!chat || !chat.id) return false;

  try {
    const effectiveEmail = (userEmail || chat.userEmail || "guest@nexa.ai").toLowerCase().trim();
    const effectiveUserId = userId || (chat as any).userId || "guest";

    console.log("[Nexa Supabase] Syncing chat session metadata:", chat.id, "User ID:", effectiveUserId, "Email:", effectiveEmail);
    const payload: any = {
      id: chat.id,
      user_id: effectiveUserId,
      title: chat.title || "Untitled Session",
      created_at: chat.createdAt || new Date().toISOString(),
      updated_at: chat.updatedAt || new Date().toISOString(),
      is_pinned: chat.isPinned || false,
      pin_order: chat.pinOrder !== undefined && chat.pinOrder !== null ? chat.pinOrder : null,
      mode: chat.mode || "general",
      selected_engine_id: chat.selectedEngineId || null,
      user_email: effectiveEmail
    };

    if (chat.isDeleted !== undefined) {
      payload.is_deleted = chat.isDeleted;
    }
    if (chat.deletedAt !== undefined) {
      payload.deleted_at = chat.deletedAt;
    }
    if (chat.autoDeleteAt !== undefined) {
      payload.auto_delete_at = chat.autoDeleteAt;
    }
    if ((chat as any).isArchived !== undefined) {
      payload.is_archived = (chat as any).isArchived;
    }
    if ((chat as any).isFavorite !== undefined) {
      payload.is_favorite = (chat as any).isFavorite;
    }

    let { error } = await supabase
      .from("chats")
      .upsert(payload, { onConflict: "id" });

    if (error && (error.code === "42703" || error.message?.includes("column"))) {
      console.warn("[Nexa Supabase] Column missing in schema. Retrying sync without optional columns...");
      const fallbackPayload = { ...payload };
      delete fallbackPayload.is_deleted;
      delete fallbackPayload.deleted_at;
      delete fallbackPayload.auto_delete_at;
      delete fallbackPayload.user_id;
      const { error: retryError } = await supabase
        .from("chats")
        .upsert(fallbackPayload, { onConflict: "id" });
      error = retryError;
    }

    // Mirror to conversations table if present
    try {
      await supabase.from("conversations").upsert(payload, { onConflict: "id" });
    } catch (e) {
      // Ignored if table does not exist
    }

    // Mirror to archived_conversations table if chat is archived
    if ((chat as any).isArchived) {
      try {
        const archivedPayload = {
          id: chat.id,
          user_id: effectiveUserId,
          chat_id: chat.id,
          archived_at: new Date().toISOString()
        };
        const { error: archErr } = await supabase.from("archived_conversations").upsert(archivedPayload, { onConflict: "id" });
        if (archErr) {
          console.warn("[Archive] archived_conversations upsert error:", archErr.message);
        } else {
          console.log("[Archive] Archived table updated for chat:", chat.id);
        }
      } catch (e) {
        console.warn("[Archive] archived_conversations mirror exception:", e);
      }
    } else {
      try {
        await supabase.from("archived_conversations").delete().eq("id", chat.id);
      } catch (e) {}
    }

    // If chat is soft-deleted, mirror to deleted_conversations and deleted_chats tables
    if (chat.isDeleted) {
      try {
        const delConvPayload = {
          id: chat.id,
          chat_id: chat.id,
          conversation_id: chat.id,
          user_id: effectiveUserId,
          user_email: effectiveEmail,
          title: chat.title || "Deleted Session",
          deleted_at: chat.deletedAt || new Date().toISOString(),
          created_at: chat.createdAt || new Date().toISOString(),
          updated_at: chat.updatedAt || new Date().toISOString(),
          is_deleted: true
        };
        const { error: delConvErr } = await supabase.from("deleted_conversations").upsert(delConvPayload, { onConflict: "id" });
        if (delConvErr) {
          console.warn("[Nexa Supabase] deleted_conversations upsert error:", delConvErr.message, "Retrying basic fallback...");
          const fbConv = await supabase.from("deleted_conversations").upsert({
            id: chat.id,
            chat_id: chat.id,
            user_id: effectiveUserId,
            user_email: effectiveEmail,
            title: chat.title || "Deleted Session",
            deleted_at: chat.deletedAt || new Date().toISOString(),
            is_deleted: true
          }, { onConflict: "id" });
          
          if (fbConv.error) {
            try {
              await supabase.from("deleted_conversations").insert({
                id: chat.id,
                title: chat.title || "Deleted Session",
                user_email: effectiveEmail
              });
            } catch (e) {}
          }
        } else {
          console.log("[Nexa Supabase] ✅ Soft-deleted chat synced to 'deleted_conversations' table:", chat.id);
        }
      } catch (e) {
        console.warn("[Nexa Supabase] deleted_conversations mirror exception:", e);
      }

      try {
        const delChatsPayload = {
          id: chat.id,
          chat_id: chat.id,
          user_id: effectiveUserId,
          user_email: effectiveEmail,
          title: chat.title || "Deleted Session",
          deleted_at: chat.deletedAt || new Date().toISOString(),
          is_deleted: true
        };
        const { error: delChatsErr } = await supabase.from("deleted_chats").upsert(delChatsPayload, { onConflict: "id" });
        if (delChatsErr) {
          console.warn("[Nexa Supabase] deleted_chats upsert error:", delChatsErr.message, "Retrying basic...");
          const fbChat = await supabase.from("deleted_chats").upsert({
            id: chat.id,
            title: chat.title || "Deleted Session",
            user_email: effectiveEmail
          }, { onConflict: "id" });
          if (fbChat.error) {
            try {
              await supabase.from("deleted_chats").insert({
                id: chat.id,
                title: chat.title || "Deleted Session",
                user_email: effectiveEmail
              });
            } catch (e) {}
          }
        } else {
          console.log("[Nexa Supabase] ✅ Soft-deleted chat synced to 'deleted_chats' table:", chat.id);
        }
      } catch (e) {
        console.warn("[Nexa Supabase] deleted_chats mirror exception:", e);
      }
    }

    // Sync all messages inside chat if present
    if (chat.messages && Array.isArray(chat.messages) && chat.messages.length > 0) {
      for (const msg of chat.messages) {
        try {
          await syncMessageToSupabase(chat.id, msg, effectiveUserId);
        } catch (mErr) {
          console.warn("[Nexa Supabase] Error syncing individual message during chat sync:", mErr);
        }
      }
    }

    if (error) {
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] 'chats' table does not exist in Supabase yet or not found in schema cache.");
      } else if (isFetchOrNetworkError(error)) {
        console.warn("[Nexa Supabase] Network connection to Supabase unavailable when syncing chat:", error.message);
      } else {
        console.error("[Nexa Supabase] Error syncing chat:", error.message);
      }
      return false;
    }

    console.log("[Nexa Supabase] Successfully synced chat to Supabase!");
    return true;
  } catch (err: any) {
    if (isFetchOrNetworkError(err)) {
      console.warn("[Nexa Supabase] Network exception during chat sync:", err?.message || err);
    } else {
      console.error("[Nexa Supabase] Unexpected error during chat sync:", err);
    }
    return false;
  }
}

/**
 * Sync an individual chat message to Supabase.
 */
export async function syncMessageToSupabase(chatId: string, message: Message, userId?: string): Promise<boolean> {
  console.log("INSIDE syncMessageToSupabase");
  console.log("==================================================");
  console.log("[Nexa Supabase DEBUG] 🚀 syncMessageToSupabase INVOCATION STARTED");
  console.log("[Nexa Supabase DEBUG] Target Chat ID:", chatId);
  console.log("[Nexa Supabase DEBUG] Target User ID:", userId);
  console.log("[Nexa Supabase DEBUG] Message ID:", message?.id, "Role:", message?.role);

  if (!chatId || !message || !message.id) {
    console.warn("⚠️ [Nexa Supabase DEBUG] ABORTED: Missing required parameters (chatId, message, or message.id)", { chatId, message });
    return false;
  }

  try {
    const effectiveUserId = userId || "guest";

    // Proactively ensure parent chat exists in 'chats' and 'conversations' tables
    try {
      const parentPayload = {
        id: chatId,
        user_id: effectiveUserId,
        title: "Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_email: "guest@nexa.ai"
      };
      await supabase.from("chats").upsert(parentPayload, { onConflict: "id" });
      try {
        await supabase.from("conversations").upsert(parentPayload, { onConflict: "id" });
      } catch (e) {}
    } catch (e) {
      console.warn("[Nexa Supabase] Non-blocking parent chat pre-upsert warning:", e);
    }

    const payload: any = {
      id: message.id,
      chat_id: chatId,
      conversation_id: chatId,
      user_id: effectiveUserId,
      user_email: "guest@nexa.ai",
      role: message.role,
      content: message.content || "",
      timestamp: message.timestamp || new Date().toISOString(),
      created_at: message.timestamp || new Date().toISOString(),
      engine_id: message.engineId || null,
      sources: message.sources ? JSON.parse(JSON.stringify(message.sources)) : null,
      fact_check: message.factCheck ? JSON.parse(JSON.stringify(message.factCheck)) : null,
      research_report: message.researchReport ? JSON.parse(JSON.stringify(message.researchReport)) : null,
      quiz: message.quiz ? JSON.parse(JSON.stringify(message.quiz)) : null,
      attachment: message.attachment ? JSON.parse(JSON.stringify(message.attachment)) : null,
      reaction: message.reaction || null
    };

    console.log("[Nexa Supabase DEBUG] 📦 EXACT PAYLOAD BEING SENT TO SUPABASE:");
    console.log(JSON.stringify(payload, null, 2));

    let response = await supabase
      .from("messages")
      .upsert(payload, { onConflict: "id" })
      .select();

    console.log("AFTER upsert", response.data, response.error);

    let finalError = response.error;

    if (finalError) {
      console.warn("⚠️ [Nexa Supabase WARNING] Initial message upsert failed, code:", finalError.code, "msg:", finalError.message);

      // Fallback 1: Standard payload without complex JSON metadata
      const stdPayload: any = {
        id: message.id,
        chat_id: chatId,
        conversation_id: chatId,
        user_id: effectiveUserId,
        user_email: "guest@nexa.ai",
        role: message.role,
        content: message.content || "",
        timestamp: message.timestamp || new Date().toISOString(),
        created_at: message.timestamp || new Date().toISOString()
      };
      let fb = await supabase.from("messages").upsert(stdPayload, { onConflict: "id" }).select();
      if (!fb.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Message inserted with standard payload!");
        return true;
      }

      // Fallback 2: Basic payload with user_id and timestamp
      const basicPayload: any = {
        id: message.id,
        chat_id: chatId,
        user_id: effectiveUserId,
        role: message.role,
        content: message.content || "",
        timestamp: message.timestamp || new Date().toISOString()
      };
      fb = await supabase.from("messages").upsert(basicPayload, { onConflict: "id" }).select();
      if (!fb.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Basic fallback message inserted successfully!");
        return true;
      }

      // Fallback 3: Basic payload with created_at instead of timestamp
      const basicCreatedAtPayload: any = {
        id: message.id,
        chat_id: chatId,
        user_id: effectiveUserId,
        role: message.role,
        content: message.content || "",
        created_at: message.timestamp || new Date().toISOString()
      };
      fb = await supabase.from("messages").upsert(basicCreatedAtPayload, { onConflict: "id" }).select();
      if (!fb.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Basic created_at message inserted successfully!");
        return true;
      }

      // Fallback 4: Minimal payload with chat_id
      const minimalPayload: any = {
        id: message.id,
        chat_id: chatId,
        role: message.role,
        content: message.content || ""
      };
      fb = await supabase.from("messages").upsert(minimalPayload, { onConflict: "id" }).select();
      if (!fb.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Minimal fallback message inserted successfully!");
        return true;
      }

      // Fallback 5: Minimal payload with conversation_id
      const convMinPayload: any = {
        id: message.id,
        conversation_id: chatId,
        role: message.role,
        content: message.content || ""
      };
      fb = await supabase.from("messages").upsert(convMinPayload, { onConflict: "id" }).select();
      if (!fb.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Conversation_id minimal message inserted successfully!");
        return true;
      }

      // Fallback 6: Direct insert
      const directInsert = await supabase.from("messages").insert(minimalPayload).select();
      if (!directInsert.error) {
        console.log("✅ [Nexa Supabase SUCCESS] Direct insert message succeeded!");
        return true;
      }

      console.error("❌ [Nexa Supabase FINAL ERROR] Unable to insert message into 'messages' table:", finalError?.message);
      return false;
    }

    console.log("✅ [Nexa Supabase SUCCESS] Message inserted/upserted into 'messages' table!");
    return true;
  } catch (err: any) {
    console.error("❌ [Nexa Supabase UNCAUGHT EXCEPTION] Exception during message sync:", err);
    return false;
  }
}

/**
 * Sync waitlist join entry to Supabase.
 * Checks for duplicates, inserts safely, and calculates the waitlist position in real time.
 */
export async function syncWaitlistToSupabase(entry: {
  email: string;
  uid?: string;
  userId?: string;
  timestamp: string;
  source: string;
  fullName?: string;
  plan?: string;
}): Promise<{ success: boolean; alreadyExists?: boolean; position?: number; entry?: any; error?: any }> {
  if (!entry || !entry.email) {
    return { success: false, error: { message: "Invalid waitlist entry input." } };
  }

  try {
    const normalizedEmail = entry.email.toLowerCase().trim();
    console.log("[Nexa Supabase] Syncing premium waitlist entry for:", normalizedEmail);
    
    // 1. Check if email already exists in the waitlist table
    const { data: existing, error: checkError } = await supabase
      .from("waitlist")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116" && checkError.code !== "42P01") {
      console.error("[Nexa Supabase] Check error:", checkError);
      return { success: false, error: checkError };
    }

    if (existing) {
      console.log("[Nexa Supabase] Email already exists in waitlist. Calculating position...");
      const { count, error: countError } = await supabase
        .from("waitlist")
        .select("*", { count: "exact", head: true })
        .lte("created_at", existing.created_at);

      if (countError) {
        console.error("[Nexa Supabase] Count error for existing:", countError);
      }

      return {
        success: true,
        alreadyExists: true,
        position: count !== null ? count : 1,
        entry: existing
      };
    }

    // 2. Insert new entry and return all values (including id, created_at generated automatically)
    const { data: insertData, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        email: normalizedEmail,
        full_name: entry.fullName || "Nexa User",
        plan: entry.plan || "Premium"
      })
      .select("*");

    if (insertError) {
      console.error("[Nexa Supabase] Insert error caught:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return { success: false, error: insertError };
    }

    const newRow = insertData?.[0];
    if (!newRow) {
      return { success: false, error: { message: "Failed to retrieve inserted waitlist entry." } };
    }

    console.log("[Nexa Supabase] Successfully inserted new waitlist entry:", newRow);

    // 3. Calculate position (how many rows have created_at <= newRow.created_at)
    const { count, error: countError } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .lte("created_at", newRow.created_at);

    if (countError) {
      console.error("[Nexa Supabase] Count error for new row:", countError);
    }

    return {
      success: true,
      alreadyExists: false,
      position: count !== null ? count : 1,
      entry: newRow
    };

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
    user_email TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    auto_delete_at TIMESTAMP WITH TIME ZONE
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

-- 4. Create Deleted Conversations Table
CREATE TABLE IF NOT EXISTS public.deleted_conversations (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    user_id TEXT,
    user_email TEXT,
    title TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT TRUE
);

-- 5. Create Deleted Chats Table
CREATE TABLE IF NOT EXISTS public.deleted_chats (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    user_id TEXT,
    user_email TEXT,
    title TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_deleted BOOLEAN DEFAULT TRUE
);

-- 6. Create Waitlist Table (Updated)
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
alter publication supabase_realtime add table public.deleted_conversations;
alter publication supabase_realtime add table public.deleted_chats;
alter publication supabase_realtime add table public.waitlist;

-- Set up Row Level Security (RLS) Rules (Optional - or disable RLS for direct client operations)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write access for all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.deleted_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.deleted_chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write access for all" ON public.waitlist FOR ALL USING (true) WITH CHECK (true);
`;

/**
 * Fetch all chat summaries from Supabase for a specific user ID or user email (excluding deleted chats)
 */
export async function fetchChatsFromSupabase(userEmail: string, userId?: string): Promise<ChatSession[]> {
  try {
    const normalizedEmail = (userEmail || "").toLowerCase().trim();
    console.log("[Nexa Supabase] Fetching active chats for email:", normalizedEmail, "userId:", userId);
    
    console.log("[ARCHIVE FETCH DEBUG] fetching archived chats");
    console.log("[ARCHIVE FETCH DEBUG] current Supabase user:", userId);

    const archivedChatIds = new Set<string>();
    if (userId) {
      const { data: archData, error: archError } = await supabase
        .from("archived_conversations")
        .select("chat_id, user_id")
        .eq("user_id", userId);

      console.log("[ARCHIVE FETCH DEBUG] data:", archData);
      console.log("[ARCHIVE FETCH DEBUG] error:", archError);

      if (archData && !archError) {
        archData.forEach((row: any) => {
          if (row.chat_id) archivedChatIds.add(row.chat_id);
          if (row.id) archivedChatIds.add(row.id);
        });
      }
    }

    let query = supabase.from("chats").select("*");

    if (userId && normalizedEmail) {
      query = query.or(`user_id.eq.${userId},user_email.ilike.${normalizedEmail},user_email.eq.${normalizedEmail}`);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else if (normalizedEmail) {
      query = query.or(`user_email.ilike.${normalizedEmail},user_email.eq.${normalizedEmail}`);
    } else {
      return [];
    }

    let { data, error } = await query
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false });

    // Fallback if is_deleted column or OR query filter fails
    if (error) {
      console.warn("[Nexa Supabase] Query with is_deleted filter failed, attempting fallback query. Error:", error.message);
      let fallbackQuery = supabase.from("chats").select("*");
      if (userId) {
        fallbackQuery = fallbackQuery.eq("user_id", userId);
      } else if (normalizedEmail) {
        fallbackQuery = fallbackQuery.eq("user_email", normalizedEmail);
      } else {
        return [];
      }
      const { data: fallbackData, error: fallbackError } = await fallbackQuery.order("updated_at", { ascending: false });
      if (fallbackError) {
        if (!isMissingTableError(fallbackError)) {
          console.error("[Nexa Supabase] Fallback fetch error:", fallbackError.message);
        }
        return [];
      }
      data = fallbackData;
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isPinned: row.is_pinned || false,
      isArchived: row.is_archived || archivedChatIds.has(row.id) || false,
      isFavorite: row.is_favorite || false,
      pinOrder: row.pin_order,
      mode: row.mode || "general",
      selectedEngineId: row.selected_engine_id,
      userEmail: row.user_email,
      userId: row.user_id,
      isDeleted: row.is_deleted || false,
      deletedAt: row.deleted_at,
      autoDeleteAt: row.auto_delete_at,
      messages: [] // loaded separately or via fetchAllChatsWithMessagesFromSupabase
    })) as ChatSession[];
  } catch (err) {
    console.error("[Nexa Supabase] Failed to fetch chats:", err);
    return [];
  }
}

/**
 * Fetch all deleted chat summaries from Supabase for a specific user ID or user email
 */
export async function fetchDeletedChatsFromSupabase(userEmail: string, userId?: string): Promise<ChatSession[]> {
  try {
    const normalizedEmail = (userEmail || "").toLowerCase().trim();
    console.log("[Nexa Supabase] Fetching deleted chats for email:", normalizedEmail, "userId:", userId);
    
    let resultsMap: Record<string, ChatSession> = {};

    let query = supabase.from("chats").select("*");

    if (userId && normalizedEmail) {
      query = query.or(`user_id.eq.${userId},user_email.ilike.${normalizedEmail},user_email.eq.${normalizedEmail}`);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else if (normalizedEmail) {
      query = query.or(`user_email.ilike.${normalizedEmail},user_email.eq.${normalizedEmail}`);
    }

    const { data, error } = await query
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    if (!error && data && data.length > 0) {
      for (const row of data) {
        resultsMap[row.id] = {
          id: row.id,
          title: row.title || "Deleted Session",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isPinned: row.is_pinned || false,
          pinOrder: row.pin_order,
          mode: row.mode || "general",
          selectedEngineId: row.selected_engine_id,
          userEmail: row.user_email,
          isDeleted: true,
          deletedAt: row.deleted_at,
          autoDeleteAt: row.auto_delete_at,
          messages: []
        };
      }
    }

    // Secondary fetch from deleted_conversations
    try {
      const { data: delConvData } = await supabase.from("deleted_conversations").select("*");
      if (delConvData && delConvData.length > 0) {
        for (const row of delConvData) {
          const id = row.id || row.chat_id || row.conversation_id;
          if (id && !resultsMap[id]) {
            resultsMap[id] = {
              id: id,
              title: row.title || "Deleted Session",
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
              isPinned: false,
              mode: "general",
              userEmail: row.user_email || normalizedEmail,
              isDeleted: true,
              deletedAt: row.deleted_at || new Date().toISOString(),
              messages: []
            };
          }
        }
      }
    } catch (e) {}

    // Secondary fetch from deleted_chats
    try {
      const { data: delChatsData } = await supabase.from("deleted_chats").select("*");
      if (delChatsData && delChatsData.length > 0) {
        for (const row of delChatsData) {
          const id = row.id || row.chat_id;
          if (id && !resultsMap[id]) {
            resultsMap[id] = {
              id: id,
              title: row.title || "Deleted Session",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isPinned: false,
              mode: "general",
              userEmail: row.user_email || normalizedEmail,
              isDeleted: true,
              deletedAt: row.deleted_at || new Date().toISOString(),
              messages: []
            };
          }
        }
      }
    } catch (e) {}

    return Object.values(resultsMap);
  } catch (err) {
    console.error("[Nexa Supabase] Failed to fetch deleted chats:", err);
    return [];
  }
}

/**
 * Fetch all active chats AND their messages for a specific user from Supabase
 */
export async function fetchAllChatsWithMessagesFromSupabase(userEmail: string, userId?: string): Promise<ChatSession[]> {
  try {
    const chats = await fetchChatsFromSupabase(userEmail, userId);
    if (!chats || chats.length === 0) return [];

    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        try {
          const msgs = await fetchMessagesFromSupabase(chat.id);
          return {
            ...chat,
            messages: msgs
          };
        } catch (err) {
          console.error("[Nexa Supabase] Failed to load messages for chat:", chat.id, err);
          return chat;
        }
      })
    );

    return chatsWithMessages;
  } catch (err) {
    console.error("[Nexa Supabase] Failed to fetch all chats with messages:", err);
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
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] 'messages' table does not exist or not found in schema cache.");
      } else if (isFetchOrNetworkError(error)) {
        console.warn("[Nexa Supabase] Network connection to Supabase unavailable when fetching messages. Falling back to local state:", error.message);
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
  } catch (err: any) {
    if (isFetchOrNetworkError(err)) {
      console.warn("[Nexa Supabase] Network/Supabase fetch exception when fetching messages:", err?.message || err);
    } else {
      console.error("[Nexa Supabase] Failed to fetch messages:", err);
    }
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
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] Table does not exist or not found in schema cache.");
      } else {
        console.error("[Nexa Supabase] Error deleting chat from Supabase:", error.message);
      }
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
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] Table does not exist or not found in schema cache.");
      } else {
        console.error("[Nexa Supabase] Error deleting message from Supabase:", error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Nexa Supabase] Failed to delete message from Supabase:", err);
    return false;
  }
}

