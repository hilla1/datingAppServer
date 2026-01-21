// src/controllers/messageController.js
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

    // Optional: also emit to individual user rooms 
    // conversation.participants.forEach((participantId) => {
    //   if (io.sockets.adapter.rooms.has(participantId.toString())) {
    //     io.to(participantId.toString()).emit("receive-message", message);
    //   }
    // });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────
// The rest of your functions remain unchanged
// ────────────────────────────────────────────────────────────────

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
        { path: "sender", select: "name avatar" },
        { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
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
      { path: "sender", select: "name avatar" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
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
      { path: "sender", select: "name avatar" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
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
        populate: { path: "sender", select: "name avatar" },
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

const markConversationAsRead = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    const unreadMessages = await Message.find({
      conversationId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
      deletedBy: { $ne: userId },
    }).select("_id");

    const messageIds = unreadMessages.map((m) => m._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { readBy: userId } }
      );

      io.to(conversationId).emit("messages-read", {
        conversationId,
        messageIds,
      });
    }

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      messageIds,
    });
  } catch (error) {
    next(error);
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