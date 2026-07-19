import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// טיפול ב-CORS גלובלי למניעת שגיאות דפדפן בקונסול
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in Vercel environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// מאגר הזמנות לוגיסטי כגיבוי (Fallback) למערכת SabanOS
const fallbackOrders = [
  {
    "תאריך קליטה": "2026-07-15T08:30:00.000Z",
    "מספר הזמנה": 1001,
    "שם לקוח": "ישראל ישראלי",
    "מחסן": "מחסן מרכז",
    "כתובת אספקה": "רחוב: שושנה דמרי מספר: 18 ישוב: ראש העין",
    "פריטים": "[11511] סומסום שק גדול - כמות: 4\n[10203] קמח שטיבל - כמות: 2",
    "סטטוס ווצאפ": "אושר ע\"י לקוח",
    "סטטוס סנכרון": "סונכרן בהצלחה ✅",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "הזמנה מאושרת ללא חריגות",
    "אימות מסלול הובלה": "אושר מסלול"
  }
];

// Endpoint לקבלת הזמנות
app.get("/api/orders", async (req, res) => {
  const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyKxsXx-mZ-XRcYTLKVp_BrGo5Vic7YvvI5lVpnzTd5_hmTGwMQc6QD-f2j9azlLar0Gg/exec";
  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    res.json({ success: true, source: "google_sheets", data });
  } catch (error: any) {
    res.json({ success: false, source: "fallback", data: fallbackOrders, error: error.message });
  }
});

// Endpoint לצ'אט עם נועה AI
app.post("/api/noa/chat", async (req, res) => {
  const { message, history = [], context = {} } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: "message is required" });
  }

  try {
    const ai = getGeminiClient();
    
    const systemInstruction = `
אתה "נועה AI" (Noa AI), עוזרת לוגיסטית חדה ומדויקת להפליא עבור מערכת Comax Order / SabanOS (וחברת ח. סבן חומרי בניין 1994 בע"מ).
ענה תמיד בעברית נקייה, תמציתית, מקצועית וישירה בגובה העיניים.
המערכת מנטרת כעת ${context?.stats?.totalOrders || '521'} הזמנות פעילות בזמן אמת.
החזר תמיד קוד HTML נקי וישיר בלבד העטוף בתוך תגית <div class="noa-response">...</div> ללא שימוש בסימני שלושה גרשים (\`\`\`) סביבו.
`;

    // התאמת היסטוריית השיחה למבנה ה-SDK הרשמי
    const contents = history.map((h: any) => ({
      role: h.role === "assistant" || h.role === "model" ? "model" : "user",
      parts: [{ text: h.text || h.parts?.[0]?.text || "" }]
    }));
    
    contents.push({ role: "user", parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
      }
    });

    res.json({ success: true, text: response.text || "" });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ success: false, error: error.message || "שגיאה זמנית בתקשורת עם שרת נועה AI" });
  }
});

// יצוא האפליקציה עבור סביבת ה-Serverless של Vercel
export default app;
