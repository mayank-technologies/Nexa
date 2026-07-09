import { IncomingMessage, ServerResponse } from "http";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req: any, res: any) {
  // Support simple CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

  console.log("[Nexa Test Email API] [Stage: Request received] Triggering test email delivery...");
  console.log(`[Nexa Test Email API] Config: Host=${host}, Port=${port}, User=${user}`);

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

    console.log("[Nexa Test Email API] [Stage: Transporter created] Verifying connection...");
    await transporter.verify();
    console.log("[Nexa Test Email API] [Stage: SMTP authentication success] Verification succeeded!");

    const mailOptions = {
      from,
      to: recipients.join(", "),
      replyTo: from,
      subject: "Nexa SMTP Test",
      text: "Hello! This is a test email from Nexa.",
    };

    console.log("[Nexa Test Email API] [Stage: Email send attempted] Sending test mail...");
    const info = await transporter.sendMail(mailOptions);

    console.log("[Nexa Test Email API] [Stage: Email send success] Full sendMail Result:", {
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
      },
    });

  } catch (err: any) {
    console.error("[Nexa Test Email API] [Stage: Email send failure] Diagnostic failed:", {
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
}
