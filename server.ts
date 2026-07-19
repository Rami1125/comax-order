import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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
