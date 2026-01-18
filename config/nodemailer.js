import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,          // SSL port (works on Render)
  secure: true,       // SSL from the start
  auth: {
    user: process.env.EMAIL_USER, // Gmail email
    pass: process.env.EMAIL_PASS, // App password (required if 2FA is enabled)
  },
  tls: {
    rejectUnauthorized: false,   // avoids SSL issues on cloud hosts
  },
  connectionTimeout: 20000,       // 20s timeout
  greetingTimeout: 20000,
  socketTimeout: 20000,
  debug: process.env.NODE_ENV !== "production",
});

export default transporter;
