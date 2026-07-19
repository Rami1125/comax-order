import { useState, useEffect, useMemo } from "react";
import { Order, DashboardStats } from "./types";
import { calculateStats, getDelayHours } from "./utils";
import KPICards from "./components/KPICards";
import ChartsSection from "./components/ChartsSection";
import OrderTable from "./components/OrderTable";
import OrderDetailModal from "./components/OrderDetailModal";
import Notifications from "./components/Notifications";
import LogisticsMap from "./components/LogisticsMap";
import ToastContainer, { Toast } from "./components/ToastContainer";
import { LayoutDashboard, ShieldCheck, Truck, RefreshCw, Layers, Clock, CheckCircle2, ChevronRight, MessageSquare, AlertTriangle, Sun, Moon, Maximize, Minimize, Map, Bell, BellOff } from "lucide-react";

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [prevStats, setPrevStats] = useState<DashboardStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"google_sheets" | "fallback" | null>(null);

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

  // Full Screen layout state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Active view layout: "dashboard" or "map"
  const [activeView, setActiveView] = useState<"dashboard" | "map">("dashboard");
  // Focused order for map initialization
  const [mapFocusedOrder, setMapFocusedOrder] = useState<Order | null>(null);

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

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

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

  // Simulating real-time order entries & critical status updates
  useEffect(() => {
    if (orders.length === 0) return;

    // Trigger initial notification info
    const initialTimer = setTimeout(() => {
      addToast({
        title: "מערכת ניטור פעילה 📡",
        message: "חיבור ערוצי לוגיסטיקה וסנכרון תקין. מאזין לעדכונים בזמן אמת.",
        type: "info",
        duration: 4000
      });
    }, 1500);

    const interval = setInterval(() => {
      const dice = Math.random();
      
      if (dice < 0.3) {
        // Trigger a simulated critical status update on a delayed/existing order
        const delayedOrders = orders.filter(o => {
          const sync = o["סטטוס סנכרון"] || "";
          return !sync.includes("סונכרן") && !sync.includes("✅");
        });
        const targetOrder = delayedOrders.length > 0 
          ? delayedOrders[Math.floor(Math.random() * delayedOrders.length)]
          : orders[Math.floor(Math.random() * orders.length)];
        
        const delayHours = getDelayHours(targetOrder);
        addToast({
          title: "עדכון סטטוס קריטי (עיכוב משלוח) ⚠️",
          message: `הזמנה #${targetOrder["מספר הזמנה"]} עבור הלקוח "${targetOrder["שם לקוח"]}" חרגה מזמן האספקה המאושר (${delayHours > 0 ? delayHours : 48} שעות עיכוב ביחס ליעד).`,
          type: "error",
          orderId: targetOrder["מספר הזמנה"],
          duration: 7500
        });
      } else if (dice < 0.65) {
        // Trigger a new simulated incoming order
        const names = [
          "אלקטרה מוצרי צריכה בע\"ם", 
          "רשת שופרסל קמעונאות", 
          "סופר-פארם קוסמטיקס", 
          "מחסני חשמל ודיגיטל", 
          "טרקלין חשמל צפון", 
          "פוקס קבוצת אופנה", 
          "רשת מרכולי יוחננוף"
        ];
        const cities = ["תל אביב", "חיפה", "באר שבע", "פתח תקווה", "ראשון לציון", "אשדוד", "נתניה"];
        const warehouses = ["מחסן מרכז", "מחסן צפון", "מחסן דרום (שפלה)"];
        
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        const randomWh = warehouses[Math.floor(Math.random() * warehouses.length)];
        const randomId = Math.floor(10000 + Math.random() * 90000);

        addToast({
          title: "הזמנה חדשה נקלטה במערכת 📦",
          message: `הזמנה חדשה #${randomId} התקבלה מלקוח "${randomName}" ליישוב אספקה ${randomCity}. מנופק ממחסן "${randomWh}".`,
          type: "success",
          duration: 6500
        });
      } else {
        // Trigger an ERP synchronization success update
        const unsyncedOrders = orders.filter(o => {
          const sync = o["סטטוס סנכרון"] || "";
          return !sync.includes("סונכרן") && !sync.includes("✅");
        });
        const targetOrder = unsyncedOrders.length > 0
          ? unsyncedOrders[Math.floor(Math.random() * unsyncedOrders.length)]
          : orders[Math.floor(Math.random() * orders.length)];

        addToast({
          title: "סנכרון ERP הושלם בהצלחה ✅",
          message: `הזמנה #${targetOrder["מספר הזמנה"]} של "${targetOrder["שם לקוח"]}" סונכרנה בהצלחה למערכות הליבה הארגוניות.`,
          type: "success",
          orderId: targetOrder["מספר הזמנה"],
          duration: 5500
        });
      }
    }, 25000); // simulation interval (every 25 seconds)

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [orders]);

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
      
      // Keep selectedOrder in sync
      if (selectedOrder && String(selectedOrder["מספר הזמנה"]) === String(orderId)) {
        const updatedSelected = updated.find(o => o && String(o["מספר הזמנה"]) === String(orderId));
        if (updatedSelected) {
          setSelectedOrder(updatedSelected);
        }
      }

      return updated;
    });

    addToast({
      title: "עדכון סטטוס סנכרון 🔄",
      message: `סטטוס הסנכרון של הזמנה #${orderId} עודכן ל- "${newStatus}".`,
      type: "success",
      duration: 4000
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
              <div className="p-2 bg-blue-500 text-white rounded-lg shadow-md">
                <Truck size={18} className="stroke-[2.5px]" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight leading-none text-white font-sans">LogiTrack</h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide block mt-1">מערכת בקרה וסנכרון הזמנות</span>
              </div>
            </div>

            {/* Dynamic Clock, Theme Toggle & Meta Info */}
            <div className="flex items-center gap-3 text-xs font-medium">
              {/* Status indicators */}
              <div className="hidden sm:flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
                {dataSource === "google_sheets" ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Google Sheets מחובר</span>
                  </div>
                ) : dataSource === "fallback" ? (
                  <div className="flex items-center gap-1.5 text-amber-400" title="פועל במצב לא מקוון עם נתוני גיבוי">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>מצב גיבוי מקומי</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>מתחבר...</span>
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
            <KPICards stats={stats} prevStats={prevStats} darkMode={darkMode} />

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
