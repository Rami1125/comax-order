import { useState, useMemo } from "react";
import { Order } from "../types";
import { isOrderDelayed, getDelayHours, formatDate } from "../utils";
import { Bell, AlertTriangle, Clock, ChevronDown, ChevronUp, CheckCircle2, ArrowLeft, ShieldAlert } from "lucide-react";

interface NotificationsProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  darkMode?: boolean;
}

export default function Notifications({ orders, onSelectOrder, darkMode = false }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Filter orders that are extremely delayed (> 48 hours and not synced)
  const delayedOrders = useMemo(() => {
    return orders
      .filter(isOrderDelayed)
      .map(order => ({
        order,
        delayHours: getDelayHours(order)
      }))
      .sort((a, b) => b.delayHours - a.delayHours); // Sort by highest delay first
  }, [orders]);

  const count = delayedOrders.length;

  return (
    <div
      id="notifications-panel"
      className={`border rounded-2xl p-4 transition-all duration-300 shadow-xs ${
        count > 0
          ? darkMode
            ? "border-red-900/50 bg-red-950/10 text-white shadow-red-950/15"
            : "border-red-100 bg-red-50/50 text-slate-800 shadow-sm"
          : darkMode
            ? "border-slate-800 bg-slate-900/40 text-slate-300"
            : "border-slate-100 bg-white text-slate-800"
      }`}
    >
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl transition-all ${
              count > 0
                ? darkMode
                  ? "bg-red-950 text-red-400 animate-pulse"
                  : "bg-red-100 text-red-600 animate-pulse"
                : darkMode
                  ? "bg-slate-800 text-slate-400"
                  : "bg-slate-50 text-slate-400"
            }`}
          >
            {count > 0 ? <Bell size={18} /> : <CheckCircle2 size={18} className="text-emerald-500" />}
          </div>
          <div>
            <h3 className={`font-bold text-sm ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
              התראות לוח בקרה
            </h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
              {count > 0
                ? `נמצאו ${count} הזמנות בעיכוב קריטי של מעל 48 שעות`
                : "כל ההזמנות מסונכרנות ובזמני התקן. שרשרת האספקה יציבה."}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-gray-500"
          }`}
          title={isOpen ? "מזער" : "הרחב"}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Delayed Orders List (Collapsible) */}
      {isOpen && count > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-dashed pt-3.5 border-red-200/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {delayedOrders.map(({ order, delayHours }, idx) => (
              <div
                key={`${order["מספר הזמנה"]}-${idx}`}
                onClick={() => onSelectOrder(order)}
                className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
                  darkMode
                    ? "border-red-900/30 bg-[#1e1b1b]/80 hover:border-red-500/40 text-slate-200 hover:shadow-lg hover:shadow-red-950/20"
                    : "border-red-100 bg-white hover:border-red-300 text-slate-700 shadow-2xs hover:shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-md bg-red-500/10 text-red-500">
                      <Clock size={12} />
                    </span>
                    <span className="font-mono text-xs font-bold text-red-500">
                      #{order["מספר הזמנה"]}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      darkMode ? "bg-red-950 text-red-400" : "bg-red-50 text-red-700"
                    }`}
                  >
                    <AlertTriangle size={10} />
                    עיכוב של {delayHours} שעות
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={darkMode ? "text-slate-400" : "text-gray-400"}>לקוח:</span>
                    <span className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>
                      {order["שם לקוח"]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={darkMode ? "text-slate-400" : "text-gray-400"}>מחסן מנפק:</span>
                    <span className="font-medium">{order["מחסן"] || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={darkMode ? "text-slate-400" : "text-gray-400"}>תאריך קליטה:</span>
                    <span className="font-mono text-[10px]">{formatDate(order["תאריך קליטה"])}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-red-500 gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <span>צפה בפרטים ופתרון</span>
                  <ArrowLeft size={10} className="transform group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
