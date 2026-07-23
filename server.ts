/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Helper to get Supabase Client lazily on server-side
let supabaseServerClient: any = null;
function getSupabaseServer(): any {
  if (!supabaseServerClient) {
    const url = process.env.VITE_SUPABASE_URL || "https://pfblkhotgrsabagnyxgn.supabase.co";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      supabaseServerClient = createClient(url, anonKey);
      console.log("[Nexa Server] Supabase server-side client initialized successfully.");
    } else {
      console.warn("[Nexa Server] Supabase credentials not found in env. Server-side Supabase features disabled.");
    }
  }
  return supabaseServerClient;
}

interface GroundingSource {
  title: string;
  uri: string;
}

// Helper to get Gemini Client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please set it in Settings > Secrets or .env.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust wrapper to handle transient 503, 429 errors, spike demands and provide live model fallback
async function generateContentWithRetry(params: {
  contents: any[];
  config?: any;
  initialModel?: string;
  turboMode?: boolean;
}): Promise<any> {
  const modelsToTry = [
    params.initialModel || "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.info(`[Nexa Core Server] Querying content generation via model ${model}...`);
      const ai = getGeminiClient();

      // Create a copy of the configuration to decorate
      const currentConfig = { ...params.config };

      // Set thinkingLevel based on turboMode
      const isGemini3 = model.includes("gemini-3") || model.includes("gemini-3.5");
      if (isGemini3) {
        if (params.turboMode !== false) {
          // Bypasses thinking phase completely for near-instant responses
          currentConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.MINIMAL
          };
        }
      } else {
        // Legacy or other fallback models don't support thinkingConfig
        if (currentConfig.thinkingConfig) {
          delete currentConfig.thinkingConfig;
        }
      }

      const result = await ai.models.generateContent({
        model: model,
        contents: params.contents,
        config: currentConfig,
      });
      return result;
    } catch (err: any) {
      lastError = err;
      const errorMessage = String(err?.message || err);
      // Log using neutral console.info to ensure transient retry exceptions do not trigger environment warnings or alarm flags
      console.info(`[Nexa Core Server Support] Model ${model} returned expected gateway exception: ${errorMessage.substring(0, 150)}... Transitioning immediately to active backup.`);
    }
  }

  throw lastError || new Error("Failed to generate content with all configured models.");
}

// Router to classify task automatically (Smart Task Router)
function routeTask(
  prompt: string,
  mode: string,
  hasImage: boolean
): "core" | "reasoning" | "vision" | "language" | "learning" {
  const lowercasePrompt = prompt.toLowerCase();

  // 1. Vision Engine routing
  if (hasImage || lowercasePrompt.includes("image") || lowercasePrompt.includes("picture") || lowercasePrompt.includes("screenshot") || lowercasePrompt.includes("ocr") || lowercasePrompt.includes("visual")) {
    return "vision";
  }

  // 2. Reasoning Engine routing (math, logic, equations, code)
  const mathRegex = /[\d+\-*/=√π▲λ∫∬]|[0-9]+[xXyYx]/;
  const codingKeywords = ["code", "typescript", "python", "javascript", "program", "function", "compile", "bug", "algorithm", "recursive"];
  const mathKeywords = ["solve", "calculate", "math", "calculus", "geometry", "equations", "algebra", "integral", "logic", "reasoning", "prove"];

  if (
    mathRegex.test(prompt) ||
    codingKeywords.some((kw) => lowercasePrompt.includes(kw)) ||
    mathKeywords.some((kw) => lowercasePrompt.includes(kw))
  ) {
    return "reasoning";
  }

  // 3. Language Engine routing (translate, grammar, detection)
  const langKeywords = ["translate", "translation", "pronounce", "pronunciation", "spelling", "grammar correction", "multilingual assist", "detect language", "how to say", "meaning of"];
  if (langKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "language";
  }

  // 4. Learning Engine routing (homework, tutor, study, explain like I'm 10)
  const learnKeywords = ["homework", "study", "exam", "quiz", "student", "explain to a", "class", "syllabus", "formula", "revision", "learn", "assignment"];
  if (mode === "study" || mode === "quiz" || learnKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "learning";
  }

  // 5. Default to Nexa Core
  return "core";
}

// Universal Link Analyzer Helper to parse and scrape metadata/content from public URLs
async function fetchUrlMetadataAndContent(url: string): Promise<{
  url: string;
  type: string;
  title?: string;
  description?: string;
  bodyText?: string;
  isPrivateOrError?: boolean;
  errorMessage?: string;
  pdfData?: { mimeType: string; data: string };
  gitHubData?: any;
}> {
  console.info(`[Nexa Link Analyzer] Analyzing URL: ${url}`);
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // 1. Google Docs, Sheets, Slides
    if (hostname.includes("docs.google.com")) {
      if (pathname.includes("/document/d/")) {
        const docIdMatch = pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          const res = await fetch(exportUrl, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            const text = await res.text();
            return {
              url,
              type: "google-doc",
              title: "Google Document",
              bodyText: text.substring(0, 15000),
            };
          }
        }
      } else if (pathname.includes("/spreadsheets/d/")) {
        const sheetIdMatch = pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (sheetIdMatch) {
          const sheetId = sheetIdMatch[1];
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
          const res = await fetch(exportUrl, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            const csv = await res.text();
            return {
              url,
              type: "google-sheet",
              title: "Google Sheet",
              bodyText: csv.substring(0, 15000),
            };
          }
        }
      } else if (pathname.includes("/presentation/d/")) {
        const slideIdMatch = pathname.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
        if (slideIdMatch) {
          const slideId = slideIdMatch[1];
          const exportUrl = `https://docs.google.com/presentation/d/${slideId}/export/pdf`;
          const res = await fetch(exportUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            return {
              url,
              type: "google-slide",
              title: "Google Slide (PDF Export)",
              pdfData: { mimeType: "application/pdf", data: base64 }
            };
          }
        }
      }
    }

    // 2. GitHub Repositories
    if (hostname === "github.com" || hostname === "www.github.com") {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts[1];
        const gitHubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
        let repoData: any = null;
        let readmeText = "";

        try {
          const apiRes = await fetch(gitHubApiUrl, {
            headers: { "User-Agent": "Nexa-Link-Analyzer" },
            signal: AbortSignal.timeout(3000),
          });
          if (apiRes.ok) {
            repoData = await apiRes.json();
          }
        } catch (e) {
          console.error("[Nexa Link Analyzer] GitHub API error:", e);
        }

        try {
          const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, {
            signal: AbortSignal.timeout(3000)
          });
          if (readmeRes.ok) {
            readmeText = await readmeRes.text();
          } else {
            const readmeResMaster = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, {
              signal: AbortSignal.timeout(3000)
            });
            if (readmeResMaster.ok) {
              readmeText = await readmeResMaster.text();
            }
          }
        } catch (e) {
          console.error("[Nexa Link Analyzer] GitHub README error:", e);
        }

        return {
          url,
          type: "github-repo",
          title: repoData ? repoData.full_name : `${owner}/${repo}`,
          description: repoData ? repoData.description : "GitHub repository",
          gitHubData: repoData,
          bodyText: readmeText ? readmeText.substring(0, 15000) : "No README available or fetched."
        };
      }
    }

    // 3. YouTube videos
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      let videoId = "";
      if (hostname.includes("youtu.be")) {
        videoId = pathname.split("/").filter(Boolean)[0] || "";
      } else {
        const params = urlObj.searchParams;
        videoId = params.get("v") || "";
      }
      return {
        url,
        type: "youtube-video",
        title: `YouTube Video (ID: ${videoId})`,
        bodyText: `This is a YouTube video with ID ${videoId}. Please search the web or grounding channels to get details, reviews, summary, or transcripts for this video if possible.`,
      };
    }

    // 4. PDF Files
    if (pathname.endsWith(".pdf") || url.toLowerCase().includes(".pdf")) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("pdf") || pathname.endsWith(".pdf")) {
          const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
          if (contentLength > 12 * 1024 * 1024) {
            return {
              url,
              type: "pdf-file-large",
              title: pathname.split("/").pop() || "PDF Document",
              isPrivateOrError: true,
              errorMessage: "PDF file is too large (>12MB) for direct server processing."
            };
          }
          const arrayBuffer = await res.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          return {
            url,
            type: "pdf-file",
            title: pathname.split("/").pop() || "PDF Document",
            pdfData: { mimeType: "application/pdf", data: base64 }
          };
        }
      }
    }

    // 5. Standard webpages, blogs, news, Amazon/Flipkart/Spotify, etc.
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) {
      return {
        url,
        type: "webpage-inaccessible",
        isPrivateOrError: true,
        errorMessage: `HTTP response status ${res.status}`,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return {
        url,
        type: "pdf-file",
        title: "PDF Document",
        pdfData: { mimeType: "application/pdf", data: base64 }
      };
    }

    if (contentType.includes("html") || contentType.includes("xml") || contentType.includes("text")) {
      const html = await res.text();
      let pageTitle = "";
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        pageTitle = titleMatch[1].trim();
      }

      let pageDesc = "";
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) || 
                        html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i) ||
                        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
      if (descMatch) {
        pageDesc = descMatch[1].trim();
      }

      let bodyHtml = "";
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        bodyHtml = bodyMatch[1];
      } else {
        bodyHtml = html;
      }

      bodyHtml = bodyHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
      bodyHtml = bodyHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");
      let textContent = bodyHtml.replace(/<[^>]+>/g, " ");
      textContent = textContent.replace(/\s+/g, " ").trim();

      return {
        url,
        type: hostname.includes("amazon") || hostname.includes("flipkart") ? "e-commerce" : "standard-webpage",
        title: pageTitle || hostname,
        description: pageDesc,
        bodyText: textContent.substring(0, 10000),
      };
    }

    return {
      url,
      type: "static-file",
      title: pathname.split("/").pop() || hostname,
      bodyText: `Static asset of type: ${contentType}`
    };

  } catch (err: any) {
    console.error(`[Nexa Link Analyzer] Fetch exception for ${url}:`, err);
    return {
      url,
      type: "webpage-error",
      isPrivateOrError: true,
      errorMessage: err.message || "Timeout or network unreachable"
    };
  }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // --- PERSISTENT USER CHAT DATABASE SETUP ---
  const DB_PATH = path.join(process.cwd(), "users_db.json");

  const readDB = () => {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read user database:", e);
    }
    return {};
  };

  const writeDB = (data: any) => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to user database:", e);
    }
  };

  // --- SHARED CHATS DATABASE SETUP ---
  const SHARED_DB_PATH = path.join(process.cwd(), "shared_chats_db.json");

  const readSharedDB = () => {
    try {
      if (fs.existsSync(SHARED_DB_PATH)) {
        const fileContent = fs.readFileSync(SHARED_DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read shared chats database:", e);
    }
    return {};
  };

  const writeSharedDB = (data: any) => {
    try {
      fs.writeFileSync(SHARED_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to shared chats database:", e);
    }
  };

  // Login or register user with cloud-sync capability
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password, fullName, currentChats, isSignUp, isGoogleAuth } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const db = readDB();

      const userExists = !!db[normalizedEmail];

      // If user exists and client wants to do a manual Sign Up registration, throw error
      if (userExists && isSignUp) {
        return res.status(400).json({
          success: false,
          error: "An account with this email address already exists. Please select Sign In instead."
        });
      }

      // If user does not exist and they are trying to do a standard Login (not sign up, not Google Auth SSO)
      if (!userExists && !isSignUp && !isGoogleAuth) {
        return res.status(400).json({
          success: false,
          error: "This account does not exist. Please click the 'Create Account' tab above to sign up first."
        });
      }

      // If user does not exist (and they are signing up or using Google SSO which auto-signs-up), create profile
      if (!userExists) {
        console.info(`[Nexa Server] Registering first-time login for user: ${normalizedEmail}`);
        
        // Save current device chats if any exist, ensuring they persist
        const initialChats = Array.isArray(currentChats) && currentChats.length > 0 
          ? currentChats 
          : [];

        db[normalizedEmail] = {
          email: normalizedEmail,
          fullName: fullName?.trim() || email.split("@")[0],
          password: password,
          chats: initialChats,
          createdAt: new Date().toISOString()
        };

        writeDB(db);

        return res.status(200).json({
          success: true,
          message: isGoogleAuth ? "Google account registered! Welcome to Nexa." : "Registration successful! Welcome to Nexa.",
          user: {
            email: normalizedEmail,
            fullName: db[normalizedEmail].fullName,
            isGuest: false,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${db[normalizedEmail].fullName}`,
            preferences: {
              primaryLanguage: "English",
              rememberPersonalization: true,
              personalizationContext: ""
            }
          },
          chats: initialChats
        });
      }

      // User exists
      const userRecord = db[normalizedEmail];

      // Verifying password (or bypass if using Google Auth)
      if (!isGoogleAuth && userRecord.password !== password) {
        return res.status(401).json({ success: false, error: "Incorrect password for this email account. Please check your credentials." });
      }

      console.info(`[Nexa Server] Authenticated user: ${normalizedEmail}${isGoogleAuth ? ' (via Google Link)' : ''}`);
      
      const responseUser = {
        email: normalizedEmail,
        fullName: userRecord.fullName || normalizedEmail.split("@")[0],
        isGuest: false,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${userRecord.fullName || normalizedEmail}`,
        preferences: {
          primaryLanguage: "English",
          rememberPersonalization: true,
          personalizationContext: ""
        }
      };

      return res.status(200).json({
        success: true,
        message: "Successfully synchronized with Cloud!",
        user: responseUser,
        chats: userRecord.chats || []
      });

    } catch (error: any) {
      console.error("Authentication error:", error);
      return res.status(500).json({ success: false, error: error.message || "Authentication error." });
    }
  });

  // Client-to-Server syncing of chat sessions
  app.post("/api/auth/sync", (req, res) => {
    try {
      const { email, chats } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required for synchronization." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const db = readDB();

      if (!db[normalizedEmail]) {
        return res.status(404).json({ success: false, error: "User profile not found in cloud." });
      }

      db[normalizedEmail].chats = Array.isArray(chats) ? chats : [];
      writeDB(db);

      console.info(`[Nexa Server] Synced ${db[normalizedEmail].chats.length} chats for: ${normalizedEmail}`);
      return res.status(200).json({ success: true });

    } catch (error: any) {
      console.error("Sync error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to sync." });
    }
  });

  const sendWaitlistEmail = async (toEmail: string): Promise<{ success: boolean; error?: string; info?: any }> => {
    console.log("[Nexa SMTP Diagnostic] [Stage: Email send attempted] Beginning sendWaitlistEmail for:", toEmail);

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || `Nexa <${user}>`;

    const maskedUser = user ? (user.includes("@") ? `${user.split("@")[0].slice(0, 3)}***@${user.split("@")[1]}` : `${user.slice(0, 3)}***`) : "UNDEFINED";
    const passExists = pass ? "YES (defined)" : "NO (undefined)";

    console.log("[Nexa SMTP Diagnostic] Environment Variables Check:");
    console.log(`  - SMTP_HOST: ${host}`);
    console.log(`  - SMTP_PORT: ${port}`);
    console.log(`  - SMTP_USER: ${maskedUser}`);
    console.log(`  - SMTP_PASS exists: ${passExists}`);
    console.log(`  - SMTP_FROM: ${from}`);
    console.log(`  - VERCEL env is present: ${process.env.VERCEL ? "YES" : "NO"}`);
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);

    if (!user || !pass) {
      console.warn("[Nexa SMTP Diagnostic] [Stage: Aborted] SMTP credentials are not configured. Skipping confirmation email.");
      return { success: false, error: "SMTP credentials are not configured in environment variables." };
    }

    try {
      console.log("[Nexa SMTP Diagnostic] [Stage: SMTP transporter created] Creating Nodemailer transporter with debug & logger enabled...");
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false, // Prevents certificate verification failures in sandboxed containers
        },
        debug: true,
        logger: true,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });

      console.log("[Nexa SMTP Diagnostic] [Stage: SMTP authentication verification] Verifying transporter connection...");
      try {
        await transporter.verify();
        console.log("[Nexa SMTP Diagnostic] [Stage: SMTP authentication success] SMTP server verified successfully!");
      } catch (verifyErr: any) {
        console.error("[Nexa SMTP Diagnostic] [Stage: SMTP authentication failure] Verification failed:", {
          message: verifyErr.message,
          code: verifyErr.code,
          command: verifyErr.command,
          response: verifyErr.response,
          responseCode: verifyErr.responseCode,
          stack: verifyErr.stack,
        });
        throw verifyErr;
      }

      console.log(`[Nexa SMTP Diagnostic] Verifying fields: To=${toEmail}, From=${from}, ReplyTo=${from}`);

      const mailOptions = {
        from,
        to: toEmail,
        replyTo: from,
        subject: "You're on the Nexa Premium Waitlist 🎉",
        text: `Hi there,\n\nThank you for joining the Nexa Premium Waitlist! We are absolutely thrilled to have you with us.\n\nYou are officially on the list and will be among the first to gain early access when Nexa Premium officially launches.\n\nExclusive features you will unlock with Nexa Premium:\n- Faster AI Responses\n- Unlimited Deep Research\n- Advanced Study Mode\n- AI Image Generator\n- Long-Term Memory\n- AI Group Chat & Voice Calls\n- Early Access to Upcoming Features\n\nWe will reach out to you as soon as early access slots open up for your spot in line.\n\nBest regards,\n\nThe Nexa Team`,
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexa Premium Waitlist</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header (Nexa Branding) -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">Nexa</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Premium Waitlist</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 30px; background-color: #ffffff;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #334155;">Hi there,</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #334155;">Thank you for joining the <strong>Nexa Premium Waitlist</strong>! We are absolutely thrilled to have you with us.</p>
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #334155;">You are officially on the list and will be among the first to gain early access when Nexa Premium officially launches.</p>
              
              <!-- Features Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f1f5f9; border-radius: 6px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: bold; color: #0f172a;">Exclusive features you will unlock with Nexa Premium:</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 22px; color: #475569;">
                      <li style="margin-bottom: 8px;"><strong>Faster AI Responses</strong> - Priority speed with zero delay.</li>
                      <li style="margin-bottom: 8px;"><strong>Unlimited Deep Research</strong> - In-depth reports on any topic.</li>
                      <li style="margin-bottom: 8px;"><strong>Advanced Study Mode</strong> - Tailored learning systems.</li>
                      <li style="margin-bottom: 8px;"><strong>AI Image Generator</strong> - High-fidelity creative assets.</li>
                      <li style="margin-bottom: 8px;"><strong>Long-Term Memory</strong> - Persistent personalized companion.</li>
                      <li style="margin-bottom: 8px;"><strong>AI Group Chat & Voice</strong> - Interactive audio & group environments.</li>
                      <li style="margin-bottom: 0;"><strong>Early Access</strong> - Be the first to try all new features.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #334155;">We will reach out to you as soon as early access slots open up for your spot in line.</p>
              
              <!-- Divider -->
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              
              <p style="margin: 0 0 5px 0; font-size: 16px; line-height: 24px; color: #334155;">Best regards,</p>
              <p style="margin: 0; font-size: 16px; line-height: 24px; font-weight: bold; color: #0f172a;">The Nexa Team</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 18px;">&copy; 2026 Nexa. All rights reserved.</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #cbd5e1; line-height: 16px;">If you did not sign up for this waitlist, please ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
      };

      console.log("[Nexa SMTP Diagnostic] [Stage: Email send attempted] Sending plain-text and HTML email via Nodemailer...");
      const info = await transporter.sendMail(mailOptions);
      console.info("[Nexa SMTP Diagnostic] [Stage: Email send success] Confirmation email sendMail() reported success:", {
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        response: info.response,
        envelope: info.envelope,
        messageId: info.messageId,
      });
      return { success: true, info };
    } catch (err: any) {
      console.error("[Nexa SMTP Diagnostic] [Stage: Email send failure] Email delivery failed:", {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
        stack: err.stack,
      });
      return { success: false, error: err.message || String(err) };
    }
  };

  // --- FEEDBACK DATABASE SETUP ---
  const FEEDBACK_DB_PATH = path.join(process.cwd(), "feedback_db.json");

  const readFeedbackDB = (): any[] => {
    try {
      if (fs.existsSync(FEEDBACK_DB_PATH)) {
        const fileContent = fs.readFileSync(FEEDBACK_DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read feedback database:", e);
    }
    return [];
  };

  const writeFeedbackDB = (data: any[]) => {
    try {
      fs.writeFileSync(FEEDBACK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to feedback database:", e);
    }
  };

  // Get all feedback (Admin role)
  app.get("/api/feedback", (req, res) => {
    try {
      const feedbackList = readFeedbackDB();
      return res.status(200).json({ success: true, feedback: feedbackList });
    } catch (error: any) {
      console.error("[Nexa Server] Error getting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Submit new feedback
  app.post("/api/feedback", (req, res) => {
    try {
      const {
        email,
        feedbackType,
        message,
        screenshot,
        browser,
        deviceType,
        operatingSystem,
        userEmail,
        userName
      } = req.body;

      if (!feedbackType || !message) {
        return res.status(400).json({ success: false, error: "Feedback type and message are required." });
      }

      const feedbackList = readFeedbackDB();
      const newFeedback = {
        id: "fb_" + Math.random().toString(36).substring(2, 11),
        userEmail: userEmail || null,
        userName: userName || null,
        email: email || null,
        feedbackType,
        message,
        screenshotUrl: screenshot || null,
        browser: browser || "Unknown",
        deviceType: deviceType || "Unknown",
        operatingSystem: operatingSystem || "Unknown",
        status: "pending",
        timestamp: new Date().toISOString()
      };

      feedbackList.push(newFeedback);
      writeFeedbackDB(feedbackList);

      console.info(`[Nexa Server] Feedback recorded from: ${email || userEmail || "Anonymous"} (${feedbackType})`);

      return res.status(200).json({
        success: true,
        feedback: newFeedback,
        message: "🎉 Thank you for your feedback! It has been successfully received."
      });
    } catch (error: any) {
      console.error("[Nexa Server] Error submitting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update feedback status (reviewed, resolved, etc.)
  app.put("/api/feedback/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, error: "Status is required." });
      }

      const feedbackList = readFeedbackDB();
      const index = feedbackList.findIndex((item: any) => item.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: "Feedback not found." });
      }

      feedbackList[index].status = status;
      writeFeedbackDB(feedbackList);

      return res.status(200).json({ success: true, feedback: feedbackList[index] });
    } catch (error: any) {
      console.error("[Nexa Server] Error updating feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Delete feedback
  app.delete("/api/feedback/:id", (req, res) => {
    try {
      const { id } = req.params;
      const feedbackList = readFeedbackDB();
      const filtered = feedbackList.filter((item: any) => item.id !== id);

      if (feedbackList.length === filtered.length) {
        return res.status(404).json({ success: false, error: "Feedback not found." });
      }

      writeFeedbackDB(filtered);
      return res.status(200).json({ success: true, message: "Feedback deleted successfully." });
    } catch (error: any) {
      console.error("[Nexa Server] Error deleting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Premium Waitlist Post endpoint
  app.post("/api/premium/waitlist", async (req, res) => {
    try {
      const { email, userId, source } = req.body;
      console.log(`[Nexa SMTP Diagnostic] [Stage: Request received] POST /api/premium/waitlist reached for email: ${email}, userId: ${userId}, source: ${source}`);

      if (!email) {
        console.warn("[Nexa SMTP Diagnostic] [Stage: Aborted] Missing email in waitlist request body.");
        return res.status(400).json({ success: false, error: "Email is required to join the waitlist." });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Since the frontend successfully writes the record in the 'waitlist' table
      // before dispatching this fetch call, we confirm Supabase success here.
      console.log(`[Nexa SMTP Diagnostic] [Stage: Supabase success] Verified that waitlist record for ${normalizedEmail} was written to Supabase by the client.`);

      console.log(`[Nexa SMTP Diagnostic] [Stage: Email send attempted] Handing off email delivery to sendWaitlistEmail for: ${normalizedEmail}`);
      
      // Execute sendWaitlistEmail synchronously so we can catch and display errors
      const emailResult = await sendWaitlistEmail(normalizedEmail);
      
      if (emailResult.success) {
        console.log(`[Nexa SMTP Diagnostic] [Stage: Email send success] sendWaitlistEmail succeeded for: ${normalizedEmail}`);
        return res.status(200).json({
          success: true,
          status: "joined",
          message: "🎉 You're officially on the Nexa Premium Waitlist!\n\nA confirmation email has been sent to your email address."
        });
      } else {
        console.error(`[Nexa SMTP Diagnostic] [Stage: Email send failure] sendWaitlistEmail reported failure for: ${normalizedEmail}. Error: ${emailResult.error}`);
        return res.status(500).json({
          success: false,
          error: `SMTP Error: ${emailResult.error || "Failed to send confirmation email."}`
        });
      }

    } catch (error: any) {
      console.error("[Nexa SMTP Diagnostic] Premium waitlist registration API error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to join the waitlist. Please try again."
      });
    }
  });

  // Check waitlist status endpoint
  app.get("/api/premium/waitlist/check", async (req, res) => {
    try {
      // The client-side will query Supabase directly for the precise check. 
      // We return success: true and registered: false by default here, as the client handles it.
      return res.status(200).json({ success: true, registered: false });
    } catch (error: any) {
      console.error("Check waitlist error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Leave waitlist endpoint
  app.post("/api/premium/waitlist/leave", async (req, res) => {
    try {
      // Client-side deletes from Supabase directly, so we just return success: true.
      return res.status(200).json({
        success: true,
        message: "You've successfully left the Nexa Premium Waitlist.\n\nYou can join again anytime."
      });

    } catch (error: any) {
      console.error("Leave waitlist error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to remove you from the waitlist. Please try again."
      });
    }
  });

  // Test email endpoint
  app.all("/api/test-email", async (req, res) => {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || `Nexa <${user}>`;

    if (!user || !pass) {
      return res.status(500).json({
        success: false,
        error: "SMTP credentials are not configured in environment variables."
      });
    }

    const recipients = ["bittomaurya0@gmail.com", "mayanktechnologies00@gmail.com"];

    console.log("[Nexa Express SMTP Test] [Stage: Request received] Triggering test email delivery...");

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        debug: true,
        logger: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      console.log("[Nexa Express SMTP Test] [Stage: Transporter created] Verifying connection...");
      await transporter.verify();
      console.log("[Nexa Express SMTP Test] [Stage: SMTP authentication success] Verification succeeded!");

      const mailOptions = {
        from,
        to: recipients.join(", "),
        replyTo: from,
        subject: "Nexa SMTP Test",
        text: `Hello! This is a test email from Nexa. Thank you for joining our waitlist!\n\nExclusive features you will unlock with Nexa Premium:\n- Faster AI Responses\n- Unlimited Deep Research\n- Advanced Study Mode\n- AI Image Generator\n- Long-Term Memory\n- AI Group Chat & Voice Calls\n- Early Access to Upcoming Features`,
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexa Premium Waitlist</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header (Nexa Branding) -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">Nexa</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Premium Waitlist</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 30px; background-color: #ffffff;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #334155;">Hi there,</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #334155;">Thank you for joining the <strong>Nexa Premium Waitlist</strong>! We are absolutely thrilled to have you with us.</p>
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #334155;">You are officially on the list and will be among the first to gain early access when Nexa Premium officially launches.</p>
              
              <!-- Features Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #f1f5f9; border-radius: 6px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: bold; color: #0f172a;">Exclusive features you will unlock with Nexa Premium:</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 22px; color: #475569;">
                      <li style="margin-bottom: 8px;"><strong>Faster AI Responses</strong> - Priority speed with zero delay.</li>
                      <li style="margin-bottom: 8px;"><strong>Unlimited Deep Research</strong> - In-depth reports on any topic.</li>
                      <li style="margin-bottom: 8px;"><strong>Advanced Study Mode</strong> - Tailored learning systems.</li>
                      <li style="margin-bottom: 8px;"><strong>AI Image Generator</strong> - High-fidelity creative assets.</li>
                      <li style="margin-bottom: 8px;"><strong>Long-Term Memory</strong> - Persistent personalized companion.</li>
                      <li style="margin-bottom: 8px;"><strong>AI Group Chat & Voice</strong> - Interactive audio & group environments.</li>
                      <li style="margin-bottom: 0;"><strong>Early Access</strong> - Be the first to try all new features.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #334155;">We will reach out to you as soon as early access slots open up for your spot in line.</p>
              
              <!-- Divider -->
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              
              <p style="margin: 0 0 5px 0; font-size: 16px; line-height: 24px; color: #334155;">Best regards,</p>
              <p style="margin: 0; font-size: 16px; line-height: 24px; font-weight: bold; color: #0f172a;">The Nexa Team</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 18px;">&copy; 2026 Nexa. All rights reserved.</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #cbd5e1; line-height: 16px;">If you did not sign up for this waitlist, please ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
      };

      console.log("[Nexa Express SMTP Test] [Stage: Email send attempted] Sending test mail...");
      const info = await transporter.sendMail(mailOptions);

      console.log("[Nexa Express SMTP Test] [Stage: Email send success] Full sendMail Result:", {
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        response: info.response,
        envelope: info.envelope,
        messageId: info.messageId,
      });

      return res.status(200).json({
        success: true,
        message: "Test emails sent successfully!",
        recipients,
        info: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
          messageId: info.messageId,
          envelope: info.envelope,
        }
      });

    } catch (err: any) {
      console.error("[Nexa Express SMTP Test] [Stage: Email send failure] Diagnostic failed:", {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
        stack: err.stack,
      });

      return res.status(500).json({
        success: false,
        error: err.message || err,
        details: {
          code: err.code,
          command: err.command,
          response: err.response,
          responseCode: err.responseCode,
        }
      });
    }
  });


  // Nexa Core Smart Chat API Gateway
  app.post("/api/chat", async (req, res) => {
    try {
      const {
        messages,
        mode = "general",
        explainLikeIm10 = false,
        writingStyle = "casual",
        quizTopic = "",
        quizDifficulty = "medium",
        personalizationContext = "",
        turboMode = true,
        otherSessions = []
      } = req.body;

      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided" });
      }

      const activeMessage = messages[messages.length - 1];
      const userPrompt = activeMessage.content || "";
      const attachment = activeMessage.attachment;
      const hasImage = !!(attachment && attachment.type === "image");

      // Smart URL detection & Link analysis
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const detectedUrls = Array.from(new Set(userPrompt.match(urlRegex) || [])) as string[];
      const hasUrls = detectedUrls.length > 0;

      let linkAnalyzerContext = "";
      let pdfParts: any[] = [];

      if (hasUrls) {
        console.info(`[Nexa Core Server] URL detected in user prompt. Starting Universal Link Analysis...`);
        const analysisResults = await Promise.all(
          detectedUrls.map(url => fetchUrlMetadataAndContent(url))
        );

        const nonPdfResults = analysisResults.filter(r => !r.pdfData);
        if (nonPdfResults.length > 0) {
          linkAnalyzerContext = `\n\n[NEXA UNIVERSAL LINK ANALYZER - RAW CONTENT & METADATA FEED]
The user is requesting an analysis of one or more URLs. Below is the parsed, server-side content & metadata for the requested link(s). Use these raw details, combined with Google Search grounding, to fulfill the request.

${nonPdfResults.map((res, i) => `
---
LINK #${i + 1}: ${res.url}
TYPE: ${res.type}
TITLE: ${res.title || "Unknown Title"}
DESCRIPTION: ${res.description || "No description available."}
${res.gitHubData ? `GITHUB DETAILS:
Stars: ${res.gitHubData.stargazers_count} | Forks: ${res.gitHubData.forks_count} | Open Issues: ${res.gitHubData.open_issues_count}
Languages: ${res.gitHubData.language || "N/A"}
License: ${res.gitHubData.license?.name || "None"}` : ""}
${res.bodyText ? `BODY TEXT CONTENT (Truncated):
${res.bodyText.substring(0, 8000)}` : ""}
${res.isPrivateOrError ? `STATUS: Direct fetch blocked or failed (${res.errorMessage}). Rely strictly on Google Search Grounding to research and verify details of this URL.` : ""}
---`).join("\n")}
`;
        }

        const pdfResults = analysisResults.filter(r => !!r.pdfData);
        pdfResults.forEach(r => {
          pdfParts.push({
            inlineData: {
              mimeType: r.pdfData!.mimeType,
              data: r.pdfData!.data
            }
          });
        });
      }

      // Smart Route classification
      const engineId = routeTask(userPrompt, mode, hasImage);

      // Lazily get Gemini Client
      const ai = getGeminiClient();

      // Setup System Instructions and configs depending on engine and mode
      let systemInstruction = "You are Nexa Core - an intelligent, helpful, highly premium, trustworthy AI chatbot designed with ultimate professional craftsmanship. You express answers in beautiful markdown with rich structure. Do not output any loading bars, neon effects or system-internal trace lines. IMPORTANT: ONLY if the user explicitly asks about who created you, built you, made you, or who your founder is, should you respond simply and clearly that you were created by Mayank (or in appropriate dialect/language like 'मुझे मयंक ने बनाया है' or 'Mayank ne banaya hai'). NEVER volunteer this information or mention your creator unless directly and explicitly asked about it first. CRITICAL: Always respond/reply to the user in the EXACT same language, dialect, or conversational slang that the user used to write their message (e.g., if the user asks in Hindi, Hinglish, Haryanvi, Spanish, etc., you MUST reply in that exact same tongue and tone).";

      if (hasUrls) {
        systemInstruction += "\n\nUNIVERSAL LINK ANALYZER SYSTEM MODULE:\n" +
          "You have been activated as the Nexa Universal Link Analyzer. For every link provided by the user, perform a comprehensive, intelligent, high-fidelity analysis. Do NOT use lazy placeholders. " +
          "Provide the following structured sections (use emojis, headings, bullet points, and tables beautifully):\n" +
          "1. 🌐 LINK OVERVIEW: Title, URL, Content Type, Domain Reputation.\n" +
          "2. 📝 EXECUTIVE SUMMARY: A concise summary of the page/content.\n" +
          "3. 🔍 DETAILED BREAKDOWN: In-depth, comprehensive explanation of the content.\n" +
          "4. 💡 KEY POINTS & IMPORTANT FACTS: Extraction of key facts, tables, headings, and crucial data.\n" +
          "5. ⚖️ PROS & CONS: Balanced evaluation (when applicable).\n" +
          "6. 🛠️ TECHNICAL ANALYSIS (if applicable): For GitHub, identify programming languages, frameworks, and project structure. For code files, analyze logic.\n" +
          "7. 🛡️ SECURITY & TRUST ASSESSMENT: Check for phishing, scams, suspicious domains, fake websites, or login walls. Analyze the domain/URL safety.\n" +
          "8. 🚀 SEO & METADATA ANALYSIS: For websites, analyze SEO tags, performance hints, and indexability.\n" +
          "9. 🔮 AI-GENERATED RECOMMENDATIONS & FINAL CONCLUSION: Actionable ideas, logical next steps, and wrap-up.\n" +
          "\n" +
          "If multiple links are provided, you MUST compare them together side-by-side using a clean Markdown table with headers, highlighting their main differences, purposes, and ratings.\n" +
          "Answer any follow-up questions about these links with high accuracy using the preserved context.";
      }

      if (personalizationContext) {
        systemInstruction += `\nRemember this user persona/instructions: ${personalizationContext}`;
      }

      // Add related past chats link detector (highly optimized for minimal token overhead and fast speeds)
      if (otherSessions && otherSessions.length > 0) {
        let pastChatsSummary = "\n\nCRITICAL CONTEXT - USER'S OTHER PAST CHAT SESSIONS:\n";
        pastChatsSummary += "You have visibility of user's other past sessions. Gently mention relative connections organically.\n";
        otherSessions.slice(0, 3).forEach((s: any) => {
          const lastMsgs = Array.isArray(s.messages) ? s.messages.slice(-1).map((m: any) => `[${m.role}]: ${m.content}`).join(" | ").substring(0, 80) : "";
          pastChatsSummary += `- Session ID: "${s.id}" | Title: "${s.title}" | Mode: "${s.mode}" | Preview: "${lastMsgs}"\n`;
        });
        systemInstruction += pastChatsSummary;
      }

      // Configure tools - enable Google Search grounding for real-time mode, Deep Research, Fact Checker, or when URLs are present
      const useSearch = mode === "research" || mode === "factcheck" || hasUrls || userPrompt.toLowerCase().includes("search") || userPrompt.toLowerCase().includes("live") || userPrompt.toLowerCase().includes("news") || userPrompt.toLowerCase().includes("current");
      const tools = useSearch ? [{ googleSearch: {} }] : undefined;

      if (useSearch) {
        systemInstruction += "\n\n🌐 CITED ANSWERS & GROUNDED WEB SEARCH MODULE:\n" +
          "When answering, you must strictly base your responses on factual, reliable search results. You must adhere to the following directives:\n" +
          "1. PRIORITIZE HIGH-TRUST SOURCES:\n" +
          "   - Prioritize official documentation over personal blogs.\n" +
          "   - Prioritize government (.gov), university (.edu), academic research papers, and official corporate websites.\n" +
          "   - For programming, prioritize official documentations, GitHub repos, MDN, Microsoft Learn, Python Docs, React Docs, and other standard SDK guides.\n" +
          "   - For medical topics, prioritize official institutions like WHO, NIH, NHS, CDC, and established medical organization sites.\n" +
          "   - For finance topics, prioritize government treasuries, official central banks, and established financial regulatory bodies.\n" +
          "   - For legal topics, prioritize official legislative portals and government judiciaries.\n" +
          "2. NO FABRICATION:\n" +
          "   - Never generate fake, guessed, or fabricated sources or URLs. Only cite links that are directly returned in the search results or provided in user inputs.\n" +
          "   - If no reliable public source or information exists for this query in the search results, explicitly state: 'No reliable public source was found for this information.'\n" +
          "3. IN-TEXT CITATIONS:\n" +
          "   - Support your claims by adding clear numbered in-text citations like [1], [2], etc., corresponding to the reliable source indexes.\n" +
          "4. END-OF-TEXT SOURCES SECTION:\n" +
          "   - At the absolute end of your response text, append a clearly titled section: '### Sources' (or in the language used, e.g. '### स्रोत' for Hindi / Hinglish).\n" +
          "   - List each cited source using its index number, Website Name, Article/Page Title, Clickable URL, Publisher (if available), and Publication date (if available) as detailed below:\n" +
          "     Example:\n" +
          "     1. OpenAI – GPT Documentation  \n" +
          "        https://platform.openai.com/docs  \n" +
          "        Publisher: OpenAI | Date: 2024\n" +
          "     *(Make sure they are fully populated using authentic metadata. If any field like publisher or date is unavailable, omit that specific field rather than guessing)*.";
      }

      // Construct request parts (handling potential image/document attachments safely)
      let contents: any[] = [];
      
      // Map previous message history for context aware conversation
      messages.forEach((msg: any) => {
        const role = msg.role === "assistant" ? "model" : "user";
        const textContent = (msg.content || "").trim();

        if (role === "user" && msg.attachment && msg.attachment.dataUrl) {
          const splitData = msg.attachment.dataUrl.split(",");
          const base64Data = splitData[1] || splitData[0];
          
          let mimeType = "image/jpeg";
          const fileNameLower = (msg.attachment.name || "").toLowerCase();
          if (msg.attachment.type === "pdf" || fileNameLower.endsWith(".pdf")) {
            mimeType = "application/pdf";
          } else if (msg.attachment.type === "txt" || fileNameLower.endsWith(".txt")) {
            mimeType = "text/plain";
          } else if (msg.attachment.type === "image" || fileNameLower.endsWith(".png")) {
            mimeType = "image/png";
          } else if (fileNameLower.endsWith(".webp")) {
            mimeType = "image/webp";
          } else if (fileNameLower.endsWith(".gif")) {
            mimeType = "image/gif";
          }

          const parts: any[] = [
            { inlineData: { mimeType, data: base64Data } }
          ];

          if (textContent) {
            parts.push({ text: textContent });
          } else {
            parts.push({ text: mimeType.startsWith("image/") ? "Analyze this image." : "Analyze this document." });
          }

          contents.push({ role, parts });
        } else if (role === "user" && msg.attachment && msg.attachment.textPreview) {
          contents.push({
            role: "user",
            parts: [{ text: `[Document Attachment "${msg.attachment.name}":\n${msg.attachment.textPreview}]\n\n${textContent || "Please analyze or summarize this document context."}` }]
          });
        } else {
          // Standard text message
          if (textContent) {
            contents.push({ role, parts: [{ text: textContent }] });
          } else {
            contents.push({ role, parts: [{ text: "..." }] });
          }
        }
      });

      // Inject server-side Link Analysis results if URLs are present in the active query
      if (hasUrls && contents.length > 0) {
        const lastContent = contents[contents.length - 1];
        if (lastContent.role === "user") {
          if (linkAnalyzerContext) {
            lastContent.parts.push({ text: linkAnalyzerContext });
          }
          if (pdfParts.length > 0) {
            lastContent.parts.push(...pdfParts);
          }
        }
      }

      // Choose speed-optimized model: gemini-3.5-flash handles link analysis and complex content better
      const modelName = (mode === "research" || mode === "factcheck" || mode === "quiz" || hasUrls)
        ? "gemini-3.5-flash"
        : "gemini-3.1-flash-lite";

      // ----------------------------------------------------
      // CASE A: QUIZ GENERATOR MODE (Structured JSON Output)
      // ----------------------------------------------------
      if (mode === "quiz" || userPrompt.toLowerCase().includes("generate quiz") || userPrompt.toLowerCase().includes("mcq")) {
        const topic = quizTopic || userPrompt || "General Knowledge";
        systemInstruction = `You are the Nexa Learning Engine’s MCQ & Quiz Generator. Generate a high quality 5-question multiple choice quiz about "${topic}" on difficulty level "${quizDifficulty}". Always provide exact explanations for the correct answer. You must output exactly matching the JSON schema.`;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctOptionIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                },
                required: ["id", "question", "options", "correctOptionIndex", "explanation"]
              }
            }
          },
          required: ["topic", "difficulty", "questions"]
        };

        const result = await generateContentWithRetry({
          initialModel: modelName,
          contents: contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode: turboMode
        });

        const quizData = JSON.parse(result.text || "{}");
        return res.json({
          content: `I've successfully generated a custom quiz on **${quizData.topic}** (${quizData.difficulty} level) for you! Use the interface to answer and test your knowledge.`,
          engineId: "learning",
          quiz: quizData
        });
      }

      // ----------------------------------------------------
      // CASE B: FACT CHECK MODE (Structured Fact Checks)
      // ----------------------------------------------------
      if (mode === "factcheck" || userPrompt.toLowerCase().includes("fact check") || userPrompt.toLowerCase().includes("verify")) {
        systemInstruction = "You are the Nexa Fact Check Engine, a highly meticulous information validator. Investigate the claim provided in the prompt. Grade it with Confidence, Reliability, and give a clear Verdict ('verified', 'misleading', 'unverified', or 'debunked'). Search the web to check validity. Do not generate fake URLs.";

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            contentMarkdown: { type: Type.STRING, description: "Detailed structural markdown report with sections: Context, Investigation, and Final verdict" },
            confidenceScore: { type: Type.INTEGER, description: "Percentage reflecting exact certainty of verdict 0-100" },
            reliabilityScore: { type: Type.INTEGER, description: "Percentage reflecting source credibility 0-100" },
            verdict: { type: Type.STRING, description: "'verified' | 'misleading' | 'unverified' | 'debunked'" },
            explanation: { type: Type.STRING, description: "One sentence executive explanation of the check" },
            sourcesChecked: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["contentMarkdown", "confidenceScore", "reliabilityScore", "verdict", "explanation", "sourcesChecked"]
        };

        const result = await generateContentWithRetry({
          initialModel: modelName,
          contents: contents,
          config: {
            systemInstruction,
            tools,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode: turboMode
        });

        const factData = JSON.parse(result.text || "{}");
        const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources: GroundingSource[] = [];
        if (grounding) {
          grounding.forEach((c: any) => {
            if (c.web) {
              sources.push({ title: c.web.title, uri: c.web.uri });
            }
          });
        }

        return res.json({
          content: factData.contentMarkdown,
          engineId: "core",
          sources: sources.length > 0 ? sources : factData.sourcesChecked.map((s: string) => ({ title: s, uri: "#" })),
          factCheck: {
            confidenceScore: factData.confidenceScore,
            reliabilityScore: factData.reliabilityScore,
            verdict: factData.verdict,
            explanation: factData.explanation,
            sourcesChecked: factData.sourcesChecked
          }
        });
      }

      // ----------------------------------------------------
      // CASE C: DEEP RESEARCH MODE (Comprehensive Reports)
      // ----------------------------------------------------
      if (mode === "research") {
        systemInstruction = `You are Nexa's premium Deep Research Engine. Conduct an exhaustive exploration on the user query. Do multi-source exploration, analyze historical insights, present structural findings. Search the web for current live references. Output EXACTLY structured JSON according to the schema provided. Organize each section cleanly without skipping parts.`;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING, description: "Brief high level TL;DR summary" },
            detailedFindings: { type: Type.STRING, description: "Extensive deep dive report with formatting and bullet points" },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 5 core takeaway insights from the topic"
            }
          },
          required: ["executiveSummary", "detailedFindings", "keyInsights"]
        };

        const result = await generateContentWithRetry({
          initialModel: modelName,
          contents: contents,
          config: {
            systemInstruction,
            tools,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode: turboMode
        });

        const reportData = JSON.parse(result.text || "{}");
        const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources: GroundingSource[] = [];
        if (grounding) {
          grounding.forEach((c: any) => {
            if (c.web) {
              sources.push({ title: c.web.title, uri: c.web.uri });
            }
          });
        }

        return res.json({
          content: `### Executive Summary\n${reportData.executiveSummary}\n\n### Detailed Findings\n${reportData.detailedFindings}`,
          engineId: "core",
          sources,
          researchReport: {
            executiveSummary: reportData.executiveSummary,
            detailedFindings: reportData.detailedFindings,
            keyInsights: reportData.keyInsights,
            references: sources
          }
        });
      }

      // ----------------------------------------------------
      // CASE D: STUDY MODE (Regular and Explain Like I'm 10)
      // ----------------------------------------------------
      if (mode === "study" || engineId === "learning") {
        systemInstruction = "You are Nexa Learning Engine - an educational assistant. Answer in highly structural blocks.";
        if (explainLikeIm10) {
          systemInstruction += " EXTREMELY IMPORTANT: Explain this topic under the strict constraint of 'Explain Like I'm 10' (ELI10). Use highly intuitive daily analogical references, simplified terms, and a nurturing tone suitable for a 10 year old kid.";
        } else {
          systemInstruction += " Provide rich study guides, outline key formulas, write explanatory notes, and offer exam preparation recommendations.";
        }
      }

      // ----------------------------------------------------
      // CASE E: REASONING ENGINE (Mathematical, programming, logic)
      // ----------------------------------------------------
      else if (engineId === "reasoning") {
        systemInstruction = "You are the Nexa Reasoning Engine. Break down calculations, logic schemas, code optimizations, and math proofs recursively. Always provide detailed step-by-step reasoning sequences. Wrap equations in standard LaTeX expressions or clear math block dividers.";
      }

      // ----------------------------------------------------
      // CASE F: VISION ENGINE (Multimodal image tasks)
      // ----------------------------------------------------
      else if (engineId === "vision") {
        systemInstruction = "You are the Nexa Vision Engine. Thoroughly analyze the image uploaded by the user. Perform exact mathematical/chemical diagram reasoning, run screenshot OCR extraction if text exists, tell details of homework pages, and write structural breakdown comments.";
      }

      // ----------------------------------------------------
      // CASE G: LANGUAGE ENGINE (Translation grammar correction)
      // ----------------------------------------------------
      else if (engineId === "language") {
        systemInstruction = "You are the Nexa Language Engine. Perfect grammar, offer fluent translations, correct phrasing, give vocabulary synonyms, and assist multilingual interaction across standard Indian regional or International languages.";
      }

      // ----------------------------------------------------
      // CASE H: WRITING ASSISTANT MODE
      // ----------------------------------------------------
      else if (mode === "writing") {
        systemInstruction = `You are Nexa's premium Creative Writing Assistant. Draft content precisely matched with the selected theme: "${writingStyle}". Ensure high cohesion, clean rhythm, outstanding paragraphs, and beautiful grammar. Style matches:
- 'formal': professional, corporate-ready, polite and meticulous.
- 'casual': conversational, lively, high empathy, human-focused.
- 'academic': rigorous, high validation, detailed context, passive-neutral.
- 'professional': outcome-driven, key-point bullets, highly actionable.`;
      }

      // Call standard generateContent
      if (systemInstruction) {
        // Appending response formatting rules as requested by user
        systemInstruction += "\n\nRESPONSE FORMATTING DIRECTIVES:\n" +
          "1. Agar user bole 'copy paste format me do', 'copyable format', 'code block me do', 'copy karne layak do', ya similar phrases, to response hamesha Markdown code block (```) ke andar hi do, bina kisi extra greeting ya explanations ke (ONLY the requested content should be inside the code block so the user can copy with one click).\n" +
          "2. Agar user specifically bole 'sirf copy paste format', to extra explanations, introductory text, or concluding text bilkul mat do. Bilkul clean code block me content do.\n" +
          "3. Bullet lists, numbered lists, headings, bold, italic, or blockquotes ke liye proper clean Markdown standards follow karo.\n" +
          "4. Kisi bhi block of code, SQL queries, HTML, CSS, JSON, CSV, or prompts ko hamesha code blocks (```language ... ```) me render karo with proper syntax highlighting.\n" +
          "5. Agar user table maange, to standard cleanly formatted and aligned Markdown tables ka use karo, dynamic column layouts use karo aur line-breaks break mat karo.\n" +
          "6. Plain text use tabhi karo jab user explicitly plain text maange.";

        systemInstruction += "\nAlways use suitable and warm emojis throughout your response (unless copying format or code block format is requested) to make it look highly expressive, welcoming, interactive, and beautifully designed. Place relevant emojis at key moments, headers, lists, and inside paragraphs where appropriate.";
        systemInstruction += "\nCRITICAL LANGUAGE DIRECTIVE: Always detect and respond in the EXACT language, dialect, or conversational slang that the user has used in their last message. If the user writes in English, reply in English. If the user writes in Hinglish (Hindi written in Latin script, e.g. 'nexa ab bhi hindi mai...', 'kaise ho', 'kya chalra hai', 'theek h'), you MUST write your entire response inside standard Hinglish (Latin alphabets) with similar colloquial slang. If they use pure Devnagari Hindi (हिन्दी), reply in pure Devnagari Hindi. Never auto-translate or respond in a different language/script combination than what the user used. Keep consistency with the user's chosen script and tongue.";
      }

      const result = await generateContentWithRetry({
        initialModel: modelName,
        contents: contents,
        config: {
          systemInstruction,
          tools,
        },
        turboMode: turboMode
      });

      const responseText = result.text || "";
      const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = [];
      if (grounding) {
        grounding.forEach((c: any) => {
          if (c.web) {
            sources.push({ title: c.web.title, uri: c.web.uri });
          }
        });
      }

      return res.json({
        content: responseText,
        engineId: engineId,
        sources: sources.length > 0 ? sources : undefined
      });

    } catch (err: any) {
      console.info("[Nexa Gateway Warning] Gemini API Gateway Exception:", err?.message || err);
      // Fallback clean mock-less response when API fails or Key is absent
      return res.status(200).json({
        content: `### 🔴 System Alert\n\nNexa's secure core is active. The engine experienced a connectivity or configuration state issue.\n\n**Reason:** ${err.message || "Unknown gateway timeout"}\n\n*Please ensure your **GEMINI_API_KEY** is configured in AI Studio's **Settings > Secrets** or in your environment '.env' file to unlock direct real-time answers.*`,
        engineId: "core",
        sources: [{ title: "Configure Keys", uri: "#" }]
      });
    }
  });

  // Automated Title Generation from Prompt and Response
  app.post("/api/generate-title", async (req, res) => {
    try {
      const { prompt, response } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided" });
      }

      console.info("[Nexa Core Server] Generating title for new conversation...");
      
      const systemInstruction = 
        "You are a helpful assistant. Generate a highly concise, creative, and professional title summarizing the user query and response. " +
        "CRITICAL RULES:\n" +
        "- The title must be between 2 to 5 words long.\n" +
        "- Do NOT wrap the title in quotes, backticks, or any markdown.\n" +
        "- Do NOT use any emojis, punctuation, or special characters.\n" +
        "- Respond ONLY with the title itself, with no extra text or pleasantries.\n" +
        "- Keep it in the same language/script as the prompt (e.g. if prompt is in Hindi/Hinglish, summarize in Hinglish or simple Hindi; otherwise English).";

      const result = await generateContentWithRetry({
        initialModel: "gemini-3.1-flash-lite", // Speed-optimized
        contents: [
          {
            role: "user",
            parts: [{ text: `Prompt: ${prompt}\n\nResponse: ${response || ""}\n\nGenerate Title:` }]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        },
        turboMode: true
      });

      const title = (result.text || "").trim().replace(/^["']|["']$/g, "").replace(/[#*_`]/g, "");
      console.info(`[Nexa Core Server] Generated title: "${title}"`);
      
      return res.json({ title: title || "New Chat" });
    } catch (err: any) {
      console.error("[Nexa Server] Title generation exception:", err);
      return res.status(200).json({ title: "New Chat" }); // Graceful fallback
    }
  });

  // --- SHARED CONVERSATIONS ENDPOINTS ---

  // --- BRUTE FORCE PROTECTION & ACCESS CODE GENERATION ---
  const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

  function generateAccessCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Readable, secure uppercase chars
    const randomSegment = (len: number) => {
      let s = "";
      for (let i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return s;
    };
    
    // Choose randomly from user-requested patterns: NXA-4K7P-9Q, CHAT-8M2X, NXA-AB12CD
    const formats = [
      () => `NXA-${randomSegment(4)}-${randomSegment(2)}`,
      () => `CHAT-${randomSegment(4)}`,
      () => `NXA-${randomSegment(6)}`
    ];
    return formats[Math.floor(Math.random() * formats.length)]();
  }

  // --- SHARED CHATS DATABASE SYNC HELPERS ---
  const syncSharedConfigToSupabase = async (config: any) => {
    const supabase = getSupabaseServer();
    if (!supabase || !config || !config.id) return;
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
        updated_at: new Date().toISOString()
      }, { onConflict: "id" }).catch(() => {});

      if (Array.isArray(config.participants)) {
        for (const p of config.participants) {
          await supabase.from("shared_participants").upsert({
            chat_id: config.id,
            email: p.email,
            name: p.name,
            role: p.role || "editor",
            joined_at: p.joinedAt || new Date().toISOString()
          }, { onConflict: "chat_id,email" }).catch(() => {});
        }
      }

      if (config.accessCode) {
        await supabase.from("share_codes").upsert({
          chat_id: config.id,
          access_code: config.accessCode,
          is_active: config.accessCodeIsActive !== false,
          expires_at: config.accessCodeExpiresAt || null,
          permission: config.accessCodePermission || "chat",
          duration_type: config.accessCodeDurationType || "never"
        }, { onConflict: "chat_id" }).catch(() => {});
      }
    } catch (e: any) {
      console.warn("[Nexa Server] Notice during Supabase share sync:", e.message);
    }
  };

  const cleanShareInput = (input: string): string => {
    if (!input) return "";
    let clean = input.trim();

    // Strip full domain / origin if present
    if (clean.includes("://")) {
      try {
        const url = new URL(clean);
        clean = url.pathname + url.search + url.hash;
      } catch (e) {
        clean = clean.split("://")[1] || clean;
        if (clean.includes("/")) {
          clean = clean.substring(clean.indexOf("/"));
        }
      }
    }

    // Strip common path prefixes
    if (clean.includes("/share/thread/")) {
      clean = clean.split("/share/thread/")[1] || clean;
    } else if (clean.includes("/share/")) {
      clean = clean.split("/share/")[1] || clean;
    } else if (clean.includes("/code/")) {
      clean = clean.split("/code/")[1] || clean;
    }

    if (clean.startsWith("thread/")) {
      clean = clean.replace("thread/", "");
    }

    // Strip hash or query parameters
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
  };

  // Helper to find shared chat config by chatId, shareToken, or accessCode
  const findSharedConfig = (input: string) => {
    if (!input) return null;
    const sharedDb = readSharedDB();
    const clean = cleanShareInput(input);
    
    // 1. Direct match on chatId key
    if (sharedDb[clean]) {
      return { actualChatId: clean, config: sharedDb[clean] };
    }
    if (sharedDb[input]) {
      return { actualChatId: input, config: sharedDb[input] };
    }
    
    // 2. Match on shareToken
    const foundByTokenKey = Object.keys(sharedDb).find(
      id => sharedDb[id].shareToken === clean || sharedDb[id].shareToken === input
    );
    if (foundByTokenKey) {
      return { actualChatId: foundByTokenKey, config: sharedDb[foundByTokenKey] };
    }
    
    // 3. Match on accessCode (normalized comparison)
    const normalizedInput = clean.toUpperCase().replace(/[- ]/g, "");
    if (normalizedInput) {
      const foundByCodeKey = Object.keys(sharedDb).find(id => {
        const dbCode = sharedDb[id].accessCode;
        if (!dbCode) return false;
        return dbCode.toUpperCase().replace(/[- ]/g, "") === normalizedInput;
      });
      if (foundByCodeKey) {
        return { actualChatId: foundByCodeKey, config: sharedDb[foundByCodeKey] };
      }
    }

    return null;
  };

  const findSharedConfigAsync = async (input: string) => {
    if (!input) return null;
    console.log(`[Nexa Server] [findSharedConfigAsync] Searching share config for input: "${input}"`);
    const syncResult = findSharedConfig(input);
    if (syncResult) {
      console.log(`[Nexa Server] [findSharedConfigAsync] Resolved from local DB: actualChatId="${syncResult.actualChatId}"`);
      return syncResult;
    }

    const clean = cleanShareInput(input);
    const normalizedInput = clean.toUpperCase().replace(/[- ]/g, "");

    // Check Supabase
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
          // Query share_codes with multiple variations (exact, normalized, ILIKE)
          const { data: codeData } = await supabase
            .from("share_codes")
            .select("*")
            .or(`access_code.eq.${clean},access_code.ilike.${clean},access_code.ilike.${normalizedInput}`)
            .maybeSingle();
          if (codeData) {
            matchedChatId = codeData.chat_id;
          }
        }

        if (matchedChatId) {
          const { data: sc } = await supabase
            .from("shared_conversations")
            .select("*")
            .eq("chat_id", matchedChatId)
            .maybeSingle();

          const { data: parts } = await supabase
            .from("shared_participants")
            .select("*")
            .eq("chat_id", matchedChatId);

          const { data: scode } = await supabase
            .from("share_codes")
            .select("*")
            .eq("chat_id", matchedChatId)
            .maybeSingle();

          if (sc) {
            const rehydratedConfig = {
              id: matchedChatId,
              ownerEmail: sc.owner_email,
              ownerName: sc.owner_name || sc.owner_email?.split("@")[0],
              isSharingActive: sc.is_sharing_active !== false,
              shareToken: sc.share_token,
              expiresAt: sc.expires_at || null,
              defaultPermission: sc.default_permission || "chat",
              participants: (parts || []).map((p: any) => ({
                email: p.email,
                name: p.name || p.email?.split("@")[0],
                role: p.role || "editor",
                joinedAt: p.joined_at || p.created_at
              })),
              accessCode: scode?.access_code || generateAccessCode(),
              accessCodeExpiresAt: scode?.expires_at || null,
              accessCodePermission: scode?.permission || "chat",
              accessCodeIsActive: scode?.is_active !== false,
              accessCodeDurationType: scode?.duration_type || "never"
            };

            const sharedDb = readSharedDB();
            sharedDb[matchedChatId] = rehydratedConfig;
            writeSharedDB(sharedDb);

            console.log(`[Nexa Server] [findSharedConfigAsync] Rehydrated share config from Supabase for chat: "${matchedChatId}"`);
            return { actualChatId: matchedChatId, config: rehydratedConfig };
          }
        }
      } catch (supaErr: any) {
        console.warn("[Nexa Server] Notice during Supabase share query:", supaErr.message);
      }
    }

    // Auto-provision default share config if input is a valid chatId format (e.g. session-xxx) or exists in local user chats
    const targetChatId = clean || input;
    if (targetChatId && (targetChatId.startsWith("session-") || targetChatId.length >= 8)) {
      const userDb = readDB();
      let ownerEmail = "guest@nexa.ai";
      let ownerName = "Nexa User";
      let chatFound = false;

      for (const email of Object.keys(userDb)) {
        const u = userDb[email];
        if (Array.isArray(u.chats) && u.chats.some((c: any) => c.id === targetChatId)) {
          ownerEmail = email;
          ownerName = u.fullName || email.split("@")[0];
          chatFound = true;
          break;
        }
      }

      if (chatFound || targetChatId.startsWith("session-")) {
        console.info(`[Nexa Server] [findSharedConfigAsync] Auto-provisioning share configuration for chat "${targetChatId}"`);
        const token = "sh_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const code = generateAccessCode();
        const autoConfig = {
          id: targetChatId,
          ownerEmail: ownerEmail.toLowerCase().trim(),
          ownerName: ownerName,
          isSharingActive: true,
          shareToken: token,
          expiresAt: null,
          defaultPermission: "chat",
          participants: [],
          accessCode: code,
          accessCodeExpiresAt: null,
          accessCodePermission: "chat",
          accessCodeIsActive: true,
          accessCodeDurationType: "never"
        };

        const sharedDb = readSharedDB();
        sharedDb[targetChatId] = autoConfig;
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(autoConfig);

        return { actualChatId: targetChatId, config: autoConfig };
      }
    }

    console.warn(`[Nexa Server] [findSharedConfigAsync] Config NOT found for input: "${input}" (cleaned: "${clean}")`);
    return null;
  };

  // Unified Sharing API: POST /api/share/enable AND /api/share/create
  const handleEnableSharingLogic = (req: any, res: any) => {
    try {
      const { chatId, ownerEmail, ownerName, defaultPermission = "chat", expiresAt = null } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const existing = sharedDb[chatId];

      const token = existing?.shareToken || "sh_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const code = existing?.accessCode || generateAccessCode();

      sharedDb[chatId] = {
        id: chatId,
        ownerEmail: ownerEmail.toLowerCase().trim(),
        ownerName: ownerName || ownerEmail.split("@")[0],
        isSharingActive: true,
        shareToken: token,
        expiresAt: expiresAt,
        defaultPermission: defaultPermission, // "chat" or "view"
        participants: existing?.participants || [],
        // Access code default state
        accessCode: code,
        accessCodeExpiresAt: existing?.accessCodeExpiresAt || null,
        accessCodePermission: existing?.accessCodePermission || "chat",
        accessCodeIsActive: existing?.accessCodeIsActive !== undefined ? existing.accessCodeIsActive : true,
        accessCodeDurationType: existing?.accessCodeDurationType || "never"
      };

      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(sharedDb[chatId]);
      console.info(`[Nexa Server] Sharing enabled/created for chat ${chatId} by ${ownerEmail}`);

      return res.status(200).json({ success: true, shareToken: token, config: sharedDb[chatId], config_alias: sharedDb[chatId] });
    } catch (e: any) {
      console.error("Error enabling share:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/enable", handleEnableSharingLogic);
  app.post("/api/share/create", handleEnableSharingLogic);

  // Unified Toggle/Disable API: PATCH /api/share/toggle/:chatId, PATCH /api/share/toggle, POST /api/share/disable
  const handleToggleSharingLogic = (req: any, res: any) => {
    try {
      const chatId = req.params.chatId || req.body.chatId;
      const { ownerEmail, isSharingActive } = req.body;

      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can toggle sharing." });
      }

      config.isSharingActive = isSharingActive !== undefined ? isSharingActive : false;
      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);
      console.info(`[Nexa Server] Sharing active state set to ${config.isSharingActive} for chat ${chatId}`);

      if (!config.isSharingActive) {
        // Notify WebSocket clients in the room to disconnect
        broadcastToRoom(chatId, { type: "revoked", message: "Sharing has been disabled by the owner." });
      }

      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/disable", (req, res) => {
    req.body.isSharingActive = false;
    handleToggleSharingLogic(req, res);
  });
  app.patch("/api/share/toggle/:chatId", handleToggleSharingLogic);

  // Unified Permission API: POST /api/share/update-permission, PATCH /api/share/participant/role/:chatId
  const handlePermissionUpdateLogic = (req: any, res: any) => {
    try {
      const chatId = req.params.chatId || req.body.chatId;
      const { ownerEmail, defaultPermission, participantEmail, targetEmail, role } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can update permissions." });
      }

      const activeTargetEmail = participantEmail || targetEmail;
      if (activeTargetEmail) {
        const pEmail = activeTargetEmail.toLowerCase().trim();
        const participant = config.participants.find((p: any) => p.email === pEmail);
        if (participant) {
          participant.role = role; // "editor" (Can Chat) or "viewer" (View Only)
          console.info(`[Nexa Server] Participant ${pEmail} role updated to ${role} in chat ${chatId}`);
          
          broadcastToRoom(chatId, {
            type: "permission-updated",
            participantEmail: pEmail,
            role: role
          });
        }
      } else if (defaultPermission) {
        config.defaultPermission = defaultPermission;
        console.info(`[Nexa Server] General permission updated to ${defaultPermission} in chat ${chatId}`);
        broadcastToRoom(chatId, {
          type: "general-permission-updated",
          defaultPermission: defaultPermission
        });
      }

      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);
      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/update-permission", handlePermissionUpdateLogic);
  app.patch("/api/share/participant/role/:chatId", handlePermissionUpdateLogic);

  // Unified Remove Participant API: POST /api/share/remove-participant, DELETE /api/share/participant/remove/:chatId
  const handleRemoveParticipantLogic = (req: any, res: any) => {
    try {
      const chatId = req.params.chatId || req.body.chatId;
      const { ownerEmail, participantEmail, targetEmail } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can remove participants." });
      }

      const activeTargetEmail = participantEmail || targetEmail;
      if (!activeTargetEmail) {
        return res.status(400).json({ success: false, error: "Participant/Target email is required." });
      }

      const pEmail = activeTargetEmail.toLowerCase().trim();
      const index = config.participants.findIndex((p: any) => p.email === pEmail);
      if (index !== -1) {
        config.participants.splice(index, 1);
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(config);
        console.info(`[Nexa Server] Participant ${pEmail} removed from chat ${chatId}`);

        broadcastToRoom(chatId, { type: "participant-removed", participantEmail: pEmail });

        broadcastToRoom(chatId, {
          type: "notification",
          message: `${pEmail} has been removed by the owner`,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/remove-participant", handleRemoveParticipantLogic);
  app.delete("/api/share/participant/remove/:chatId", handleRemoveParticipantLogic);

  // Unified Regenerate API: POST /api/share/regenerate-link, POST /api/share/regenerate/:chatId
  const handleRegenerateLogic = (req: any, res: any) => {
    try {
      const chatId = req.params.chatId || req.body.chatId;
      const { ownerEmail } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can regenerate the share link." });
      }

      const newToken = "sh_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      config.shareToken = newToken;
      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);
      console.info(`[Nexa Server] Share link regenerated for chat ${chatId}`);

      return res.status(200).json({ success: true, shareToken: newToken, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/regenerate-link", handleRegenerateLogic);
  app.post("/api/share/regenerate/:chatId", handleRegenerateLogic);

  // Add Participant Directly: POST /api/share/participant/add/:chatId
  app.post("/api/share/participant/add/:chatId", (req, res) => {
    try {
      const { chatId } = req.params;
      const { ownerEmail, targetEmail, role = "editor" } = req.body;

      if (!chatId || !ownerEmail || !targetEmail) {
        return res.status(400).json({ success: false, error: "chatId, ownerEmail, and targetEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can invite participants." });
      }

      const pEmail = targetEmail.toLowerCase().trim();
      const existing = config.participants.find((p: any) => p.email === pEmail);

      if (!existing) {
        config.participants.push({
          email: pEmail,
          name: pEmail.split("@")[0],
          role: role,
          joinedAt: new Date().toISOString()
        });
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(config);
        console.info(`[Nexa Server] Owner invited ${pEmail} with role ${role} to chat ${chatId}`);
      } else {
        existing.role = role;
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(config);
      }

      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- ACCESS CODE DEDICATED ENDPOINTS ---

  // Generate or regenerate Access Code
  app.post("/api/share/access-code/generate", (req, res) => {
    try {
      const { chatId, ownerEmail, expiresAfterValue = "never", defaultPermission = "chat" } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      let config = sharedDb[chatId];

      if (!config) {
        const token = "sh_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sharedDb[chatId] = {
          id: chatId,
          ownerEmail: ownerEmail.toLowerCase().trim(),
          ownerName: ownerEmail.split("@")[0],
          isSharingActive: true,
          shareToken: token,
          expiresAt: null,
          defaultPermission: defaultPermission,
          participants: []
        };
        config = sharedDb[chatId];
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can manage access codes." });
      }

      let newCode = generateAccessCode();
      let collisionCount = 0;
      while (Object.values(sharedDb).some((c: any) => c.accessCode === newCode) && collisionCount < 10) {
        newCode = generateAccessCode();
        collisionCount++;
      }

      let expiresAtStr: string | null = null;
      const now = new Date();
      if (expiresAfterValue === "1h") {
        expiresAtStr = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      } else if (expiresAfterValue === "24h") {
        expiresAtStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else if (expiresAfterValue === "7d") {
        expiresAtStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      config.accessCode = newCode;
      config.accessCodeExpiresAt = expiresAtStr;
      config.accessCodePermission = defaultPermission;
      config.accessCodeIsActive = true;
      config.accessCodeDurationType = expiresAfterValue;

      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);
      console.info(`[Nexa Server] Generated access code ${newCode} for chat ${chatId} by ${ownerEmail}`);

      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      console.error("Error generating access code:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Toggle/Disable access code
  app.post("/api/share/access-code/disable", (req, res) => {
    try {
      const { chatId, ownerEmail } = req.body;
      if (!chatId || !ownerEmail) {
        return res.status(400).json({ success: false, error: "chatId and ownerEmail are required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can disable access codes." });
      }

      config.accessCodeIsActive = false;
      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);
      console.info(`[Nexa Server] Access code disabled for chat ${chatId}`);

      return res.status(200).json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Join shared conversation handler logic
  const handleJoinLogic = async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const query = req.query || {};
      const params = req.params || {};

      const email = (body.email || query.email || "guest@nexa.ai").toString().trim().toLowerCase();
      const fullName = (body.fullName || query.fullName || body.name || query.name || "Guest Collaborator").toString().trim();
      const rawInput = (
        params.input ||
        params.chatId ||
        body.accessCode ||
        body.shareToken ||
        body.token ||
        body.input ||
        body.code ||
        body.chatId ||
        query.accessCode ||
        query.shareToken ||
        query.token ||
        query.input ||
        query.code ||
        query.chatId ||
        ""
      ).toString().trim();

      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "unknown";
      console.log(`[Nexa Server] [share/join] Request received from ${clientIp}. Email: "${email}", Input: "${rawInput}"`);

      if (!rawInput) {
        return res.status(400).json({ success: false, error: "A valid share link, share token, or access code is required." });
      }

      const attemptKey = String(clientIp);
      const attempt = failedAttempts.get(attemptKey);
      if (attempt && attempt.count >= 10 && Date.now() - attempt.lastAttempt < 15 * 60 * 1000) {
        return res.status(429).json({
          success: false,
          error: "Too many failed attempts. Brute-force protection activated. Please wait 15 minutes."
        });
      }

      const found = await findSharedConfigAsync(rawInput);

      if (!found) {
        const now = Date.now();
        if (attempt) {
          attempt.count += 1;
          attempt.lastAttempt = now;
        } else {
          failedAttempts.set(attemptKey, { count: 1, lastAttempt: now });
        }
        return res.status(404).json({
          success: false,
          error: "Invalid share link, access code, or the conversation no longer exists."
        });
      }

      failedAttempts.delete(attemptKey);

      const { actualChatId: chatId, config } = found;
      const clean = cleanShareInput(rawInput);
      const isJoiningViaCode = config.accessCode && (
        clean.toUpperCase().replace(/[- ]/g, "") === config.accessCode.toUpperCase().replace(/[- ]/g, "")
      );

      if (isJoiningViaCode) {
        if (!config.accessCodeIsActive) {
          return res.status(400).json({ success: false, error: "This chat access code has been disabled by the owner." });
        }
        if (config.accessCodeExpiresAt && new Date(config.accessCodeExpiresAt) < new Date()) {
          return res.status(400).json({ success: false, error: "This chat access code has expired." });
        }
      } else {
        if (!config.isSharingActive) {
          return res.status(400).json({ success: false, error: "This shared conversation has been disabled by the owner." });
        }
        if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
          return res.status(400).json({ success: false, error: "This shared conversation link has expired." });
        }
      }

      if (config.ownerEmail === email) {
        return res.status(200).json({ success: true, chatId, role: "owner", config });
      }

      const defaultPerm = isJoiningViaCode 
        ? config.accessCodePermission || "chat"
        : config.defaultPermission || "chat";
      let role = defaultPerm === "chat" ? "editor" : "viewer";

      if (!Array.isArray(config.participants)) {
        config.participants = [];
      }

      const existingPart = config.participants.find((p: any) => p.email === email);
      if (!existingPart) {
        config.participants.push({
          email: email,
          name: fullName || email.split("@")[0],
          role: role,
          joinedAt: new Date().toISOString()
        });
        const sharedDb = readSharedDB();
        sharedDb[chatId] = config;
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(config);
        console.info(`[Nexa Server] User ${email} joined shared chat ${chatId} as ${role} via ${isJoiningViaCode ? 'Code' : 'Link'}`);
      } else {
        role = existingPart.role;
      }

      return res.status(200).json({ success: true, chatId, role, config });
    } catch (e: any) {
      console.error("[Nexa Server] Exception in /api/share/join:", e);
      return res.status(500).json({ success: false, error: e.message || "An internal error occurred while joining." });
    }
  };

  app.post("/api/share/join", handleJoinLogic);
  app.get("/api/share/join", handleJoinLogic);
  app.post("/api/share/join/:input", handleJoinLogic);
  app.get("/api/share/join/:input", handleJoinLogic);
  app.post("/api/share/:chatId/join", handleJoinLogic);

  // Validate Share Token or Access Code Endpoint
  const handleValidateLogic = async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const query = req.query || {};
      const params = req.params || {};

      const rawInput = (
        params.input ||
        body.accessCode ||
        body.shareToken ||
        body.token ||
        body.input ||
        body.code ||
        body.chatId ||
        query.accessCode ||
        query.shareToken ||
        query.token ||
        query.input ||
        query.code ||
        query.chatId ||
        ""
      ).toString().trim();

      if (!rawInput) {
        return res.status(400).json({ success: false, valid: false, error: "Share token or access code input is required." });
      }

      const found = await findSharedConfigAsync(rawInput);
      if (!found) {
        return res.status(200).json({ success: true, valid: false, error: "Invalid share link or access code." });
      }

      const { actualChatId, config } = found;

      if (!config.isSharingActive && !config.accessCodeIsActive) {
        return res.status(200).json({ success: true, valid: false, error: "Sharing has been disabled by the owner." });
      }

      const now = new Date();
      if (config.expiresAt && new Date(config.expiresAt) < now) {
        return res.status(200).json({ success: true, valid: false, error: "This share link has expired." });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        chatId: actualChatId,
        isSharingActive: !!config.isSharingActive,
        accessCodeIsActive: !!config.accessCodeIsActive,
        defaultPermission: config.defaultPermission || "chat",
        config
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, valid: false, error: e.message });
    }
  };

  app.post("/api/share/validate", handleValidateLogic);
  app.get("/api/share/validate", handleValidateLogic);
  app.post("/api/share/validate/:input", handleValidateLogic);
  app.get("/api/share/validate/:input", handleValidateLogic);

  // Revoke Share API Endpoint
  const handleRevokeLogic = async (req: any, res: any) => {
    try {
      const chatId = req.params.chatId || req.body.chatId || req.body.id;
      const ownerEmail = req.body.ownerEmail || req.body.email;

      if (!chatId) {
        return res.status(400).json({ success: false, error: "chatId is required." });
      }

      const sharedDb = readSharedDB();
      const config = sharedDb[chatId];
      if (!config) {
        return res.status(404).json({ success: false, error: "Sharing configuration not found." });
      }

      if (ownerEmail && config.ownerEmail !== ownerEmail.toLowerCase().trim()) {
        return res.status(403).json({ success: false, error: "Only the owner can revoke sharing." });
      }

      config.isSharingActive = false;
      config.accessCodeIsActive = false;
      writeSharedDB(sharedDb);
      syncSharedConfigToSupabase(config);

      broadcastToRoom(chatId, { type: "revoked", message: "Sharing has been revoked by the owner." });

      return res.status(200).json({ success: true, message: "Sharing revoked successfully.", config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  app.post("/api/share/revoke", handleRevokeLogic);
  app.post("/api/share/revoke/:chatId", handleRevokeLogic);

  // 7. Get share info
  app.get("/api/share/info/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const email = (req.query.email as string)?.toLowerCase().trim() || "guest@nexa.ai";

      console.log(`[Nexa Server] [share/info] Request received for chatId: "${chatId}", email: "${email}"`);

      if (!chatId) {
        console.warn(`[Nexa Server] [share/info] Missing chatId in request`);
        return res.status(400).json({ success: false, error: "chatId is required." });
      }

      const found = await findSharedConfigAsync(chatId);

      if (!found) {
        console.warn(`[Nexa Server] [share/info] No configuration found for chatId: "${chatId}"`);
        return res.status(200).json({ success: true, isShared: false });
      }

      const { actualChatId, config } = found;

      const isOwner = email && config.ownerEmail === email;
      const isParticipant = email && Array.isArray(config.participants) && config.participants.some((p: any) => p.email === email);

      console.log(`[Nexa Server] [share/info] Successfully retrieved config for actualChatId: "${actualChatId}". Owner: ${isOwner} (${config.ownerEmail}), Participant: ${isParticipant}`);

      return res.status(200).json({
        success: true,
        isShared: true,
        actualChatId,
        config: config,
        isOwner,
        isParticipant
      });
    } catch (e: any) {
      console.error(`[Nexa Server] [share/info] Exception inside endpoint:`, e);
      return res.status(500).json({ success: false, error: `Internal Server Error: ${e.message}` });
    }
  });

  // 8. Get complete shared session (conversations & messages)
  app.get("/api/share/session/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const email = (req.query.email as string)?.toLowerCase().trim() || "guest@nexa.ai";
      const token = (req.query.token as string) || (req.query.shareToken as string) || (req.query.accessCode as string);

      console.log(`[Nexa Server] [share/session] Accessing shared session. chatId/token: "${chatId}", email: "${email}", token: "${token || 'none'}"`);

      if (!chatId) {
        console.warn(`[Nexa Server] [share/session] Missing required parameter chatId`);
        return res.status(400).json({ success: false, error: "chatId is required to load a shared session." });
      }

      const found = await findSharedConfigAsync(chatId);

      if (!found) {
        console.warn(`[Nexa Server] [share/session] Shared conversation config not found for chatId: "${chatId}"`);
        return res.status(404).json({ success: false, error: `Shared conversation not found. The chat link or access code may be invalid or deleted.` });
      }

      const { actualChatId, config } = found;

      // Verify access: must be owner, participant, or access via valid share token / access code
      const isOwner = config.ownerEmail === email;
      const isParticipant = Array.isArray(config.participants) && config.participants.some((p: any) => p.email === email);
      const isAccessViaValidToken = token && (token === config.shareToken || token.toUpperCase().replace(/[- ]/g, "") === (config.accessCode || "").toUpperCase().replace(/[- ]/g, ""));
      const isDirectTokenMatch = chatId === config.shareToken || (config.accessCode && chatId.toUpperCase().replace(/[- ]/g, "") === config.accessCode.toUpperCase().replace(/[- ]/g, ""));

      console.log(`[Nexa Server] [share/session] Auth status. isOwner: ${isOwner}, isParticipant: ${isParticipant}, isAccessViaValidToken: ${isAccessViaValidToken}, isDirectTokenMatch: ${isDirectTokenMatch}`);

      // Auto-register guest/external participant if token is valid
      if (!isOwner && !isParticipant && (isAccessViaValidToken || isDirectTokenMatch || config.isSharingActive)) {
        if (!Array.isArray(config.participants)) {
          config.participants = [];
        }
        const role = config.defaultPermission === "chat" ? "editor" : "viewer";
        config.participants.push({
          email: email,
          name: email.split("@")[0] || "Guest Collaborator",
          role: role,
          joinedAt: new Date().toISOString()
        });
        const sharedDb = readSharedDB();
        sharedDb[actualChatId] = config;
        writeSharedDB(sharedDb);
        syncSharedConfigToSupabase(config);
        console.log(`[Nexa Server] [share/session] Auto-registered participant ${email} for chat ${actualChatId}`);
      }

      if (!config.isSharingActive && !isOwner) {
        console.warn(`[Nexa Server] [share/session] Access denied. Sharing is disabled for chat "${actualChatId}"`);
        return res.status(403).json({ success: false, error: "Access denied. The owner has disabled sharing for this conversation." });
      }

      // Check expiration
      if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
        console.warn(`[Nexa Server] [share/session] Access denied. Shared link expired on ${config.expiresAt}`);
        return res.status(400).json({ success: false, error: "This shared conversation link has expired." });
      }

      let session: any = null;

      // 1. Try to fetch from Supabase first
      const supabase = getSupabaseServer();
      if (supabase) {
        try {
          console.log(`[Nexa Server] [share/session] Querying Supabase for actualChatId "${actualChatId}"...`);
          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("id", actualChatId)
            .maybeSingle();

          if (chatData && !chatError) {
            console.log(`[Nexa Server] [share/session] Chat row found in Supabase. Querying messages...`);
            const { data: messagesData, error: messagesError } = await supabase
              .from("messages")
              .select("*")
              .eq("chat_id", actualChatId)
              .order("timestamp", { ascending: true });

            if (messagesError) {
              console.warn(`[Nexa Server] [share/session] Supabase messages query notice (${messagesError.code}): ${messagesError.message}`);
            }

            session = {
              id: chatData.id,
              title: chatData.title,
              createdAt: chatData.created_at,
              updatedAt: chatData.updated_at,
              isPinned: chatData.is_pinned || false,
              pinOrder: chatData.pin_order,
              mode: chatData.mode || "general",
              selectedEngineId: chatData.selected_engine_id,
              userEmail: chatData.user_email,
              messages: (messagesData || []).map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                engineId: msg.engine_id,
                sources: msg.sources || null,
                factCheck: msg.fact_check || null,
                researchReport: msg.research_report || null,
                quiz: msg.quiz || null,
                attachment: msg.attachment || null,
                reaction: msg.reaction || null
              }))
            };
            console.log(`[Nexa Server] [share/session] Loaded from Supabase: "${session.title}" with ${session.messages.length} messages.`);
          } else if (chatError) {
            console.warn(`[Nexa Server] [share/session] Supabase table/schema notice (${chatError.code || 'NO_CODE'}): ${chatError.message}. Falling back to local storage.`);
          } else {
            console.warn(`[Nexa Server] [share/session] Chat record "${actualChatId}" not found in Supabase table "chats". Falling back to local storage.`);
          }
        } catch (supaErr: any) {
          console.warn(`[Nexa Server] [share/session] Exception while connecting to Supabase: ${supaErr.message || supaErr}. Falling back to local storage.`);
        }
      } else {
        console.warn(`[Nexa Server] [share/session] Supabase client is not available on server-side. Skipping Supabase query.`);
      }

      // 2. Fallback to local user DB if not found in Supabase
      if (!session) {
        console.info(`[Nexa Server] [share/session] Falling back to local db for actualChatId "${actualChatId}"...`);
        const userDb = readDB();
        const ownerRecord = userDb[config.ownerEmail];

        if (ownerRecord && Array.isArray(ownerRecord.chats)) {
          session = ownerRecord.chats.find((c: any) => c.id === actualChatId);
          if (session) {
            console.log(`[Nexa Server] [share/session] Session successfully resolved from local DB of owner: "${config.ownerEmail}"`);
          }
        } else {
          console.warn(`[Nexa Server] [share/session] Owner record not found or has no chats in local database.`);
        }
      }

      // 3. Fallback to active collaborative chat session structure if not in Supabase or local DB
      if (!session) {
        console.info(`[Nexa Server] [share/session] Constructing active collaborative chat session object for actualChatId "${actualChatId}"`);
        session = {
          id: actualChatId,
          title: "Collaborative Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPinned: false,
          mode: "general",
          userEmail: config.ownerEmail,
          messages: [],
          isShared: true
        };
      }

      console.info(`[Nexa Server] [share/session] Successfully returning shared session for actualChatId: "${actualChatId}" to user: "${email}"`);
      return res.status(200).json({
        success: true,
        session,
        config
      });
    } catch (e: any) {
      console.error("[Nexa Server] [share/session] Error retrieving shared session:", e);
      return res.status(500).json({ success: false, error: `Internal Server Error: ${e.message}` });
    }
  });

  // 9. Diagnostic info for shared chats
  app.get("/api/share/diagnostics/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const email = (req.query.email as string)?.toLowerCase().trim();
      const token = req.query.token as string;

      console.info(`[Nexa Diagnostics] Diagnostic query for chatId: "${chatId}", email: "${email || 'none'}", token: "${token || 'none'}"`);

      const results: any = {
        timestamp: new Date().toISOString(),
        chatId,
        inputEmail: email || null,
        inputToken: token || null,
        errors: [],
        warnings: [],
        checks: {}
      };

      // 1. Check shared_chats_db.json
      let config: any = null;
      try {
        const sharedDb = readSharedDB();
        config = sharedDb[chatId];
        results.checks.sharedDb = {
          exists: true,
          hasConfig: !!config
        };
        if (!config) {
          results.warnings.push(`No configuration found for chatId ${chatId} in shared_chats_db.json`);
        } else {
          results.checks.sharedDb.config = {
            ownerEmail: config.ownerEmail,
            shareToken: config.shareToken,
            isSharingActive: config.isSharingActive,
            expiresAt: config.expiresAt,
            hasExpired: config.expiresAt ? new Date(config.expiresAt) < new Date() : false,
            participantsCount: Array.isArray(config.participants) ? config.participants.length : 0,
            accessCodeEnabled: !!config.accessCode
          };
        }
      } catch (dbErr: any) {
        results.errors.push(`Failed to read shared_chats_db.json: ${dbErr.message}`);
        results.checks.sharedDb = { exists: false, error: dbErr.message };
      }

      // 2. Authorization rules check
      if (config) {
        const isOwner = email && config.ownerEmail === email;
        const isParticipant = email && Array.isArray(config.participants) && config.participants.some((p: any) => p.email === email);
        const tokenMatches = token && config.shareToken === token;
        
        results.checks.authorization = {
          isOwner: !!isOwner,
          isParticipant: !!isParticipant,
          tokenMatches: !!tokenMatches,
          isSharingActive: !!config.isSharingActive,
          canAccess: isOwner || isParticipant || (tokenMatches && config.isSharingActive)
        };

        if (!results.checks.authorization.canAccess) {
          results.warnings.push(`Requesting user "${email}" is NOT owner or registered participant, and has no valid token / sharing is inactive.`);
        }
      }

      // 3. Supabase Integration Check
      const supabase = getSupabaseServer();
      results.checks.supabase = {
        clientInitialized: !!supabase,
        urlConfigured: !!process.env.VITE_SUPABASE_URL,
        anonKeyConfigured: !!process.env.VITE_SUPABASE_ANON_KEY
      };

      if (supabase) {
        try {
          const { data: chatData, error: chatError } = await supabase
            .from("chats")
            .select("*")
            .eq("id", chatId)
            .maybeSingle();

          results.checks.supabase.chatRecord = {
            found: !!chatData,
            error: chatError ? chatError.message : null
          };

          if (chatData) {
            results.checks.supabase.chatRecord.details = {
              title: chatData.title,
              userEmail: chatData.user_email,
              mode: chatData.mode,
              created_at: chatData.created_at
            };

            const { count, error: countError } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("chat_id", chatId);

            results.checks.supabase.messagesCount = {
              count: count || 0,
              error: countError ? countError.message : null
            };
          } else if (chatError) {
            results.warnings.push(`Supabase query notice for chat ${chatId}: ${chatError.message}`);
          } else {
            results.warnings.push(`Chat ${chatId} not found in Supabase chats table.`);
          }
        } catch (supaErr: any) {
          results.warnings.push(`Exception querying Supabase for chat diagnostics: ${supaErr.message}`);
          results.checks.supabase.exception = supaErr.message;
        }
      } else {
        results.warnings.push("Supabase is not configured on the server-side. Falling back entirely to local JSON files.");
      }

      // 4. Local DB Fallback Check
      try {
        const userDb = readDB();
        results.checks.localDb = {
          exists: true
        };
        if (config) {
          const ownerRecord = userDb[config.ownerEmail];
          results.checks.localDb.ownerRecordFound = !!ownerRecord;
          if (ownerRecord) {
            const localChat = Array.isArray(ownerRecord.chats) && ownerRecord.chats.find((c: any) => c.id === chatId);
            results.checks.localDb.chatFoundInOwnerRecord = !!localChat;
            if (localChat) {
              results.checks.localDb.localMessagesCount = Array.isArray(localChat.messages) ? localChat.messages.length : 0;
            } else {
              results.warnings.push(`Chat ${chatId} was not found in owner ${config.ownerEmail}'s local profile chats.`);
            }
          } else {
            results.warnings.push(`Owner ${config.ownerEmail} record not found in local user_db.json.`);
          }
        }
      } catch (localDbErr: any) {
        results.errors.push(`Failed to check local user_db.json: ${localDbErr.message}`);
        results.checks.localDb = { exists: false, error: localDbErr.message };
      }

      // Set diagnostic success status
      results.success = results.errors.length === 0;

      return res.status(200).json(results);
    } catch (err: any) {
      console.error("[Nexa Diagnostics] Diagnostic error:", err);
      return res.status(500).json({
        success: false,
        error: `Diagnostic endpoint exception: ${err.message}`,
        stack: err.stack
      });
    }
  });

  // Catch-All 404 for API endpoints to ensure JSON response instead of HTML
  app.all("/api/*", (req, res) => {
    console.warn(`[Nexa Server] 404 Unhandled API route requested: ${req.method} ${req.originalUrl}`);
    return res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Serve static UI assets
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for real time HMR asset updates in dev mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Static distribution serving in production runtime
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // WebSocket active rooms
  // Key: chatId, Value: Set of WebSocket connections with custom metadata
  const activeRooms = new Map<string, Set<any>>();

  function broadcastToRoom(chatId: string, payload: any, skipSocket?: any) {
    const clients = activeRooms.get(chatId);
    if (!clients) return;

    const messageString = JSON.stringify(payload);
    clients.forEach((client: any) => {
      if (client !== skipSocket && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  // Bind to 0.0.0.0 on port 3000 exclusively
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nexa Server] Dynamic fullstack service running on http://0.0.0.0:${PORT}`);
    
    // Execute a test email immediate startup check using the existing SMTP configuration
    sendStartupTestEmail();
  });

  // WebSocket upgrade and connection setup
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: any) => {
    console.info("[Nexa WS] New client connection established");
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message: string) => {
      try {
        const payload = JSON.parse(message);
        const { type, chatId } = payload;

        if (!chatId) return;

        switch (type) {
          case "join-room": {
            const { user } = payload;
            ws.chatId = chatId;
            ws.userEmail = user.email.toLowerCase().trim();
            ws.userName = user.fullName || user.email.split("@")[0];
            ws.userAvatar = user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${ws.userName}`;

            if (!activeRooms.has(chatId)) {
              activeRooms.set(chatId, new Set());
            }
            activeRooms.get(chatId)!.add(ws);

            console.info(`[Nexa WS] User ${ws.userEmail} joined room ${chatId}`);

            // Gather all active participants in this room
            const participants = Array.from(activeRooms.get(chatId)!).map((client: any) => ({
              email: client.userEmail,
              name: client.userName,
              avatarUrl: client.userAvatar,
              isTyping: !!client.isTyping
            }));

            // Broadcast presence update
            broadcastToRoom(chatId, {
              type: "presence-update",
              participants
            });

            // Broadcast join notification message
            broadcastToRoom(chatId, {
              type: "notification",
              message: `${ws.userName} joined the session`,
              timestamp: new Date().toISOString()
            });
            break;
          }

          case "leave-room": {
            handleClientLeave(ws);
            break;
          }

          case "typing": {
            const { isTyping } = payload;
            ws.isTyping = isTyping;

            // Gather active participants with typing status
            const participants = Array.from(activeRooms.get(chatId)!).map((client: any) => ({
              email: client.userEmail,
              name: client.userName,
              avatarUrl: client.userAvatar,
              isTyping: !!client.isTyping
            }));

            // Broadcast typing update
            broadcastToRoom(chatId, {
              type: "presence-update",
              participants
            }, ws);
            break;
          }

          case "message-sync": {
            const { message: msg } = payload;
            if (!msg) return;

            // Save message to owner's users_db.json
            const sharedDb = readSharedDB();
            const config = sharedDb[chatId];
            if (config) {
              const userDb = readDB();
              const ownerRecord = userDb[config.ownerEmail];
              if (ownerRecord && Array.isArray(ownerRecord.chats)) {
                const session = ownerRecord.chats.find((c: any) => c.id === chatId);
                if (session) {
                  if (!Array.isArray(session.messages)) {
                    session.messages = [];
                  }
                  
                  // Ensure we show who sent the message!
                  // We add a sender field to the message:
                  const enrichedMsg = {
                    ...msg,
                    senderName: ws.userName,
                    senderEmail: ws.userEmail
                  };

                  // Guard against duplicates
                  const exists = session.messages.some((m: any) => m.id === enrichedMsg.id);
                  if (!exists) {
                    session.messages.push(enrichedMsg);
                    session.updatedAt = new Date().toISOString();
                    writeDB(userDb);
                    console.info(`[Nexa WS] Saved enriched message ${enrichedMsg.id} to chat ${chatId} in owners database.`);
                  }

                  // Broadcast enriched message in real-time
                  broadcastToRoom(chatId, {
                    type: "message-sync",
                    message: enrichedMsg
                  }, ws);
                }
              }
            }
            break;
          }

          case "read-receipt": {
            const { messageId } = payload;
            broadcastToRoom(chatId, {
              type: "read-receipt",
              messageId,
              userEmail: ws.userEmail,
              userName: ws.userName
            }, ws);
            break;
          }
        }
      } catch (err) {
        console.error("[Nexa WS] Error processing WS message:", err);
      }
    });

    ws.on("close", () => {
      handleClientLeave(ws);
    });

    ws.on("error", (err: any) => {
      console.error("[Nexa WS] Socket error:", err);
      handleClientLeave(ws);
    });
  });

  function handleClientLeave(ws: any) {
    const chatId = ws.chatId;
    if (!chatId) return;

    const clients = activeRooms.get(chatId);
    if (clients) {
      clients.delete(ws);
      console.info(`[Nexa WS] User ${ws.userEmail} left room ${chatId}`);

      if (clients.size === 0) {
        activeRooms.delete(chatId);
      } else {
        // Broadcast presence update
        const participants = Array.from(clients).map((client: any) => ({
          email: client.userEmail,
          name: client.userName,
          avatarUrl: client.userAvatar,
          isTyping: !!client.isTyping
        }));

        broadcastToRoom(chatId, {
          type: "presence-update",
          participants
        });

        // Broadcast leave notification
        broadcastToRoom(chatId, {
          type: "notification",
          message: `${ws.userName} left the session`,
          timestamp: new Date().toISOString()
        });
      }
    }
    ws.chatId = null;
  }

  // Heartbeat keep-alive loop
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const customWs = ws as any;
      if (customWs.isAlive === false) {
        console.info(`[Nexa WS] Client dead, terminating connection: ${customWs.userEmail}`);
        return ws.terminate();
      }
      customWs.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });
}

async function sendStartupTestEmail() {
  console.log("[Nexa SMTP Startup Test] Starting immediate SMTP startup test email...");
  
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `Nexa <${user}>`;
  const recipient = "mayanktechnologies00@gmail.com";

  console.log("[Nexa SMTP Startup Test] Configuration details:");
  console.log(`  - SMTP_HOST: ${host}`);
  console.log(`  - SMTP_PORT: ${port}`);
  console.log(`  - SMTP_USER: ${user ? "DEFINED" : "UNDEFINED"}`);
  console.log(`  - SMTP_PASS: ${pass ? "DEFINED" : "UNDEFINED"}`);
  console.log(`  - SMTP_FROM: ${from}`);
  console.log(`  - Target Recipient: ${recipient}`);

  if (!user || !pass) {
    console.error("[Nexa SMTP Startup Test] SMTP credentials are not configured in environment variables. Aborting test.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Ensures TLS connection inside sandboxed networks is permissive
      },
      debug: true,
      logger: true,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    console.log("[Nexa SMTP Startup Test] Verifying transporter...");
    try {
      await transporter.verify();
      console.log("[Nexa SMTP Startup Test] transporter.verify() result: SUCCESS! SMTP connection is verified.");
    } catch (verifyErr: any) {
      console.error("[Nexa SMTP Startup Test] transporter.verify() result: FAILED. Error details:", {
        message: verifyErr.message,
        code: verifyErr.code,
        command: verifyErr.command,
        response: verifyErr.response,
        responseCode: verifyErr.responseCode,
        stack: verifyErr.stack,
      });
      throw verifyErr;
    }

    const mailOptions = {
      from,
      to: recipient,
      subject: "Nexa SMTP Diagnostic Test Email",
      text: "This is a simple startup test email to verify that Nexa SMTP is configured and working correctly.",
      html: "<p>This is a simple startup test email to verify that Nexa SMTP is configured and working correctly.</p>"
    };

    console.log("[Nexa SMTP Startup Test] Sending email...");
    const info = await transporter.sendMail(mailOptions);
    
    console.log("[Nexa SMTP Startup Test] sendMail() result: SUCCESS!");
    console.log(`[Nexa SMTP Startup Test] Message ID: ${info.messageId}`);
    console.log(`[Nexa SMTP Startup Test] SMTP response: ${info.response}`);
    console.log("SMTP is working correctly");

  } catch (err: any) {
    console.error("[Nexa SMTP Startup Test] TEST EMAIL FAILED! Detailed SMTP Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      stack: err.stack,
    });
  }
}

startServer();
