import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import getTransporter from '../config/nodemailer.js';
import { OAuth2Client } from 'google-auth-library';
import { setAuthCookies } from '../utils/setAuthCookies.js';
import { clearAuthCookies } from '../utils/clearAuthCookies.js';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

const redirectURL = `${process.env.BASE_URL}/auth/oauth/callback`;

/* -------------------------------------------------------------------------- */
/*                               EMAIL HELPERS                                 */
/* -------------------------------------------------------------------------- */

const sendEmailAsync = async (options) => {
  try {
    const transporter = await getTransporter();
    await transporter.sendMail(options);
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

const welcomeEmail = ({ name }) => ({
  subject: 'Welcome to Tudate 💖',
  text: `Welcome to Tudate, ${name}!

We’re excited to have you join a community built for meaningful connections and real relationships.

Your journey starts now.

— Tudate Team`,
  html: `
  <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#fff;padding:24px;border-radius:12px">
    <h2 style="color:#fb7185">Welcome to Tudate 💖</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>
      You’ve just joined <strong>Tudate</strong> — a place where genuine connections,
      meaningful conversations, and real relationships begin.
    </p>
    <div style="margin:20px 0;padding:16px;border-radius:10px;background:linear-gradient(135deg,#fb7185,#38bdf8);color:#fff">
      💕 Discover compatible matches<br/>
      💬 Start real conversations<br/>
      🌱 Build something meaningful
    </div>
    <p>Complete your profile and take the first step toward something special.</p>
    <p style="color:#6b7280;font-size:14px;margin-top:24px">
      With love,<br/><strong>The Tudate Team</strong>
    </p>
  </div>
  `,
});

const otpEmail = ({ otp, purpose }) => ({
  subject: purpose,
  text: `Your OTP is ${otp}.`,
  html: `
  <div style="max-width:520px;margin:auto;font-family:Arial,sans-serif;background:#fff;padding:24px;border-radius:12px">
    <h3>${purpose}</h3>
    <p>Your one-time password is:</p>
    <div style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0;color:#fb7185">
      ${otp}
    </div>
    <p>This OTP will expire soon. Do not share it with anyone.</p>
  </div>
  `,
});

/* -------------------------------------------------------------------------- */
/*                                   REGISTER                                  */
/* -------------------------------------------------------------------------- */

export const register = async (req, res) => {
  if (!req.body) return res.json({ message: 'Request body is missing' });

  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.json({ success: false, message: 'Missing Details' });

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) return res.json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    setAuthCookies(res, token);

    sendEmailAsync({
      from: process.env.SENDER_EMAIL,
      to: email,
      ...welcomeEmail({ name }),
    });

    return res.json({ success: true, message: 'Account created succesfully' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                    LOGIN                                    */
/* -------------------------------------------------------------------------- */

export const login = async (req, res) => {
  if (!req.body) return res.json({ message: 'Request body is missing' });

  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ success: false, message: 'Email and password are required' });

  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: 'Invalid email' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: 'Invalid password' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    setAuthCookies(res, token);

    return res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                               GOOGLE OAUTH                                  */
/* -------------------------------------------------------------------------- */

export const googleOAuthRedirect = (req, res) => {
  const authorizeUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    redirect_uri: redirectURL,
  });
  res.redirect(authorizeUrl);
};

export const googleOAuthCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.VITE_CLIENT_URL}`);

  try {
    const { tokens } = await client.getToken({ code, redirect_uri: redirectURL });
    client.setCredentials(tokens);

    const response = await client.request({ url: 'https://www.googleapis.com/oauth2/v3/userinfo' });
    const { email, name, picture, sub: googleId } = response.data;

    let user = await userModel.findOne({ email });
    if (!user) {
      user = new userModel({
        name,
        email,
        googleId,
        avatar: picture,
        isAccountVerified: true,
        role: 'user',
      });
      await user.save();

      sendEmailAsync({
        from: process.env.SENDER_EMAIL,
        to: email,
        ...welcomeEmail({ name }),
      });
    } else {
      let shouldSave = false;
      if (!user.avatar && picture) { user.avatar = picture; shouldSave = true; }
      if (!user.isAccountVerified) { user.isAccountVerified = true; shouldSave = true; }
      if (shouldSave) await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    setAuthCookies(res, token);
    return res.redirect(`${process.env.VITE_CLIENT_URL}/dashboard`);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                    LOGOUT                                   */
/* -------------------------------------------------------------------------- */

export const logout = async (req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                               EMAIL VERIFICATION                            */
/* -------------------------------------------------------------------------- */

export const sendVerifyOtp = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);
    if (user.isAccountVerified) return res.json({ success: false, message: 'Account already verified' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    sendEmailAsync({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      ...otpEmail({ otp, purpose: 'Account verification OTP' }),
    });

    return res.json({ success: true, message: 'Verification OTP sent on Email' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  if (!req.body) return res.json({ message: 'Request body is missing' });

  const { otp } = req.body;

  try {
    const user = await userModel.findById(req.userId);
    if (!user || user.verifyOtp !== otp || user.verifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isAccountVerified = true;
    user.verifyOtp = '';
    user.verifyOtpExpireAt = 0;
    await user.save();

    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                               AUTH CHECK                                    */
/* -------------------------------------------------------------------------- */

export const isAuthenticated = async (req, res) => {
  return res.json({ success: true, message: 'Authenticated', role: req.userRole });
};

/* -------------------------------------------------------------------------- */
/*                             PASSWORD RESET                                  */
/* -------------------------------------------------------------------------- */

export const sendResetOtp = async (req, res) => {
  if (!req.body) return res.json({ message: 'Request body is missing' });

  const { email } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: 'User not found' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    sendEmailAsync({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      ...otpEmail({ otp, purpose: 'Password reset OTP' }),
    });

    return res.json({ success: true, message: 'OTP sent to your Email' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  if (!req.body) return res.json({ message: 'Request body is missing' });

  const { email, otp, newPassword } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user || user.resetOtp !== otp || user.resetOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = '';
    user.resetOtpExpireAt = 0;
    await user.save();

    return res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
