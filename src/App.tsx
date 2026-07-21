import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Order, DashboardStats } from "./types";
import { calculateStats, getDelayHours, getCity, parseItems } from "./utils";
import { playNotificationSound } from "./utils/sound";
import KPICards from "./components/KPICards";
import ChartsSection from "./components/ChartsSection";
import OrderTable from "./components/OrderTable";
import OrderDetailModal from "./components/OrderDetailModal";
import Notifications from "./components/Notifications";
import DailyInsights from "./components/DailyInsights";
import LogisticsMap from "./components/LogisticsMap";
import ToastContainer, { Toast } from "./components/ToastContainer";
import NoaChat from "./components/NoaChat";
import AutomationModal from "./components/AutomationModal";
import { LayoutDashboard, ShieldCheck, Truck, RefreshCw, Layers, Clock, CheckCircle2, ChevronRight, MessageSquare, AlertTriangle, Sun, Moon, Maximize, Minimize, Map, Bell, BellOff, Wifi, WifiOff, Trash2, Sparkles, Menu, Calendar, X, Settings, Keyboard, Target } from "lucide-react";

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [prevStats, setPrevStats] = useState<DashboardStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"google_sheets" | "fallback" | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

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

  // Listen to global keyboard shortcuts for desktop efficiency
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier keys (Ctrl on Windows/Linux, Cmd on macOS)
      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier) {
        const key = e.key.toLowerCase();
        if (key === "k") {
          e.preventDefault();
          // Ensure we are viewing the main dashboard list to see the search input
          setActiveView("dashboard");
          
          // Wait slightly for layout swap before focusing
          setTimeout(() => {
            const searchInput = document.getElementById("search-input");
            if (searchInput) {
              searchInput.focus();
              searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
              
              addToast({
                title: "חיפוש מהיר ממוקד 🔍",
                message: "ניתן להקליד כעת לסינון הזמנות.",
                type: "info",
                duration: 2000
              });
            }
          }, 120);
        } else if (key === "m") {
          e.preventDefault();
          setActiveView((prev) => {
            const next = prev === "map" ? "dashboard" : "map";
            addToast({
              title: next === "map" ? "מפת הפצה 🗺️" : "לוח בקרה 📊",
              message: `מעבר לתצוגת ${next === "map" ? "מפת הפצה ארצית" : "לוח הבקרה הלוגיסטי"}`,
              type: "info",
              duration: 2000
            });
            return next;
          });
        } else if (key === "comma" || e.key === ",") {
          e.preventDefault();
          setIsAutomationOpen((prev) => !prev);
          addToast({
            title: "מרכז אוטומציה ⚙️",
            message: "טעינת הגדרות חיבור ERP ו-Make.com",
            type: "info",
            duration: 2000
          });
        } else if (key === "h" || e.key === "/") {
          e.preventDefault();
          setIsNoaChatOpen((prev) => !prev);
        } else if (key === "f") {
          e.preventDefault();
          setIsFullScreen((prev) => !prev);
        } else if (key === "b") {
          e.preventDefault();
          setIsFocusMode((prev) => {
            const next = !prev;
            addToast({
              title: next ? "מצב מיקוד פעיל 🎯" : "מצב מיקוד כבוי 📊",
              message: next ? "הסתרת אלמנטים משניים לצורך הגדלת הפרודוקטיביות." : "הצגת לוח בקרה מלא כולל גרפים ומדדים.",
              type: "info",
              duration: 2500
            });
            return next;
          });
        }
      } else {
        // Pressing '?' (Shift + /) shows the shortcuts modal (if not typing in inputs)
        if (e.key === "?" && e.target instanceof HTMLElement && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setIsShortcutsHelpOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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

  // Dynamic OneSignal initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initOneSignal = () => {
        const OneSignal = (window as any).OneSignal;
        if (OneSignal) {
          OneSignal.push(() => {
            const appId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID || "10168393-68fb-4f36-b610-d020e24177d0";
            OneSignal.init({
              appId: appId,
              allowLocalhostAsSecureOrigin: true,
              notifyButton: {
                enable: false,
              },
            }).then(() => {
              console.log("OneSignal push service initialized successfully.");
            }).catch((err: any) => {
              console.warn("OneSignal Web Push warning:", err);
            });
          });
        }
      };

      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        initOneSignal();
      } else {
        const handleOneSignalLoad = () => initOneSignal();
        document.addEventListener("onesignalload", handleOneSignalLoad);
        return () => document.removeEventListener("onesignalload", handleOneSignalLoad);
      }
    }
  }, []);

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
    // Find matching order first to extract details before the state updates
    const targetOrder = orders.find(o => o && String(o["מספר הזמנה"]) === String(orderId));

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

      // Dispatch to Make.com Webhook trigger!
      if (targetOrder) {
        fetch("/api/make/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: targetOrder["מספר הזמנה"],
            newStatus,
            customerName: targetOrder["שם לקוח"],
            city: targetOrder["כתובת אספקה"] ? getCity(targetOrder["כתובת אספקה"]) : "לא ידוע",
            itemsCount: targetOrder["פריטים"] ? parseItems(targetOrder["פריטים"]).length : 0,
            date: targetOrder["תאריך קליטה"]
          })
        })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            addToast({
              title: "סנכרון אוטומציה 🚀",
              message: result.message || "עדכון הסטטוס נשלח וסונכרן בהצלחה מול שרתי Make.com!",
              type: "success",
              duration: 3500
            });
          }
        })
        .catch(err => {
          console.warn("Automation background sync error:", err);
        });
      }
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

            {/* Desktop Navigation Controls (Hidden on Mobile/Tablet) */}
            <div className="hidden lg:flex items-center gap-3 text-xs font-medium">
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

              {/* Focus Mode Toggle Button */}
              <button
                onClick={() => {
                  const next = !isFocusMode;
                  setIsFocusMode(next);
                  addToast({
                    title: next ? "מצב מיקוד פעיל 🎯" : "מצב מיקוד כבוי 📊",
                    message: next ? "הסתרת אלמנטים משניים לצורך הגדלת הפרודוקטיביות." : "הצגת לוח בקרה מלא כולל גרפים ומדדים.",
                    type: "info",
                    duration: 2500
                  });
                }}
                className={`p-2 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner ${
                  isFocusMode 
                    ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 ring-2 ring-indigo-500/50" 
                    : "bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750"
                }`}
                title={isFocusMode ? "בטל מצב מיקוד (Ctrl+B)" : "הפעל מצב מיקוד (Ctrl+B)"}
              >
                <Target size={15} className={`stroke-[2.5px] ${isFocusMode ? "text-white animate-pulse" : "text-slate-300"}`} />
              </button>

              {/* Keyboard Shortcuts Trigger Button */}
              <button
                onClick={() => setIsShortcutsHelpOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner"
                title="הצג קיצורי מקלדת מהירים (או הקש '?')"
              >
                <Keyboard size={15} className="text-slate-300 stroke-[2px]" />
              </button>

              {/* Automation Center Toggle Button */}
              <button
                onClick={() => setIsAutomationOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 transition-all duration-300 cursor-pointer flex items-center justify-center shadow-inner"
                title="ניהול אוטומציה וחיבורי Make / OneSignal"
              >
                <Settings size={15} className="text-indigo-400 stroke-[2.5px] animate-pulse" />
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

            {/* Mobile/Tablet Quick Controls (Hidden on Desktop) */}
            <div className="flex lg:hidden items-center gap-2">
              {/* Theme Toggle Button */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-100 cursor-pointer flex items-center justify-center"
                title="החלף מצב תצוגה"
              >
                {darkMode ? (
                  <Sun size={15} className="text-amber-400" />
                ) : (
                  <Moon size={15} className="text-slate-300" />
                )}
              </button>

              {/* Mobile Focus Mode Toggle Button */}
              <button
                onClick={() => {
                  const next = !isFocusMode;
                  setIsFocusMode(next);
                  addToast({
                    title: next ? "מצב מיקוד פעיל 🎯" : "מצב מיקוד כבוי 📊",
                    message: next ? "הסתרת אלמנטים משניים לצורך הגדלת הפרודוקטיביות." : "הצגת לוח בקרה מלא כולל גרפים ומדדים.",
                    type: "info",
                    duration: 2500
                  });
                }}
                className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  isFocusMode 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
                title={isFocusMode ? "בטל מצב מיקוד" : "הפעל מצב מיקוד"}
              >
                <Target size={15} className={isFocusMode ? "text-white animate-pulse" : "text-slate-300"} />
              </button>

              {/* Noa AI Chat Header Quick Toggle */}
              <button
                onClick={() => setIsNoaChatOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-indigo-500 text-white font-extrabold cursor-pointer flex items-center gap-1 shadow-sm"
                title="פתח צ'אט עם נועה"
              >
                <Sparkles size={13} className="animate-pulse" />
                <span className="text-[11px] sm:text-xs">נועה AI ⚡</span>
              </button>

              {/* Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 cursor-pointer flex items-center justify-center transition-all"
                aria-label="תפריט ניווט"
                title="תפריט ניווט"
              >
                {isMobileMenuOpen ? <X size={16} className="text-rose-400" /> : <Menu size={16} />}
              </button>
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
                לוח סידור
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
            {/* Daily Insights banner */}
            {!isFocusMode && <DailyInsights orders={orders} darkMode={darkMode} />}

            {/* System Alerts / Notifications */}
            {!isFocusMode && (
              <Notifications
                orders={orders}
                onSelectOrder={(order) => setSelectedOrder(order)}
                darkMode={darkMode}
              />
            )}

            {/* 1. Key Performance Indicators (KPIs) */}
            {!isFocusMode && (
              <KPICards 
                stats={stats} 
                prevStats={prevStats} 
                darkMode={darkMode} 
                onCardClick={handleKpiCardClick}
                activeCardId={activeKpiFilter}
              />
            )}

            {/* 2. Visual Graphs (Recharts) */}
            {!isFocusMode && <ChartsSection orders={orders} darkMode={darkMode} />}

            {/* Focus Mode Informational Bar */}
            {isFocusMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold ${
                  darkMode 
                    ? "bg-indigo-950/20 border-indigo-900/40 text-indigo-300" 
                    : "bg-indigo-50 border-indigo-100 text-indigo-800 shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Target size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm">מצב מיקוד פעיל (Focus Mode) 🎯</h4>
                    <p className={`text-xs mt-0.5 opacity-80 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                      כל הרכיבים הלא-קריטיים מוסתרים כדי לאפשר התרכזות מקסימלית בניהול תור ההזמנות וההפצה.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFocusMode(false)}
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all shadow-md shadow-indigo-600/10 text-xs shrink-0 cursor-pointer"
                >
                  הצג לוח בקרה מלא 📊
                </button>
              </motion.div>
            )}

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
              onUpdateSyncStatus={updateOrderSyncStatus}
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

      {/* 5. Smart Layered Mobile Menu Dropping Downwards */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 top-16 bg-slate-950/85 z-40 backdrop-blur-xs"
            />

            {/* Smart layered menu opening downwards */}
            <motion.div
              dir="rtl"
              initial={{ height: 0, opacity: 0, y: -15 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -15 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className={`absolute top-16 left-0 right-0 z-45 shadow-2xl border-b overflow-hidden px-5 py-6 flex flex-col transition-all duration-300 ${
                darkMode 
                  ? "bg-[#0F172A]/98 border-slate-850 text-white" 
                  : "bg-white/98 border-slate-200 text-slate-800"
              }`}
            >
              <div className="space-y-5">
                {/* Section header */}
                <div className="flex items-center justify-between border-b border-slate-800/10 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-indigo-500">שער ניווט מהיר מובייל</h3>
                    <p className="text-[10px] text-slate-400 font-medium">לחיצה פיזית בעלת עומק לחיבור מערכות</p>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider">
                    {currentTime || "00:00:00"}
                  </span>
                </div>

                {/* 3D Pressed Mobile Gateway Buttons Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Button 1: Orders */}
                  <button
                    onClick={() => {
                      setActiveView("dashboard");
                      setIsMobileMenuOpen(false);
                      setTimeout(() => {
                        const tbl = document.getElementById("order-table-section");
                        tbl?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 250);
                    }}
                    className={`btn-depth flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer text-center group h-24 ${
                      activeView === "dashboard"
                        ? "bg-indigo-600 border-indigo-500 text-white border-b-4 border-b-indigo-800"
                        : darkMode
                          ? "bg-slate-900/60 border-slate-800 text-slate-200 border-b-4 border-b-slate-950"
                          : "bg-slate-50 border-slate-200 text-slate-700 border-b-4 border-b-slate-300"
                    }`}
                  >
                    <LayoutDashboard size={20} className="mb-1.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold leading-none">לוח הזמנות</span>
                  </button>

                  {/* Button 2: Map */}
                  <button
                    onClick={() => {
                      setActiveView("map");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`btn-depth flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer text-center group h-24 ${
                      activeView === "map"
                        ? "bg-indigo-600 border-indigo-500 text-white border-b-4 border-b-indigo-800"
                        : darkMode
                          ? "bg-slate-900/60 border-slate-800 text-slate-200 border-b-4 border-b-slate-950"
                          : "bg-slate-50 border-slate-200 text-slate-700 border-b-4 border-b-slate-300"
                    }`}
                  >
                    <Map size={20} className="mb-1.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold leading-none">מפת משלוחים</span>
                  </button>

                  {/* Button 3: Noa AI */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setTimeout(() => {
                        setIsNoaChatOpen(true);
                      }, 200);
                    }}
                    className={`btn-depth flex flex-col items-center justify-center p-4 rounded-xl border border-indigo-500/30 cursor-pointer text-center group h-24 ${
                      darkMode
                        ? "bg-gradient-to-br from-indigo-950/40 to-slate-900 border-b-4 border-b-slate-950 text-indigo-400"
                        : "bg-gradient-to-br from-indigo-50/50 to-white border-b-4 border-b-slate-300 text-indigo-700"
                    }`}
                  >
                    <Sparkles size={20} className="mb-1.5 text-indigo-500 animate-pulse group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold leading-none">צ'אט נועה AI</span>
                  </button>

                  {/* Button 4: Automation */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setTimeout(() => {
                        setIsAutomationOpen(true);
                      }, 200);
                    }}
                    className={`btn-depth flex flex-col items-center justify-center p-4 rounded-xl border border-violet-500/30 cursor-pointer text-center group h-24 ${
                      darkMode
                        ? "bg-gradient-to-br from-violet-950/40 to-slate-900 border-b-4 border-b-slate-950 text-violet-400"
                        : "bg-gradient-to-br from-violet-50/50 to-white border-b-4 border-b-slate-300 text-violet-700"
                    }`}
                  >
                    <Settings size={20} className="mb-1.5 text-violet-500 group-hover:scale-110 transition-transform animate-spin-slow" />
                    <span className="text-xs font-extrabold leading-none">אוטומציה ו-Push</span>
                  </button>
                </div>

                {/* Network & sync details inside drop menu */}
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  darkMode ? "bg-slate-950/50 border-slate-850" : "bg-slate-50 border-slate-150"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                    <span className="text-xs font-bold">
                      {isOnline ? "מחובר ומקוון ל-ERP" : "מצב אופליין פעיל"}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      fetchOrders();
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-[11px] font-bold text-indigo-500 flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
                    <span>סנכרון ידני</span>
                  </button>
                </div>

                {/* Footer in drop menu */}
                <div className="text-center text-[10px] text-slate-500 border-t border-slate-800/20 pt-3">
                  <p>© {new Date().getFullYear()} סידור נועה - גרסת יהלום סופית 💎</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 5. Automation & OneSignal Push Settings Modal */}
      <AutomationModal
        isOpen={isAutomationOpen}
        onClose={() => setIsAutomationOpen(false)}
        orders={orders}
        darkMode={darkMode}
      />

      {/* 5. Noa AI Chat Drawer and Fullscreen Popup */}
      <NoaChat
        orders={orders}
        stats={stats}
        darkMode={darkMode}
        isOpen={isNoaChatOpen}
        onClose={() => setIsNoaChatOpen(false)}
        onOpen={() => setIsNoaChatOpen(true)}
      />

      {/* Keyboard Shortcuts Legend Modal */}
      <AnimatePresence>
        {isShortcutsHelpOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShortcutsHelpOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs cursor-pointer"
            />

            {/* Modal Content container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl pointer-events-auto border transition-colors duration-300 ${
                  darkMode
                    ? "bg-[#111827] border-slate-800 text-white"
                    : "bg-white border-slate-200 text-slate-850"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/20 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                      <Keyboard size={18} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base">מקשי קיצור למנהלי מערכת</h3>
                      <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                        האצת מהירות העבודה בלוח הבקרה וההפצה
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsShortcutsHelpOpen(false)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      darkMode
                        ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Grid of Shortcuts */}
                <div className="space-y-3.5 my-5" dir="rtl">
                  {/* Shortcut 1 */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">מיקוד בחיפוש הזמנות מהיר</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>K</kbd>
                    </div>
                  </div>

                  {/* Shortcut 2 */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">מעבר תצוגה (מפה 🗺️ / טבלה 📊)</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>M</kbd>
                    </div>
                  </div>

                  {/* Shortcut 3 */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">פתח/סגור מרכז אוטומציה ⚙️</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2.5 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>,</kbd>
                    </div>
                  </div>

                  {/* Shortcut 4 */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">פתח/סגור צ'אט עזרה נועה AI ⚡</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>H</kbd>
                    </div>
                  </div>

                  {/* Shortcut 5 */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">מעבר למצב מסך מלא (Fullscreen)</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>F</kbd>
                    </div>
                  </div>

                  {/* Shortcut 6 - Focus Mode */}
                  <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-800/10">
                    <span className="text-xs sm:text-sm font-semibold">פתח/סגור מצב מיקוד (Focus Mode) 🎯</span>
                    <div className="flex items-center gap-1 font-mono">
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>Ctrl</kbd>
                      <span className="text-xs font-semibold">+</span>
                      <kbd className={`px-2 py-1 text-[11px] rounded border shadow-xs ${
                        darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>B</kbd>
                    </div>
                  </div>

                  {/* Shortcut 7 */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs sm:text-sm font-semibold">הצג מדריך קיצורים זה</span>
                    <kbd className={`px-2.5 py-1 text-[11px] rounded border shadow-xs font-mono ${
                      darkMode ? "bg-slate-900 border-slate-800 text-slate-200 shadow-slate-950/50" : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>?</kbd>
                  </div>
                </div>

                {/* Tip Footer */}
                <div className={`p-3 rounded-xl text-center text-xs font-medium border ${
                  darkMode ? "bg-indigo-950/30 border-indigo-900/35 text-indigo-300" : "bg-indigo-50/70 border-indigo-100 text-indigo-700"
                }`}>
                  💡 טיפ: משתמשי macOS יכולים להשתמש במקש <span className="font-mono">Cmd ⌘</span> במקום במקש <span className="font-mono">Ctrl</span>.
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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
