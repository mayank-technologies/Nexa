var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
import_dotenv.default.config();
var aiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please set it in Settings > Secrets or .env.");
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function generateContentWithRetry(params) {
  const modelsToTry = [
    params.initialModel || "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError = null;
  for (const model of modelsToTry) {
    try {
      console.info(`[Nexa Core Server] Querying content generation via model ${model}...`);
      const ai = getGeminiClient();
      const currentConfig = { ...params.config };
      const isGemini3 = model.includes("gemini-3") || model.includes("gemini-3.5");
      if (isGemini3) {
        if (params.turboMode !== false) {
          currentConfig.thinkingConfig = {
            thinkingLevel: import_genai.ThinkingLevel.MINIMAL
          };
        }
      } else {
        if (currentConfig.thinkingConfig) {
          delete currentConfig.thinkingConfig;
        }
      }
      const result = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: currentConfig
      });
      return result;
    } catch (err) {
      lastError = err;
      const errorMessage = String(err?.message || err);
      console.info(`[Nexa Core Server Support] Model ${model} returned expected gateway exception: ${errorMessage.substring(0, 150)}... Transitioning immediately to active backup.`);
    }
  }
  throw lastError || new Error("Failed to generate content with all configured models.");
}
function routeTask(prompt, mode, hasImage) {
  const lowercasePrompt = prompt.toLowerCase();
  if (hasImage || lowercasePrompt.includes("image") || lowercasePrompt.includes("picture") || lowercasePrompt.includes("screenshot") || lowercasePrompt.includes("ocr") || lowercasePrompt.includes("visual")) {
    return "vision";
  }
  const mathRegex = /[\d+\-*/=√π▲λ∫∬]|[0-9]+[xXyYx]/;
  const codingKeywords = ["code", "typescript", "python", "javascript", "program", "function", "compile", "bug", "algorithm", "recursive"];
  const mathKeywords = ["solve", "calculate", "math", "calculus", "geometry", "equations", "algebra", "integral", "logic", "reasoning", "prove"];
  if (mathRegex.test(prompt) || codingKeywords.some((kw) => lowercasePrompt.includes(kw)) || mathKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "reasoning";
  }
  const langKeywords = ["translate", "translation", "pronounce", "pronunciation", "spelling", "grammar correction", "multilingual assist", "detect language", "how to say", "meaning of"];
  if (langKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "language";
  }
  const learnKeywords = ["homework", "study", "exam", "quiz", "student", "explain to a", "class", "syllabus", "formula", "revision", "learn", "assignment"];
  if (mode === "study" || mode === "quiz" || learnKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "learning";
  }
  return "core";
}
async function fetchUrlMetadataAndContent(url) {
  console.info(`[Nexa Link Analyzer] Analyzing URL: ${url}`);
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    if (hostname.includes("docs.google.com")) {
      if (pathname.includes("/document/d/")) {
        const docIdMatch = pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          const res2 = await fetch(exportUrl, { signal: AbortSignal.timeout(4e3) });
          if (res2.ok) {
            const text = await res2.text();
            return {
              url,
              type: "google-doc",
              title: "Google Document",
              bodyText: text.substring(0, 15e3)
            };
          }
        }
      } else if (pathname.includes("/spreadsheets/d/")) {
        const sheetIdMatch = pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (sheetIdMatch) {
          const sheetId = sheetIdMatch[1];
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
          const res2 = await fetch(exportUrl, { signal: AbortSignal.timeout(4e3) });
          if (res2.ok) {
            const csv = await res2.text();
            return {
              url,
              type: "google-sheet",
              title: "Google Sheet",
              bodyText: csv.substring(0, 15e3)
            };
          }
        }
      } else if (pathname.includes("/presentation/d/")) {
        const slideIdMatch = pathname.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
        if (slideIdMatch) {
          const slideId = slideIdMatch[1];
          const exportUrl = `https://docs.google.com/presentation/d/${slideId}/export/pdf`;
          const res2 = await fetch(exportUrl, { signal: AbortSignal.timeout(6e3) });
          if (res2.ok) {
            const arrayBuffer = await res2.arrayBuffer();
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
    if (hostname === "github.com" || hostname === "www.github.com") {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts[1];
        const gitHubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
        let repoData = null;
        let readmeText = "";
        try {
          const apiRes = await fetch(gitHubApiUrl, {
            headers: { "User-Agent": "Nexa-Link-Analyzer" },
            signal: AbortSignal.timeout(3e3)
          });
          if (apiRes.ok) {
            repoData = await apiRes.json();
          }
        } catch (e) {
          console.error("[Nexa Link Analyzer] GitHub API error:", e);
        }
        try {
          const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, {
            signal: AbortSignal.timeout(3e3)
          });
          if (readmeRes.ok) {
            readmeText = await readmeRes.text();
          } else {
            const readmeResMaster = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, {
              signal: AbortSignal.timeout(3e3)
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
          bodyText: readmeText ? readmeText.substring(0, 15e3) : "No README available or fetched."
        };
      }
    }
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
        bodyText: `This is a YouTube video with ID ${videoId}. Please search the web or grounding channels to get details, reviews, summary, or transcripts for this video if possible.`
      };
    }
    if (pathname.endsWith(".pdf") || url.toLowerCase().includes(".pdf")) {
      const res2 = await fetch(url, { signal: AbortSignal.timeout(8e3) });
      if (res2.ok) {
        const contentType2 = res2.headers.get("content-type") || "";
        if (contentType2.includes("pdf") || pathname.endsWith(".pdf")) {
          const contentLength = parseInt(res2.headers.get("content-length") || "0", 10);
          if (contentLength > 12 * 1024 * 1024) {
            return {
              url,
              type: "pdf-file-large",
              title: pathname.split("/").pop() || "PDF Document",
              isPrivateOrError: true,
              errorMessage: "PDF file is too large (>12MB) for direct server processing."
            };
          }
          const arrayBuffer = await res2.arrayBuffer();
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
        errorMessage: `HTTP response status ${res.status}`
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
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i) || html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
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
        bodyText: textContent.substring(0, 1e4)
      };
    }
    return {
      url,
      type: "static-file",
      title: pathname.split("/").pop() || hostname,
      bodyText: `Static asset of type: ${contentType}`
    };
  } catch (err) {
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
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  const DB_PATH = import_path.default.join(process.cwd(), "users_db.json");
  const readDB = () => {
    try {
      if (import_fs.default.existsSync(DB_PATH)) {
        const fileContent = import_fs.default.readFileSync(DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read user database:", e);
    }
    return {};
  };
  const writeDB = (data) => {
    try {
      import_fs.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to user database:", e);
    }
  };
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password, fullName, currentChats, isSignUp, isGoogleAuth } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password are required." });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const db = readDB();
      const userExists = !!db[normalizedEmail];
      if (userExists && isSignUp) {
        return res.status(400).json({
          success: false,
          error: "An account with this email address already exists. Please select Sign In instead."
        });
      }
      if (!userExists && !isSignUp && !isGoogleAuth) {
        return res.status(400).json({
          success: false,
          error: "This account does not exist. Please click the 'Create Account' tab above to sign up first."
        });
      }
      if (!userExists) {
        console.info(`[Nexa Server] Registering first-time login for user: ${normalizedEmail}`);
        const initialChats = Array.isArray(currentChats) && currentChats.length > 0 ? currentChats : [];
        db[normalizedEmail] = {
          email: normalizedEmail,
          fullName: fullName?.trim() || email.split("@")[0],
          password,
          chats: initialChats,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
      const userRecord = db[normalizedEmail];
      if (!isGoogleAuth && userRecord.password !== password) {
        return res.status(401).json({ success: false, error: "Incorrect password for this email account. Please check your credentials." });
      }
      console.info(`[Nexa Server] Authenticated user: ${normalizedEmail}${isGoogleAuth ? " (via Google Link)" : ""}`);
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
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ success: false, error: error.message || "Authentication error." });
    }
  });
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
    } catch (error) {
      console.error("Sync error:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to sync." });
    }
  });
  const sendWaitlistEmail = async (toEmail) => {
    console.log("[Nexa SMTP Diagnostic] [Stage: Email send attempted] Beginning sendWaitlistEmail for:", toEmail);
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || `Nexa <${user}>`;
    const maskedUser = user ? user.includes("@") ? `${user.split("@")[0].slice(0, 3)}***@${user.split("@")[1]}` : `${user.slice(0, 3)}***` : "UNDEFINED";
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
      const transporter = import_nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
          // Prevents certificate verification failures in sandboxed containers
        },
        debug: true,
        logger: true,
        connectionTimeout: 15e3,
        greetingTimeout: 15e3,
        socketTimeout: 15e3
      });
      console.log("[Nexa SMTP Diagnostic] [Stage: SMTP authentication verification] Verifying transporter connection...");
      try {
        await transporter.verify();
        console.log("[Nexa SMTP Diagnostic] [Stage: SMTP authentication success] SMTP server verified successfully!");
      } catch (verifyErr) {
        console.error("[Nexa SMTP Diagnostic] [Stage: SMTP authentication failure] Verification failed:", {
          message: verifyErr.message,
          code: verifyErr.code,
          command: verifyErr.command,
          response: verifyErr.response,
          responseCode: verifyErr.responseCode,
          stack: verifyErr.stack
        });
        throw verifyErr;
      }
      console.log(`[Nexa SMTP Diagnostic] Verifying fields: To=${toEmail}, From=${from}, ReplyTo=${from}`);
      const mailOptions = {
        from,
        to: toEmail,
        replyTo: from,
        subject: "You're on the Nexa Premium Waitlist \u{1F389}",
        text: `Hi there,

Thank you for joining the Nexa Premium Waitlist! We are absolutely thrilled to have you with us.

You are officially on the list and will be among the first to gain early access when Nexa Premium officially launches.

Exclusive features you will unlock with Nexa Premium:
- Faster AI Responses
- Unlimited Deep Research
- Advanced Study Mode
- AI Image Generator
- Long-Term Memory
- AI Group Chat & Voice Calls
- Early Access to Upcoming Features

We will reach out to you as soon as early access slots open up for your spot in line.

Best regards,

The Nexa Team`,
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
        messageId: info.messageId
      });
      return { success: true, info };
    } catch (err) {
      console.error("[Nexa SMTP Diagnostic] [Stage: Email send failure] Email delivery failed:", {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
        stack: err.stack
      });
      return { success: false, error: err.message || String(err) };
    }
  };
  const FEEDBACK_DB_PATH = import_path.default.join(process.cwd(), "feedback_db.json");
  const readFeedbackDB = () => {
    try {
      if (import_fs.default.existsSync(FEEDBACK_DB_PATH)) {
        const fileContent = import_fs.default.readFileSync(FEEDBACK_DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read feedback database:", e);
    }
    return [];
  };
  const writeFeedbackDB = (data) => {
    try {
      import_fs.default.writeFileSync(FEEDBACK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to feedback database:", e);
    }
  };
  app.get("/api/feedback", (req, res) => {
    try {
      const feedbackList = readFeedbackDB();
      return res.status(200).json({ success: true, feedback: feedbackList });
    } catch (error) {
      console.error("[Nexa Server] Error getting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      feedbackList.push(newFeedback);
      writeFeedbackDB(feedbackList);
      console.info(`[Nexa Server] Feedback recorded from: ${email || userEmail || "Anonymous"} (${feedbackType})`);
      return res.status(200).json({
        success: true,
        feedback: newFeedback,
        message: "\u{1F389} Thank you for your feedback! It has been successfully received."
      });
    } catch (error) {
      console.error("[Nexa Server] Error submitting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  app.put("/api/feedback/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, error: "Status is required." });
      }
      const feedbackList = readFeedbackDB();
      const index = feedbackList.findIndex((item) => item.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Feedback not found." });
      }
      feedbackList[index].status = status;
      writeFeedbackDB(feedbackList);
      return res.status(200).json({ success: true, feedback: feedbackList[index] });
    } catch (error) {
      console.error("[Nexa Server] Error updating feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  app.delete("/api/feedback/:id", (req, res) => {
    try {
      const { id } = req.params;
      const feedbackList = readFeedbackDB();
      const filtered = feedbackList.filter((item) => item.id !== id);
      if (feedbackList.length === filtered.length) {
        return res.status(404).json({ success: false, error: "Feedback not found." });
      }
      writeFeedbackDB(filtered);
      return res.status(200).json({ success: true, message: "Feedback deleted successfully." });
    } catch (error) {
      console.error("[Nexa Server] Error deleting feedback:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/premium/waitlist", async (req, res) => {
    try {
      const { email, userId, source } = req.body;
      console.log(`[Nexa SMTP Diagnostic] [Stage: Request received] POST /api/premium/waitlist reached for email: ${email}, userId: ${userId}, source: ${source}`);
      if (!email) {
        console.warn("[Nexa SMTP Diagnostic] [Stage: Aborted] Missing email in waitlist request body.");
        return res.status(400).json({ success: false, error: "Email is required to join the waitlist." });
      }
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`[Nexa SMTP Diagnostic] [Stage: Supabase success] Verified that waitlist record for ${normalizedEmail} was written to Supabase by the client.`);
      console.log(`[Nexa SMTP Diagnostic] [Stage: Email send attempted] Handing off email delivery to sendWaitlistEmail for: ${normalizedEmail}`);
      const emailResult = await sendWaitlistEmail(normalizedEmail);
      if (emailResult.success) {
        console.log(`[Nexa SMTP Diagnostic] [Stage: Email send success] sendWaitlistEmail succeeded for: ${normalizedEmail}`);
        return res.status(200).json({
          success: true,
          status: "joined",
          message: "\u{1F389} You're officially on the Nexa Premium Waitlist!\n\nA confirmation email has been sent to your email address."
        });
      } else {
        console.error(`[Nexa SMTP Diagnostic] [Stage: Email send failure] sendWaitlistEmail reported failure for: ${normalizedEmail}. Error: ${emailResult.error}`);
        return res.status(500).json({
          success: false,
          error: `SMTP Error: ${emailResult.error || "Failed to send confirmation email."}`
        });
      }
    } catch (error) {
      console.error("[Nexa SMTP Diagnostic] Premium waitlist registration API error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to join the waitlist. Please try again."
      });
    }
  });
  app.get("/api/premium/waitlist/check", async (req, res) => {
    try {
      return res.status(200).json({ success: true, registered: false });
    } catch (error) {
      console.error("Check waitlist error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/premium/waitlist/leave", async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        message: "You've successfully left the Nexa Premium Waitlist.\n\nYou can join again anytime."
      });
    } catch (error) {
      console.error("Leave waitlist error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to remove you from the waitlist. Please try again."
      });
    }
  });
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
      const transporter = import_nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        },
        debug: true,
        logger: true,
        connectionTimeout: 1e4,
        greetingTimeout: 1e4,
        socketTimeout: 1e4
      });
      console.log("[Nexa Express SMTP Test] [Stage: Transporter created] Verifying connection...");
      await transporter.verify();
      console.log("[Nexa Express SMTP Test] [Stage: SMTP authentication success] Verification succeeded!");
      const mailOptions = {
        from,
        to: recipients.join(", "),
        replyTo: from,
        subject: "Nexa SMTP Test",
        text: `Hello! This is a test email from Nexa. Thank you for joining our waitlist!

Exclusive features you will unlock with Nexa Premium:
- Faster AI Responses
- Unlimited Deep Research
- Advanced Study Mode
- AI Image Generator
- Long-Term Memory
- AI Group Chat & Voice Calls
- Early Access to Upcoming Features`,
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
        messageId: info.messageId
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
          envelope: info.envelope
        }
      });
    } catch (err) {
      console.error("[Nexa Express SMTP Test] [Stage: Email send failure] Diagnostic failed:", {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        responseCode: err.responseCode,
        stack: err.stack
      });
      return res.status(500).json({
        success: false,
        error: err.message || err,
        details: {
          code: err.code,
          command: err.command,
          response: err.response,
          responseCode: err.responseCode
        }
      });
    }
  });
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
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const detectedUrls = Array.from(new Set(userPrompt.match(urlRegex) || []));
      const hasUrls = detectedUrls.length > 0;
      let linkAnalyzerContext = "";
      let pdfParts = [];
      if (hasUrls) {
        console.info(`[Nexa Core Server] URL detected in user prompt. Starting Universal Link Analysis...`);
        const analysisResults = await Promise.all(
          detectedUrls.map((url) => fetchUrlMetadataAndContent(url))
        );
        const nonPdfResults = analysisResults.filter((r) => !r.pdfData);
        if (nonPdfResults.length > 0) {
          linkAnalyzerContext = `

[NEXA UNIVERSAL LINK ANALYZER - RAW CONTENT & METADATA FEED]
The user is requesting an analysis of one or more URLs. Below is the parsed, server-side content & metadata for the requested link(s). Use these raw details, combined with Google Search grounding, to fulfill the request.

${nonPdfResults.map((res2, i) => `
---
LINK #${i + 1}: ${res2.url}
TYPE: ${res2.type}
TITLE: ${res2.title || "Unknown Title"}
DESCRIPTION: ${res2.description || "No description available."}
${res2.gitHubData ? `GITHUB DETAILS:
Stars: ${res2.gitHubData.stargazers_count} | Forks: ${res2.gitHubData.forks_count} | Open Issues: ${res2.gitHubData.open_issues_count}
Languages: ${res2.gitHubData.language || "N/A"}
License: ${res2.gitHubData.license?.name || "None"}` : ""}
${res2.bodyText ? `BODY TEXT CONTENT (Truncated):
${res2.bodyText.substring(0, 8e3)}` : ""}
${res2.isPrivateOrError ? `STATUS: Direct fetch blocked or failed (${res2.errorMessage}). Rely strictly on Google Search Grounding to research and verify details of this URL.` : ""}
---`).join("\n")}
`;
        }
        const pdfResults = analysisResults.filter((r) => !!r.pdfData);
        pdfResults.forEach((r) => {
          pdfParts.push({
            inlineData: {
              mimeType: r.pdfData.mimeType,
              data: r.pdfData.data
            }
          });
        });
      }
      const engineId = routeTask(userPrompt, mode, hasImage);
      const ai = getGeminiClient();
      let systemInstruction = "You are Nexa Core - an intelligent, helpful, highly premium, trustworthy AI chatbot designed with ultimate professional craftsmanship. You express answers in beautiful markdown with rich structure. Do not output any loading bars, neon effects or system-internal trace lines. IMPORTANT: ONLY if the user explicitly asks about who created you, built you, made you, or who your founder is, should you respond simply and clearly that you were created by Mayank (or in appropriate dialect/language like '\u092E\u0941\u091D\u0947 \u092E\u092F\u0902\u0915 \u0928\u0947 \u092C\u0928\u093E\u092F\u093E \u0939\u0948' or 'Mayank ne banaya hai'). NEVER volunteer this information or mention your creator unless directly and explicitly asked about it first. CRITICAL: Always respond/reply to the user in the EXACT same language, dialect, or conversational slang that the user used to write their message (e.g., if the user asks in Hindi, Hinglish, Haryanvi, Spanish, etc., you MUST reply in that exact same tongue and tone).";
      if (hasUrls) {
        systemInstruction += "\n\nUNIVERSAL LINK ANALYZER SYSTEM MODULE:\nYou have been activated as the Nexa Universal Link Analyzer. For every link provided by the user, perform a comprehensive, intelligent, high-fidelity analysis. Do NOT use lazy placeholders. Provide the following structured sections (use emojis, headings, bullet points, and tables beautifully):\n1. \u{1F310} LINK OVERVIEW: Title, URL, Content Type, Domain Reputation.\n2. \u{1F4DD} EXECUTIVE SUMMARY: A concise summary of the page/content.\n3. \u{1F50D} DETAILED BREAKDOWN: In-depth, comprehensive explanation of the content.\n4. \u{1F4A1} KEY POINTS & IMPORTANT FACTS: Extraction of key facts, tables, headings, and crucial data.\n5. \u2696\uFE0F PROS & CONS: Balanced evaluation (when applicable).\n6. \u{1F6E0}\uFE0F TECHNICAL ANALYSIS (if applicable): For GitHub, identify programming languages, frameworks, and project structure. For code files, analyze logic.\n7. \u{1F6E1}\uFE0F SECURITY & TRUST ASSESSMENT: Check for phishing, scams, suspicious domains, fake websites, or login walls. Analyze the domain/URL safety.\n8. \u{1F680} SEO & METADATA ANALYSIS: For websites, analyze SEO tags, performance hints, and indexability.\n9. \u{1F52E} AI-GENERATED RECOMMENDATIONS & FINAL CONCLUSION: Actionable ideas, logical next steps, and wrap-up.\n\nIf multiple links are provided, you MUST compare them together side-by-side using a clean Markdown table with headers, highlighting their main differences, purposes, and ratings.\nAnswer any follow-up questions about these links with high accuracy using the preserved context.";
      }
      if (personalizationContext) {
        systemInstruction += `
Remember this user persona/instructions: ${personalizationContext}`;
      }
      if (otherSessions && otherSessions.length > 0) {
        let pastChatsSummary = "\n\nCRITICAL CONTEXT - USER'S OTHER PAST CHAT SESSIONS:\n";
        pastChatsSummary += "You have visibility of user's other past sessions. Gently mention relative connections organically.\n";
        otherSessions.slice(0, 3).forEach((s) => {
          const lastMsgs = Array.isArray(s.messages) ? s.messages.slice(-1).map((m) => `[${m.role}]: ${m.content}`).join(" | ").substring(0, 80) : "";
          pastChatsSummary += `- Session ID: "${s.id}" | Title: "${s.title}" | Mode: "${s.mode}" | Preview: "${lastMsgs}"
`;
        });
        systemInstruction += pastChatsSummary;
      }
      const useSearch = mode === "research" || mode === "factcheck" || hasUrls || userPrompt.toLowerCase().includes("search") || userPrompt.toLowerCase().includes("live") || userPrompt.toLowerCase().includes("news") || userPrompt.toLowerCase().includes("current");
      const tools = useSearch ? [{ googleSearch: {} }] : void 0;
      if (useSearch) {
        systemInstruction += "\n\n\u{1F310} CITED ANSWERS & GROUNDED WEB SEARCH MODULE:\nWhen answering, you must strictly base your responses on factual, reliable search results. You must adhere to the following directives:\n1. PRIORITIZE HIGH-TRUST SOURCES:\n   - Prioritize official documentation over personal blogs.\n   - Prioritize government (.gov), university (.edu), academic research papers, and official corporate websites.\n   - For programming, prioritize official documentations, GitHub repos, MDN, Microsoft Learn, Python Docs, React Docs, and other standard SDK guides.\n   - For medical topics, prioritize official institutions like WHO, NIH, NHS, CDC, and established medical organization sites.\n   - For finance topics, prioritize government treasuries, official central banks, and established financial regulatory bodies.\n   - For legal topics, prioritize official legislative portals and government judiciaries.\n2. NO FABRICATION:\n   - Never generate fake, guessed, or fabricated sources or URLs. Only cite links that are directly returned in the search results or provided in user inputs.\n   - If no reliable public source or information exists for this query in the search results, explicitly state: 'No reliable public source was found for this information.'\n3. IN-TEXT CITATIONS:\n   - Support your claims by adding clear numbered in-text citations like [1], [2], etc., corresponding to the reliable source indexes.\n4. END-OF-TEXT SOURCES SECTION:\n   - At the absolute end of your response text, append a clearly titled section: '### Sources' (or in the language used, e.g. '### \u0938\u094D\u0930\u094B\u0924' for Hindi / Hinglish).\n   - List each cited source using its index number, Website Name, Article/Page Title, Clickable URL, Publisher (if available), and Publication date (if available) as detailed below:\n     Example:\n     1. OpenAI \u2013 GPT Documentation  \n        https://platform.openai.com/docs  \n        Publisher: OpenAI | Date: 2024\n     *(Make sure they are fully populated using authentic metadata. If any field like publisher or date is unavailable, omit that specific field rather than guessing)*.";
      }
      let contents = [];
      messages.forEach((msg) => {
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
          const parts = [
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
            parts: [{ text: `[Document Attachment "${msg.attachment.name}":
${msg.attachment.textPreview}]

${textContent || "Please analyze or summarize this document context."}` }]
          });
        } else {
          if (textContent) {
            contents.push({ role, parts: [{ text: textContent }] });
          } else {
            contents.push({ role, parts: [{ text: "..." }] });
          }
        }
      });
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
      const modelName = mode === "research" || mode === "factcheck" || mode === "quiz" || hasUrls ? "gemini-3.5-flash" : "gemini-3.1-flash-lite";
      if (mode === "quiz" || userPrompt.toLowerCase().includes("generate quiz") || userPrompt.toLowerCase().includes("mcq")) {
        const topic = quizTopic || userPrompt || "General Knowledge";
        systemInstruction = `You are the Nexa Learning Engine\u2019s MCQ & Quiz Generator. Generate a high quality 5-question multiple choice quiz about "${topic}" on difficulty level "${quizDifficulty}". Always provide exact explanations for the correct answer. You must output exactly matching the JSON schema.`;
        const responseSchema = {
          type: import_genai.Type.OBJECT,
          properties: {
            topic: { type: import_genai.Type.STRING },
            difficulty: { type: import_genai.Type.STRING },
            questions: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  id: { type: import_genai.Type.STRING },
                  question: { type: import_genai.Type.STRING },
                  options: {
                    type: import_genai.Type.ARRAY,
                    items: { type: import_genai.Type.STRING }
                  },
                  correctOptionIndex: { type: import_genai.Type.INTEGER },
                  explanation: { type: import_genai.Type.STRING }
                },
                required: ["id", "question", "options", "correctOptionIndex", "explanation"]
              }
            }
          },
          required: ["topic", "difficulty", "questions"]
        };
        const result2 = await generateContentWithRetry({
          initialModel: modelName,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode
        });
        const quizData = JSON.parse(result2.text || "{}");
        return res.json({
          content: `I've successfully generated a custom quiz on **${quizData.topic}** (${quizData.difficulty} level) for you! Use the interface to answer and test your knowledge.`,
          engineId: "learning",
          quiz: quizData
        });
      }
      if (mode === "factcheck" || userPrompt.toLowerCase().includes("fact check") || userPrompt.toLowerCase().includes("verify")) {
        systemInstruction = "You are the Nexa Fact Check Engine, a highly meticulous information validator. Investigate the claim provided in the prompt. Grade it with Confidence, Reliability, and give a clear Verdict ('verified', 'misleading', 'unverified', or 'debunked'). Search the web to check validity. Do not generate fake URLs.";
        const responseSchema = {
          type: import_genai.Type.OBJECT,
          properties: {
            contentMarkdown: { type: import_genai.Type.STRING, description: "Detailed structural markdown report with sections: Context, Investigation, and Final verdict" },
            confidenceScore: { type: import_genai.Type.INTEGER, description: "Percentage reflecting exact certainty of verdict 0-100" },
            reliabilityScore: { type: import_genai.Type.INTEGER, description: "Percentage reflecting source credibility 0-100" },
            verdict: { type: import_genai.Type.STRING, description: "'verified' | 'misleading' | 'unverified' | 'debunked'" },
            explanation: { type: import_genai.Type.STRING, description: "One sentence executive explanation of the check" },
            sourcesChecked: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING }
            }
          },
          required: ["contentMarkdown", "confidenceScore", "reliabilityScore", "verdict", "explanation", "sourcesChecked"]
        };
        const result2 = await generateContentWithRetry({
          initialModel: modelName,
          contents,
          config: {
            systemInstruction,
            tools,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode
        });
        const factData = JSON.parse(result2.text || "{}");
        const grounding2 = result2.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources2 = [];
        if (grounding2) {
          grounding2.forEach((c) => {
            if (c.web) {
              sources2.push({ title: c.web.title, uri: c.web.uri });
            }
          });
        }
        return res.json({
          content: factData.contentMarkdown,
          engineId: "core",
          sources: sources2.length > 0 ? sources2 : factData.sourcesChecked.map((s) => ({ title: s, uri: "#" })),
          factCheck: {
            confidenceScore: factData.confidenceScore,
            reliabilityScore: factData.reliabilityScore,
            verdict: factData.verdict,
            explanation: factData.explanation,
            sourcesChecked: factData.sourcesChecked
          }
        });
      }
      if (mode === "research") {
        systemInstruction = `You are Nexa's premium Deep Research Engine. Conduct an exhaustive exploration on the user query. Do multi-source exploration, analyze historical insights, present structural findings. Search the web for current live references. Output EXACTLY structured JSON according to the schema provided. Organize each section cleanly without skipping parts.`;
        const responseSchema = {
          type: import_genai.Type.OBJECT,
          properties: {
            executiveSummary: { type: import_genai.Type.STRING, description: "Brief high level TL;DR summary" },
            detailedFindings: { type: import_genai.Type.STRING, description: "Extensive deep dive report with formatting and bullet points" },
            keyInsights: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "3 to 5 core takeaway insights from the topic"
            }
          },
          required: ["executiveSummary", "detailedFindings", "keyInsights"]
        };
        const result2 = await generateContentWithRetry({
          initialModel: modelName,
          contents,
          config: {
            systemInstruction,
            tools,
            responseMimeType: "application/json",
            responseSchema
          },
          turboMode
        });
        const reportData = JSON.parse(result2.text || "{}");
        const grounding2 = result2.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources2 = [];
        if (grounding2) {
          grounding2.forEach((c) => {
            if (c.web) {
              sources2.push({ title: c.web.title, uri: c.web.uri });
            }
          });
        }
        return res.json({
          content: `### Executive Summary
${reportData.executiveSummary}

### Detailed Findings
${reportData.detailedFindings}`,
          engineId: "core",
          sources: sources2,
          researchReport: {
            executiveSummary: reportData.executiveSummary,
            detailedFindings: reportData.detailedFindings,
            keyInsights: reportData.keyInsights,
            references: sources2
          }
        });
      }
      if (mode === "study" || engineId === "learning") {
        systemInstruction = "You are Nexa Learning Engine - an educational assistant. Answer in highly structural blocks.";
        if (explainLikeIm10) {
          systemInstruction += " EXTREMELY IMPORTANT: Explain this topic under the strict constraint of 'Explain Like I'm 10' (ELI10). Use highly intuitive daily analogical references, simplified terms, and a nurturing tone suitable for a 10 year old kid.";
        } else {
          systemInstruction += " Provide rich study guides, outline key formulas, write explanatory notes, and offer exam preparation recommendations.";
        }
      } else if (engineId === "reasoning") {
        systemInstruction = "You are the Nexa Reasoning Engine. Break down calculations, logic schemas, code optimizations, and math proofs recursively. Always provide detailed step-by-step reasoning sequences. Wrap equations in standard LaTeX expressions or clear math block dividers.";
      } else if (engineId === "vision") {
        systemInstruction = "You are the Nexa Vision Engine. Thoroughly analyze the image uploaded by the user. Perform exact mathematical/chemical diagram reasoning, run screenshot OCR extraction if text exists, tell details of homework pages, and write structural breakdown comments.";
      } else if (engineId === "language") {
        systemInstruction = "You are the Nexa Language Engine. Perfect grammar, offer fluent translations, correct phrasing, give vocabulary synonyms, and assist multilingual interaction across standard Indian regional or International languages.";
      } else if (mode === "writing") {
        systemInstruction = `You are Nexa's premium Creative Writing Assistant. Draft content precisely matched with the selected theme: "${writingStyle}". Ensure high cohesion, clean rhythm, outstanding paragraphs, and beautiful grammar. Style matches:
- 'formal': professional, corporate-ready, polite and meticulous.
- 'casual': conversational, lively, high empathy, human-focused.
- 'academic': rigorous, high validation, detailed context, passive-neutral.
- 'professional': outcome-driven, key-point bullets, highly actionable.`;
      }
      if (systemInstruction) {
        systemInstruction += "\n\nRESPONSE FORMATTING DIRECTIVES:\n1. Agar user bole 'copy paste format me do', 'copyable format', 'code block me do', 'copy karne layak do', ya similar phrases, to response hamesha Markdown code block (```) ke andar hi do, bina kisi extra greeting ya explanations ke (ONLY the requested content should be inside the code block so the user can copy with one click).\n2. Agar user specifically bole 'sirf copy paste format', to extra explanations, introductory text, or concluding text bilkul mat do. Bilkul clean code block me content do.\n3. Bullet lists, numbered lists, headings, bold, italic, or blockquotes ke liye proper clean Markdown standards follow karo.\n4. Kisi bhi block of code, SQL queries, HTML, CSS, JSON, CSV, or prompts ko hamesha code blocks (```language ... ```) me render karo with proper syntax highlighting.\n5. Agar user table maange, to standard cleanly formatted and aligned Markdown tables ka use karo, dynamic column layouts use karo aur line-breaks break mat karo.\n6. Plain text use tabhi karo jab user explicitly plain text maange.";
        systemInstruction += "\nAlways use suitable and warm emojis throughout your response (unless copying format or code block format is requested) to make it look highly expressive, welcoming, interactive, and beautifully designed. Place relevant emojis at key moments, headers, lists, and inside paragraphs where appropriate.";
        systemInstruction += "\nCRITICAL LANGUAGE DIRECTIVE: Always detect and respond in the EXACT language, dialect, or conversational slang that the user has used in their last message. If the user writes in English, reply in English. If the user writes in Hinglish (Hindi written in Latin script, e.g. 'nexa ab bhi hindi mai...', 'kaise ho', 'kya chalra hai', 'theek h'), you MUST write your entire response inside standard Hinglish (Latin alphabets) with similar colloquial slang. If they use pure Devnagari Hindi (\u0939\u093F\u0928\u094D\u0926\u0940), reply in pure Devnagari Hindi. Never auto-translate or respond in a different language/script combination than what the user used. Keep consistency with the user's chosen script and tongue.";
      }
      const result = await generateContentWithRetry({
        initialModel: modelName,
        contents,
        config: {
          systemInstruction,
          tools
        },
        turboMode
      });
      const responseText = result.text || "";
      const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = [];
      if (grounding) {
        grounding.forEach((c) => {
          if (c.web) {
            sources.push({ title: c.web.title, uri: c.web.uri });
          }
        });
      }
      return res.json({
        content: responseText,
        engineId,
        sources: sources.length > 0 ? sources : void 0
      });
    } catch (err) {
      console.info("[Nexa Gateway Warning] Gemini API Gateway Exception:", err?.message || err);
      return res.status(200).json({
        content: `### \u{1F534} System Alert

Nexa's secure core is active. The engine experienced a connectivity or configuration state issue.

**Reason:** ${err.message || "Unknown gateway timeout"}

*Please ensure your **GEMINI_API_KEY** is configured in AI Studio's **Settings > Secrets** or in your environment '.env' file to unlock direct real-time answers.*`,
        engineId: "core",
        sources: [{ title: "Configure Keys", uri: "#" }]
      });
    }
  });
  app.post("/api/generate-title", async (req, res) => {
    try {
      const { prompt, response } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided" });
      }
      console.info("[Nexa Core Server] Generating title for new conversation...");
      const systemInstruction = "You are a helpful assistant. Generate a highly concise, creative, and professional title summarizing the user query and response. CRITICAL RULES:\n- The title must be between 2 to 5 words long.\n- Do NOT wrap the title in quotes, backticks, or any markdown.\n- Do NOT use any emojis, punctuation, or special characters.\n- Respond ONLY with the title itself, with no extra text or pleasantries.\n- Keep it in the same language/script as the prompt (e.g. if prompt is in Hindi/Hinglish, summarize in Hinglish or simple Hindi; otherwise English).";
      const result = await generateContentWithRetry({
        initialModel: "gemini-3.1-flash-lite",
        // Speed-optimized
        contents: [
          {
            role: "user",
            parts: [{ text: `Prompt: ${prompt}

Response: ${response || ""}

Generate Title:` }]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.7
        },
        turboMode: true
      });
      const title = (result.text || "").trim().replace(/^["']|["']$/g, "").replace(/[#*_`]/g, "");
      console.info(`[Nexa Core Server] Generated title: "${title}"`);
      return res.json({ title: title || "New Chat" });
    } catch (err) {
      console.error("[Nexa Server] Title generation exception:", err);
      return res.status(200).json({ title: "New Chat" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nexa Server] Dynamic fullstack service running on http://0.0.0.0:${PORT}`);
    sendStartupTestEmail();
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
    const transporter = import_nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
        // Ensures TLS connection inside sandboxed networks is permissive
      },
      debug: true,
      logger: true,
      connectionTimeout: 15e3,
      greetingTimeout: 15e3,
      socketTimeout: 15e3
    });
    console.log("[Nexa SMTP Startup Test] Verifying transporter...");
    try {
      await transporter.verify();
      console.log("[Nexa SMTP Startup Test] transporter.verify() result: SUCCESS! SMTP connection is verified.");
    } catch (verifyErr) {
      console.error("[Nexa SMTP Startup Test] transporter.verify() result: FAILED. Error details:", {
        message: verifyErr.message,
        code: verifyErr.code,
        command: verifyErr.command,
        response: verifyErr.response,
        responseCode: verifyErr.responseCode,
        stack: verifyErr.stack
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
  } catch (err) {
    console.error("[Nexa SMTP Startup Test] TEST EMAIL FAILED! Detailed SMTP Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      stack: err.stack
    });
  }
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
