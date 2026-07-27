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
export async function syncChatToSupabase(chat: ChatSession, userEmail?: string, userId?: string): Promise<boolean> {
  if (!chat || !chat.id) return false;

  try {
    const effectiveEmail = (userEmail || chat.userEmail || "").toLowerCase().trim() || null;
    const effectiveUserId = userId || (chat as any).userId || null;

    console.log("[Nexa Supabase] Syncing chat session metadata:", chat.id, "User ID:", effectiveUserId, "Email:", effectiveEmail);
    const payload: any = {
      id: chat.id,
      user_id: effectiveUserId,
      title: chat.title || "Untitled Session",
      created_at: chat.createdAt || new Date().toISOString(),
      updated_at: chat.updatedAt || new Date().toISOString(),
      is_pinned: chat.isPinned || false,
      pin_order: chat.pinOrder || null,
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

    if (error) {
      if (isMissingTableError(error)) {
        console.warn("[Nexa Supabase] 'chats' table does not exist in Supabase yet or not found in schema cache.");
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
export async function syncMessageToSupabase(chatId: string, message: Message, userId?: string): Promise<boolean> {
  console.log("==================================================");
  console.log("[Nexa Supabase DEBUG] 🚀 syncMessageToSupabase INVOCATION STARTED");
  console.log("[Nexa Supabase DEBUG] Target Chat ID:", chatId);
  console.log("[Nexa Supabase DEBUG] Target User ID:", userId);
  console.log("[Nexa Supabase DEBUG] Message ID:", message?.id, "Role:", message?.role);

  if (!chatId || !message || !message.id) {
    console.warn("⚠️ [Nexa Supabase DEBUG] ABORTED: Missing required parameters (chatId, message, or message.id)", { chatId, message });
    console.log("==================================================");
    return false;
  }

  try {
    const payload: any = {
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
    };

    if (userId) {
      payload.user_id = userId;
    }

    console.log("[Nexa Supabase DEBUG] 📦 EXACT PAYLOAD BEING SENT TO SUPABASE:");
    console.log(JSON.stringify(payload, null, 2));

    console.log("[Nexa Supabase DEBUG] ⚡ EXECUTING: supabase.from('messages').upsert(payload, { onConflict: 'id' }).select()");
    
    const response = await supabase
      .from("messages")
      .upsert(payload, { onConflict: "id" })
      .select();

    console.log("[Nexa Supabase DEBUG] 📥 SUPABASE QUERY RESPONSE:");
    console.log("   Status:", response.status, "Status Text:", response.statusText);
    console.log("   Data Returned:", JSON.stringify(response.data, null, 2));
    console.log("   Error Returned:", response.error);

    let finalError = response.error;

    if (finalError) {
      console.error("❌ [Nexa Supabase ERROR] Message Upsert Failed!");
      console.error("   error.code:", finalError.code);
      console.error("   error.message:", finalError.message);
      console.error("   error.details:", finalError.details);
      console.error("   error.hint:", finalError.hint);

      // Handle Foreign Key Constraint Violation (Code 23503)
      if (finalError.code === "23503" || finalError.message?.includes("foreign key") || finalError.message?.includes("violates foreign key constraint")) {
        console.warn("🔄 [Nexa Supabase DEBUG] Foreign key error detected. Auto-creating parent conversation record...");
        
        const parentPayload = {
          id: chatId,
          user_id: userId || null,
          title: "New Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const chatParentRes = await supabase.from("chats").upsert(parentPayload, { onConflict: "id" }).select();
        console.log("[Nexa Supabase DEBUG] Parent 'chats' upsert response:", chatParentRes);

        try {
          const convParentRes = await supabase.from("conversations").upsert(parentPayload, { onConflict: "id" }).select();
          console.log("[Nexa Supabase DEBUG] Parent 'conversations' upsert response:", convParentRes);
        } catch (e) {}

        console.log("[Nexa Supabase DEBUG] ⚡ RETRYING: Message upsert after parent record creation...");
        const fkRetryResponse = await supabase
          .from("messages")
          .upsert(payload, { onConflict: "id" })
          .select();

        console.log("[Nexa Supabase DEBUG] FK Retry Response Data:", fkRetryResponse.data);
        console.log("[Nexa Supabase DEBUG] FK Retry Response Error:", fkRetryResponse.error);

        if (!fkRetryResponse.error && fkRetryResponse.data && fkRetryResponse.data.length > 0) {
          console.log("✅ [Nexa Supabase SUCCESS] Message inserted successfully after creating parent conversation!");
          console.log("==================================================");
          return true;
        }
        finalError = fkRetryResponse.error || finalError;
      }

      // Handle Missing Column Error (Code 42703)
      if (finalError && (finalError.code === "42703" || finalError.message?.includes("column"))) {
        console.warn("🔄 [Nexa Supabase DEBUG] Schema column missing. Retrying message insert with basic payload...");
        
        const basicPayload: any = {
          id: message.id,
          chat_id: chatId,
          role: message.role,
          content: message.content || "",
          timestamp: message.timestamp || new Date().toISOString()
        };
        if (userId) basicPayload.user_id = userId;

        console.log("[Nexa Supabase DEBUG] Fallback Basic Payload:", JSON.stringify(basicPayload, null, 2));

        const fallbackResponse = await supabase
          .from("messages")
          .upsert(basicPayload, { onConflict: "id" })
          .select();

        console.log("[Nexa Supabase DEBUG] Fallback Response Data:", fallbackResponse.data);
        console.log("[Nexa Supabase DEBUG] Fallback Response Error:", fallbackResponse.error);

        if (!fallbackResponse.error && fallbackResponse.data && fallbackResponse.data.length > 0) {
          console.log("✅ [Nexa Supabase SUCCESS] Basic fallback message inserted successfully!");
          console.log("==================================================");
          return true;
        }

        finalError = fallbackResponse.error || finalError;
      }

      console.error("❌ [Nexa Supabase FINAL ERROR] Unable to insert message into Supabase 'messages' table.");
      console.error("   Final error code:", finalError?.code);
      console.error("   Final error message:", finalError?.message);
      console.error("   Final error details:", finalError?.details);
      console.error("   Final error hint:", finalError?.hint);
      console.log("==================================================");
      return false;
    }

    console.log("✅ [Nexa Supabase SUCCESS] Message inserted/upserted into 'messages' table!");
    console.log("[Nexa Supabase SUCCESS] Returned data:", response.data);
    console.log("==================================================");
    return true;
  } catch (err: any) {
    console.error("❌ [Nexa Supabase UNCAUGHT EXCEPTION] Exception during message sync:", err);
    console.log("==================================================");
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
 * Fetch all chat summaries from Supabase for a specific user ID or user email (excluding deleted chats)
 */
export async function fetchChatsFromSupabase(userEmail: string, userId?: string): Promise<ChatSession[]> {
  try {
    const normalizedEmail = (userEmail || "").toLowerCase().trim();
    console.log("[Nexa Supabase] Fetching active chats for email:", normalizedEmail, "userId:", userId);
    
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

    const { data, error } = await query
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    if (error) {
      if (error.code === "42703" || error.message?.includes("column") || isMissingTableError(error)) {
        console.warn("[Nexa Supabase] 'is_deleted' column or chats table does not exist or not found in schema cache yet. Returning empty.");
        return [];
      }
      console.error("[Nexa Supabase] Error fetching deleted chats:", error.message);
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
      userId: row.user_id,
      isDeleted: row.is_deleted || false,
      deletedAt: row.deleted_at,
      autoDeleteAt: row.auto_delete_at,
      messages: []
    })) as ChatSession[];
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

