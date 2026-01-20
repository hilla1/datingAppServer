import express from "express";
import { messageController } from "../controllers/messageController.js";
import userAuth from "../middleware/userAuth.js";

const messageRouter = express.Router();

// ---------- Message Routes ----------

// Create a new message
messageRouter.post("/", userAuth, messageController.createMessage);

// Get all messages in a conversation with optional pagination
messageRouter.get("/", userAuth, messageController.getAllMessages);

// Get a single message by ID
messageRouter.get("/:id", userAuth, messageController.getMessageById);

// Full update of a message by ID
messageRouter.put("/:id", userAuth, messageController.updateMessage);

// Partial update of a message by ID
messageRouter.patch("/:id", userAuth, messageController.patchMessage);

// Soft delete a message for current user
messageRouter.delete("/:id", userAuth, messageController.deleteMessage);

// Get all conversations for the current user with last message & unread counts
messageRouter.get("/conversations/list", userAuth, messageController.getUserConversations);

export default messageRouter;
