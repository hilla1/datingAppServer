import express from "express";
import { messageController } from "../controllers/messageController.js";
import userAuth from "../middleware/userAuth.js"; 

const messageRouter = express.Router();

// CRUD Routes
messageRouter.post("/", userAuth, messageController.createMessage);
messageRouter.get("/", userAuth, messageController.getAllMessages);
messageRouter.get("/:id", userAuth, messageController.getMessageById);
messageRouter.put("/:id", userAuth, messageController.updateMessage);
messageRouter.patch("/:id", userAuth, messageController.patchMessage);
messageRouter.delete("/:id", userAuth, messageController.deleteMessage);

// Mark message as read
messageRouter.patch("/:id/read", userAuth, messageController.markMessageRead);

export default messageRouter;
