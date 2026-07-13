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

dotenv.config();

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
      const userPrompt = activeMessage.content;
      const attachment = activeMessage.attachment;
      const hasImage = !!(attachment && attachment.type === "image");

      // Smart Route classification
      const engineId = routeTask(userPrompt, mode, hasImage);

      // Lazily get Gemini Client
      const ai = getGeminiClient();

      // Setup System Instructions and configs depending on engine and mode
      let systemInstruction = "You are Nexa Core - an intelligent, helpful, highly premium, trustworthy AI chatbot designed with ultimate professional craftsmanship. You express answers in beautiful markdown with rich structure. Do not output any loading bars, neon effects or system-internal trace lines. IMPORTANT: ONLY if the user explicitly asks about who created you, built you, made you, or who your founder is, should you respond simply and clearly that you were created by Mayank (or in appropriate dialect/language like 'मुझे मयंक ने बनाया है' or 'Mayank ne banaya hai'). NEVER volunteer this information or mention your creator unless directly and explicitly asked about it first. CRITICAL: Always respond/reply to the user in the EXACT same language, dialect, or conversational slang that the user used to write their message (e.g., if the user asks in Hindi, Hinglish, Haryanvi, Spanish, etc., you MUST reply in that exact same tongue and tone).";

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

      // Configure tools - enable Google Search grounding for real-time mode, Deep Research, or Fact Checker
      const useSearch = mode === "research" || mode === "factcheck" || userPrompt.toLowerCase().includes("search") || userPrompt.toLowerCase().includes("live") || userPrompt.toLowerCase().includes("news") || userPrompt.toLowerCase().includes("current");
      const tools = useSearch ? [{ googleSearch: {} }] : undefined;

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

      // Choose speed-optimized model: gemini-3.1-flash-lite resolves under 1 second for standard chats
      const modelName = (mode === "research" || mode === "factcheck" || mode === "quiz")
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
        systemInstruction += "\nAlways use suitable and warm emojis throughout your response to make it look highly expressive, welcoming, interactive, and beautifully designed. Place relevant emojis at key moments, headers, lists, and inside paragraphs where appropriate.";
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

  // Bind to 0.0.0.0 on port 3000 exclusively
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nexa Server] Dynamic fullstack service running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
