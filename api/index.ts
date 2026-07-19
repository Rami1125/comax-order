import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // הגדרת כותרות CORS גלובליות למניעת שגיאות דפדפן
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  try {
    // נתיב 1: קבלת הזמנות משרתי המערכת
    if (url.includes('/api/orders')) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      
      const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyKxsXx-mZ-XRcYTLKVp_BrGo5Vic7YvvI5lVpnzTd5_hmTGwMQc6QD-f2j9azlLar0Gg/exec";
      try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const data = await response.json();
        return res.status(200).json({ success: true, source: "google_sheets", data });
      } catch (err: any) {
        return res.status(200).json({
          success: false,
          source: "fallback",
          data: [
            {
              "תאריך קליטה": new Date().toISOString(),
              "מספר הזמנה": 1001,
              "שם לקוח": "גיבוי אוטומטי - סבן אוס",
              "מחסן": "מחסן מרכז",
              "כתובת אספקה": "סנכרון מקומי חלופי",
              "פריטים": "נטען מהקאש",
              "סטטוס סנכרון": "סונכרן מקומית ⚠️"
            }
          ],
          error: err.message
        });
      }
    }

    // נתיב 2: צ'אט לוגיסטי עם נועה AI
    if (url.includes('/api/noa/chat')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      
      if (!apiKey) {
        return res.status(500).json({ success: false, error: "מפתח GEMINI_API_KEY חסר בהגדרות השרת של Vercel" });
      }

      const { message, history = [], context = {} } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: "הודעת טקסט היא שדה חובה" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `
אתה "נועה AI" (Noa AI), עוזרת לוגיסטית חדה ומדויקת להפליא עבור מערכת Comax Order / SabanOS (וחברת ח. סבן חומרי בניין 1994 בע"מ).
ענה תמיד בעברית נקייה, תמציתית, מקצועית וישירה בגובה העיניים.
המערכת מנטרת כעת ${context?.stats?.totalOrders || '544'} הזמנות פעילות בזמן אמת.
החזר תמיד קוד HTML נקי וישיר בלבד העטוף בתוך תגית <div class="noa-response">...</div> ללא שימוש בסימני שלושה גרשים (\`\`\`) סביבו.
`;

      const contents = history.map((h: any) => ({
        role: h.role === "assistant" || h.role === "model" ? "model" : "user",
        parts: [{ text: h.text || h.parts?.[0]?.text || "" }]
      }));
      
      contents.push({ role: "user", parts: [{ text: message }] });

      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.4,
        }
      });

      return res.status(200).json({ success: true, text: aiResponse.text || "" });
    }

    return res.status(404).json({ error: "הנתיב המבוקש לא נמצא" });

  } catch (globalError: any) {
    console.error("Global API Error:", globalError);
    return res.status(500).json({ 
      success: false, 
      error: "תקלה פנימית בשרת הלוגיסטי", 
      details: globalError.message 
    });
  }
}
