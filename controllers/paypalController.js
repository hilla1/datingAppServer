import axios from "axios";

const BASE_URL = "https://api-m.sandbox.paypal.com"; // Use "https://api-m.paypal.com" in production

// Get OAuth token from PayPal
const generateAccessToken = async () => {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
};

// Create PayPal Order
export const createOrder = async (req, res) => {
  try {
    const { amount, currency = "USD" } = req.body;
    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ orderID: response.data.id });
  } catch (error) {
    console.error("PayPal Create Order Error:", error.message);
    res.json({ error: "Failed to create PayPal order" });
  }
};

// Capture PayPal Order
export const captureOrder = async (req, res) => {
  try {
    const { orderID } = req.body;
    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("PayPal Capture Error:", error.message);
    res.json({ error: "Failed to capture PayPal order" });
  }
};
