// src/controllers/messageController.js
import mongoose from 'mongoose';
import Message from "../models/messageModel.js";
import Conversation from "../models/conversationModel.js";
import { io } from "../server.js"; 
import { deleteFromCloudinary } from "../middleware/uploadMiddleware.js"; 

/**
 * Create a new message
 * POST /api/messages
 */
const createMessage = async (req, res, next) => {
  try {
    const sender = req.userId;
    const { conversationId, content, attachments, replyTo } = req.body;

    if (!conversationId)
      return res.status(400).json({ success: false, message: "Conversation ID is required" });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation)
      return res.status(404).json({ success: false, message: "Conversation not found" });

    // Create message with sender already marked as read
    let message = await Message.create({
      conversationId,
      sender,
      content,
      attachments: attachments || [],
      replyTo: replyTo || null,
      readBy: [sender],
      deletedBy: [],
    });

    // Update last message reference
    conversation.lastMessage = message._id;
    await conversation.save();

    // Populate for response + socket
    message = await message.populate([
      { path: "sender", select: "name avatar" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
    ]);

    // ────────────────────────────────────────────────
    // IMPORTANT CHANGE: Emit to CONVERSATION room
    // This ensures everyone currently in the chat sees the message instantly
    // ────────────────────────────────────────────────
    io.to(conversationId).emit("receive-message", message);

    // Emit to individual user rooms (for notifications, unread count, presence)
    conversation.participants.forEach((participantId) => {
      const uid = participantId.toString();
      if (io.sockets.adapter.rooms.has(uid)) {
        io.to(uid).emit("receive-message", message);
      }
    });


    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};


const getMessageById = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id).populate([
      { path: "sender", select: "name avatar" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
    ]);

    if (!message)
      return res.status(404).json({ success: false, message: "Message not found" });

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

const getAllMessages = async (req, res, next) => {
  try {
    const { conversationId, page = 1, limit = 50 } = req.query;

    if (!conversationId)
      return res.status(400).json({ success: false, message: "Conversation ID is required" });

    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId,
      deletedBy: { $ne: req.userId },
    })
      .populate([
        { path: "sender", select: "name avatar lastActive" },
        { path: "replyTo", populate: { path: "sender", select: "name avatar lastActive" }, select: "content attachments sender" },
      ])
      .sort("createdAt")
      .skip(Number(skip))
      .limit(Number(limit));

    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const updateData = { ...req.body, edited: true };

    let message = await Message.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!message)
      return res.status(404).json({ success: false, message: "Message not found" });

    message = await message.populate([
      { path: "sender", select: "name avatar lastActive" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar lastActive" }, select: "content attachments sender" },
    ]);

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

const patchMessage = async (req, res, next) => {
  try {
    let message = await Message.findById(req.params.id);

    if (!message)
      return res.status(404).json({ success: false, message: "Message not found" });

    Object.keys(req.body).forEach((key) => {
      message[key] = req.body[key];
    });

    message.edited = true;
    await message.save();

    message = await message.populate([
      { path: "sender", select: "name avatar lastActive" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar lastActive" }, select: "content attachments sender" },
    ]);

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message)
      return res.status(404).json({ success: false, message: "Message not found" });

    if (!message.deletedBy.includes(req.userId)) {
      message.deletedBy.push(req.userId);
      await message.save();
    }

    const conversation = await Conversation.findById(message.conversationId);
    if (conversation && message.deletedBy.length === conversation.participants.length) {
      for (const att of message.attachments) {
        if (att.publicId) {
          try {
            await deleteFromCloudinary(att.publicId);
          } catch (deleteErr) {
            console.error("Failed to delete attachment:", att.publicId, deleteErr);
          }
        }
      }

      await Message.findByIdAndDelete(req.params.id);
      return res.status(200).json({ success: true, message: "Message fully deleted" });
    }

    res.status(200).json({ success: true, message: "Message deleted successfully for this user" });
  } catch (error) {
    next(error);
  }
};

const getUserConversations = async (req, res, next) => {
  try {
    const userId = req.userId;

    const conversations = await Conversation.find({ participants: userId })
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar lastActive" },
      })
      .sort("-updatedAt");

    const data = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          readBy: { $ne: userId },
          deletedBy: { $ne: userId },
        });
        return { ...conv.toObject(), unreadCount };
      })
    );

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.body;

    // ── 1. Input validation 
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized – user ID missing",
        code: "AUTH_MISSING_USERID",
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required in request body",
        code: "MISSING_CONVERSATION_ID",
      });
    }

    // Optional: validate ObjectId format early (prevents later cast errors)
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversationId format",
        code: "INVALID_CONVERSATION_ID",
      });
    }

    // ── 2. Atomic bulk update 
    const updateResult = await Message.updateMany(
      {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        sender: { $ne: userId },
        readBy: { $ne: userId },
        deletedBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } },
      { runValidators: true }
    );

    const modifiedCount = updateResult.modifiedCount || 0;

    // Early return when nothing to update (very common case)
    if (modifiedCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No unread messages to mark as read",
        modifiedCount: 0,
      });
    }

    // ── 3. Socket broadcast (only if changes occurred) 
    if (req.io) {
      req.io.to(conversationId).emit("messages-read", {
        conversationId,
        userId,
        modifiedCount,
        timestamp: new Date().toISOString(),
        // We no longer send messageIds → frontend should refetch or optimistically update
      });
    } else {
      console.warn(`Socket.IO not available – cannot broadcast read status for conversation ${conversationId}`);
    }

    // ── 4. Response 
    return res.status(200).json({
      success: true,
      message: `Marked ${modifiedCount} message(s) as read`,
      modifiedCount,
    });
  } catch (error) {
    // Structured logging – very useful in production
    console.error("markConversationAsRead failed", {
      userId: req.userId,
      conversationId: req.body?.conversationId,
      errorMessage: error.message,
      errorStack: error.stack?.split("\n").slice(0, 4).join("\n"),
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      message: "Failed to mark conversation as read",
      errorCode: "SERVER_MARK_READ_FAILED",
      ...(process.env.NODE_ENV === "development" && { debug: error.message }),
    });
  }
};

export const messageController = {
  createMessage,
  getMessageById,
  getAllMessages,
  updateMessage,
  patchMessage,
  deleteMessage,
  getUserConversations,
  markConversationAsRead,
};