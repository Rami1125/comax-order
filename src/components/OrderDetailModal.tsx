import { useMemo } from "react";
import { Order } from "../types";
import { parseItems, formatDate, getCity } from "../utils";
import { useETA } from "../utils/useETA";
import { X, Clipboard, MapPin, Warehouse, MessageSquare, CheckCircle2, ShoppingBag, Sparkles, AlertCircle, TrendingUp, Info, Share2, RefreshCw, Clock } from "lucide-react";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onViewOnMap?: (order: Order) => void;
  onUpdateSyncStatus?: (orderId: string | number, newStatus: string) => void;
  darkMode?: boolean;
}

export default function OrderDetailModal({ order, onClose, onViewOnMap, onUpdateSyncStatus, darkMode = false }: OrderDetailModalProps) {
  if (!order) return null;

  const parsedProducts = parseItems(order["פריטים"]);
  const totalQty = parsedProducts.reduce((sum, item) => sum + item.quantity, 0);

  const syncStatus = order["סטטוס סנכרון"];

  // Calculate internal ETA using custom hook
  const destinationCity = order["כתובת אספקה"] ? getCity(order["כתובת אספקה"]) : undefined;
  const { eta, isRush, isDefaultFallback } = useETA(
    order["מחסן"] || "החרש 10, הוד השרון",
    destinationCity,
    order["תאריך קליטה"]
  );
  const isSynced = syncStatus && typeof syncStatus === "string" && (syncStatus.includes("סונכרן") || syncStatus.includes("✅"));

  // Generate WhatsApp Sharing URL
  const whatsappUrl = useMemo(() => {
    const orderId = order["מספר הזמנה"];
    const customer = order["שם לקוח"];
    const address = order["כתובת אספקה"] || "לא צוין יעד";
    const warehouse = order["מחסן"] || "לא הוגדר מחסן";
    const dateStr = formatDate(order["תאריך קליטה"]);
    const syncStatus = isSynced ? "סונכרן למערכת ERP ✅" : "ממתין לסנכרון ⏳";
    
    const itemsText = parsedProducts.length > 0 
      ? parsedProducts.map(p => `• ${p.name} (${p.quantity} יח') [קוד: ${p.code || 'ללא'}]`).join("\n")
      : "אין פירוט פריטים";

    const aiInsights = order["מסקנות נועה AI"] 
      ? `\n✨ *מסקנות נועה AI (מנתחת פיקדונומטר):*\n${order["מסקנות נועה AI"]}` 
      : "";

    const message = `שלום, להלן פרטי הזמנה מספר *#${orderId}* מתוך מערכת *LogiTrack*:\n\n` +
      `👤 *לקוח:* ${customer}\n` +
      `📍 *כתובת אספקה:* ${address}\n` +
      `🏠 *מחסן מנפק:* ${warehouse}\n` +
      `📅 *תאריך קליטה:* ${dateStr}\n` +
      `🔄 *סטטוס סנכרון:* ${syncStatus}\n\n` +
      `📦 *פירוט פריטים:* \n${itemsText}` +
      `${aiInsights}\n\n` +
      `נשלח דרך לוח הבקרה הלוגיסטי LogiTrack.`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }, [order, parsedProducts, isSynced]);

  return (
    <div
      id="order-detail-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="order-detail-content"
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border flex flex-col transition-colors duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between transition-colors duration-300 ${
          darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl ${darkMode ? "bg-indigo-950/60 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
              <Clipboard size={18} />
            </span>
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${darkMode ? "text-slate-100" : "text-slate-850"}`}>הזמנה #{order["מספר הזמנה"]}</h2>
              <p className={`text-[10px] sm:text-xs ${darkMode ? "text-slate-400" : "text-slate-400"}`}>התקבלה בתאריך: {formatDate(order["תאריך קליטה"])}</p>
            </div>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              darkMode ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Customer Details */}
            <div className={`p-4 rounded-xl border flex gap-3 transition-colors duration-300 ${
              darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50/40 border-slate-100"
            }`}>
              <div className={`p-2.5 rounded-lg h-fit ${darkMode ? "bg-blue-950/60 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <MapPin size={16} />
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] sm:text-xs block font-medium ${darkMode ? "text-slate-400" : "text-gray-400"}`}>פרטי לקוח ויעד אספקה</span>
                <span className={`font-semibold text-xs sm:text-sm block ${darkMode ? "text-slate-200" : "text-slate-850"}`}>{order["שם לקוח"]}</span>
                <span className={`text-[11px] sm:text-xs block leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{order["כתובת אספקה"] || "לא צוין יעד"}</span>
              </div>
            </div>

            {/* Warehouse Details */}
            <div className={`p-4 rounded-xl border flex gap-3 transition-colors duration-300 ${
              darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50/40 border-slate-100"
            }`}>
              <div className={`p-2.5 rounded-lg h-fit ${darkMode ? "bg-emerald-950/60 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                <Warehouse size={16} />
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] sm:text-xs block font-medium ${darkMode ? "text-slate-400" : "text-gray-400"}`}>מחסן מנפק ומסלול</span>
                <span className={`font-semibold text-xs sm:text-sm block ${darkMode ? "text-slate-200" : "text-slate-850"}`}>{order["מחסן"] || "לא הוגדר מחסן"}</span>
                {order["אימות מסלול הובלה"] && (
                  <span className={`text-[11px] sm:text-xs block leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    מסלול: {order["אימות מסלול הובלה"]}
                  </span>
                )}
              </div>
            </div>

            {/* ETA Estimation Details */}
            <div className={`p-4 rounded-xl border flex gap-3 transition-colors duration-300 ${
              darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50/40 border-slate-100"
            }`}>
              <div className={`p-2.5 rounded-lg h-fit ${darkMode ? "bg-indigo-950/60 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                <Clock size={16} />
              </div>
              <div className="space-y-1 w-full">
                <span className={`text-[10px] sm:text-xs block font-medium ${darkMode ? "text-slate-400" : "text-gray-400"}`}>ETA משוער ללקוח</span>
                {eta !== null ? (
                  <div className="space-y-1">
                    <span className={`font-bold text-xs sm:text-sm block ${darkMode ? "text-indigo-400" : "text-indigo-600"}`}>
                      צפי הגעה: כ-{eta} דקות
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {isRush && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          עומס פקקים 🚨
                        </span>
                      )}
                      {isDefaultFallback ? (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/10">
                          ברירת מחדל
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/10">
                          נתונים היסטוריים
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className={`text-xs block font-medium ${darkMode ? "text-slate-500" : "text-gray-400"}`}>
                    זמן הגעה לא זמין
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Product Items Block */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between border-b pb-2 transition-colors duration-300 ${
              darkMode ? "border-slate-850" : "border-slate-100"
            }`}>
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-indigo-500 shrink-0" />
                <h3 className={`font-semibold text-xs sm:text-sm ${darkMode ? "text-slate-200" : "text-slate-800"}`}>פירוט פריטי ההזמנה</h3>
              </div>
              <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-md font-mono shrink-0 ${
                darkMode ? "text-indigo-400 bg-indigo-950/50" : "text-indigo-600 bg-indigo-50"
              }`}>
                {parsedProducts.length} פריטים | {totalQty} יח' סה"כ
              </span>
            </div>

            {parsedProducts.length === 0 ? (
              <div className={`text-center py-4 text-xs rounded-lg ${darkMode ? "bg-slate-900/50 text-slate-500" : "bg-slate-50 text-gray-400"}`}>
                אין פירוט פריטים להזמנה זו
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {parsedProducts.map((prod, idx) => (
                  <div
                    key={`${prod.code}-${idx}`}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-all ${
                      darkMode 
                        ? "border-slate-800/80 bg-slate-900/20 hover:border-slate-700/60" 
                        : "border-slate-100 hover:border-slate-200 bg-white shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md shrink-0 ${
                        darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
                      }`}>
                        {prod.code || "N/A"}
                      </span>
                      <span className={`text-[11px] sm:text-xs font-medium truncate ${darkMode ? "text-slate-300" : "text-slate-800"}`}>{prod.name}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 font-mono shrink-0">
                      <span className="text-[10px] sm:text-xs text-slate-400">כמות:</span>
                      <span className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border ${
                        darkMode 
                          ? "text-slate-200 bg-slate-950 border-slate-850" 
                          : "text-slate-800 bg-slate-50 border-slate-100"
                      }`}>
                        {prod.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Insights Block (מסקנות נועה AI) */}
          <div className={`p-4 rounded-xl border shadow-xs ring-1 space-y-3 transition-colors duration-300 ${
            darkMode 
              ? "border-violet-900/50 bg-gradient-to-br from-violet-950/40 via-indigo-950/20 to-fuchsia-950/20 ring-violet-500/5" 
              : "border-indigo-100 bg-gradient-to-br from-indigo-50 via-violet-50/50 to-fuchsia-50/40 ring-indigo-500/5"
          }`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${darkMode ? "text-violet-400" : "text-indigo-700"}`}>
                <div className={`p-1 rounded-md ${darkMode ? "bg-violet-950 text-violet-400" : "bg-indigo-100/80 text-indigo-700"}`}>
                  <Sparkles size={16} className="animate-pulse" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold tracking-tight">מסקנות נועה AI (מנתחת פיקדונומטר)</h4>
              </div>
              <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                המלצת מערכת
              </span>
            </div>
            
            <div className={`backdrop-blur-xs p-3 rounded-lg text-[11px] sm:text-xs leading-relaxed shadow-2xs font-medium border ${
              darkMode 
                ? "bg-slate-950/80 border-violet-900/40 text-slate-200" 
                : "bg-white/80 border-indigo-100/50 text-slate-700"
            }`}>
              {order["מסקנות נועה AI"] ? (
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✦</span>
                  <p>{order["מסקנות נועה AI"]}</p>
                </div>
              ) : (
                <div className={`italic flex items-center gap-2 justify-center py-2 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                  <span>לא נמצאו מסקנות מאובחנות. הפעל את סקריפט מנוע הפיקדונומטר.</span>
                </div>
              )}
            </div>
          </div>

          {/* Deposit Verification section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Bullets Deposit */}
            <div className={`p-3 sm:p-3.5 rounded-xl border ${darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50/20 border-slate-100"} space-y-1`}>
              <span className={`text-[10px] sm:text-xs font-medium block ${darkMode ? "text-slate-400" : "text-gray-400"}`}>אימות פקדון בלות (שקים גדולים)</span>
              <div className="flex items-center gap-1.5">
                <Info size={13} className="text-slate-400 shrink-0" />
                <span className={`text-[11px] sm:text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {order["אימות פקדון בלות"] || "טרם בוצע אימות"}
                </span>
              </div>
            </div>

            {/* Pallets Deposit */}
            <div className={`p-3 sm:p-3.5 rounded-xl border ${darkMode ? "bg-slate-900/30 border-slate-800" : "bg-slate-50/20 border-slate-100"} space-y-1`}>
              <span className={`text-[10px] sm:text-xs font-medium block ${darkMode ? "text-slate-400" : "text-gray-400"}`}>אימות פקדון משטחים</span>
              <div className="flex items-center gap-1.5">
                <Info size={13} className="text-slate-400 shrink-0" />
                <span className={`text-[11px] sm:text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {order["אימות פקדון משטחים"] || "טרם בוצע אימות"}
                </span>
              </div>
            </div>
          </div>

          {/* Manual Sync Status Update Section */}
          <div className={`p-4 rounded-xl border space-y-3 transition-colors duration-300 ${
            darkMode 
              ? "border-slate-800 bg-slate-900/40" 
              : "border-slate-200 bg-slate-50/50"
          }`}>
            <div className="flex items-center gap-2">
              <RefreshCw size={15} className={`text-indigo-500 ${!isSynced ? 'animate-spin' : ''}`} />
              <h4 className={`text-xs sm:text-sm font-bold ${darkMode ? "text-slate-200" : "text-slate-850"}`}>עדכון סטטוס סנכרון ידני (ERP)</h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "סונכרן בהצלחה ✅", value: "סונכרן בהצלחה ✅", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20" },
                { label: "ממתין לסנכרון ⏳", value: "ממתין לסנכרון ⏳", color: "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20" },
                { label: "בוטל ❌", value: "בוטל ❌", color: "bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20" }
              ].map((opt) => {
                const isSelected = order["סטטוס סנכרון"] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateSyncStatus?.(order["מספר הזמנה"], opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                      isSelected 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10" 
                        : `${opt.color}`
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-300 ${
          darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
        }`}>
          {/* Metadata info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-400"}`}>סטטוס סנכרון לוגיסטי:</span>
              {isSynced ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 size={12} className="stroke-[2.5px]" />
                  <span>סונכרן למערכת ERP</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  <AlertCircle size={12} className="stroke-[2.5px]" />
                  <span>ממתין לסנכרון</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-400"}`}>ערוץ הפצה:</span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg font-mono border ${
                darkMode 
                  ? "text-blue-400 bg-blue-950/50 border-blue-900/50" 
                  : "text-blue-700 bg-blue-50 border-blue-100"
              }`}>
                {order["סטטוס ווצאפ"] || "ללא מזהה"}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 justify-end w-full sm:w-auto">
            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(order)}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border ${
                  darkMode 
                    ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-xs hover:shadow-md" 
                    : "bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-700 shadow-2xs hover:shadow-xs"
                }`}
                title="צפה בהזמנה זו על גבי מפת הפצה בגודל מלא"
              >
                <MapPin size={14} className="stroke-[2.5px]" />
                <span>צפה על מפה</span>
              </button>
            )}

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/30 font-sans"
              title="שיתוף פרטי ההזמנה ב-WhatsApp"
            >
              <Share2 size={14} className="stroke-[2.5px]" />
              <span>שיתוף הזמנה ב-WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
