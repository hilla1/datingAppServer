import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,           // SSL port
  secure: true,        // true for SSL
  auth: {
    user: process.env.EMAIL_USER, // Gmail email
    pass: process.env.EMAIL_PASS, // App password
  },
  tls: {
    rejectUnauthorized: false,   // allows self-signed certs (needed on some cloud hosts)
  },
  connectionTimeout: 10000,       // 10 seconds timeout
  greetingTimeout: 10000,         // wait for server greeting
  socketTimeout: 10000,           // total socket timeout
  debug: process.env.NODE_ENV !== "production", // verbose logs in dev
});

export default transporter;
