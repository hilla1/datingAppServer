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
import { updateLastActive } from "./utils/updateLastActive.js";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

connectDB();

const allowedOrigins = [process.env.VITE_CLIENT_URL];

// Middleware
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
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
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

// Socket.IO connection logic
const onlineUsers = new Map(); // userId (as string) → socket.id

io.on("connection", (socket) => {
  // console.log("New client connected:", socket.id);

  let heartbeatInterval = null;

  socket.on("join-room", (userId) => {
    if (!userId) return;

    // Force string conversion – critical to avoid ObjectId vs string mismatch
    const uid = String(userId);

    // Clean up any previous entries for this user (handles multi-tab / reconnect)
    for (const [existingUid, existingSockId] of onlineUsers.entries()) {
      if (existingUid === uid) {
        onlineUsers.delete(existingUid);
        // Optional: you could notify old socket, but not necessary
      }
    }

    socket.join(uid);
    onlineUsers.set(uid, socket.id);
    // console.log(`User ${uid} joined their room (socket ${socket.id})`);

    // Update lastActive immediately on join
    updateLastActive(uid);

    // ── NEW: Heartbeat – keep lastActive fresh while tab/window is open ──
    heartbeatInterval = setInterval(() => {
      if (socket.connected && onlineUsers.has(uid)) {
        updateLastActive(uid);
      }
    }, 60_000); // 60 seconds – good balance between freshness & DB writes

    // Broadcast to others (not to self)
    socket.broadcast.emit("user-online", uid);
  });

  socket.on("check-user-online", (targetUserId) => {
    if (!targetUserId) return;

    const uid = String(targetUserId);
    const isOnline = onlineUsers.has(uid);

    // Optional debug log (remove later if not needed)
    // console.log(`[check] ${uid} → online=${isOnline} (total online: ${onlineUsers.size})`);

    socket.emit("user-online-status", {
      userId: uid,           // consistent string
      online: isOnline
    });
  });

  socket.on("join-conversation", (conversationId) => {
    if (conversationId) {
      socket.join(String(conversationId)); // also normalize to string
      // console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
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

  socket.on("messages-read", ({ conversationId, userId, messageIds }) => {
    if (!conversationId || !userId || !messageIds?.length) {
      // console.log("Invalid messages-read payload:", { conversationId, userId, messageIds });
      return;
    }

    // console.log(`User ${userId} marked messages as read in ${conversationId}:`, messageIds);

    io.to(conversationId).emit("messages-read", {
      conversationId,
      messageIds,
      readByUserId: userId,
    });
  });

  socket.on("disconnect", () => {
    //console.log("Client disconnected:", socket.id);

    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Find if this socket was associated with any user
    const affectedUsers = [];

    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        affectedUsers.push(userId);
      }
    }

    affectedUsers.forEach((userId) => {
      // Check if this user has any other active sockets
      const stillConnected = Array.from(onlineUsers.entries()).some(
        ([uid, sid]) => uid === userId && sid !== socket.id
      );

      if (!stillConnected) {
        // No other sockets left → truly offline
        onlineUsers.delete(userId);
        //console.log(`User ${userId} fully offline (no remaining sockets)`);

        // ── NEW: Final lastActive update when user goes fully offline ──
        updateLastActive(userId);

        io.emit("user-offline", userId);
      } else {
        // Still has other tabs/devices → keep online
        //console.log(`User ${userId} still connected via other socket(s)`);
        // Optional: update map to point to one remaining socket
        const remaining = Array.from(onlineUsers.entries()).find(
          ([uid, sid]) => uid === userId && sid !== socket.id
        );
        if (remaining) {
          onlineUsers.set(userId, remaining[1]);
        }
      }
    });
  });
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});

export { io };