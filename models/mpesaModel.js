import mongoose from "mongoose";

const mpesaSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    checkoutRequestID: String,
    mpesaReceiptNumber: String,
    transactionDate: String,
    rawCallback: Object,
  },
  { timestamps: true }
);

const mpesaModel = mongoose.models.mpesa || mongoose.model('mpesa', mpesaSchema);

export default mpesaModel;