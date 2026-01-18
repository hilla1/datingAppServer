// routes/exchangeRoute.js
import express from "express";
import axios from "axios";

const exchangeRouter = express.Router();

exchangeRouter.get("/usd-to-kes", async (req, res) => {
  try {
    // Step 1: Try open.er-api.com
    const { data } = await axios.get("https://open.er-api.com/v6/latest/USD");

    const rate = data?.rates?.KES;
    if (rate && !isNaN(rate)) {
      return res.json({ success: true, rate });
    }

    throw new Error("Exchange rate not found in open.er-api.com response");
  } catch (err) {
    console.warn("⚠️ open.er-api.com failed:", err.message);
  }

  // If open.er-api.com fails, fall back to other sources
  const fallbackSources = [
    {
      name: "exchangerate.host",
      url: "https://api.exchangerate.host/latest",
      params: { base: "USD", symbols: "KES" },
      extractRate: (data) => data?.rates?.KES,
    },
    {
      name: "frankfurter.app",
      url: "https://api.frankfurter.app/latest",
      params: { from: "USD", to: "KES" },
      extractRate: (data) => data?.rates?.KES,
    },
  ];

  for (const source of fallbackSources) {
    try {
      const response = await axios.get(source.url, { params: source.params });
      const rate = source.extractRate(response.data);
      if (rate && !isNaN(rate)) {
        console.log(`✅ Fallback ${source.name}: 1 USD = ${rate} KES`);
        return res.json({ success: true, rate });
      }
    } catch (error) {
      console.warn(`⚠️ Fallback ${source.name} failed:`, error.message);
    }
  }

  // All sources failed
  return res.status(500).json({
    success: false,
    message: "❌ Failed to fetch exchange rate from all sources",
  });
});

export default exchangeRouter;
