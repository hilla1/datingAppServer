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
import { updateLastActive } from "./utils/updateLastActive.js";
import User from "./models/userModel.js";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

connectDB();

const allowedOrigins = [process.env.VITE_CLIENT_URL];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

const onlineUsers = new Map();           // userId → latest socket.id
const socketToUser = new Map();          // socket.id → userId (faster disconnect lookup)

io.on("connection", (socket) => {
  let heartbeatInterval = null;
  let currentUserId = null;

  const cleanupUser = async (userId) => {
    if (!userId) return;
    if (onlineUsers.get(userId) === socket.id) {
      onlineUsers.delete(userId);
      socketToUser.delete(socket.id);

      try {
        await updateLastActive(userId);
        io.emit("user-offline", {
          userId,
          lastSeenAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Failed to update lastActive for ${userId}:`, err.message);
      }
    }
  };

  socket.on("join-room", (userId) => {
    if (!userId || typeof userId !== "string") return;

    const uid = String(userId);

    // Remove previous connection for same user (multi-tab / reconnect)
    if (onlineUsers.has(uid)) {
      const oldSocketId = onlineUsers.get(uid);
      socketToUser.delete(oldSocketId);
    }

    currentUserId = uid;
    socket.join(uid);
    onlineUsers.set(uid, socket.id);
    socketToUser.set(socket.id, uid);

    updateLastActive(uid);

    // Heartbeat – only update if this is still the active socket for the user
    heartbeatInterval = setInterval(() => {
      if (socket.connected && onlineUsers.get(uid) === socket.id) {
        updateLastActive(uid);
      }
    }, 45000); // slightly less aggressive than 60s

    // Notify others
    socket.broadcast.emit("user-online", uid);
  });

  socket.on("check-user-online", async (targetUserId) => {
    if (!targetUserId) return;

    const uid = String(targetUserId);
    const isOnline = onlineUsers.has(uid);

    let lastSeenAt = null;
    if (!isOnline) {
      try {
        const userDoc = await User.findById(uid).select("lastActive").lean();
        lastSeenAt = userDoc?.lastActive ? new Date(userDoc.lastActive).toISOString() : null;
      } catch (err) {
        console.error("check-user-online DB error:", err.message);
        lastSeenAt = new Date().toISOString();
      }
    }

    socket.emit("user-online-status", {
      userId: uid,
      online: isOnline,
      lastSeenAt,
    });
  });

  // Batch endpoint – very important for lists/grids
  socket.on("check-users-online", async (userIds) => {
    if (!Array.isArray(userIds)) return;
    if (userIds.length === 0 || userIds.length > 400) return; // safety limit

    const results = [];

    for (const rawId of userIds) {
      const uid = String(rawId);
      const isOnline = onlineUsers.has(uid);

      let lastSeenAt = null;
      if (!isOnline) {
        try {
          const doc = await User.findById(uid).select("lastActive").lean();
          lastSeenAt = doc?.lastActive ? new Date(doc.lastActive).toISOString() : null;
        } catch {
          lastSeenAt = new Date().toISOString();
        }
      }

      results.push({ userId: uid, online: isOnline, lastSeenAt });
    }

    socket.emit("users-online-status", results);
  });

  socket.on("join-conversation", (conversationId) => {
    if (conversationId) socket.join(String(conversationId));
  });

  socket.on("typing", ({ conversationId }) => {
    if (conversationId) socket.to(conversationId).emit("typing", { conversationId });
  });

  socket.on("stop-typing", ({ conversationId }) => {
    if (conversationId) socket.to(conversationId).emit("stop-typing", { conversationId });
  });

  socket.on("messages-read", ({ conversationId, userId, messageIds }) => {
    if (!conversationId || !userId || !Array.isArray(messageIds) || !messageIds.length) return;
    io.to(conversationId).emit("messages-read", {
      conversationId,
      messageIds,
      readByUserId: userId,
    });
  });

  socket.on("disconnect", async () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    if (currentUserId) {
      await cleanupUser(currentUserId);
    } else if (socketToUser.has(socket.id)) {
      // fallback – in case join-room never happened
      const uid = socketToUser.get(socket.id);
      await cleanupUser(uid);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { io };