// src/services/emailService.js
//
// Two modes, selected automatically:
//
//   PRODUCTION  — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.
//                 Any SMTP provider works (Gmail, Resend, Mailgun, SendGrid, etc.)
//
//   DEVELOPMENT — if those variables are absent, emails are printed to the
//                 terminal instead of sent.  No extra setup needed to get
//                 started.  The verification link appears in your console log.

const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM  = "Finance App <noreply@financeapp.local>",
  APP_URL    = "http://localhost:3000",
  NODE_ENV,
} = process.env;

const useRealTransport = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

// ── Transport ─────────────────────────────────────────────────────────────────

function createTransport() {
  if (useRealTransport) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  // Dev: log email to stdout instead of sending
  return nodemailer.createTransport({
    jsonTransport: true,  // built-in fake transport
  });
}

// ── Send helper ───────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html, text }) {
  const transport = createTransport();

  const message = {
    from: SMTP_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  };

  const info = await transport.sendMail(message);

  if (!useRealTransport) {
    // Pretty-print in dev so developers can copy the link easily
    const parsed = JSON.parse(info.message);
    console.log("\n──────────────────────────────────────────");
    console.log("📧  EMAIL (dev mode — not actually sent)");
    console.log(`    To:      ${to}`);
    console.log(`    Subject: ${subject}`);
    // Extract and highlight any URL in the body
    const urlMatch = parsed.text?.match(/https?:\/\/\S+/);
    if (urlMatch) console.log(`    Link:    ${urlMatch[0]}`);
    console.log("──────────────────────────────────────────\n");
  }

  return info;
}

// ── Email templates ───────────────────────────────────────────────────────────

async function sendVerificationEmail({ name, email, token }) {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;

  await sendMail({
    to: email,
    subject: "Verify your Finance App account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#222">
        <h2 style="font-size:20px;font-weight:500;margin-bottom:8px">Verify your email</h2>
        <p style="margin-bottom:24px;color:#555">Hi ${name}, click the button below to verify your
        email address and activate your account. The link expires in
        <strong>24 hours</strong>.</p>
        <a href="${url}"
           style="display:inline-block;background:#185FA5;color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
          Verify email address
        </a>
        <p style="margin-top:24px;font-size:12px;color:#888">
          Or copy this link:<br>
          <a href="${url}" style="color:#185FA5;word-break:break-all">${url}</a>
        </p>
        <p style="margin-top:32px;font-size:12px;color:#aaa">
          If you did not create an account, you can ignore this email.
        </p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };
