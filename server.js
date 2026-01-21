// src/server.js
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

const onlineUsers = new Map();

io.on("connection", (socket) => {
  //console.log("New client connected:", socket.id);

  socket.on("join-room", (userId) => {
    if (userId) {
      socket.join(userId);
      onlineUsers.set(userId, socket.id);
      //console.log(`User ${userId} joined their room`);
      socket.broadcast.emit("user-online", userId);
    }
  });

  socket.on("check-user-online", (targetUserId) => {
    if (!targetUserId) return;
    const isOnline = onlineUsers.has(targetUserId.toString());
    socket.emit("user-online-status", { userId: targetUserId, online: isOnline });
  });

  socket.on("join-conversation", (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
      //console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    }
  });

  socket.on("typing", ({ conversationId }) => {
    if (conversationId) {
      socket.to(conversationId).emit("typing", { conversationId });
    }
  });

  socket.on("stop-typing", ({ conversationId }) => {
    if (conversationId) {
      socket.to(conversationId).emit("stop-typing", { conversationId });
    }
  });

  // ────────────────────────────────────────────────
  // IMPROVED: messages-read handler with logging
  // ────────────────────────────────────────────────
  socket.on("messages-read", ({ conversationId, userId, messageIds }) => {
    if (!conversationId || !userId || !messageIds?.length) {
      //console.log("Invalid messages-read payload:", { conversationId, userId, messageIds });
      return;
    }

    //console.log(`User ${userId} marked messages as read in ${conversationId}:`, messageIds);

    // Broadcast to the entire conversation room (including sender!)
    io.to(conversationId).emit("messages-read", {
      conversationId,
      messageIds,
      readByUserId: userId,   // ← optional: helps frontend know who read it
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    let disconnectedUserId = null;
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      io.emit("user-offline", disconnectedUserId);
    }
  });
});

server.listen(port, () => console.log(`Server running on port:${port}`));

export { io };