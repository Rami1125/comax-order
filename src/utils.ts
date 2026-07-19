import { Order, ParsedItem, DashboardStats } from "./types";

/**
 * Extracts the city name from a Hebrew address string
 */
export function getCity(address: string): string {
  if (!address) return "לא ידוע";
  
  // Format: "רחוב: שושנה דמרי מספר: 18 ישוב: ראש העין"
  if (address.includes("ישוב:")) {
    const match = address.match(/ישוב:\s*([^,\s]+(?:\s+[^,\s]+)*)/);
    if (match) return match[1].trim();
  }
  
  const parts = address.split(",");
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    // Clean up postal codes or extra numbers if any
    return lastPart.replace(/\d+/g, "").trim();
  }
  
  return address.trim();
}

/**
 * Parses a structured items list string into an array of products and quantities
 */
export function parseItems(itemsStr: string): ParsedItem[] {
  if (!itemsStr) return [];
  
  // Split lines
  const lines = itemsStr.split("\n");
  
  return lines
    .map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return null;
      
      // Match pattern like "[11511] סומסום שק גדול - כמות: 4"
      const codeMatch = trimmedLine.match(/^\[(.*?)\]/);
      const qtyMatch = trimmedLine.match(/כמות:\s*(\d+)/);
      
      const code = codeMatch ? codeMatch[1].trim() : "";
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      
      let name = trimmedLine;
      if (codeMatch) {
        name = name.replace(codeMatch[0], "");
      }
      if (qtyMatch) {
        name = name.replace(/-\s*כמות:\s*\d+/, "").replace(/כמות:\s*\d+/, "");
      }
      name = name.trim().replace(/^-\s*/, "").replace(/^-/, "").trim();
      
      return { code, name, quantity };
    })
    .filter((item): item is ParsedItem => item !== null && (item.name.length > 0 || item.code.length > 0));
}

/**
 * Formats ISO date string into readable Hebrew date format
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}

/**
 * Calculates dashboard-wide statistics from a list of orders
 */
export function calculateStats(orders: Order[]): DashboardStats {
  const totalOrders = orders.length;
  
  let syncedOrders = 0;
  let delayedOrders = 0;
  const citiesCount: Record<string, number> = {};
  const warehouses = new Set<string>();
  const whatsappModelStats: Record<string, number> = {};
  
  orders.forEach(order => {
    // Sync check
    const syncStatus = String(order["סטטוס סנכרון"] || "");
    if (syncStatus.includes("סונכרן") || syncStatus.includes("✅")) {
      syncedOrders++;
    }

    // Delayed check
    if (isOrderDelayed(order)) {
      delayedOrders++;
    }
    
    // City calculation
    const city = getCity(String(order["כתובת אספקה"] || ""));
    if (city && city !== "לא ידוע") {
      citiesCount[city] = (citiesCount[city] || 0) + 1;
    }
    
    // Warehouse check
    if (order["מחסן"]) {
      warehouses.add(String(order["מחסן"]).trim());
    }
    
    // WhatsApp Model stats
    const waModel = String(order["סטטוס ווצאפ"] || "לא ידוע");
    whatsappModelStats[waModel] = (whatsappModelStats[waModel] || 0) + 1;
  });
  
  const pendingOrders = totalOrders - syncedOrders;
  
  // Find top city
  let topCity = "אין נתונים";
  let topCityCount = 0;
  
  Object.entries(citiesCount).forEach(([city, count]) => {
    if (count > topCityCount) {
      topCity = city;
      topCityCount = count;
    }
  });
  
  return {
    totalOrders,
    syncedOrders,
    pendingOrders,
    delayedOrders,
    topCity,
    topCityCount,
    activeWarehouses: warehouses.size,
    whatsappModelStats
  };
}

/**
 * Checks if an order is extremely delayed (not synced and over 48 hours old)
 */
export function isOrderDelayed(order: Order): boolean {
  if (!order["תאריך קליטה"]) return false;
  
  const syncStatus = order["סטטוס סנכרון"];
  const isSynced = !!(syncStatus && typeof syncStatus === "string" && (syncStatus.includes("סונכרן") || syncStatus.includes("✅")));
  if (isSynced) return false;
  
  try {
    const orderDate = new Date(order["תאריך קליטה"]);
    if (isNaN(orderDate.getTime())) return false;
    
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours > 48;
  } catch (e) {
    return false;
  }
}

/**
 * Gets the number of hours an order has been delayed
 */
export function getDelayHours(order: Order): number {
  if (!order["תאריך קליטה"]) return 0;
  try {
    const orderDate = new Date(order["תאריך קליטה"]);
    if (isNaN(orderDate.getTime())) return 0;
    
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  } catch (e) {
    return 0;
  }
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export const CITY_COORDINATES: Record<string, [number, number]> = {
  "תל אביב": [32.0853, 34.7818],
  "תל אביב יפו": [32.0853, 34.7818],
  "תל אביב-יפו": [32.0853, 34.7818],
  "תל-אביב": [32.0853, 34.7818],
  "חיפה": [32.7940, 34.9896],
  "ירושלים": [31.7683, 35.2137],
  "באר שבע": [31.2529, 34.7915],
  "באר-שבע": [31.2529, 34.7915],
  "ראשון לציון": [31.9730, 34.7925],
  "ראשון-לציון": [31.9730, 34.7925],
  "פתח תקווה": [32.0840, 34.8878],
  "פתח-תקווה": [32.0840, 34.8878],
  "אשדוד": [31.8044, 34.6553],
  "נתניה": [32.3215, 34.8532],
  "חולון": [32.0158, 34.7874],
  "ראש העין": [32.0965, 34.9567],
  "ראש-העין": [32.0965, 34.9567],
  "רחובות": [31.8928, 34.8113],
  "הרצליה": [32.1624, 34.8447],
  "כפר סבא": [32.1714, 34.9083],
  "כפר-סבא": [32.1714, 34.9083],
  "אשקלון": [31.6688, 34.5743],
  "רמת גן": [32.0713, 34.8080],
  "רמת-גן": [32.0713, 34.8080],
  "בני ברק": [32.0833, 34.8333],
  "בני-ברק": [32.0833, 34.8333],
  "בת ים": [32.0167, 34.7500],
  "בת-ים": [32.0167, 34.7500],
  "חדרה": [32.4340, 34.9197],
  "רעננה": [32.1848, 34.8707],
  "בית שמש": [31.7470, 34.9881],
  "בית-שמש": [31.7470, 34.9881],
  "מודיעין": [31.8903, 35.0104],
  "מודיעין מכבים רעות": [31.8903, 35.0104],
  "מודיעין-מכבים-רעות": [31.8903, 35.0104],
  "קרית גת": [31.6077, 34.7647],
  "קרית-גת": [31.6077, 34.7647],
  "לוד": [31.9515, 34.8961],
  "רמלה": [31.9272, 34.8646],
  "עכו": [32.9278, 35.0817],
  "טבריה": [32.7922, 35.5312],
  "נצרת": [32.6996, 35.3035],
  "כרמיאל": [32.9136, 35.2954],
  "נהריה": [33.0031, 35.0978],
  "עפולה": [32.6139, 35.2903],
  "קרית שמונה": [33.2078, 35.5701],
  "קרית-שמונה": [33.2078, 35.5701],
  "אילת": [29.5577, 34.9519],
  "קיסריה": [32.5186, 34.9046],
  "אום אל-פחם": [32.5255, 35.1517],
  "אום אל פחם": [32.5255, 35.1517],
  "רמת השרון": [32.1492, 34.8392],
  "נס ציונה": [31.9275, 34.7981],
  "נס-ציונה": [31.9275, 34.7981],
  "גדרה": [31.8119, 34.7772],
  "גבעתיים": [32.0722, 34.8101],
  "טירת כרמל": [32.7633, 34.9692],
  "הוד השרון": [32.1558, 34.8883],
  "יהוד": [32.0322, 34.8953],
  "יהוד-מונוסון": [32.0322, 34.8953],
  "יהוד מונוסון": [32.0322, 34.8953],
  "שדרות": [31.5230, 34.5960],
  "אופקים": [31.3142, 34.6144],
  "נתיבות": [31.4239, 34.5881],
  "קרית מלאכי": [31.7328, 34.7578],
  "קרית אונו": [32.0628, 34.8569],
  "קרית ביאליק": [32.8406, 35.0931],
  "קרית מוצקין": [32.8408, 35.0744],
  "קרית ים": [32.8622, 35.0750],
  "קרית אתא": [32.8025, 35.0833],
  "נשר": [32.7667, 35.0408],
  "אור עקיבא": [32.5028, 34.9167],
  "מגדל העמק": [32.6736, 35.2411],
  "יקנעם": [32.6644, 35.1092],
  "יקנעם עילית": [32.6644, 35.1092],
  "מעלות תרשיחא": [33.0136, 35.2711],
  "צפת": [32.9775, 35.4947],
  "סחנין": [32.8594, 35.2911],
  "ערד": [31.2589, 35.2150],
  "דימונה": [31.0664, 34.9917]
};

/**
 * Resolves coordinates for an order based on embedded coordinates or city lookup
 */
export function getOrderCoordinates(order: Order): Coordinates | null {
  const address = order["כתובת אספקה"] || "";
  
  // Look for coordinates pattern inside the address: eg. "32.0853, 34.7818" or "32.0853,34.7818"
  const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const match = address.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // Otherwise, extract the city and lookup its coordinates in our database
  const city = getCity(address);
  if (city) {
    const coords = CITY_COORDINATES[city.trim()];
    if (coords) {
      return { lat: coords[0], lng: coords[1] };
    }
  }

  return null;
}


