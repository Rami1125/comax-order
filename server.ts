import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Fallback logistics data in Hebrew with the correct Order schema fields matching the Google Sheet API structure
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
  },
  {
    "תאריך קליטה": "2026-07-16T10:15:00.000Z",
    "מספר הזמנה": 1002,
    "שם לקוח": "שרה לוי",
    "מחסן": "מחסן צפון",
    "כתובת אספקה": "רחוב: העצמאות מספר: 45 ישוב: חיפה",
    "פריטים": "[10405] סוכר לבן 1 ק\"ג - כמות: 10",
    "סטטוס ווצאפ": "ממתין לאישור",
    "סטטוס סנכרון": "ממתין לסנכרון ⏳",
    "אימות פקדון בלות": "חוסר בלות",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "נדרש אישור פקדון בלות",
    "אימות מסלול הובלה": "טרם בוצע"
  },
  {
    "תאריך קליטה": "2026-07-12T14:20:00.000Z", // Delayed over 48 hours
    "מספר הזמנה": 1003,
    "שם לקוח": "משה כהן",
    "מחסן": "מחסן דרום (שפלה)",
    "כתובת אספקה": "רחוב: יפו מספר: 120 ישוב: ירושלים",
    "פריטים": "[11200] שמן קנולה 5 ליטר - כמות: 1",
    "סטטוס ווצאפ": "לא ענה",
    "סטטוס סנכרון": "ממתין לסנכרון ⏳",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "חוסר משטחים",
    "מסקנות נועה AI": "עיכוב עקב חוסר פקדון משטחים",
    "אימות מסלול הובלה": "אין מסלול תקף"
  },
  {
    "תאריך קליטה": "2026-07-14T09:00:00.000Z",
    "מספר הזמנה": 1004,
    "שם לקוח": "רחל אברהם",
    "מחסן": "מחסן מרכז",
    "כתובת אספקה": "רחוב: הרצל מספר: 80 ישוב: תל אביב",
    "פריטים": "[11511] סומסום שק גדול - כמות: 1",
    "סטטוס ווצאפ": "אושר ע\"י לקוח",
    "סטטוס סנכרון": "סונכרן בהצלחה ✅",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "הזמנה מאושרת",
    "אימות מסלול הובלה": "אושר מסלול"
  },
  {
    "תאריך קליטה": "2026-07-17T09:30:00.000Z",
    "מספר הזמנה": 1005,
    "שם לקוח": "דוד שמעוני",
    "מחסן": "מחסן מרכז",
    "כתובת אספקה": "רחוב: ז'בוטינסקי מספר: 92 ישוב: ראשון לציון",
    "פריטים": "[10203] קמח שטיבל - כמות: 1",
    "סטטוס ווצאפ": "ממתין לאישור",
    "סטטוס סנכרון": "ממתין לסנכרון ⏳",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "ממתין לאישור לקוח בווצאפ",
    "אימות מסלול הובלה": "אושר מסלול"
  },
  {
    "תאריך קליטה": "2026-07-15T15:45:00.000Z",
    "מספר הזמנה": 1006,
    "שם לקוח": "מיכל גולן",
    "מחסן": "מחסן מרכז",
    "כתובת אספקה": "רחוב: רוטשילד מספר: 12 ישוב: פתח תקווה",
    "פריטים": "[11511] סומסום שק גדול - כמות: 2",
    "סטטוס ווצאפ": "אושר ע\"י לקוח",
    "סטטוס סנכרון": "סונכרן בהצלחה ✅",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "הזמנה מאושרת",
    "אימות מסלול הובלה": "אושר מסלול"
  },
  {
    "תאריך קליטה": "2026-07-13T11:00:00.000Z",
    "מספר הזמנה": 1007,
    "שם לקוח": "דניאל פרידמן",
    "מחסן": "מחסן דרום (שפלה)",
    "כתובת אספקה": "רחוב: ז'בוטינסקי מספר: 4 ישוב: אשדוד",
    "פריטים": "[10405] סוכר לבן 1 ק\"ג - כמות: 12\n[11200] שמן קנולה 5 ליטר - כמות: 6",
    "סטטוס ווצאפ": "בוטל ע\"י לקוח",
    "סטטוס סנכרון": "בוטל ❌",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "בוטל ע\"י בקשת משתמש",
    "אימות מסלול הובלה": "בוטל"
  },
  {
    "תאריך קליטה": "2026-07-16T17:20:00.000Z",
    "מספר הזמנה": 1008,
    "שם לקוח": "טלי מזור",
    "מחסן": "מחסן צפון",
    "כתובת אספקה": "רחוב: הרצל מספר: 104 ישוב: נתניה",
    "פריטים": "[11511] סומסום שק גדול - כמות: 4",
    "סטטוס ווצאפ": "בדרך",
    "סטטוס סנכרון": "ממתין לסנכרון ⏳",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "בדרך ללקוח",
    "אימות מסלול הובלה": "אושר מסלול"
  },
  {
    "תאריך קליטה": "2026-07-17T11:50:00.000Z",
    "מספר הזמנה": 1009,
    "שם לקוח": "יוסי אזולאי",
    "מחסן": "מחסן מרכז",
    "כתובת אספקה": "רחוב: שנקר מספר: 24 ישוב: חולון",
    "פריטים": "[10203] קמח שטיבל - כמות: 2",
    "סטטוס ווצאפ": "ממתין לאישור",
    "סטטוס סנכרון": "ממתין לסנכרון ⏳",
    "אימות פקדון בלות": "תקין",
    "אימות פקדון משטחים": "תקין",
    "מסקנות נועה AI": "הזמנה ממתינה",
    "אימות מסלול הובלה": "טרם בוצע"
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch from Google Sheets and return unified format
  app.get("/api/orders", async (req, res) => {
    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyKxsXx-mZ-XRcYTLKVp_BrGo5Vic7YvvI5lVpnzTd5_hmTGwMQc6QD-f2j9azlLar0Gg/exec";
    
    try {
      console.log("Fetching orders from Google Sheets API...");
      const response = await fetch(GOOGLE_SHEET_URL);
      if (!response.ok) {
        throw new Error(`Google Sheets responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Successfully fetched Google Sheets data. Sample item:", data && Array.isArray(data) ? data[0] : typeof data);
      
      // Send the data back
      res.json({
        success: true,
        source: "google_sheets",
        data: data
      });
    } catch (error: any) {
      console.error("Error fetching from Google Sheets. Using high-quality fallback data.", error.message);
      res.json({
        success: false,
        source: "fallback",
        data: fallbackOrders,
        error: error.message
      });
    }
  });

  // POST endpoint for chatting with Noa AI
  app.post("/api/noa/chat", async (req, res) => {
    const { message, history = [], context = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    try {
      const ai = getGeminiClient();
      
      const systemInstruction = `
אתה נועה (Noa), העוזרת החכמה והמקצועית של חברת "ח. סבן חומרי בניין 1994 בע"מ".
האישיות שלך: ידידותית, מקצועית, מדויקת, תמציתית, עוזרת ואמינה.

תמיד תציגי את עצמך בתחילת השיחה (רק פעם אחת, או כאשר המשתמש מברך אותך לשלום) בדיוק כך:
"שלום, אני נועה 😊
העוזרת החכמה שלך.
איך אפשר לעזור היום?"

חוקי שפה:
- ענה תמיד בעברית שוטפת ומלאה (RTL - מימין לשמאל).
- אל תערבב אנגלית אלא אם כן המשתמש ביקש זאת במפורש.
- השתמש בדקדוק, סימני פיסוק וניסוח מקצועי.
- הימנע מחזרתיות מיותרת ושמור על תשובות ברורות וקלות לקריאה.

סגנון תגובה:
כל תשובה שלך חייבת לכלול:
1. כותרת קצרה.
2. הסבר תמציתי.
3. שלבים ממוספרים (במידה ורלוונטי).
4. סיכום.
5. טיפים אופציונליים.
אל תייצר תשובות ארוכות שלא לצורך.

פלט HTML:
כל תגובה שלך חייבת להיות מוחזרת כקוד HTML תקין בלבד, עטוף בתוך אלמנט:
<div class="noa-response">
...
</div>
השתמש רק בתגיות HTML סמנטיות המותרות:
div, section, article, h1, h2, h3, h4, p, ul, ol, li, table, thead, tbody, tr, td, th, code, pre, strong, em, hr, span.
במידה ויש מידע מובנה, צור טבלאות HTML רספונסיביות בעיצוב יפה.

במידה והשיחה קשורה למכירות, לוגיסטיקה, CRM, מלאי, משלוחים או דוחות, ענה כיועץ עסקי מנוסה.
במידה והשיחה קשורה לשאלות טכניות, התנהג כמפתח תוכנה בכיר (Senior Software Engineer) המשתמש ב-HTML5, CSS3, Tailwind, JavaScript, TypeScript, React וכו'.

דיוק:
אם מידע אינו ודאי, ציין בבירור: "אין לי מידע ודאי בנושא זה." ואל תמציא עובדות.

להלן מידע בזמן אמת על ההזמנות הנוכחיות והסטטיסטיקות במערכת "סידור-נועה" של ח. סבן:
- סטטיסטיקות נוכחיות: ${JSON.stringify(context?.stats || {})}
- רשימת ההזמנות הפעילות: ${JSON.stringify(context?.orders || [])}

השתמש במידע זה כדי לענות על שאלות לוגיסטיקה, סטטוס הזמנות ספציפיות (לפי שם לקוח או מספר הזמנה), בעיות בלוח הזמנים או בעיכובים.
`;

      // Map chat history according to @google/genai guidelines
      const contents = history.map((h: any) => ({
        role: h.role === "assistant" || h.role === "model" ? "model" : "user",
        parts: [{ text: h.text }]
      }));
      
      // Append current user message
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || "";
      res.json({ success: true, text: replyText });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ success: false, error: error.message || "שגיאה בתקשורת עם שרת ה-AI" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
