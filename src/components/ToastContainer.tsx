import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X, ExternalLink, Bell } from "lucide-react";

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
  orderId?: number;
  duration?: number; // ms
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
  onActionClick?: (orderId: number) => void;
  darkMode?: boolean;
}

export default function ToastContainer({ toasts, onClose, onActionClick, darkMode = false }: ToastContainerProps) {
  return (
    <div
      id="toast-notifications-container"
      className="fixed bottom-5 left-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={onClose}
            onActionClick={onActionClick}
            darkMode={darkMode}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: Toast;
  onClose: (id: string) => void;
  onActionClick?: (orderId: number) => void;
  darkMode: boolean;
}

function ToastItem({ toast, onClose, onActionClick, darkMode }: ToastItemProps) {
  const { id, title, message, type, orderId, duration = 5000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  // Styling based on toast type
  let icon = <Info className="text-blue-500" size={18} />;
  let borderClass = darkMode ? "border-slate-800" : "border-slate-100";
  let bgClass = darkMode ? "bg-slate-900/95" : "bg-white/95";
  let progressColor = "bg-blue-500";

  switch (type) {
    case "success":
      icon = <CheckCircle2 className="text-emerald-500" size={18} />;
      progressColor = "bg-emerald-500";
      break;
    case "warning":
      icon = <AlertTriangle className="text-amber-500" size={18} />;
      progressColor = "bg-amber-500";
      break;
    case "error":
      icon = <AlertTriangle className="text-red-500 animate-pulse" size={18} />;
      progressColor = "bg-red-500";
      break;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-lg flex flex-col gap-2 transition-all duration-300 backdrop-blur-md ${bgClass} ${borderClass}`}
      dir="rtl"
    >
      {/* Icon, Title, and Close Button */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-xs font-extrabold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
            {title}
          </h4>
          <p className={`text-[11px] leading-relaxed mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            {message}
          </p>
        </div>
        <button
          onClick={() => onClose(id)}
          className={`p-1 rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer ${
            darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Optional Order Details CTA */}
      {orderId && onActionClick && (
        <div className="flex justify-end mt-1.5 border-t border-slate-500/10 pt-2">
          <button
            onClick={() => onActionClick(orderId)}
            className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors bg-indigo-500/5 px-2 py-1 rounded-lg cursor-pointer"
          >
            <span>הצג פרטי הזמנה #{orderId}</span>
            <ExternalLink size={10} />
          </button>
        </div>
      )}

      {/* Progress Bar Countdown */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-500/10">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          className={`h-full ${progressColor}`}
        />
      </div>
    </motion.div>
  );
}
