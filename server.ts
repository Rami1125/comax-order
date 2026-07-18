import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Fallback logistics data in Hebrew in case the API is offline or rate-limited
const fallbackOrders = [
  { id: "1001", customerName: "ישראל ישראלי", city: "תל אביב", date: "2026-07-15", amount: 1500, status: "נמסר", itemsCount: 3, phone: "050-1234567" },
  { id: "1002", customerName: "שרה לוי", city: "חיפה", date: "2026-07-16", amount: 2400, status: "בטיפול", itemsCount: 5, phone: "052-7654321" },
  { id: "1003", customerName: "משה כהן", city: "ירושלים", date: "2026-07-16", amount: 750, status: "בדרך", itemsCount: 1, phone: "054-9876543" },
  { id: "1004", customerName: "רחל אברהם", city: "באר שבע", date: "2026-07-14", amount: 3200, status: "נמסר", itemsCount: 8, phone: "053-1112223" },
  { id: "1005", customerName: "דוד שמעוני", city: "ראשון לציון", date: "2026-07-17", amount: 120, status: "ממתין", itemsCount: 1, phone: "058-4445556" },
  { id: "1006", customerName: "מיכל גולן", city: "פתח תקווה", date: "2026-07-15", amount: 980, status: "נמסר", itemsCount: 2, phone: "055-6667778" },
  { id: "1007", customerName: "דניאל פרידמן", city: "אשדוד", date: "2026-07-13", amount: 4300, status: "בוטל", itemsCount: 12, phone: "050-9998887" },
  { id: "1008", customerName: "טלי מזור", city: "נתניה", date: "2026-07-16", amount: 1850, status: "בדרך", itemsCount: 4, phone: "052-3334445" },
  { id: "1009", customerName: "יוסי אזולאי", city: "חולון", date: "2026-07-17", amount: 620, status: "ממתין", itemsCount: 2, phone: "054-2228889" },
  { id: "1010", customerName: "רוני ברק", city: "תל אביב", date: "2026-07-15", amount: 1400, status: "נמסר", itemsCount: 3, phone: "050-8887776" },
  { id: "1011", customerName: "אלון חדד", city: "ירושלים", date: "2026-07-15", amount: 2100, status: "נמסר", itemsCount: 4, phone: "053-7773332" },
  { id: "1012", customerName: "שירה רוזן", city: "חיפה", date: "2026-07-16", amount: 340, status: "בטיפול", itemsCount: 1, phone: "054-4449991" }
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
