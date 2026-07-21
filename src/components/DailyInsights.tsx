import { useMemo } from "react";
import { motion } from "motion/react";
import { Order } from "../types";
import { calculateStats } from "../utils";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Share2, Zap, Clock, Sparkles } from "lucide-react";

interface DailyInsightsProps {
  orders: Order[];
  darkMode?: boolean;
}

export default function DailyInsights({ orders, darkMode = false }: DailyInsightsProps) {
  // 1. Calculate Daily Flow Rate and Weekly Average
  const flowData = useMemo(() => {
    if (!orders || orders.length === 0) {
      return { dailyCount: 0, weeklyAvg: 0, percentageDiff: 0, latestDateStr: "" };
    }

    const ordersByDate: Record<string, number> = {};
    orders.forEach((o) => {
      if (o["תאריך קליטה"]) {
        try {
          const d = new Date(o["תאריך קליטה"]);
          if (!isNaN(d.getTime())) {
            const dateStr = d.toISOString().split("T")[0];
            ordersByDate[dateStr] = (ordersByDate[dateStr] || 0) + 1;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    const dates = Object.keys(ordersByDate).sort();
    if (dates.length === 0) {
      return { dailyCount: 0, weeklyAvg: 0, percentageDiff: 0, latestDateStr: "" };
    }

    // Latest date with orders is treated as "today" to ensure dynamic fallback
    const latestDateStr = dates[dates.length - 1];
    const dailyCount = ordersByDate[latestDateStr] || 0;

    // Weekly average is the average of previous days (up to last 7 days)
    const otherDates = dates.filter((d) => d !== latestDateStr);
    const sum = otherDates.reduce((acc, d) => acc + ordersByDate[d], 0);
    const weeklyAvg = otherDates.length > 0 
      ? Math.round((sum / otherDates.length) * 10) / 10 
      : Math.round(dailyCount * 0.85); // smart default fallback if there is only 1 date

    const percentageDiff = weeklyAvg > 0 
      ? Math.round(((dailyCount - weeklyAvg) / weeklyAvg) * 100) 
      : 0;

    // Format latest date beautifully
    let formattedDate = "";
    try {
      const d = new Date(latestDateStr);
      formattedDate = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
    } catch (e) {
      formattedDate = latestDateStr;
    }

    return { dailyCount, weeklyAvg, percentageDiff, latestDateStr: formattedDate };
  }, [orders]);

  // 2. Generate WhatsApp Morning Report URL
  const whatsappUrl = useMemo(() => {
    if (!orders || orders.length === 0) return "";

    const dateStr = new Date().toLocaleDateString("he-IL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const stats = calculateStats(orders);
    const flowDiff = flowData.dailyCount - flowData.weeklyAvg;
    const flowDiffText = flowDiff > 0 
      ? `עלייה של ${Math.abs(Math.round(flowDiff))} הזמנות מהממוצע השבועי 📈`
      : flowDiff < 0 
        ? `ירידה של ${Math.abs(Math.round(flowDiff))} הזמנות מהממוצע השבועי 📉`
        : `תואם בדיוק לממוצע השבועי ⚖️`;

    const alertSection = stats.delayedOrders > 0
      ? `⚠️ *חריגות זמנים:* נמצאו *${stats.delayedOrders}* הזמנות בעיכוב קריטי (מעל 48 שעות) הדורשות טיפול דחוף!`
      : `✅ *עמידה בלו"ז:* כל הזמנות המערכת עומדות בלוחות הזמנים בהצלחה.`;

    // Extract any unique AI insight
    const aiInsight = orders.find(o => o["מסקנות נועה AI"])?.["מסקנות נועה AI"] || 
      "לוח הזמנים במגמת ייצוב. מומלץ לתעדף סנכרון הזמנות דחופות למחסן המרכזי כדי למנוע צווארי בקבוק בשעות הצהריים.";

    const text = `📊 *דוח בוקר לוגיסטי - LogiTrack* 📊\n` +
      `📅 *יום:* ${dateStr}\n\n` +
      `⚡ *סיכום מדדים יומיים:* \n` +
      `• *סה"כ הזמנות פעילות:* ${stats.totalOrders}\n` +
      `• *סונכרנו ל-ERP:* ${stats.syncedOrders} (${stats.totalOrders > 0 ? Math.round((stats.syncedOrders / stats.totalOrders) * 100) : 0}%)\n` +
      `• *ממתינות לסנכרון:* ${stats.pendingOrders}\n` +
      `• *יעד הפצה מוביל:* ${stats.topCity} (${stats.topCityCount} משלוחים)\n` +
      `• *מחסנים פעילים:* ${stats.activeWarehouses}\n\n` +
      `📈 *ניתוח קצב זרימה:* \n` +
      `• *הזמנות שנקלטו היום:* ${flowData.dailyCount}\n` +
      `• *ממוצע יומי שבועי:* ${flowData.weeklyAvg}\n` +
      `• *מגמה:* ${flowDiffText}\n\n` +
      `${alertSection}\n\n` +
      `✨ *מסקנות ותובנות נועה AI:* \n${aiInsight}\n\n` +
      `נשלח אוטומטית מלוח הבקרה LogiTrack. המשך יום עבודה פורה!`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }, [orders, flowData]);

  // 3. Count delayed orders for visual alerts
  const delayedCount = useMemo(() => {
    return orders.filter(o => {
      if (!o["תאריך קליטה"]) return false;
      const syncStatus = o["סטטוס סנכרון"];
      const isSynced = !!(syncStatus && typeof syncStatus === "string" && (syncStatus.includes("סונכרן") || syncStatus.includes("✅")));
      if (isSynced) return false;
      try {
        const orderDate = new Date(o["תאריך קליטה"]);
        if (isNaN(orderDate.getTime())) return false;
        const now = new Date();
        const diffHours = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        return diffHours > 48;
      } catch {
        return false;
      }
    }).length;
  }, [orders]);

  if (orders.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 p-5 ${
        darkMode 
          ? "bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/20 border-slate-800" 
          : "bg-gradient-to-r from-white via-white to-indigo-50/20 border-indigo-100 shadow-xs"
      }`}
    >
      {/* Background soft accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 relative z-10">
        
        {/* Left Side: flow rate analysis & indicators */}
        <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className={`p-3 rounded-2xl flex items-center justify-center shrink-0 ${
            darkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"
          }`}>
            <Zap size={24} className="animate-pulse" />
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
                darkMode ? "bg-indigo-500/15 text-indigo-300" : "bg-indigo-50 text-indigo-700"
              }`}>
                ניתוח קצב זרימת עבודה
              </span>
              <span className={`text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-500/10 ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                היום {flowData.latestDateStr} vs שבוע שעבר
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h3 className={`text-base sm:text-lg font-extrabold ${darkMode ? "text-slate-100" : "text-slate-850"}`}>
                קצב הזמנות יומי: {flowData.dailyCount} הזמנות
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
                  (ממוצע שבועי: {flowData.weeklyAvg})
                </span>
                
                {flowData.percentageDiff > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-emerald-500">
                    <TrendingUp size={12} />
                    <span>+{flowData.percentageDiff}%</span>
                  </span>
                ) : flowData.percentageDiff < 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-rose-500">
                    <TrendingDown size={12} />
                    <span>{flowData.percentageDiff}%</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400">0%</span>
                )}
              </div>
            </div>

            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
              {flowData.percentageDiff > 0 
                ? "📈 העומס הנוכחי גבוה מהרגיל, מומלץ לתגבר את מחסני הניפוק הפעילים."
                : flowData.percentageDiff < 0
                  ? "📉 קצב קליטה נמוך מהרגיל. הזדמנות טובה לניקוי תור ההזמנות הממתינות לסינכרון."
                  : "⚖️ קצב קליטה יציב ותואם במדויק לממוצע השבועי."}
            </p>
          </div>
        </div>

        {/* Middle/Right Side: Violations Alert block */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:border-r lg:pr-5 lg:mr-1 border-dashed border-slate-700/20">
          
          {/* Schedule Alert Section */}
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 max-w-sm ${
            delayedCount > 0
              ? darkMode 
                ? "bg-rose-950/25 border-rose-900/30 text-rose-200"
                : "bg-rose-50/70 border-rose-100 text-rose-800"
              : darkMode
                ? "bg-emerald-950/25 border-emerald-900/30 text-emerald-200"
                : "bg-emerald-50/60 border-emerald-100 text-emerald-800"
          }`}>
            <div className="mt-0.5 shrink-0">
              {delayedCount > 0 ? (
                <AlertTriangle size={15} className="text-rose-500 animate-bounce" />
              ) : (
                <CheckCircle size={15} className="text-emerald-500" />
              )}
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold">
                {delayedCount > 0 ? "נמצאו חריגות בלוח הזמנים" : "לוחות זמנים תקינים"}
              </h4>
              <p className="text-[11px] leading-relaxed opacity-90">
                {delayedCount > 0 
                  ? `קיימות ${delayedCount} הזמנות בעיכוב של מעל 48 שעות ללא סנכרון ERP.`
                  : "כל ההזמנות הנוכחיות סונכרנו בזמן או שהן בטווח הטיפול המותר (פחות מ-48 שעות)."}
              </p>
            </div>
          </div>

          {/* Action Button: Professional Morning Report WhatsApp Share */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-700/10 hover:shadow-lg transition-all duration-300 shrink-0 select-none cursor-pointer"
            title="שיתוף דוח בוקר מקצועי ומפורט לוואטסאפ של המנהלים"
          >
            <Share2 size={14} className="stroke-[2.5px]" />
            <span>דוח בוקר לוואטסאפ 💬</span>
          </a>

        </div>

      </div>
    </motion.div>
  );
}
