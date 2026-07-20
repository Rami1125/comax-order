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

  const { title, message, url, data } = req.body;
  const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: "Title and message are required" });
  }

  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title, he: title },
      contents: { en: message, he: message },
      url: url || "",
      data: data || {},
      included_segments: ["Subscribed Users"]
    };

    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.errors ? result.errors.join(", ") : `OneSignal returned status ${response.status}`);
      }

      return res.status(200).json({
        success: true,
        source: "live_onesignal",
        message: "התראת Push נשלחה בהצלחה באמצעות OneSignal! 🔔",
        result
      });
    } else {
      // Friendly simulation mode so the application looks gorgeous and shows the mechanism clearly
      return res.status(200).json({
        success: true,
        source: "mock_onesignal",
        message: "התראת מנהל סימולטיבית שוגרה בהצלחה באפליקציה (הגדר ONESIGNAL_APP_ID ו-REST_API_KEY לפעילות שרת חיה) 📢",
        payload
      });
    }
  } catch (error: any) {
    console.error("OneSignal push notification trigger error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "שגיאה בשיגור ההתראה ל-OneSignal"
    });
  }
}
