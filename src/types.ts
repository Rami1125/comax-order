export interface Order {
  "תאריך קליטה": string;
  "מספר הזמנה": number;
  "שם לקוח": string;
  "מחסן": string;
  "כתובת אספקה": string;
  "פריטים": string;
  "Column 4"?: string;
  "סטטוס ווצאפ": string;
  "אימות פקדון בלות"?: string;
  "אימות פקדון משטחים"?: string;
  "מסקנות נועה AI"?: string;
  "אימות מסלול הובלה"?: string;
  "סטטוס סנכרון": string;
}

export interface ParsedItem {
  code: string;
  name: string;
  quantity: number;
}

export interface DashboardStats {
  totalOrders: number;
  syncedOrders: number;
  pendingOrders: number;
  topCity: string;
  topCityCount: number;
  activeWarehouses: number;
  whatsappModelStats: Record<string, number>;
}
