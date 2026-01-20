import Message from "../models/messageModel.js";
import Conversation from "../models/conversationModel.js";

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

    // Create message
    let message = await Message.create({
      conversationId,
      sender,
      content,
      attachments: attachments || [],
      replyTo: replyTo || null,
      readBy: [sender],
      deletedBy: [],
    });

    // Update conversation lastMessage
    conversation.lastMessage = message._id;
    await conversation.save();

    // Nested populate
    message = await message.populate([
      { path: "sender", select: "name avatar" },
      { path: "replyTo", populate: { path: "sender", select: "name avatar" }, select: "content attachments sender" },
    ]);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message by ID
 */
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

/**
 * Get all messages in a conversation with pagination
 */
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

/**
 * Full update (PUT)
 */
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

/**
 * Partial update (PATCH)
 */
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

/**
 * Soft delete for current user
 */
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message)
      return res.status(404).json({ success: false, message: "Message not found" });

    if (!message.deletedBy.includes(req.userId)) {
      message.deletedBy.push(req.userId);
      await message.save();
    }

    res.status(200).json({ success: true, message: "Message deleted successfully for this user" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all conversations for current user
 */
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

export const messageController = {
  createMessage,
  getMessageById,
  getAllMessages,
  updateMessage,
  patchMessage,
  deleteMessage,
  getUserConversations,
};
