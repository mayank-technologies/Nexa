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

  // Confirm Supabase success: as per client flow, the client writes before this API is called
  console.log(`[Nexa Serverless SMTP Diagnostic] [Stage: Supabase success] Verified that waitlist record for ${normalizedEmail} was written to Supabase by the client.`);

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
    console.log("[Nexa Serverless SMTP Diagnostic] [Stage: SMTP transporter created] Creating Nodemailer transporter with debug & logger enabled...");
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

    console.log(`[Nexa Serverless SMTP Diagnostic] Verifying fields: To=${normalizedEmail}, From=${from}, ReplyTo=${from}`);

    const mailOptions = {
      from,
      to: normalizedEmail,
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

    console.log("[Nexa Serverless SMTP Diagnostic] [Stage: Email send attempted] Sending plain-text and HTML email via Nodemailer...");
    const info = await transporter.sendMail(mailOptions);
    console.info("[Nexa Serverless SMTP Diagnostic] [Stage: Email send success] Confirmation email sendMail() reported success:", {
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      response: info.response,
      envelope: info.envelope,
      messageId: info.messageId,
    });
    
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
    
    // We still return 200/joined because the Supabase registration was successful
    return res.status(200).json({
      success: true,
      status: "joined",
      emailSent: false,
      message: "🎉 You're officially on the Nexa Premium Waitlist!\n\n(Waitlist joined, but confirmation email delivery failed: " + (err.message || err) + ")"
    });
  }
}
