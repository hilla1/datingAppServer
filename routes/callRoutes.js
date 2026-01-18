import express from "express";
import { callController } from "../controllers/callController.js";
import userAuth from "../middleware/userAuth.js"; 

const callRouter = express.Router();

// CRUD Routes
callRouter.post("/", userAuth, callController.createCall);
callRouter.get("/", userAuth, callController.getAllCalls);
callRouter.get("/:id", userAuth, callController.getCallById);
callRouter.put("/:id", userAuth, callController.updateCall);
callRouter.patch("/:id", userAuth, callController.patchCall);
callRouter.delete("/:id", userAuth, callController.deleteCall);

// Special updates
callRouter.patch("/:id/status", userAuth, callController.updateCallStatus);
callRouter.patch("/:id/duration", userAuth, callController.updateCallDuration);

export default callRouter;
