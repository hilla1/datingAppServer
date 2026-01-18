import express from "express";
import { createOrder, captureOrder } from "../controllers/paypalController.js";

const paypalRouter = express.Router();

paypalRouter.post("/create-order", createOrder);

paypalRouter.post("/capture-order", captureOrder);

export default paypalRouter;
