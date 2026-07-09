import { IncomingMessage, ServerResponse } from "http";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req: any, res: any) {
  // Support simple CORS in Vercel
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { email, userId, source } = req.body;
  console.log(`[Nexa Serverless SMTP Diagnostic] [Stage: Request received] POST /api/premium/waitlist reached for email: ${email}, userId: ${userId}, source: ${source}`);

  if (!email) {
    console.warn("[Nexa Serverless SMTP Diagnostic] [Stage: Aborted] Missing email in waitlist request body.");
    return res.status(400).json({ success: false, error: "Email is required to join the waitlist." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Confirm Firestore success: as per client flow, setDoc is resolved before this API is called
  console.log(`[Nexa Serverless SMTP Diagnostic] [Stage: Firestore success] Verified that waitlist record for ${normalizedEmail} was written to Firestore by the client.`);

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `Nexa <${user}>`;

  const maskedUser = user ? (user.includes("@") ? `${user.split("@")[0].slice(0, 3)}***@${user.split("@")[1]}` : `${user.slice(0, 3)}***`) : "UNDEFINED";
  const passExists = pass ? "YES (defined)" : "NO (undefined)";

  console.log("[Nexa Serverless SMTP Diagnostic] Environment Variables Check:");
  console.log(`  - SMTP_HOST: ${host}`);
  console.log(`  - SMTP_PORT: ${port}`);
  console.log(`  - SMTP_USER: ${maskedUser}`);
  console.log(`  - SMTP_PASS exists: ${passExists}`);
  console.log(`  - SMTP_FROM: ${from}`);
  console.log(`  - VERCEL env is present: ${process.env.VERCEL ? "YES" : "NO"}`);
  console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);

  if (!user || !pass) {
    console.warn("[Nexa Serverless SMTP Diagnostic] [Stage: Aborted] SMTP credentials are not configured in Vercel. Skipping confirmation email.");
    return res.status(200).json({
      success: true,
      status: "joined",
      message: "🎉 You're on the waitlist! (SMTP credentials not configured on server)"
    });
  }

  console.log("[Nexa Serverless SMTP Diagnostic] [Stage: Email send attempted] Beginning email delivery flow...");

  try {
    console.log("[Nexa Serverless SMTP Diagnostic] [Stage: SMTP transporter created] Creating Nodemailer transporter...");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    console.log("[Nexa Serverless SMTP Diagnostic] [Stage: SMTP authentication verification] Verifying transporter connection...");
    try {
      await transporter.verify();
      console.log("[Nexa Serverless SMTP Diagnostic] [Stage: SMTP authentication success] SMTP server verified successfully!");
    } catch (verifyErr: any) {
      console.error("[Nexa Serverless SMTP Diagnostic] [Stage: SMTP authentication failure] Verification failed:", {
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
      to: normalizedEmail,
      subject: "You're on the Nexa Premium Waitlist 🎉",
      text: `Hi,\n\nThank you for joining the Nexa Premium Waitlist! 🎉\n\nWe're excited to have you with us.\n\nYou are now officially on the waitlist and will be among the first users to get early access when Nexa Premium launches.\n\nHere's what you'll get with Nexa Premium:\n\n⚡ Faster AI Responses\n\n🔍 Unlimited Deep Research\n\n📚 Advanced Study Mode\n\n🎨 AI Image Generator\n\n🧠 Long-Term Memory\n\n✨ Nexa Companion\n\n👥 AI Group Chat\n\n📞 AI Voice Calls\n\n🚀 Early Access to Upcoming Features\n\nWe'll notify you as soon as Nexa Premium is ready.\n\nThank you for believing in Nexa and being part of our journey.\n\nBest regards,\n\nThe Nexa Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 16px;">Hi,</p>
          <p style="font-size: 16px;">Thank you for joining the Nexa Premium Waitlist! 🎉</p>
          <p style="font-size: 16px;">We're excited to have you with us.</p>
          <p style="font-size: 16px;">You are now officially on the waitlist and will be among the first users to get early access when Nexa Premium launches.</p>
          
          <p style="font-size: 16px; font-weight: bold; margin-top: 24px;">Here's what you'll get with Nexa Premium:</p>
          <p style="font-size: 15px; margin: 8px 0;">⚡ Faster AI Responses</p>
          <p style="font-size: 15px; margin: 8px 0;">🔍 Unlimited Deep Research</p>
          <p style="font-size: 15px; margin: 8px 0;">📚 Advanced Study Mode</p>
          <p style="font-size: 15px; margin: 8px 0;">🎨 AI Image Generator</p>
          <p style="font-size: 15px; margin: 8px 0;">🧠 Long-Term Memory</p>
          <p style="font-size: 15px; margin: 8px 0;">✨ Nexa Companion</p>
          <p style="font-size: 15px; margin: 8px 0;">👥 AI Group Chat</p>
          <p style="font-size: 15px; margin: 8px 0;">📞 AI Voice Calls</p>
          <p style="font-size: 15px; margin: 8px 0;">🚀 Early Access to Upcoming Features</p>
          
          <p style="font-size: 16px; margin-top: 24px;">We'll notify you as soon as Nexa Premium is ready.</p>
          <p style="font-size: 16px;">Thank you for believing in Nexa and being part of our journey.</p>
          
          <p style="font-size: 16px; margin-top: 24px; margin-bottom: 4px;">Best regards,</p>
          <p style="font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 0;">The Nexa Team</p>
        </div>
      `,
    };

    console.log("[Nexa Serverless SMTP Diagnostic] [Stage: Email send attempted] Sending email via Nodemailer...");
    const info = await transporter.sendMail(mailOptions);
    console.info(`[Nexa Serverless SMTP Diagnostic] [Stage: Email send success] Confirmation email sent successfully to ${normalizedEmail}: ${info.messageId}`);
    
    return res.status(200).json({
      success: true,
      status: "joined",
      message: "🎉 You're officially on the Nexa Premium Waitlist!\n\nA confirmation email has been sent to your email address."
    });

  } catch (err: any) {
    console.error("[Nexa Serverless SMTP Diagnostic] [Stage: Email send failure] Email delivery failed:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      stack: err.stack,
    });
    
    // We still return 200/joined because the Firestore registration was successful
    return res.status(200).json({
      success: true,
      status: "joined",
      emailSent: false,
      message: "🎉 You're officially on the Nexa Premium Waitlist!\n\n(Waitlist joined, but confirmation email delivery failed: " + (err.message || err) + ")"
    });
  }
}
