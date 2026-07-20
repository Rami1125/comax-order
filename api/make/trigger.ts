import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST,PUT,DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { orderId, newStatus, customerName, city, itemsCount, date } = req.body;
  const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

  try {
    const payload = {
      event: "order_status_updated",
      timestamp: new Date().toISOString(),
      orderId,
      newStatus,
      customerName,
      city,
      itemsCount,
      date,
      system: "Comax / SabanOS"
    };

    if (MAKE_WEBHOOK_URL) {
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Make.com webhook responded with status ${response.status}`);
      }

      return res.status(200).json({
        success: true,
        source: "live_make_webhook",
        message: "האירוע נשלח בהצלחה ל-Make.com 🚀",
        payload
      });
    } else {
      // Friendly simulation in development/fallback mode so the app is fully functional without a key
      return res.status(200).json({
        success: true,
        source: "mock_make_webhook",
        message: "סנכרון סימולטיבי ל-Make.com תקין (הגדר MAKE_WEBHOOK_URL בהגדרות לפעילות מלאה).",
        payload
      });
    }
  } catch (error: any) {
    console.error("Make webhook error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "שגיאה בשיגור האירוע ל-Make.com"
    });
  }
}
