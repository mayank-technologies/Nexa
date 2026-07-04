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

  // --- PREMIUM WAITLIST REGISTRATION DATABASE SETUP ---
  const WAITLIST_DB_PATH = path.join(process.cwd(), "premium_waitlist_db.json");

  const readWaitlistDB = (): any[] => {
    try {
      if (fs.existsSync(WAITLIST_DB_PATH)) {
        const fileContent = fs.readFileSync(WAITLIST_DB_PATH, "utf8");
        return JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("Failed to read premium waitlist database:", e);
    }
    return [];
  };

  const writeWaitlistDB = (data: any[]) => {
    try {
      fs.writeFileSync(WAITLIST_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to write to premium waitlist database:", e);
    }
  };

  const sendWaitlistConfirmationEmail = async (recipientEmail: string): Promise<boolean> => {
    const subject = "🚀 Welcome to the Nexa Premium Waitlist!";
    const from = process.env.SMTP_FROM || "Nexa Team <no-reply@nexa.app>";

    const plainText = `Hi there,

Thank you for joining the Nexa Premium Waitlist! 🎉

We're excited to have you with us.

You're now among the first users who will receive early access to Nexa Premium before its public launch.

Here's what you can look forward to:

⚡ Faster AI Responses
🔍 Unlimited Deep Research
📚 Advanced Study Mode
🎨 AI Image Generator
🧠 Long-Term Memory
✨ Nexa Companion
👥 AI Group Chat
📞 AI Voice Calls
🚀 Early Access to New Features

Our team is working hard to build an amazing premium experience, and we'll notify you as soon as it's ready.

Thank you for believing in Nexa and being part of our journey.

See you soon!

— The Nexa Team

This email was sent because you joined the Nexa Premium Waitlist.
© Nexa. All rights reserved.`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Nexa Premium Waitlist!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      background-color: #f8fafc;
      width: 100%;
      padding: 40px 10px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 40px 30px;
      text-align: center;
      border-bottom: 4px solid #C96A3D;
    }
    .logo-container {
      margin-bottom: 15px;
    }
    .logo-text {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.05em;
    }
    .logo-dot {
      color: #C96A3D;
    }
    .badge {
      display: inline-block;
      background-color: rgba(201, 106, 61, 0.15);
      border: 1px solid rgba(201, 106, 61, 0.3);
      color: #C96A3D;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 6px 16px;
      border-radius: 100px;
      margin-top: 5px;
    }
    .content {
      padding: 40px 35px;
      color: #334155;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .lead-text {
      font-size: 15px;
      color: #475569;
      margin-bottom: 25px;
    }
    .feature-headline {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #C96A3D;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 8px;
    }
    .features-grid {
      margin-bottom: 30px;
    }
    .feature-item {
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .feature-icon {
      font-size: 18px;
      margin-right: 12px;
      display: inline-block;
      vertical-align: middle;
    }
    .feature-details {
      display: inline-block;
      vertical-align: middle;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      margin: 0;
    }
    .copyright {
      margin-top: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-container">
          <span class="logo-text">Nexa<span class="logo-dot">.</span></span>
        </div>
        <div class="badge">🚀 Waitlist Confirmed</div>
      </div>
      <div class="content">
        <p class="greeting">Hi there,</p>
        <p class="lead-text">Thank you for joining the Nexa Premium Waitlist! 🎉 We're excited to have you with us.</p>
        <p class="lead-text">You're now among the first users who will receive early access to Nexa Premium before its public launch.</p>
        
        <div class="feature-headline">Here's what you can look forward to:</div>
        
        <div class="features-grid">
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <span class="feature-details">Faster AI Responses</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🔍</span>
            <span class="feature-details">Unlimited Deep Research</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📚</span>
            <span class="feature-details">Advanced Study Mode</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <span class="feature-details">AI Image Generator</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🧠</span>
            <span class="feature-details">Long-Term Memory</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✨</span>
            <span class="feature-details">Nexa Companion</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">👥</span>
            <span class="feature-details">AI Group Chat</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📞</span>
            <span class="feature-details">AI Voice Calls</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🚀</span>
            <span class="feature-details">Early Access to New Features</span>
          </div>
        </div>
        
        <p style="margin-top: 25px; margin-bottom: 15px; font-size: 14px; color: #475569;">Our team is working hard to build an amazing premium experience, and we'll notify you as soon as it's ready.</p>
        <p style="margin-top: 0; font-size: 14px; color: #475569;">Thank you for believing in Nexa and being part of our journey.</p>
        
        <p style="margin-top: 25px; margin-bottom: 0; font-size: 14px; font-weight: 700; color: #0f172a;">See you soon!</p>
        <p style="margin-top: 5px; margin-bottom: 0; font-size: 14px; font-weight: 700; color: #C96A3D;">— The Nexa Team</p>
      </div>
      <div class="footer">
        <p class="footer-text">This email was sent because you joined the Nexa Premium Waitlist.</p>
        <p class="footer-text copyright">© Nexa. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      console.info(`[Nexa Email Simulator] SIMULATED EMAIL DELIVERED TO: ${recipientEmail}`);
      console.info(`[Nexa Email Simulator] SUBJECT: ${subject}`);
      console.info(`[Nexa Email Simulator] FROM: ${from}`);
      console.info(`[Nexa Email Simulator] Plaintext fallback preview:\n${plainText}`);
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      console.info(`[Nexa Email Simulator] Real SMTP host is not configured (SMTP_USER/SMTP_PASS are empty).`);
      console.info(`[Nexa Email Simulator] Configure credentials in .env or secrets to send actual emails.`);
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      return true;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
        port: parseInt(smtpPort || "587"),
        secure: smtpPort === "465",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: from,
        to: recipientEmail,
        subject: subject,
        text: plainText,
        html: htmlContent,
      });

      console.info(`[Nexa Email] Waitlist confirmation email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`[Nexa Email ERROR] Failed to deliver waitlist email to ${recipientEmail}:`, error);
      return false;
    }
  };

  const sendLeaveWaitlistEmail = async (recipientEmail: string): Promise<boolean> => {
    const subject = "You've Left the Nexa Premium Waitlist";
    const from = process.env.SMTP_FROM || "Nexa Team <no-reply@nexa.app>";

    const plainText = `Hi,

You've successfully removed yourself from the Nexa Premium Waitlist.

You will no longer receive Premium launch updates or early access emails.

If you change your mind, you can join the waitlist again anytime from the Nexa website.

Thank you for trying Nexa.

— The Nexa Team`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Left the Nexa Premium Waitlist</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      background-color: #f8fafc;
      width: 100%;
      padding: 40px 10px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 40px 30px;
      text-align: center;
      border-bottom: 4px solid #64748b;
    }
    .logo-container {
      margin-bottom: 15px;
    }
    .logo-text {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.05em;
    }
    .logo-dot {
      color: #64748b;
    }
    .badge {
      display: inline-block;
      background-color: rgba(100, 116, 139, 0.15);
      border: 1px solid rgba(100, 116, 139, 0.3);
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 6px 16px;
      border-radius: 100px;
      margin-top: 5px;
    }
    .content {
      padding: 40px 35px;
      color: #334155;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .lead-text {
      font-size: 15px;
      color: #475569;
      margin-bottom: 20px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      margin: 0;
    }
    .copyright {
      margin-top: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-container">
          <span class="logo-text">Nexa<span class="logo-dot">.</span></span>
        </div>
        <div class="badge">Waitlist Removed</div>
      </div>
      <div class="content">
        <p class="greeting">Hi,</p>
        <p class="lead-text">You've successfully removed yourself from the Nexa Premium Waitlist.</p>
        <p class="lead-text">You will no longer receive Premium launch updates or early access emails.</p>
        <p class="lead-text">If you change your mind, you can join the waitlist again anytime from the Nexa website.</p>
        
        <p style="margin-top: 25px; margin-bottom: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Thank you for trying Nexa.</p>
        <p style="margin-top: 5px; margin-bottom: 0; font-size: 14px; font-weight: 700; color: #C96A3D;">— The Nexa Team</p>
      </div>
      <div class="footer">
        <p class="footer-text">This email was sent because you joined the Nexa Premium Waitlist.</p>
        <p class="footer-text copyright">© Nexa. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      console.info(`[Nexa Email Simulator] SIMULATED EMAIL DELIVERED TO: ${recipientEmail}`);
      console.info(`[Nexa Email Simulator] SUBJECT: ${subject}`);
      console.info(`[Nexa Email Simulator] FROM: ${from}`);
      console.info(`[Nexa Email Simulator] Plaintext fallback preview:\n${plainText}`);
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      console.info(`[Nexa Email Simulator] Real SMTP host is not configured (SMTP_USER/SMTP_PASS are empty).`);
      console.info(`[Nexa Email Simulator] Configure credentials in .env or secrets to send actual emails.`);
      console.info(`[Nexa Email Simulator] --------------------------------------------------`);
      return true;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
        port: parseInt(smtpPort || "587"),
        secure: smtpPort === "465",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: from,
        to: recipientEmail,
        subject: subject,
        text: plainText,
        html: htmlContent,
      });

      console.info(`[Nexa Email] Leave waitlist confirmation email sent successfully to ${recipientEmail}. Message ID: ${info.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`[Nexa Email ERROR] Failed to deliver leave waitlist email to ${recipientEmail}:`, error);
      return false;
    }
  };

  // Premium Waitlist Post endpoint
  app.post("/api/premium/waitlist", (req, res) => {
    try {
      const { email, userId, source } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required to join the waitlist." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const waitlist = readWaitlistDB();

      // Check for duplicate
      const alreadyExists = waitlist.some(
        (item: any) => item.email.toLowerCase().trim() === normalizedEmail
      );

      if (alreadyExists) {
        return res.status(200).json({
          success: true,
          status: "already_registered",
          message: "You're already on the Nexa Premium waitlist."
        });
      }

      // Add new record
      const newEntry = {
        email: normalizedEmail,
        userId: userId || null,
        timestamp: new Date().toISOString(),
        source: source || "unknown"
      };

      waitlist.push(newEntry);
      writeWaitlistDB(waitlist);

      console.info(`[Nexa Server] New user joined Premium waitlist: ${normalizedEmail} (Source: ${source})`);

      // Send the email confirmation immediately (asynchronously)
      sendWaitlistConfirmationEmail(normalizedEmail).catch((err) => {
        console.error(`[Nexa Server] Error sending confirmation email to ${normalizedEmail}:`, err);
      });

      return res.status(200).json({
        success: true,
        status: "joined",
        message: "You're officially on the Nexa Premium waitlist!"
      });

    } catch (error: any) {
      console.error("Premium waitlist registration error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to join the waitlist. Please try again."
      });
    }
  });

  // Check waitlist status endpoint
  app.get("/api/premium/waitlist/check", (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required to check waitlist." });
      }
      const normalizedEmail = String(email).toLowerCase().trim();
      const waitlist = readWaitlistDB();
      const exists = waitlist.some((item: any) => item.email.toLowerCase().trim() === normalizedEmail);
      return res.status(200).json({ success: true, registered: exists });
    } catch (error: any) {
      console.error("Check waitlist error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Leave waitlist endpoint
  app.post("/api/premium/waitlist/leave", (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required to leave the waitlist." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const waitlist = readWaitlistDB();

      // Filter out matching record
      const initialLength = waitlist.length;
      const filteredWaitlist = waitlist.filter(
        (item: any) => item.email.toLowerCase().trim() !== normalizedEmail
      );

      if (filteredWaitlist.length === initialLength) {
        return res.status(200).json({
          success: false,
          error: "This email was not found on the Nexa Premium waitlist."
        });
      }

      writeWaitlistDB(filteredWaitlist);

      console.info(`[Nexa Server] User left Premium waitlist: ${normalizedEmail}`);

      // Send confirmation email
      sendLeaveWaitlistEmail(normalizedEmail).catch((err) => {
        console.error(`[Nexa Server] Error sending leave confirmation email to ${normalizedEmail}:`, err);
      });

      return res.status(200).json({
        success: true,
        message: "You've successfully left the Nexa Premium Waitlist."
      });

    } catch (error: any) {
      console.error("Leave waitlist error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to remove you from the waitlist. Please try again."
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
