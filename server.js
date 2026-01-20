import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import 'dotenv/config';

import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import paypalRouter from "./routes/paypalRoutes.js";
import stripeRouter from "./routes/stripeRoutes.js";
import mpesaRouter from "./routes/mpesaRoutes.js";
import exchangeRouter from "./routes/exchangeRoute.js";
import fileRouter from "./routes/fileRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import callRouter from "./routes/callRoutes.js";
import conversationRouter from "./routes/conversationRoutes.js";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;
connectDB();

const allowedOrigins = [process.env.VITE_CLIENT_URL];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Health Endpoint for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/paypal', paypalRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/mpesa", mpesaRouter);
app.use("/api/exchange", exchangeRouter);
app.use("/api/file", fileRouter);
app.use("/api/profile", profileRouter);
app.use("/api/message", messageRouter);
app.use("/api/conversation", conversationRouter);
app.use("/api/call", callRouter);

// -------- Socket.IO Setup --------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Map to track connected users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Add user to online map
  socket.on("user-online", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  // Handle sending messages
  socket.on("send-message", ({ conversationId, senderId, content, replyTo }) => {
    const message = {
      _id: Date.now().toString(), // temporary ID, real ID comes from DB
      conversationId,
      sender: { _id: senderId },
      content,
      replyTo,
      createdAt: new Date(),
    };

    // Emit to all participants
    socket.to(conversationId).emit("receive-message", message);
  });

  // Join rooms for conversation
  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    onlineUsers.forEach((value, key) => {
      if (value === socket.id) onlineUsers.delete(key);
    });
  });
});

app.listen(port, () => console.log(`Server running on port:${port}`));
export { io };