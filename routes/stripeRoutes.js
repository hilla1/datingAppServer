// routes/stripeRoutes.js
import express from "express";
import { createPaymentIntent } from "../controllers/stripeController.js";

const stripeRouter = express.Router();

stripeRouter.post("/create-payment-intent", createPaymentIntent);

export default stripeRouter;
