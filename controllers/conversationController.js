// src/controllers/conversationController.js
import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";

/**
 * Create a new conversation (1:1 or group)
 * POST /api/conversations
 */
const createConversation = async (req, res, next) => {
  try {
    const userId = req.userId;
    let { participants = [], name } = req.body;

    if (!Array.isArray(participants)) participants = [];

    // Ensure current user is included
    if (!participants.includes(userId)) participants.push(userId);

    if (participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 participants are required to create a conversation",
      });
    }

    // 1:1 conversation deduplication
    if (participants.length === 2) {
      const existing = await Conversation.findOne({
        participants: { $all: participants, $size: 2 },
      }).populate("participants", "name avatar");
      if (existing) return res.status(200).json({ success: true, data: existing });
    }

    // Create new conversation
    const conversation = await Conversation.create({ participants, name });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants", "name avatar");

    res.status(201).json({ success: true, data: populatedConversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all conversations for current user with last message & unread count
 * GET /api/conversations
 */
const getUserConversations = async (req, res, next) => {
  try {
    const userId = req.userId;

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name avatar")
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
        });
        return { ...conv.toObject(), unreadCount };
      })
    );

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Add participants to a conversation (atomic)
 * PATCH /api/conversations/:id/add
 */
const addParticipants = async (req, res, next) => {
  try {
    const { participants } = req.body;
    const conversationId = req.params.id;

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ success: false, message: "Participants are required" });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { participants: { $each: participants } } },
      { new: true }
    ).populate("participants", "name avatar");

    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove participants from a conversation (atomic)
 * PATCH /api/conversations/:id/remove
 */
const removeParticipants = async (req, res, next) => {
  try {
    const { participants } = req.body;
    const conversationId = req.params.id;

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ success: false, message: "Participants are required" });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { $in: participants } } },
      { new: true }
    ).populate("participants", "name avatar");

    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete conversation + all its messages
 * DELETE /api/conversations/:id
 */
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    await Message.deleteMany({ conversationId: conversation._id });

    res.status(200).json({ success: true, message: "Conversation deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const conversationController = {
  createConversation,
  getUserConversations,
  addParticipants,
  removeParticipants,
  deleteConversation,
};
