import { useState, useEffect, useMemo, useRef } from "react";
import { Order, DashboardStats } from "./types";
import { calculateStats, getDelayHours } from "./utils";
import { playNotificationSound } from "./utils/sound";
import KPICards from "./components/KPICards";
import ChartsSection from "./components/ChartsSection";
import OrderTable from "./components/OrderTable";
import OrderDetailModal from "./components/OrderDetailModal";
import Notifications from "./components/Notifications";
import LogisticsMap from "./components/LogisticsMap";
import ToastContainer, { Toast } from "./components/ToastContainer";
import NoaChat from "./components/NoaChat";
import { LayoutDashboard, ShieldCheck, Truck, RefreshCw, Layers, Clock, CheckCircle2, ChevronRight, MessageSquare, AlertTriangle, Sun, Moon, Maximize, Minimize, Map, Bell, BellOff, Wifi, WifiOff, Trash2, Sparkles } from "lucide-react";

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [prevStats, setPrevStats] = useState<DashboardStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"google_sheets" | "fallback" | null>(null);

  // Lifted filter states for OrderTable and KPI click bindings
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedSyncStatus, setSelectedSyncStatus] = useState("all");
  const [selectedWaStatus, setSelectedWaStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [isNoaChatOpen, setIsNoaChatOpen] = useState(false);

  const handleKpiCardClick = (cardId: string) => {
    // Reset all filters first to have a clean state, then apply the specific one
    setSearchTerm("");
    setSelectedWarehouse("all");
    setSelectedSyncStatus("all");
    setSelectedWaStatus("all");
    setStartDate("");
    setEndDate("");
    setShowDelayedOnly(false);
    setCurrentPage(1);

    if (cardId === "total-orders") {
      setActiveKpiFilter("total-orders");
    } else if (cardId === "synced-orders") {
      setSelectedSyncStatus("synced");
      setActiveKpiFilter("synced-orders");
    } else if (cardId === "pending-orders") {
      setSelectedSyncStatus("pending");
      setActiveKpiFilter("pending-orders");
    } else if (cardId === "delayed-orders") {
      setShowDelayedOnly(true);
      setActiveKpiFilter("delayed-orders");
    } else if (cardId === "top-city") {
      if (stats.topCity && stats.topCity !== "אין נתונים" && stats.topCity !== "לא ידוע") {
        setSearchTerm(stats.topCity);
      }
      setActiveKpiFilter("top-city");
    } else if (cardId === "active-warehouses") {
      setActiveKpiFilter("active-warehouses");
      // Let's scroll to the table and focus on the warehouse select
      setTimeout(() => {
        const warehouseSelect = document.getElementById("warehouse-select") as HTMLSelectElement | null;
        if (warehouseSelect) {
          warehouseSelect.focus();
          warehouseSelect.classList.add("ring-2", "ring-indigo-500", "scale-[1.03]");
          setTimeout(() => {
            warehouseSelect.classList.remove("ring-2", "ring-indigo-500", "scale-[1.03]");
          }, 1500);
        }
      }, 300);
    }

    // Scroll to the order table smoothly
    const tableSection = document.getElementById("order-table-section");
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Global Dark Mode state (initialized from local storage or system preference)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("logitrack_theme");
    return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    localStorage.setItem("logitrack_theme", darkMode ? "dark" : "light");
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Quick stats computed from the current loaded orders
  const stats = useMemo(() => calculateStats(orders), [orders]);

  // Current system local time to render a premium dashboard timestamp
  const [currentTime, setCurrentTime] = useState("");

  // Toast Notification System state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Ref to always access the latest orders list in interval simulation without restarts
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Full Screen layout state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Active view layout: "dashboard" or "map"
  const [activeView, setActiveView] = useState<"dashboard" | "map">("dashboard");
  // Focused order for map initialization
  const [mapFocusedOrder, setMapFocusedOrder] = useState<Order | null>(null);

  // Online / Offline state tracking
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  // Offline sync queue for updates made while offline
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<{orderId: string | number, newStatus: string}[]>(() => {
    try {
      const saved = localStorage.getItem("sidur_noa_offline_queue");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Monitor network status changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      addToast({
        title: "חיבור הרשת חזר! ⚡",
        message: "המכשיר מחובר מחדש. מתחיל סנכרון פנימי מקומי מול שרתי סידור-נועה.",
        type: "success",
        duration: 5000,
      });
      // Play high-tech ascending sync sound
      playNotificationSound("sync");
    };

    const handleOffline = () => {
      setIsOnline(false);
      addToast({
        title: "עבודה במצב אופליין 🔌",
        message: "חיבור האינטרנט אבד. שינויים יישמרו מקומית ויסונכרנו אוטומטית כשהחיבור יתחדש.",
        type: "error",
        duration: 6000,
      });
      playNotificationSound("error");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Process offline sync queue when network becomes online
  useEffect(() => {
    if (isOnline && offlineSyncQueue.length > 0) {
      console.log("Processing offline sync queue:", offlineSyncQueue);
      // Simulate sending offline queue modifications to the backend
      addToast({
        title: "סנכרון פנימי הושלם בהצלחה 🎉",
        message: `סונכרנו בהצלחה ${offlineSyncQueue.length} עדכוני סטטוס שבוצעו במצב לא מקוון.`,
        type: "success",
        duration: 5000,
      });
      playNotificationSound("sync");
      
      // Clear offline sync queue
      setOfflineSyncQueue([]);
      localStorage.removeItem("sidur_noa_offline_queue");
    }
  }, [isOnline, offlineSyncQueue]);

  // Web Notifications permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  // Sync notification permission status on mount and focus
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const syncPermission = () => {
        setNotificationPermission(Notification.permission);
      };
      syncPermission();
      window.addEventListener("focus", syncPermission);
      return () => window.removeEventListener("focus", syncPermission);
    }
  }, []);

  const sendNativeNotification = (title: string, body: string, orderId?: number | string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const options: NotificationOptions = {
          body,
          icon: "/favicon.ico",
          dir: "rtl",
          lang: "he",
          tag: orderId ? `order-${orderId}` : undefined,
        };
        const notification = new Notification(title, options);
        if (orderId) {
          notification.onclick = () => {
            window.focus();
            const found = orders.find(o => String(o["מספר הזמנה"]) === String(orderId));
            if (found) {
              setSelectedOrder(found);
            }
          };
        }
      } catch (err) {
        console.error("Failed to send native notification:", err);
      }
    }
  };

  const requestNotificationPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
        if (permission === "granted") {
          addToast({
            title: "התראות דפדפן הופעלו בהצלחה! 🔔",
            message: "כעת תקבל התראות מערכת על עדכוני סטטוס קריטיים גם כאשר הלשונית אינה פעילה.",
            type: "success",
            duration: 5000,
          });
          // Send a test notification
          sendNativeNotification("מערכת LogiTrack 📡", "התראות דפדפן פעילות ומסונכרנות.");
        } else if (permission === "denied") {
          addToast({
            title: "התראות דפדפן נחסמו 🔕",
            message: "כדי לקבל התראות מערכת, יש לאפשר אותן בהגדרות האתר בדפדפן שלך.",
            type: "error",
            duration: 5000,
          });
        }
      });
    } else {
      addToast({
        title: "התראות אינן נתמכות ⚠️",
        message: "הדפדפן שלך אינו תומך ב-Web Notifications API.",
        type: "error",
        duration: 5000,
      });
    }
  };

  // Save notified events in memory/localStorage to prevent duplicate toast alerts
  const [notifiedKeys, setNotifiedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sidur_noa_notified_events");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToast = (toast: Omit<Toast, "id">) => {
    // Generate unique fingerprint based on title, message and orderId
    const fingerprint = `${toast.title}_${toast.message}_${toast.orderId || ""}`;
    
    // Prevent duplicate toast alerts by checking memory
    if (notifiedKeys.includes(fingerprint)) {
      console.log("Prevented duplicate notification:", fingerprint);
      return;
    }

    // Save in memory state and localStorage
    setNotifiedKeys((prev) => {
      const updated = [...prev, fingerprint];
      localStorage.setItem("sidur_noa_notified_events", JSON.stringify(updated));
      return updated;
    });

    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Trigger synthetic audio alert based on toast type
    try {
      if (toast.type === "error") {
        playNotificationSound("error");
      } else if (toast.type === "success") {
        if (toast.title.includes("סנכרון") || toast.title.includes("סנכרן") || toast.title.includes("הושלם")) {
          playNotificationSound("sync");
        } else {
          playNotificationSound("success");
        }
      } else {
        playNotificationSound("info");
      }
    } catch (e) {
      console.warn("Audio chime playback blocked by browser gesture constraints:", e);
    }

    // Trigger system notification for critical updates or if tab is inactive
    const isCritical = toast.type === "error" || toast.title.includes("קריטי") || toast.title.includes("חריג") || toast.title.includes("אזהרה") || toast.title.includes("סנכרון ERP");
    const shouldNotify = isCritical || document.hidden;
    if (shouldNotify) {
      sendNativeNotification(toast.title, toast.message, (toast as any).orderId);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Toggle Full Screen View Mode
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request failed:", err);
        });
      }
      setIsFullScreen(true);
      addToast({
        title: "מצב מסך מלא הופעל 🖥️",
        message: "תצוגת לוח הבקרה הורחבה למקסימום. לחץ Esc או על כפתור היציאה לחזרה.",
        type: "info",
        duration: 3500
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn("Exit fullscreen failed:", err);
        });
      }
      setIsFullScreen(false);
    }
  };

  // Listen to standard Esc key or Fullscreen API changes to keep state in sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullscreen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Track whether we've shown the initial toast
  const hasShownInitialToast = useRef(false);

  // Show the initial "מערכת ניטור פעילה 📡" toast exactly once when orders are loaded
  useEffect(() => {
    if (orders.length > 0 && !hasShownInitialToast.current) {
      hasShownInitialToast.current = true;
      const initialTimer = setTimeout(() => {
        addToast({
          title: "מערכת ניטור פעילה 📡",
          message: "חיבור ערוצי לוגיסטיקה וסנכרון תקין. מאזין לעדכונים בזמן אמת.",
          type: "info",
          duration: 4000
        });
      }, 1500);
      return () => clearTimeout(initialTimer);
    }
  }, [orders.length > 0]);

  // Simulating real-time order entries & critical status updates removed to run exclusively on actual user-triggered changes

  useEffect(() => {
    // Set clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        new Intl.DateTimeFormat("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch logic
  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching orders from server...");
      const response = await fetch("/api/orders");
      const result = await response.json();
      
      if (result.data) {
        if (orders.length > 0) {
          setPrevStats(calculateStats(orders));
        }
        setOrders(result.data);
        setDataSource(result.source);
        
        // Cache the latest successful data
        localStorage.setItem("sidur_noa_cached_orders", JSON.stringify(result.data));

        if (!result.success) {
          console.warn("API returned fallback source due to error:", result.error);
        }
        // Trigger success toast
        addToast({
          title: "סנכרון נתונים הושלם בהצלחה 🔄",
          message: `נטענו בהצלחה ${result.data.length} הזמנות פעילות משרתי המערכת.`,
          type: "success",
          duration: 4000
        });
      } else {
        throw new Error("No data returned from backend");
      }
    } catch (err: any) {
      console.error("Error loading orders in client:", err);
      
      // Attempt to load from localStorage cache!
      const cached = localStorage.getItem("sidur_noa_cached_orders");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setOrders(parsed);
          setDataSource("fallback");
          setError(null);
          addToast({
            title: "מצב אופליין פעיל 🔌",
            message: `נטענו בהצלחה ${parsed.length} הזמנות מגיבוי המטמון המקומי של סידור-נועה.`,
            type: "info",
            duration: 6000
          });
          return;
        } catch (e) {
          // fallback failed
        }
      }

      setError(err.message || "שגיאה בחיבור לשרת הנתונים");
      addToast({
        title: "שגיאת סנכרון נתונים ⚠️",
        message: err.message || "לא ניתן היה למשוך נתונים משרתי המערכת. פועל במצב גיבוי מקומי.",
        type: "error",
        duration: 8000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderSyncStatus = (orderId: string | number, newStatus: string) => {
    setOrders((prevOrders) => {
      const updated = prevOrders.map((o) => {
        if (o && String(o["מספר הזמנה"]) === String(orderId)) {
          return {
            ...o,
            "סטטוס סנכרון": newStatus,
          };
        }
        return o;
      });
      
      // Cache the full updated orders state in localStorage
      localStorage.setItem("sidur_noa_cached_orders", JSON.stringify(updated));

      // Keep selectedOrder in sync
      if (selectedOrder && String(selectedOrder["מספר הזמנה"]) === String(orderId)) {
        const updatedSelected = updated.find(o => o && String(o["מספר הזמנה"]) === String(orderId));
        if (updatedSelected) {
          setSelectedOrder(updatedSelected);
        }
      }

      return updated;
    });

    if (!isOnline) {
      // Add to offline sync queue
      setOfflineSyncQueue((prev) => {
        const next = [...prev, { orderId, newStatus }];
        localStorage.setItem("sidur_noa_offline_queue", JSON.stringify(next));
        return next;
      });

      addToast({
        title: "שינוי נשמר מקומית (אופליין) 💾",
        message: `הזמנה #${orderId} עודקנה ל- "${newStatus}" ותסונכרן אוטומטית ברגע שתחזור לרשת.`,
        type: "info",
        duration: 5000
      });
    } else {
      addToast({
        title: "עדכון סטטוס סנכרון 🔄",
        message: `סטטוס הסנכרון של הזמנה #${orderId} עודכן ל- "${newStatus}".`,
        type: "success",
        duration: 4000
      });
    }
  };

  const deleteOrder = (orderId: string | number) => {
    setOrders((prevOrders) => {
      const updated = prevOrders.filter((o) => o && String(o["מספר הזמנה"]) !== String(orderId));
      localStorage.setItem("sidur_noa_cached_orders", JSON.stringify(updated));
      return updated;
    });

    if (selectedOrder && String(selectedOrder["מספר הזמנה"]) === String(orderId)) {
      setSelectedOrder(null);
    }

    addToast({
      title: "הזמנה נמחקה בהצלחה 🗑️",
      message: `הזמנה #${orderId} הוסרה מרשימת הלוח הארעי.`,
      type: "info",
      duration: 4000
    });
  };

  const deleteDummyOrders = () => {
    setOrders((prevOrders) => {
      const updated = prevOrders.filter((o) => !o.isSimulated);
      localStorage.setItem("sidur_noa_cached_orders", JSON.stringify(updated));
      return updated;
    });

    addToast({
      title: "הזמנות דמה נמחקו 🗑️",
      message: "כל הזמנות הדמה החדשות שאינן בגליון המקורי הוסרו מהתצוגה.",
      type: "success",
      duration: 5000
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // --- FULL SCREEN MAP VIEW INTERCEPTOR ---
  if (activeView === "map") {
    return (
      <div 
        id="fullscreen-map-wrapper"
        className={`w-screen h-screen selection:bg-blue-600 selection:text-white ${
          darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        <LogisticsMap
          orders={orders}
          onSelectOrder={(order) => {
            setSelectedOrder(order);
          }}
          darkMode={darkMode}
          fullScreenMode={true}
          onBackToDashboard={() => {
            setActiveView("dashboard");
            setMapFocusedOrder(null);
          }}
          initialSelectedOrder={mapFocusedOrder}
        />
        
        {/* Detail modal over the full screen map */}
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onViewOnMap={(order) => {
            setMapFocusedOrder(order);
          }}
          darkMode={darkMode}
        />

        {/* Real-time Toasts in map view */}
        <ToastContainer
          toasts={toasts}
          onClose={removeToast}
          onActionClick={(orderId) => {
            const found = orders.find(o => o["מספר הזמנה"] === orderId);
            if (found) setSelectedOrder(found);
          }}
          darkMode={darkMode}
        />
      </div>
    );
  }

  return (
    <div
      id="app-root"
      dir="rtl"
      className={`min-h-screen transition-colors duration-300 font-sans selection:bg-blue-600 selection:text-white ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-[#F8FAFC] text-slate-800"
      }`}
    >
      {/* Top Professional Navigation Bar */}
      {!isFullScreen && (
        <header id="app-header" className="sticky top-0 z-40 bg-[#0F172A] text-white border-b border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <img 
                src="/logo.jpg" 
                alt="סידור-נועה" 
                className="w-10 h-10 rounded-xl object-cover shadow-md border border-indigo-500/25 shadow-indigo-500/10" 
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-none text-white font-sans flex items-center gap-1.5">
                  סידור-נועה
                  <span className="text-[9px] bg-indigo-600/60 text-indigo-200 px-1.5 py-0.5 rounded-full font-bold">PWA</span>
                </h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide block mt-1">מערכת סידור ותיאום לוגיסטי באופליין</span>
              </div>
            </div>

            {/* Dynamic Clock, Theme Toggle & Meta Info */}
            <div className="flex items-center gap-3 text-xs font-medium">
              {/* Status indicators */}
              <div className="hidden sm:flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
                {isOnline ? (
                  offlineSyncQueue.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
                      <Wifi size={13} />
                      <span>סנכרון מקומי פנימי ({offlineSyncQueue.length})</span>
                    </div>
                  ) : dataSource === "google_sheets" ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Wifi size={13} className="text-emerald-400" />
                      <span>מקוון - Google Sheets</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <Wifi size={13} className="text-indigo-400" />
                      <span>מקוון - סידור נועה ⚡</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400" title="פועל במצב לא מקוון עם גיבוי מקומי">
                    <WifiOff size={13} className="text-rose-400 animate-pulse" />
                    <span>אופליין - נתונים שמורים מקומית</span>
                  </div>
                )}
              </div>

              {/* Web Notifications Toggle Button */}
              <button
                onClick={requestNotificationPermission}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner"
                title={
                  notificationPermission === "granted"
                    ? "התראות דפדפן פעילות 🔔"
                    : notificationPermission === "denied"
                    ? "התראות דפדפן חסומות (לחץ למידע) 🔕"
                    : "לחץ להפעלת התראות דפדפן לעדכונים קריטיים 🔔"
                }
              >
                {notificationPermission === "granted" ? (
                  <Bell size={15} className="text-emerald-400 animate-pulse" />
                ) : notificationPermission === "denied" ? (
                  <BellOff size={15} className="text-red-400" />
                ) : (
                  <Bell size={15} className="text-slate-300 hover:text-blue-400 transition-colors" />
                )}
              </button>

              {/* Noa AI Chat Header Toggle */}
              <button
                onClick={() => setIsNoaChatOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-indigo-500 text-white font-extrabold transition-all duration-300 cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="פתח צ'אט עם נועה AI"
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>צ'אט נועה AI ⚡</span>
              </button>

              {/* Full Screen Mode Toggle Button */}
              <button
                onClick={toggleFullScreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner"
                title="מעבר למצב מסך מלא"
              >
                <Maximize size={15} className="text-slate-300 stroke-[2px]" />
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner"
                title={darkMode ? "מעבר למצב תצוגה בהיר" : "מעבר למצב תצוגה כהה"}
              >
                {darkMode ? (
                  <Sun size={15} className="text-amber-400 stroke-[2px]" />
                ) : (
                  <Moon size={15} className="text-slate-300 stroke-[2px]" />
                )}
              </button>

              {/* Live Clock */}
              <div className="bg-slate-800 text-slate-100 font-mono px-3.5 py-1.5 rounded-xl text-center shadow-inner tracking-wider">
                {currentTime || "00:00:00"}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Floating control bar for escaping fullscreen view mode */}
      {isFullScreen && (
        <div id="fullscreen-control-pill" className="fixed top-4 left-1/2 -translate-x-1/2 z-55 flex items-center gap-3 bg-slate-900/95 text-white border border-slate-700/80 px-4 py-2 rounded-full shadow-2xl text-xs font-sans select-none backdrop-blur-md animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold">תצוגת מסך מלא פעילה</span>
          <span className="text-slate-500">|</span>
          <button
            onClick={toggleFullScreen}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all text-[11px] cursor-pointer"
          >
            יציאה ממסך מלא
          </button>
        </div>
      )}

      {/* Main Dashboard Canvas */}
      <main className={`transition-all duration-300 space-y-6 ${
        isFullScreen 
          ? "w-full max-w-full px-4 sm:px-6 py-6" 
          : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      }`}>
        
        {/* Welcome Section / Overview - Hidden in fullscreen mode */}
        {!isFullScreen && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className={`text-2xl font-extrabold tracking-tight transition-colors duration-300 ${
                darkMode ? "text-white" : "text-slate-900"
              }`}>
                לוח בקרה לוגיסטי
              </h2>
              <p className={`text-sm mt-1 transition-colors duration-300 ${
                darkMode ? "text-slate-400" : "text-gray-500"
              }`}>
                מעקב, סנכרון וניתוח נתוני שרשרת האספקה בזמן אמת
              </p>
            </div>

            <div className="flex items-center gap-3">
              {dataSource === "fallback" && (
                <div className="flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/25 px-3.5 py-2 rounded-xl text-xs font-semibold">
                  <AlertTriangle size={15} />
                  <span>שגיאה בטעינת Google Sheets. מציג נתוני סימולציה.</span>
                </div>
              )}
              
              <button
                onClick={() => {
                  setMapFocusedOrder(null);
                  setActiveView("map");
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                  darkMode
                    ? "bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white shadow-md"
                    : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 shadow-xs"
                }`}
                title="מעבר לתצוגת מפת משלוחים מלאה"
              >
                <Map size={14} className="stroke-[2.5px]" />
                <span>מפת הפצה ארצית 🗺️</span>
              </button>

              <button
                onClick={fetchOrders}
                disabled={isLoading}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white" 
                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-xs hover:shadow-sm"
                }`}
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                <span>רענון לוח בקרה</span>
              </button>

              {orders.some((o) => o && o.isSimulated) && (
                <button
                  onClick={deleteDummyOrders}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                    darkMode
                      ? "bg-rose-950/40 border-rose-900/45 text-rose-300 hover:bg-rose-900/30"
                      : "bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100 shadow-2xs"
                  }`}
                  title="מחק את כל הזמנות הדמה שאינן בגליון המקורי"
                >
                  <Trash2 size={14} />
                  <span>מחק הזמנות דמה 🗑️</span>
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading && orders.length === 0 ? (
          /* Loading State */
          <div className={`py-24 text-center border rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors duration-300 ${
            darkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200/40"
          }`}>
            <RefreshCw className="animate-spin text-indigo-500" size={36} />
            <span className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>מבצע סנכרון וטעינת נתונים...</span>
            <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>משיכת נתונים מרוחקים משרתי Google Sheets</p>
          </div>
        ) : (
          /* Dashboard Content Grid */
          <>
            {/* System Alerts / Notifications */}
            <Notifications
              orders={orders}
              onSelectOrder={(order) => setSelectedOrder(order)}
              darkMode={darkMode}
            />

            {/* 1. Key Performance Indicators (KPIs) */}
            <KPICards 
              stats={stats} 
              prevStats={prevStats} 
              darkMode={darkMode} 
              onCardClick={handleKpiCardClick}
              activeCardId={activeKpiFilter}
            />

            {/* 2. Visual Graphs (Recharts) */}
            <ChartsSection orders={orders} darkMode={darkMode} />

            {/* 3. Interactive Data Table (OrderTable) */}
            <OrderTable
              orders={orders}
              onSelectOrder={(order) => setSelectedOrder(order)}
              onViewOnMap={(order) => {
                setMapFocusedOrder(order);
                setActiveView("map");
              }}
              onRefresh={fetchOrders}
              isLoading={isLoading}
              darkMode={darkMode}
              onDeleteOrder={deleteOrder}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedWarehouse={selectedWarehouse}
              setSelectedWarehouse={setSelectedWarehouse}
              selectedSyncStatus={selectedSyncStatus}
              setSelectedSyncStatus={setSelectedSyncStatus}
              selectedWaStatus={selectedWaStatus}
              setSelectedWaStatus={setSelectedWaStatus}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              showDelayedOnly={showDelayedOnly}
              setShowDelayedOnly={setShowDelayedOnly}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              onClearKpiFilter={() => setActiveKpiFilter(null)}
            />
          </>
        )}
      </main>

      {/* 4. Full Detail Sidebar/Modal Overlay */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onViewOnMap={(order) => {
          setSelectedOrder(null);
          setMapFocusedOrder(order);
          setActiveView("map");
        }}
        onUpdateSyncStatus={updateOrderSyncStatus}
        darkMode={darkMode}
      />

      {/* Subtle Footer - Hidden in fullscreen mode */}
      {!isFullScreen && (
        <footer className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t mt-12 text-center text-xs transition-colors duration-300 ${
          darkMode ? "border-slate-900 text-slate-500" : "border-slate-200/50 text-slate-400"
        }`}>
          <p>© {new Date().getFullYear()} LogiTrack - מערכת לוגיסטית מנוהלת AI. כל הזכויות שמורות.</p>
          <p className="mt-1">ממשק Sleek Interface מתקדם המבוסס על נתוני זמן-אמת</p>
        </footer>
      )}

      {/* 5. Noa AI Chat Drawer and Fullscreen Popup */}
      <NoaChat
        orders={orders}
        stats={stats}
        darkMode={darkMode}
        isOpen={isNoaChatOpen}
        onClose={() => setIsNoaChatOpen(false)}
        onOpen={() => setIsNoaChatOpen(true)}
      />

      {/* Floating Real-time Toast Notifications Container */}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
        onActionClick={(orderId) => {
          const found = orders.find(o => o["מספר הזמנה"] === orderId);
          if (found) setSelectedOrder(found);
        }}
        darkMode={darkMode}
      />
    </div>
  );
}
