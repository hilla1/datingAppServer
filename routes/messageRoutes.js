import express from "express";
import { messageController } from "../controllers/messageController.js";
import userAuth from "../middleware/userAuth.js";

const messageRouter = express.Router();

// Mark whole conversation as read (body: { conversationId })
messageRouter.patch("/read", userAuth, messageController.markConversationAsRead);

// ── CRUD routes with :id after special routes 

messageRouter.post("/", userAuth, messageController.createMessage);
messageRouter.get("/", userAuth, messageController.getAllMessages);

// :id routes come AFTER /read
messageRouter.get("/:id", userAuth, messageController.getMessageById);
messageRouter.put("/:id", userAuth, messageController.updateMessage);
messageRouter.patch("/:id", userAuth, messageController.patchMessage);   
messageRouter.delete("/:id", userAuth, messageController.deleteMessage);

messageRouter.get("/conversations/list", userAuth, messageController.getUserConversations);

export default messageRouter;