import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Persistence helpers for Vercel Serverless environment
const DB_PATH = path.join("/tmp", "nexa_shared_db.json");

let memorySharedDb: Record<string, any> = {};

function readSharedDB(): Record<string, any> {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, "utf8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("[Nexa Share Serverless] Error reading DB:", e);
  }
  return memorySharedDb;
}

function writeSharedDB(data: Record<string, any>) {
  memorySharedDb = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.warn("[Nexa Share Serverless] File write skipped or failed in serverless:", e);
  }
}

function getSupabaseServer() {
  const url = process.env.VITE_SUPABASE_URL || "https://pfblkhotgrsabagnyxgn.supabase.co";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return createClient(url, anonKey);
  }
  return null;
}

const syncSharedConfigToSupabase = async (config: any) => {
  const supabase = getSupabaseServer();
  if (!supabase || !config || !config.id) return;
  try {
    try {
      await supabase.from("shared_conversations").upsert({
        id: config.id,
        chat_id: config.id,
        owner_email: config.ownerEmail,
        owner_name: config.ownerName,
        is_sharing_active: config.isSharingActive !== false,
        share_token: config.shareToken,
        expires_at: config.expiresAt || null,
        default_permission: config.defaultPermission || "chat",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    } catch (e) {}

    if (Array.isArray(config.participants)) {
      for (const p of config.participants) {
        try {
          await supabase.from("shared_participants").upsert({
            chat_id: config.id,
            email: p.email,
            name: p.name,
            role: p.role || "editor",
            joined_at: p.joinedAt || new Date().toISOString(),
          }, { onConflict: "chat_id,email" });
        } catch (e) {}
      }
    }

    if (config.accessCode) {
      try {
        await supabase.from("share_codes").upsert({
          chat_id: config.id,
          access_code: config.accessCode,
          is_active: config.accessCodeIsActive !== false,
          expires_at: config.accessCodeExpiresAt || null,
          permission: config.accessCodePermission || "chat",
          duration_type: config.accessCodeDurationType || "never",
        }, { onConflict: "chat_id" });
      } catch (e) {}
    }
  } catch (e: any) {
    console.warn("[Nexa Share Serverless] Supabase sync notice:", e.message);
  }
};

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `NXA-${s}`;
}

function generateShareToken(): string {
  return "sh_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function cleanShareInput(input: string): string {
  if (!input) return "";
  let clean = input.trim();
  if (clean.includes("://")) {
    try {
      const url = new URL(clean);
      clean = url.pathname + url.search + url.hash;
    } catch (e) {
      clean = clean.split("://")[1] || clean;
      if (clean.includes("/")) clean = clean.substring(clean.indexOf("/"));
    }
  }
  if (clean.includes("/share/thread/")) clean = clean.split("/share/thread/")[1] || clean;
  else if (clean.includes("/share/")) clean = clean.split("/share/")[1] || clean;
  else if (clean.includes("/code/")) clean = clean.split("/code/")[1] || clean;

  if (clean.startsWith("thread/")) clean = clean.replace("thread/", "");
  if (clean.includes("#share=")) clean = clean.split("#share=")[1] || clean;
  else if (clean.includes("share=")) clean = clean.split("share=")[1] || clean;
  else if (clean.includes("#code=")) clean = clean.split("#code=")[1] || clean;
  else if (clean.includes("code=")) clean = clean.split("code=")[1] || clean;
  else if (clean.includes("#join=")) clean = clean.split("#join=")[1] || clean;
  else if (clean.includes("join=")) clean = clean.split("join=")[1] || clean;

  if (clean.includes("#")) clean = clean.split("#")[0];
  if (clean.includes("&")) clean = clean.split("&")[0];
  if (clean.includes("?")) clean = clean.split("?")[0];

  return clean.trim();
}

const findSharedConfig = (input: string) => {
  if (!input) return null;
  const sharedDb = readSharedDB();
  const clean = cleanShareInput(input);

  if (sharedDb[clean]) return { actualChatId: clean, config: sharedDb[clean] };
  if (sharedDb[input]) return { actualChatId: input, config: sharedDb[input] };

  const foundByTokenKey = Object.keys(sharedDb).find(
    (id) => sharedDb[id].shareToken === clean || sharedDb[id].shareToken === input
  );
  if (foundByTokenKey) return { actualChatId: foundByTokenKey, config: sharedDb[foundByTokenKey] };

  const normalizedInput = clean.toUpperCase().replace(/[- ]/g, "");
  if (normalizedInput) {
    const foundByCodeKey = Object.keys(sharedDb).find((id) => {
      const dbCode = sharedDb[id].accessCode;
      if (!dbCode) return false;
      return dbCode.toUpperCase().replace(/[- ]/g, "") === normalizedInput;
    });
    if (foundByCodeKey) return { actualChatId: foundByCodeKey, config: sharedDb[foundByCodeKey] };
  }

  return null;
};

const findSharedConfigAsync = async (input: string) => {
  if (!input) return null;
  const syncResult = findSharedConfig(input);
  if (syncResult) return syncResult;

  const clean = cleanShareInput(input);
  const normalizedInput = clean.toUpperCase().replace(/[- ]/g, "");
  const supabase = getSupabaseServer();

  if (supabase) {
    try {
      const { data: convData } = await supabase
        .from("shared_conversations")
        .select("*")
        .or(`chat_id.eq.${clean},share_token.eq.${clean},chat_id.eq.${input},share_token.eq.${input}`)
        .maybeSingle();

      let matchedChatId: string | null = null;
      if (convData) {
        matchedChatId = convData.chat_id || convData.id;
      } else {
        const { data: codeData } = await supabase
          .from("share_codes")
          .select("*")
          .or(`access_code.eq.${clean},access_code.ilike.${clean},access_code.ilike.${normalizedInput}`)
          .maybeSingle();
        if (codeData) matchedChatId = codeData.chat_id;
      }

      if (matchedChatId) {
        const { data: sc } = await supabase.from("shared_conversations").select("*").eq("chat_id", matchedChatId).maybeSingle();
        const { data: parts } = await supabase.from("shared_participants").select("*").eq("chat_id", matchedChatId);
        const { data: scode } = await supabase.from("share_codes").select("*").eq("chat_id", matchedChatId).maybeSingle();

        if (sc) {
          const config = {
            id: sc.chat_id || sc.id,
            ownerEmail: sc.owner_email || "guest@nexa.ai",
            ownerName: sc.owner_name || "Guest Collaborator",
            isSharingActive: sc.is_sharing_active !== false,
            shareToken: sc.share_token,
            expiresAt: sc.expires_at || null,
            defaultPermission: sc.default_permission || "chat",
            participants: (parts || []).map((p: any) => ({
              email: p.email,
              name: p.name,
              role: p.role || "editor",
              joinedAt: p.joined_at,
            })),
            accessCode: scode?.access_code || null,
            accessCodeExpiresAt: scode?.expires_at || null,
            accessCodePermission: scode?.permission || "chat",
            accessCodeIsActive: scode?.is_active !== false,
            accessCodeDurationType: scode?.duration_type || "never",
          };

          const sharedDb = readSharedDB();
          sharedDb[config.id] = config;
          writeSharedDB(sharedDb);

          return { actualChatId: config.id, config };
        }
      }
    } catch (e) {
      console.warn("[Nexa Share Serverless] Error querying Supabase:", e);
    }
  }

  return null;
};

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const pathQuery = req.query ? req.query.path : undefined;
  const pathSegments = Array.isArray(pathQuery) ? pathQuery : typeof pathQuery === "string" ? [pathQuery] : [];

  let action = pathSegments[0] || "";
  let targetId = pathSegments[1] || "";
  let subAction = pathSegments[2] || "";

  if (!action && req.url) {
    const urlParts = req.url.split("?")[0].split("/").filter(Boolean);
    const shareIdx = urlParts.indexOf("share");
    if (shareIdx !== -1) {
      action = urlParts[shareIdx + 1] || "";
      targetId = urlParts[shareIdx + 2] || "";
      subAction = urlParts[shareIdx + 3] || "";
    }
  }

  const method = req.method ? req.method.toUpperCase() : "GET";
  const body = req.body || {};

  console.log(`[Nexa Share Serverless] ${method} action="${action}" targetId="${targetId}" subAction="${subAction}"`);

  try {
    // 1. CREATE or ENABLE sharing
    if (action === "create" || action === "enable") {
      const chatId = body.chatId || targetId || "session-default";
      const ownerEmail = body.ownerEmail || "guest@nexa.ai";
      const ownerName = body.ownerName || (ownerEmail ? ownerEmail.split("@")[0] : "Guest Collaborator");
      const defaultPermission = body.defaultPermission || "chat";

      const existingResult = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      let config = existingResult?.config;

      if (!config) {
        config = {
          id: chatId,
          ownerEmail,
          ownerName,
          isSharingActive: true,
          shareToken: generateShareToken(),
          expiresAt: null,
          defaultPermission,
          participants: [],
          accessCode: generateAccessCode(),
          accessCodeExpiresAt: null,
          accessCodePermission: "chat",
          accessCodeIsActive: true,
          accessCodeDurationType: "never",
        };
      } else {
        config.isSharingActive = true;
        if (!config.shareToken) config.shareToken = generateShareToken();
        if (!config.accessCode) config.accessCode = generateAccessCode();
      }

      const initialMessages = body.messages || [];
      const initialTitle = body.title || "";
      if (Array.isArray(initialMessages) && initialMessages.length > 0) {
        (config as any).messages = initialMessages;
      }
      if (initialTitle) {
        (config as any).title = initialTitle;
      }

      sharedDb[chatId] = config;
      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(config);

      // Also upsert chat and initial messages to Supabase database
      const supabase = getSupabaseServer();
      if (supabase) {
        try {
          if (initialTitle) {
            await supabase.from("chats").upsert({
              id: chatId,
              title: initialTitle,
              user_email: ownerEmail,
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" });
          }

          if (Array.isArray(initialMessages) && initialMessages.length > 0) {
            for (const msg of initialMessages) {
              if (msg && msg.id) {
                await supabase.from("messages").upsert({
                  id: msg.id,
                  chat_id: chatId,
                  role: msg.role,
                  content: msg.content || "",
                  timestamp: msg.timestamp || new Date().toISOString(),
                  engine_id: msg.engineId || null,
                  sources: msg.sources || null,
                  fact_check: msg.factCheck || null,
                  research_report: msg.researchReport || null,
                  quiz: msg.quiz || null,
                  attachment: msg.attachment || null,
                  reaction: msg.reaction || null,
                }, { onConflict: "id" });
              }
            }
          }
        } catch (e) {
          console.warn("[Nexa Share Serverless] Error syncing initial chat messages on share create:", e);
        }
      }

      return res.status(200).json({
        success: true,
        shareToken: config.shareToken,
        config,
        config_alias: config,
      });
    }

    // 2. GET INFO
    if (action === "info") {
      const chatId = targetId || (req.query ? (req.query.chatId as string) : undefined) || "session-default";
      const email = (req.query ? (req.query.email as string) : undefined) || body.email || "guest@nexa.ai";

      const found = await findSharedConfigAsync(chatId);
      if (!found) {
        return res.status(200).json({
          success: true,
          isShared: false,
          actualChatId: chatId,
          config: null,
          isOwner: true,
          isParticipant: false,
        });
      }

      const isOwner = found.config.ownerEmail?.toLowerCase() === email.toLowerCase();
      const isParticipant = Array.isArray(found.config.participants) &&
        found.config.participants.some((p: any) => p.email?.toLowerCase() === email.toLowerCase());

      return res.status(200).json({
        success: true,
        isShared: found.config.isSharingActive !== false,
        actualChatId: found.actualChatId,
        config: found.config,
        isOwner,
        isParticipant,
      });
    }

    // 3. TOGGLE SHARING
    if (action === "toggle") {
      const chatId = targetId || body.chatId || "session-default";
      const isSharingActive = body.isSharingActive !== undefined ? body.isSharingActive : true;

      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      sharedDb[found.actualChatId].isSharingActive = isSharingActive;
      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(sharedDb[found.actualChatId]);

      return res.status(200).json({
        success: true,
        config: sharedDb[found.actualChatId],
      });
    }

    // 4. REGENERATE LINK
    if (action === "regenerate" || action === "regenerate-link") {
      const chatId = targetId || body.chatId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      const newToken = generateShareToken();
      sharedDb[found.actualChatId].shareToken = newToken;
      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(sharedDb[found.actualChatId]);

      return res.status(200).json({
        success: true,
        shareToken: newToken,
        config: sharedDb[found.actualChatId],
      });
    }

    // 5. PARTICIPANT MANAGEMENT
    if (action === "participant") {
      const chatId = subAction || targetId || body.chatId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      const conf = sharedDb[found.actualChatId];
      if (!Array.isArray(conf.participants)) conf.participants = [];

      if (targetId === "add") {
        const targetEmail = (body.targetEmail || body.email || "").toLowerCase();
        const role = body.role || "editor";
        const name = body.name || targetEmail.split("@")[0] || "Collaborator";

        if (targetEmail && !conf.participants.some((p: any) => p.email.toLowerCase() === targetEmail)) {
          conf.participants.push({ email: targetEmail, name, role, joinedAt: new Date().toISOString() });
        }
      } else if (targetId === "role") {
        const targetEmail = (body.targetEmail || "").toLowerCase();
        const role = body.role || "editor";
        const p = conf.participants.find((p: any) => p.email.toLowerCase() === targetEmail);
        if (p) p.role = role;
      } else if (targetId === "remove") {
        const targetEmail = (body.targetEmail || "").toLowerCase();
        conf.participants = conf.participants.filter((p: any) => p.email.toLowerCase() !== targetEmail);
      }

      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(conf);

      return res.status(200).json({ success: true, config: conf });
    }

    if (action === "update-permission") {
      const chatId = body.chatId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      const conf = sharedDb[found.actualChatId];
      if (body.targetEmail) {
        const p = (conf.participants || []).find((p: any) => p.email.toLowerCase() === body.targetEmail.toLowerCase());
        if (p) p.role = body.role || "editor";
      }

      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(conf);

      return res.status(200).json({ success: true, config: conf });
    }

    if (action === "remove-participant") {
      const chatId = body.chatId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      const conf = sharedDb[found.actualChatId];
      if (body.targetEmail && Array.isArray(conf.participants)) {
        conf.participants = conf.participants.filter((p: any) => p.email.toLowerCase() !== body.targetEmail.toLowerCase());
      }

      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(conf);

      return res.status(200).json({ success: true, config: conf });
    }

    // 6. ACCESS CODE GENERATE / DISABLE
    if (action === "access-code") {
      const chatId = body.chatId || targetId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      let conf = found ? sharedDb[found.actualChatId] : null;

      if (!conf) {
        conf = {
          id: chatId,
          ownerEmail: body.ownerEmail || "guest@nexa.ai",
          ownerName: "Guest Collaborator",
          isSharingActive: true,
          shareToken: generateShareToken(),
          expiresAt: null,
          defaultPermission: "chat",
          participants: [],
          accessCode: generateAccessCode(),
          accessCodeExpiresAt: null,
          accessCodePermission: "chat",
          accessCodeIsActive: true,
          accessCodeDurationType: "never",
        };
        sharedDb[chatId] = conf;
      }

      if (targetId === "generate" || targetId === "create") {
        const newCode = generateAccessCode();
        conf.accessCode = newCode;
        conf.accessCodeIsActive = true;
        conf.accessCodeDurationType = body.expiresAfterValue || "never";
        conf.accessCodePermission = body.defaultPermission || "chat";

        let expiresAt: string | null = null;
        const now = new Date();
        if (body.expiresAfterValue === "1h") now.setHours(now.getHours() + 1);
        else if (body.expiresAfterValue === "24h") now.setHours(now.getHours() + 24);
        else if (body.expiresAfterValue === "7d") now.setDate(now.getDate() + 7);

        if (body.expiresAfterValue !== "never") expiresAt = now.toISOString();
        conf.accessCodeExpiresAt = expiresAt;
      } else if (targetId === "disable") {
        conf.accessCodeIsActive = false;
      }

      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(conf);

      return res.status(200).json({ success: true, config: conf });
    }

    // 7. JOIN
    if (action === "join") {
      const reqQuery = req.query || {};
      const input = body.input || targetId || (reqQuery.input as string) || (reqQuery.code as string) || (reqQuery.token as string) || "";
      const email = body.email || (reqQuery.email as string) || "guest@nexa.ai";
      const fullName = body.fullName || (reqQuery.fullName as string) || email.split("@")[0] || "Guest Collaborator";

      const found = await findSharedConfigAsync(input);
      if (!found) {
        return res.status(404).json({ success: false, error: "Invalid share code or link." });
      }

      const conf = found.config;
      if (!conf.isSharingActive) {
        return res.status(400).json({ success: false, error: "Sharing has been disabled for this thread." });
      }

      const sharedDb = readSharedDB();
      const dbConf = sharedDb[found.actualChatId] || conf;
      if (!Array.isArray(dbConf.participants)) dbConf.participants = [];

      let role = dbConf.defaultPermission || "editor";
      const existing = dbConf.participants.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
      if (!existing) {
        dbConf.participants.push({ email, name: fullName, role, joinedAt: new Date().toISOString() });
      } else {
        role = existing.role || role;
      }

      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(dbConf);

      return res.status(200).json({
        success: true,
        chatId: found.actualChatId,
        role,
        config: dbConf,
      });
    }

    // 8. VALIDATE
    if (action === "validate") {
      const reqQuery = req.query || {};
      const input = body.input || targetId || (reqQuery.input as string) || "";
      const found = await findSharedConfigAsync(input);

      if (!found) {
        return res.status(200).json({ success: true, isValid: false, message: "Code or link not found." });
      }

      return res.status(200).json({
        success: true,
        isValid: found.config.isSharingActive !== false,
        type: found.config.accessCode === cleanShareInput(input) ? "accessCode" : "shareLink",
        chatId: found.actualChatId,
        config: found.config,
      });
    }

    // 9. DISABLE or REVOKE
    if (action === "disable" || action === "revoke") {
      const chatId = body.chatId || targetId || "session-default";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();

      if (!found || !sharedDb[found.actualChatId]) {
        return res.status(404).json({ success: false, error: "Share configuration not found." });
      }

      sharedDb[found.actualChatId].isSharingActive = false;
      writeSharedDB(sharedDb);
      await syncSharedConfigToSupabase(sharedDb[found.actualChatId]);

      return res.status(200).json({
        success: true,
        config: sharedDb[found.actualChatId],
      });
    }

    // 9b. USER SESSIONS (get all shared sessions owned or joined by user)
    if (action === "user-sessions" || action === "user-shares") {
      const reqQuery = req.query || {};
      const email = ((reqQuery.email as string) || body.email || "").toLowerCase().trim();
      if (!email) {
        return res.status(200).json({ success: true, sessions: [] });
      }

      const sharedDb = readSharedDB();
      const matchedConfigs: any[] = [];

      for (const chatId of Object.keys(sharedDb)) {
        const conf = sharedDb[chatId];
        if (!conf || conf.isSharingActive === false) continue;
        const isOwner = conf.ownerEmail?.toLowerCase() === email;
        const isParticipant = Array.isArray(conf.participants) && conf.participants.some((p: any) => p.email?.toLowerCase() === email);
        if (isOwner || isParticipant) {
          matchedConfigs.push({
            id: chatId,
            title: conf.title || "Collaborative Conversation",
            createdAt: conf.createdAt || new Date().toISOString(),
            updatedAt: conf.updatedAt || new Date().toISOString(),
            isPinned: false,
            mode: conf.mode || "general",
            userEmail: conf.ownerEmail,
            isShared: true,
            messages: conf.messages || [],
          });
        }
      }

      // Query Supabase for shared participants if available
      const supabase = getSupabaseServer();
      if (supabase) {
        try {
          const { data: partRows } = await supabase
            .from("shared_participants")
            .select("chat_id")
            .eq("email", email);
          if (partRows && partRows.length > 0) {
            for (const prow of partRows) {
              if (!matchedConfigs.some((m) => m.id === prow.chat_id)) {
                const { data: confRow } = await supabase
                  .from("shared_configs")
                  .select("*")
                  .eq("chat_id", prow.chat_id)
                  .maybeSingle();
                if (confRow) {
                  matchedConfigs.push({
                    id: confRow.chat_id,
                    title: confRow.title || "Collaborative Conversation",
                    createdAt: confRow.created_at || new Date().toISOString(),
                    updatedAt: confRow.updated_at || new Date().toISOString(),
                    isPinned: false,
                    mode: "general",
                    userEmail: confRow.owner_email,
                    isShared: true,
                    messages: [],
                  });
                }
              }
            }
          }
        } catch (err) {
          console.warn("[Nexa Share Serverless] Error querying user shared sessions from Supabase:", err);
        }
      }

      return res.status(200).json({ success: true, sessions: matchedConfigs });
    }

    // 10. SESSION FETCH
    if (action === "session") {
      const reqQuery = req.query || {};
      const chatId = targetId || "session-default";
      const email = (reqQuery.email as string) || "guest@nexa.ai";
      const found = await findSharedConfigAsync(chatId);
      const actualChatId = found ? found.actualChatId : chatId;

      const config = found?.config || {
        id: actualChatId,
        ownerEmail: "guest@nexa.ai",
        ownerName: "Guest Collaborator",
        isSharingActive: true,
        shareToken: generateShareToken(),
        defaultPermission: "chat",
        participants: [],
      };

      let title = (config as any).title || "Collaborative Conversation";
      let messages: any[] = (config as any).messages || [];

      // Query Supabase for real chat metadata & messages
      const supabase = getSupabaseServer();
      if (supabase) {
        try {
          const { data: chatRow } = await supabase.from("chats").select("*").eq("id", actualChatId).maybeSingle();
          if (chatRow && chatRow.title) {
            title = chatRow.title;
          }
          const { data: msgRows } = await supabase
            .from("messages")
            .select("*")
            .eq("chat_id", actualChatId)
            .order("timestamp", { ascending: true });

          if (msgRows && msgRows.length > 0) {
            messages = msgRows.map((r: any) => ({
              id: r.id,
              role: r.role,
              content: r.content,
              timestamp: r.timestamp,
              engineId: r.engine_id,
              sources: r.sources,
              factCheck: r.fact_check,
              researchReport: r.research_report,
              quiz: r.quiz,
              attachment: r.attachment,
              reaction: r.reaction,
            }));
          }
        } catch (e) {
          console.warn("[Nexa Share Serverless] Error fetching session messages from Supabase:", e);
        }
      }

      // Fallback to sharedDb[actualChatId]
      const sharedDb = readSharedDB();
      if (messages.length === 0 && sharedDb[actualChatId]?.messages) {
        messages = sharedDb[actualChatId].messages;
      }
      if (sharedDb[actualChatId]?.title) {
        title = sharedDb[actualChatId].title;
      }

      return res.status(200).json({
        success: true,
        session: {
          id: actualChatId,
          title: title,
          messages: messages,
        },
        role: "editor",
        isOwner: config.ownerEmail?.toLowerCase() === email.toLowerCase(),
        isParticipant: true,
        config,
      });
    }

    // 10b. SYNC MESSAGES
    if (action === "sync-messages" || action === "update-messages") {
      const chatId = body.chatId || targetId || "session-default";
      const messages = body.messages || [];
      const title = body.title || "";
      const found = await findSharedConfigAsync(chatId);
      const sharedDb = readSharedDB();
      const actualChatId = found ? found.actualChatId : chatId;

      let conf = sharedDb[actualChatId];
      if (!conf) {
        conf = {
          id: actualChatId,
          ownerEmail: body.ownerEmail || "guest@nexa.ai",
          ownerName: "Guest Collaborator",
          isSharingActive: true,
          shareToken: generateShareToken(),
          defaultPermission: "chat",
          participants: [],
        };
        sharedDb[actualChatId] = conf;
      }

      if (Array.isArray(messages) && messages.length > 0) {
        conf.messages = messages;
      }
      if (title) {
        conf.title = title;
      }

      writeSharedDB(sharedDb);

      // Upsert to Supabase
      const supabase = getSupabaseServer();
      if (supabase) {
        try {
          if (title) {
            try {
              await supabase.from("chats").upsert({
                id: actualChatId,
                title: title,
                user_email: conf.ownerEmail,
                updated_at: new Date().toISOString(),
              }, { onConflict: "id" });
            } catch (err) {}
          }

          if (Array.isArray(messages) && messages.length > 0) {
            for (const msg of messages) {
              if (msg && msg.id) {
                try {
                  await supabase.from("messages").upsert({
                    id: msg.id,
                    chat_id: actualChatId,
                    role: msg.role,
                    content: msg.content || "",
                    timestamp: msg.timestamp || new Date().toISOString(),
                    engine_id: msg.engineId || null,
                    sources: msg.sources || null,
                    fact_check: msg.factCheck || null,
                    research_report: msg.researchReport || null,
                    quiz: msg.quiz || null,
                    attachment: msg.attachment || null,
                    reaction: msg.reaction || null,
                  }, { onConflict: "id" });
                } catch (err) {}
              }
            }
          }
        } catch (e) {
          console.warn("[Nexa Share Serverless] Error syncing messages to Supabase:", e);
        }
      }

      return res.status(200).json({ success: true, count: messages.length });
    }

    // 11. DIAGNOSTICS
    if (action === "diagnostics") {
      const chatId = targetId || "session-default";
      const found = await findSharedConfigAsync(chatId);

      return res.status(200).json({
        success: true,
        chatId,
        checks: {
          exists: !!found,
          isSharingActive: found?.config?.isSharingActive ?? false,
          hasAccessCode: !!found?.config?.accessCode,
          hasShareToken: !!found?.config?.shareToken,
          participantCount: found?.config?.participants?.length || 0,
        },
      });
    }

    // Unrecognized route
    return res.status(404).json({
      success: false,
      error: `Share API route not found: ${method} /api/share/${action}`,
    });
  } catch (err: any) {
    console.error("[Nexa Share Serverless Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal serverless error processing share request.",
    });
  }
}
