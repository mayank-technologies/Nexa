import { fetchMessagesFromSupabase } from "./supabaseClient";
import { safeFetchJson } from "./safeFetch";
import { ChatSession, Message } from "../types";

export interface SharedSessionDiagnosticResult {
  timestamp: string;
  success: boolean;
  inputToken: string;
  actualChatId: string;
  isMappingMismatch: boolean;
  role: string;
  supabaseMessageCount: number;
  supabaseMessageIds: string[];
  serverMessageCount: number;
  serverMessageIds: string[];
  mergedMessageCount: number;
  mergedMessageIds: string[];
  sessionInState: boolean;
  activeSessionIdMatch: boolean;
  discrepancies: string[];
  timelineMs: {
    joinApi: number;
    supabaseFetch: number;
    serverSessionApi: number;
    totalMs: number;
  };
}

/**
 * Diagnostic function that verifies if message IDs and conversation history
 * are correctly fetched for shared sessions when a user joins via a link or token.
 */
export async function diagnoseSharedSessionFetch(
  inputTokenOrId: string,
  userEmail: string = "guest@nexa.ai",
  currentSessions: ChatSession[] = [],
  currentActiveSessionId: string = ""
): Promise<SharedSessionDiagnosticResult> {
  const startTime = performance.now();
  const discrepancies: string[] = [];
  const cleanInput = (inputTokenOrId || "").trim();

  console.group(`[Nexa Shared Session Diagnostic] Verifying join & message sync for: "${cleanInput}"`);
  console.log(`[Diagnostic] User Email: ${userEmail}`);
  console.log(`[Diagnostic] Current Active Session ID in App: "${currentActiveSessionId}"`);
  console.log(`[Diagnostic] Local Sessions Count in App State: ${currentSessions.length}`);

  let actualChatId = cleanInput;
  let role = "editor";
  let joinTime = 0;

  // 1. Verify Initial Join API & ID Mapping
  try {
    const t0 = performance.now();
    const joinRes = await safeFetchJson("/api/share/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        input: cleanInput,
        shareToken: cleanInput,
        accessCode: cleanInput,
      }),
    });
    joinTime = Math.round(performance.now() - t0);

    if (joinRes.data && joinRes.data.success && joinRes.data.chatId) {
      actualChatId = joinRes.data.chatId;
      role = joinRes.data.role || "editor";
      console.log(`[Diagnostic] ✓ Initial Join API succeeded (${joinTime}ms). Mapped "${cleanInput}" -> actualChatId: "${actualChatId}"`);
      
      if (cleanInput !== actualChatId) {
        console.log(`[Diagnostic] ℹ Share token/code "${cleanInput}" mapped to target session ID "${actualChatId}".`);
      }
    } else {
      const err = joinRes.data?.error || joinRes.error || "Join API failed";
      discrepancies.push(`Join API Error: ${err}`);
      console.warn(`[Diagnostic] ⚠️ Join API failed (${joinTime}ms):`, err);
    }
  } catch (e: any) {
    discrepancies.push(`Join API Exception: ${e.message}`);
    console.error(`[Diagnostic] ❌ Join API exception:`, e);
  }

  // 2. Test Supabase Message Fetching
  let supabaseMsgs: Message[] = [];
  let supabaseTime = 0;
  try {
    const t0 = performance.now();
    supabaseMsgs = await fetchMessagesFromSupabase(actualChatId);
    supabaseTime = Math.round(performance.now() - t0);
    console.log(`[Diagnostic] Supabase fetch returned ${supabaseMsgs.length} messages (${supabaseTime}ms).`);
  } catch (e: any) {
    discrepancies.push(`Supabase Fetch Exception: ${e.message}`);
    console.warn(`[Diagnostic] ⚠️ Supabase fetch error:`, e);
  }

  // 3. Test Server Shared Session API Fetching
  let serverMsgs: Message[] = [];
  let serverSessionTitle = "";
  let serverTime = 0;
  try {
    const t0 = performance.now();
    const sessionRes = await safeFetchJson(`/api/share/session/${actualChatId}?email=${encodeURIComponent(userEmail)}`);
    serverTime = Math.round(performance.now() - t0);

    if (sessionRes.data && sessionRes.data.success && sessionRes.data.session) {
      serverSessionTitle = sessionRes.data.session.title || "";
      if (Array.isArray(sessionRes.data.session.messages)) {
        serverMsgs = sessionRes.data.session.messages;
      }
      console.log(`[Diagnostic] ✓ Server Session API returned "${serverSessionTitle}" with ${serverMsgs.length} messages (${serverTime}ms).`);
    } else {
      const err = sessionRes.data?.error || sessionRes.error || "Server Session API failed";
      discrepancies.push(`Server Session API Error: ${err}`);
      console.warn(`[Diagnostic] ⚠️ Server Session API failed (${serverTime}ms):`, err);
    }
  } catch (e: any) {
    discrepancies.push(`Server Session API Exception: ${e.message}`);
    console.error(`[Diagnostic] ❌ Server Session API exception:`, e);
  }

  // 4. Merge & Deduplicate Message IDs
  const msgMap = new Map<string, Message>();
  supabaseMsgs.forEach((m) => {
    if (m && m.id) msgMap.set(m.id, m);
  });
  serverMsgs.forEach((m) => {
    if (m && m.id) msgMap.set(m.id, m);
  });

  const mergedMsgs = Array.from(msgMap.values());
  mergedMsgs.sort((a, b) => {
    const getNum = (id: string) => {
      const match = id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return getNum(a.id) - getNum(b.id);
  });

  const supabaseMsgIds = supabaseMsgs.map((m) => m.id);
  const serverMsgIds = serverMsgs.map((m) => m.id);
  const mergedMsgIds = mergedMsgs.map((m) => m.id);

  // Check for empty history
  if (mergedMsgs.length === 0) {
    discrepancies.push("No conversation messages found in either Supabase or Server Shared DB.");
    console.warn(`[Diagnostic] ⚠️ Warning: 0 messages retrieved for shared session "${actualChatId}".`);
  } else {
    console.log(`[Diagnostic] ✓ Successfully merged ${mergedMsgs.length} total unique messages. IDs:`, mergedMsgIds);
  }

  // Check individual message completeness
  mergedMsgs.forEach((m, idx) => {
    if (!m.id) discrepancies.push(`Message at index ${idx} is missing an ID.`);
    if (!m.role) discrepancies.push(`Message ${m.id || idx} is missing a role.`);
    if (m.content === undefined || m.content === null) discrepancies.push(`Message ${m.id || idx} has null/undefined content.`);
  });

  // 5. Verify App React State Compatibility
  const sessionInState = currentSessions.some((s) => s.id === actualChatId);
  const activeSessionIdMatch = currentActiveSessionId === actualChatId;

  if (!sessionInState) {
    discrepancies.push(`Session "${actualChatId}" is NOT currently in App React 'sessions' state array.`);
    console.warn(`[Diagnostic] ⚠️ Session "${actualChatId}" missing from App 'sessions' state. State map update required.`);
  } else {
    console.log(`[Diagnostic] ✓ Session "${actualChatId}" verified present in local App 'sessions' state.`);
  }

  if (!activeSessionIdMatch) {
    discrepancies.push(`Active session ID mismatch: App activeSessionId is "${currentActiveSessionId}", expected "${actualChatId}".`);
    console.warn(`[Diagnostic] ⚠️ App activeSessionId ("${currentActiveSessionId}") does not match joined chatId ("${actualChatId}").`);
  } else {
    console.log(`[Diagnostic] ✓ Active session ID matches actualChatId: "${actualChatId}".`);
  }

  const totalMs = Math.round(performance.now() - startTime);

  const result: SharedSessionDiagnosticResult = {
    timestamp: new Date().toISOString(),
    success: discrepancies.length === 0,
    inputToken: cleanInput,
    actualChatId,
    isMappingMismatch: cleanInput !== actualChatId,
    role,
    supabaseMessageCount: supabaseMsgs.length,
    supabaseMessageIds: supabaseMsgIds,
    serverMessageCount: serverMsgs.length,
    serverMessageIds: serverMsgIds,
    mergedMessageCount: mergedMsgs.length,
    mergedMessageIds: mergedMsgIds,
    sessionInState,
    activeSessionIdMatch,
    discrepancies,
    timelineMs: {
      joinApi: joinTime,
      supabaseFetch: supabaseTime,
      serverSessionApi: serverTime,
      totalMs,
    },
  };

  console.log(`[Diagnostic Summary] Completed in ${totalMs}ms. Status: ${result.success ? "PASS ✅" : "ISSUES FOUND ⚠️"}`);
  if (discrepancies.length > 0) {
    console.warn(`[Diagnostic Discrepancies]:`, discrepancies);
  }
  console.groupEnd();

  return result;
}
