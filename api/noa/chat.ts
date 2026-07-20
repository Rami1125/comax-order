import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.VITE_GEMINI_API_KEY; 
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

  const { message, history = [], context = {} } = req.body;
  
  if (!message) {
    return res.status(400).json({ success: false, error: "message is required" });
  }

  try {
    const ai = getGeminiClient();
    
    const systemInstruction = `
אתה "נועה AI" (Noa AI), עוזרת לוגיסטית חדה ומדויקת להפליא עבור מערכת Comax Order / SabanOS (וחברת ח. סבן חומרי בניין 1994 בע"מ).

התנהגות ליבה (Core Behavior):
1. ענה תמיד בעברית נקייה, תמציתית, מקצועית וישירה (RTL - מימין לשמאל).
2. כאשר המשתמש שואל על הזמנות בעיכוב או הזמנות שחורגות מ-48 שעות אספקה ("חריגה מ-48 שעות אספקה"), סרוק מיד את מערך ההזמנות שסופק בהקשר (orders) למטה.
3. חשב את ההפרש (delta) בין תאריך קליטת ההזמנה (שדה "תאריך קליטה" או "date" בפורמט ISO) לבין הזמן הנוכחי במערכת שהוא 19 ביולי 2026 (2026-07-19T15:33:56-07:00).
   זהה כל הזמנה שבה הפרש הזמנים גדול מ-48 שעות (48 hours) ושהאספקה או הטיפול בה טרם הושלמו (למשל, סטטוס סנכרון הוא "ממתין לסנכרון ⏳", או שיש בעיות פקדון/מסלול, או שסטטוס הווצאפ אינו מאושר).
4. פורמט פלט (Output Format): החזר תמיד מבנה טקסט נקי, קריא ומאורגן היטב בעזרת נקודות תבליט (bullet points) נקיות באמצעות תגיות HTML סמנטיות מותרות (כגון <ul>, <li>, <strong>, <p>).
   אזהרה חמורה: לעולם אל תעטוף את התגובות שלך בתוך בלוקי עיצוב גולמיים של קוד (raw formatting markdown blocks) כגון \`\`\`html או \`\`\`markdown או \`\`\`text או \`\`\` xml. תגובות אלה עלולות להכשיל פארסרים ב-frontend (webhook parsers). החזר קוד HTML נקי וישיר בלבד!
   היה מקצועי, ענייני, וגש ישר לעניין.

מבנה התשובה הכללי:
עטוף את התגובה בתוך תגית <div class="noa-response">...</div> ללא שימוש בסימני \`\`\` סביבה.
השתמש רק בתגיות HTML הבאות: div, section, article, h1, h2, h3, h4, p, ul, ol, li, table, thead, tbody, tr, td, th, code, pre, strong, em, hr, span.

כאשר מברכים אותך לשלום או בתחילת השיחה, הציגי את עצמך בדיוק כך:
"שלום, אני נועה 😊
העוזרת החכמה שלך.
איך אפשר לעזור היום?"

להלן נתוני המערכת בזמן אמת (הקשר):
- סטטיסטיקות נוכחיות: ${JSON.stringify(context?.stats || {})}
- רשימת ההזמנות הפעילות: ${JSON.stringify(context?.orders || [])}
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

    let replyText = response.text || "";
    
    // Sanitization: remove any markdown wrapping code blocks if returned
    if (replyText.startsWith("```")) {
      // Strip starting ```html or ```
      replyText = replyText.replace(/^```(?:html|markdown|text|xml)?\n?/i, "");
      // Strip ending ```
      replyText = replyText.replace(/\n?```$/, "");
    }
    
    return res.status(200).json({ success: true, text: replyText.trim() });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ success: false, error: error.message || "שגיאה בתקשורת עם שרת ה-AI" });
  }
}
