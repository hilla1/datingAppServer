import axios from "axios";
import moment from "moment";
import MpesaTransaction from "../models/mpesaModel.js";

const getMpesaToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(`${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  return res.data.access_token;
};

// STK PUSH initiation with amount
export const initiateStkPush = async (req, res) => {
  const { phone, amount = 1 } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ 
      success: false, 
      message: "Phone and amount required.",
      details: { received: req.body }
    });
  }

  try {
    const accessToken = await getMpesaToken();

    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const phoneFormatted = phone.startsWith("254") ? phone : phone.replace(/^0/, "254");

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: parseInt(amount),
        PartyA: phoneFormatted,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phoneFormatted,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "Tech with Brands",
        TransactionDesc: "Plan Subscription Payment",
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Save transaction
    const transaction = await MpesaTransaction.create({
      phone,
      amount,
      checkoutRequestID: response.data.CheckoutRequestID,
      requestPayload: req.body,
      mpesaResponse: response.data
    });

    return res.json({
      success: true,
      message: "STK push sent. Complete the payment on your phone.",
      data: response.data,
      transactionId: transaction._id
    });
  } catch (err) {
    console.error("M-Pesa Error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.errorMessage || "M-Pesa payment initiation failed.",
      errorDetails: err.response?.data || err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Callback handler
export const mpesaCallback = async (req, res) => {
  try {
    console.log("Received M-Pesa callback:", JSON.stringify(req.body, null, 2));

    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.error("Invalid callback structure");
      return res.sendStatus(200);
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    
    if (!CheckoutRequestID) {
      console.error("Missing CheckoutRequestID in callback");
      return res.sendStatus(200);
    }

    const transaction = await MpesaTransaction.findOne({ checkoutRequestID: CheckoutRequestID });
    if (!transaction) {
      console.error(`Transaction not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.sendStatus(200);
    }

    // Update transaction status
    transaction.status = ResultCode === 0 ? "Completed" : "Failed";
    transaction.resultCode = ResultCode;
    transaction.resultDescription = ResultDesc;
    transaction.rawCallback = req.body;
    transaction.callbackReceivedAt = new Date();

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      transaction.mpesaReceiptNumber = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
      transaction.transactionDate = items.find((i) => i.Name === "TransactionDate")?.Value;
      transaction.amountPaid = items.find((i) => i.Name === "Amount")?.Value;
      transaction.payerPhoneNumber = items.find((i) => i.Name === "PhoneNumber")?.Value;
    }

    await transaction.save();
    console.log(`Transaction ${CheckoutRequestID} updated with status: ${transaction.status}`);

  } catch (error) {
    console.error("M-Pesa Callback Processing Error:", error.message, error.stack);
  }

  res.sendStatus(200);
};

// Transaction status check endpoint
export const checkTransactionStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.query;

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: "checkoutRequestId is required"
      });
    }

    const transaction = await MpesaTransaction.findOne({ checkoutRequestID: checkoutRequestId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    // Format response based on transaction status
    const response = {
      success: transaction.status === 'Completed',
      status: transaction.status,
      message: transaction.resultDescription || `Transaction is ${transaction.status}`,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        phone: transaction.phone,
        checkoutRequestID: transaction.checkoutRequestID,
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
        transactionDate: transaction.transactionDate,
        resultCode: transaction.resultCode,
        resultDescription: transaction.resultDescription
      },
      rawData: {
        callback: transaction.rawCallback,
        mpesaResponse: transaction.mpesaResponse
      }
    };

    // Include additional details for failed transactions
    if (transaction.status === 'Failed') {
      response.reason = transaction.resultDescription;
      if (transaction.resultCode === 1) {
        response.suggestedAction = "Please ensure you have sufficient balance in your M-Pesa account";
      }
    }

    return res.json(response);

  } catch (error) {
    console.error("Transaction status check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking transaction status",
      error: error.message
    });
  }
};