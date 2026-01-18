// controllers/stripeController.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "usd", metadata } = req.body;

    // Validate required amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.json({
        success: false,
        message: "Invalid amount provided. Must be a positive number.",
      });
    }

    // Stripe expects the amount in the smallest currency unit (e.g., cents)
    const amountInCents = Math.round(amount);

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, 
      currency,
      metadata,
    });

    return res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe Payment Intent Error:", error.message);
    return res.json({
      success: false,
      message: error.message || "Failed to create payment intent",
    });
  }
};
