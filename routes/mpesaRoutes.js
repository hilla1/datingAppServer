import express from "express";
import { checkTransactionStatus, initiateStkPush, mpesaCallback } from "../controllers/mpesaController.js";

const mpesaRouter = express.Router();

mpesaRouter.post("/stk-push", initiateStkPush);
mpesaRouter.post("/callback", mpesaCallback);
mpesaRouter.get('/transaction-status', checkTransactionStatus);

export default mpesaRouter;
