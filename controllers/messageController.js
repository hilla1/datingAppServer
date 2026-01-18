import Message from "../models/messageModel.js";

/**
 * Create a new message
 * POST /api/messages
 */
const createMessage = async (req, res, next) => {
  try {
    const { sender, receiver, content } = req.body;

    const message = await Message.create({ sender, receiver, content });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message by ID
 * GET /api/messages/:id
 */
const getMessageById = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate("sender", "name email")
      .populate("receiver", "name email");

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all messages
 * GET /api/messages
 * Supports filtering by sender, receiver, read status, pagination
 */
const getAllMessages = async (req, res, next) => {
  try {
    const { sender, receiver, isRead, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (sender) filter.sender = sender;
    if (receiver) filter.receiver = receiver;
    if (isRead !== undefined) filter.isRead = isRead === "true";

    const total = await Message.countDocuments(filter);
    const messages = await Message.find(filter)
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update message (PUT) - full update
 * PUT /api/messages/:id
 */
const updateMessage = async (req, res, next) => {
  try {
    const message = await Message.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * Patch message (PATCH) - partial update
 * PATCH /api/messages/:id
 */
const patchMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    Object.keys(req.body).forEach(key => {
      message[key] = req.body[key];
    });

    await message.save();
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete message
 * DELETE /api/messages/:id
 */
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark message as read
 * PATCH /api/messages/:id/read
 */
const markMessageRead = async (req, res, next) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    res.status(200).json({ success: true, data: message });
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
  markMessageRead,
};
