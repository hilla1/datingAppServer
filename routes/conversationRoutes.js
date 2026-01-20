import express from "express";
import { conversationController } from "../controllers/conversationController.js";
import userAuth from "../middleware/userAuth.js";

const conversationRouter = express.Router();

// ---------- Conversation Routes ----------

// Create a new conversation (1:1 or group)
conversationRouter.post("/", userAuth, conversationController.createConversation);

// Get all conversations for current user
conversationRouter.get("/", userAuth, conversationController.getUserConversations);

// Add participants to a conversation
conversationRouter.patch("/:id/add", userAuth, conversationController.addParticipants);

// Remove participants from a conversation
conversationRouter.patch("/:id/remove", userAuth, conversationController.removeParticipants);

// Delete a conversation (and optionally its messages)
conversationRouter.delete("/:id", userAuth, conversationController.deleteConversation);

export default conversationRouter;
