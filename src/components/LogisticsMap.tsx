import { useState, useEffect, useRef, useMemo } from "react";
import { Order } from "../types";
import { getCity, getOrderCoordinates, isOrderDelayed, getDelayHours, formatDate } from "../utils";
import { 
  MapPin, 
  Search, 
  Compass, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  List, 
  X, 
  Map, 
  SlidersHorizontal,
  ChevronDown,
  Navigation,
  Info
} from "lucide-react";

interface LogisticsMapProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  darkMode?: boolean;
  fullScreenMode?: boolean;
  onBackToDashboard?: () => void;
  initialSelectedOrder?: Order | null;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function LogisticsMap({ 
  orders, 
  onSelectOrder, 
  darkMode = false,
  fullScreenMode = false,
  onBackToDashboard,
  initialSelectedOrder = null
}: LogisticsMapProps) {
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "synced" | "pending" | "delayed">("all");
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  
  // Mobile UI/UX States
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const mapRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const mapContainerId = fullScreenMode ? "logistics-map-fullscreen-canvas" : "logistics-map-canvas";

  // 1. Resolve coordinates and status for all orders
  const mapPoints = useMemo(() => {
    return orders
      .map(order => {
        if (!order) return null;
        const coords = getOrderCoordinates(order);
        const city = getCity(String(order["כתובת אספקה"] || ""));
        const syncStatus = order["סטטוס סנכרון"];
        const isSynced = syncStatus && typeof syncStatus === "string" && (syncStatus.includes("סונכרן") || syncStatus.includes("✅"));
        const isDelayed = isOrderDelayed(order);
        
        let status: "synced" | "delayed" | "pending" = "pending";
        if (isSynced) status = "synced";
        else if (isDelayed) status = "delayed";

        return {
          order,
          coords,
          city,
          status,
          id: Number(order["מספר הזמנה"] || 0),
          customerName: String(order["שם לקוח"] || ""),
          warehouse: String(order["מחסן"] || "לא שויך")
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null && p.coords !== null); // Only keep points with coordinates
  }, [orders]);

  // 2. Filter map points based on search query and status filter
  const filteredPoints = useMemo(() => {
    return mapPoints.filter(p => {
      const matchesSearch = 
        p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.id).includes(searchQuery) ||
        p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.warehouse.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "synced" && p.status === "synced") ||
        (statusFilter === "pending" && p.status === "pending") ||
        (statusFilter === "delayed" && p.status === "delayed");

      return matchesSearch && matchesStatus;
    });
  }, [mapPoints, searchQuery, statusFilter]);

  // 3. Dynamically load Leaflet resources if not already loaded
  useEffect(() => {
    if (window.L) {
      setIsLeafletLoaded(true);
      return;
    }

    // Insert Leaflet CSS
    const cssId = "leaflet-cdn-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Insert Leaflet JS
    const jsId = "leaflet-cdn-js";
    let script = document.getElementById(jsId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = jsId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const handleScriptLoad = () => {
      setIsLeafletLoaded(true);
    };

    script.addEventListener("load", handleScriptLoad);

    return () => {
      script.removeEventListener("load", handleScriptLoad);
    };
  }, []);

  // 4. Quick navigation to target coordinates
  const zoomToPoint = (lat: number, lng: number, id: number) => {
    if (!mapRef.current) return;
    setSelectedPinId(id);
    mapRef.current.setView([lat, lng], 13, { animate: true });
    
    // Find and open popup dynamically if markers exist
    if (markersGroupRef.current) {
      markersGroupRef.current.eachLayer((layer: any) => {
        if (layer.getLatLng && layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) {
          layer.openPopup();
        }
      });
    }
  };

  // Preset region zoomers
  const zoomToRegion = (region: "all" | "north" | "center" | "south") => {
    if (!mapRef.current) return;
    if (region === "all") {
      mapRef.current.setView([31.85, 34.85], 8);
    } else if (region === "north") {
      mapRef.current.setView([32.85, 35.15], 10);
    } else if (region === "center") {
      mapRef.current.setView([32.08, 34.85], 11);
    } else if (region === "south") {
      mapRef.current.setView([31.25, 34.79], 10);
    }
  };

  // 5. Initialize and update the Leaflet map markers
  useEffect(() => {
    if (!isLeafletLoaded || !window.L || !document.getElementById(mapContainerId)) return;

    const L = window.L;

    // Clean up previous instance only if it exists and container matches
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Create Map centered in Israel
    const map = L.map(mapContainerId, {
      zoomControl: false,
      scrollWheelZoom: true,
      maxZoom: 18,
      minZoom: 7
    }).setView([31.85, 34.85], 8);

    mapRef.current = map;

    // Choose map tile theme
    const tileUrl = darkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    const attribution = darkMode
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 20
    }).addTo(map);

    // Create markers layer group
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Define custom icon generators
    const getPinIcon = (status: "synced" | "delayed" | "pending", isSelected: boolean) => {
      let ringColor = "bg-blue-500/30";
      let dotColor = "bg-blue-500";
      let pulseClass = "";

      if (status === "synced") {
        ringColor = "bg-emerald-500/30";
        dotColor = "bg-emerald-500";
      } else if (status === "delayed") {
        ringColor = "bg-red-500/40";
        dotColor = "bg-red-600";
        pulseClass = "animate-ping";
      } else if (status === "pending") {
        ringColor = "bg-amber-500/40";
        dotColor = "bg-amber-500";
      }

      const size = isSelected ? "w-10 h-10" : "w-8 h-8";
      const dotSize = isSelected ? "h-4 w-4" : "h-3 w-3";
      const borderClass = isSelected ? "border-2 border-white scale-125 z-50 shadow-lg" : "border border-white";

      return L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="relative flex items-center justify-center ${size} transition-transform duration-300">
            <span class="absolute inline-flex h-full w-full rounded-full ${ringColor} ${pulseClass} opacity-75"></span>
            <span class="relative inline-flex rounded-full ${dotSize} ${dotColor} ${borderClass} shadow-xs"></span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    };

    const getWarehouseIcon = (name: string) => {
      return L.divIcon({
        className: "custom-leaflet-warehouse",
        html: `
          <div class="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white border-2 border-slate-950 rounded-lg shadow-md transform hover:scale-110 transition-transform" title="${name}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 21v-4a3 3 0 0 1 6 0v4M4 10l8-7 8 7"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    };

    // Plot key warehouses with dynamic live statistics computed from current orders
    const warehouses = [
      { name: "מחסן מרכז", coords: [32.0840, 34.8878] as [number, number], address: "אזור התעשייה חולון, מחוז מרכז" },
      { name: "מחסן צפון", coords: [32.7940, 34.9896] as [number, number], address: "פארק תעשיות נשר, חיפה והצפון" },
      { name: "מחסן דרום (שפלה)", coords: [31.8928, 34.8113] as [number, number], address: "אזור תעשייה רג\"מ, רחובות והדרום" }
    ];

    warehouses.forEach(wh => {
      // Calculate dynamic stats for this warehouse based on mapPoints
      const whOrders = mapPoints.filter(p => p.warehouse === wh.name);
      const total = whOrders.length;
      const synced = whOrders.filter(p => p.status === "synced").length;
      const delayed = whOrders.filter(p => p.status === "delayed").length;
      const pending = total - synced - delayed;

      L.marker(wh.coords, { icon: getWarehouseIcon(wh.name) })
        .addTo(markersGroup)
        .bindPopup(`
          <div class="text-right font-sans p-2 min-w-[210px] text-xs leading-relaxed" dir="rtl">
            <div class="font-extrabold text-indigo-700 dark:text-indigo-400 text-sm flex items-center gap-1.5 justify-start mb-1">
              <span>🏭 ${wh.name}</span>
            </div>
            <p class="text-[10px] text-slate-500 mb-2 border-b pb-1 dark:text-slate-400">${wh.address}</p>
            <div class="space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
              <div class="flex justify-between items-center"><span class="text-slate-500">סה"כ הזמנות לניפוק:</span> <strong class="text-slate-900 dark:text-slate-100 font-mono">${total}</strong></div>
              <div class="flex justify-between items-center text-emerald-600 dark:text-emerald-400"><span class="text-slate-500">סונכרנו ל-ERP:</span> <strong>${synced}</strong></div>
              <div class="flex justify-between items-center text-amber-600 dark:text-amber-400"><span class="text-slate-500">ממתינות לסנכרון:</span> <strong>${pending}</strong></div>
              <div class="flex justify-between items-center text-red-600 dark:text-red-400"><span class="text-slate-500">בעיכוב אספקה:</span> <strong class="font-mono">${delayed}</strong></div>
            </div>
            <div class="mt-2 text-[9px] text-indigo-500 bg-indigo-500/5 px-2 py-0.5 rounded text-center">מרכז הפצה פעיל - ניפוק ישיר</div>
          </div>
        `);
    });

    // Plot orders with high-fidelity, beautifully formatted popups
    filteredPoints.forEach(p => {
      if (!p.coords) return;
      
      const isSelected = p.id === selectedPinId;
      const marker = L.marker([p.coords.lat, p.coords.lng], {
        icon: getPinIcon(p.status, isSelected)
      }).addTo(markersGroup);

      // Create a premium custom popup
      const popupContent = document.createElement("div");
      popupContent.dir = "rtl";
      popupContent.className = "text-right font-sans text-xs p-1.5 min-w-[220px]";
      
      let statusBadge = "";
      if (p.status === "synced") {
        statusBadge = '<span class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-emerald-200/50">סונכרן ל-ERP ✅</span>';
      } else if (p.status === "delayed") {
        statusBadge = `<span class="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-red-200/50 animate-pulse">עיכוב (${getDelayHours(p.order)} ש') ⚠️</span>`;
      } else {
        statusBadge = '<span class="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-amber-200/50">ממתין לסנכרון ⏳</span>';
      }

      const dateStr = formatDate(p.order["תאריך קליטה"]);
      const fullAddress = p.order["כתובת אספקה"] || "לא צוין יעד";
      const routeCheck = p.order["אימות מסלול הובלה"] || "טרם בוצע";

      popupContent.innerHTML = `
        <div class="font-mono text-[9px] text-indigo-500 font-extrabold mb-1 font-sans">מזהה הזמנה: #${p.id}</div>
        <div class="font-bold text-slate-950 dark:text-slate-100 text-sm mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">${p.customerName}</div>
        <div class="space-y-1.5 mb-3 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
          <div><strong class="text-slate-400">עיר אספקה:</strong> <span class="text-slate-800 dark:text-slate-200">${p.city}</span></div>
          <div><strong class="text-slate-400">יעד מדויק:</strong> <span class="text-slate-800 dark:text-slate-200 font-medium">${fullAddress}</span></div>
          <div><strong class="text-slate-400">תאריך קבלה:</strong> <span class="text-slate-800 dark:text-slate-200 font-mono">${dateStr}</span></div>
          <div><strong class="text-slate-400">מחסן שולח:</strong> <span class="text-slate-800 dark:text-slate-200">${p.warehouse}</span></div>
          <div><strong class="text-slate-400">אימות מסלול:</strong> <span class="text-slate-800 dark:text-slate-200">${routeCheck}</span></div>
          <div class="flex items-center gap-1.5 mt-2"><strong>סטטוס:</strong> ${statusBadge}</div>
        </div>
        <button id="popup-btn-${p.id}" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-xl text-center block cursor-pointer transition-all duration-300 text-[11px] shadow-sm hover:shadow-md border border-indigo-500/10 font-sans">
          פתח פרטי הזמנה מלאים ←
        </button>
      `;

      marker.bindPopup(popupContent);

      // Set up click handler for the popup button
      marker.on("popupopen", () => {
        setSelectedPinId(p.id);
        const btn = document.getElementById(`popup-btn-${p.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectOrder(p.order);
          };
        }
      });
    });

    // Auto-fit bounds if we have filtered markers to show
    const validCoords = filteredPoints
      .map(p => p.coords)
      .filter((c): c is { lat: number; lng: number } => c !== null);

    // Zoom/Bounds behavior
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isLeafletLoaded, filteredPoints, darkMode, selectedPinId, mapContainerId]);

  // 6. Handle focus on dynamic initial selected order when map launches
  useEffect(() => {
    if (!isLeafletLoaded || !mapRef.current || !initialSelectedOrder) return;
    
    const targetId = initialSelectedOrder["מספר הזמנה"];
    const foundPoint = mapPoints.find(p => p.id === targetId);
    if (foundPoint && foundPoint.coords) {
      const timer = setTimeout(() => {
        zoomToPoint(foundPoint.coords.lat, foundPoint.coords.lng, foundPoint.id);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLeafletLoaded, initialSelectedOrder, mapPoints]);

  // Destination sidebar block (reused for desktop grid or mobile sheet)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="relative mb-3">
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
          <Search size={14} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חפש לקוח, יישוב או מחסן..."
          className={`w-full pr-9 pl-3 py-2 text-xs rounded-xl border transition-all ${
            darkMode
              ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500/50 outline-hidden"
              : "bg-white border-slate-200 text-slate-800 placeholder-gray-400 focus:border-indigo-500 outline-hidden"
          }`}
        />
      </div>

      {/* Status filtering tabs */}
      <div className="flex gap-1 mb-3 border-b pb-2 border-slate-200/45 dark:border-slate-800/60 overflow-x-auto select-none">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all ${
            statusFilter === "all"
              ? darkMode ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-850"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          הכל ({mapPoints.length})
        </button>
        <button
          onClick={() => setStatusFilter("synced")}
          className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1 ${
            statusFilter === "synced"
              ? "bg-emerald-500/15 text-emerald-500"
              : "text-slate-400 hover:text-emerald-500"
          }`}
        >
          <CheckCircle2 size={10} />
          סונכרן
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1 ${
            statusFilter === "pending"
              ? "bg-amber-500/15 text-amber-500"
              : "text-slate-400 hover:text-amber-500"
          }`}
        >
          <Clock size={10} />
          ממתין
        </button>
        <button
          onClick={() => setStatusFilter("delayed")}
          className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1 ${
            statusFilter === "delayed"
              ? "bg-red-500/15 text-red-500"
              : "text-slate-400 hover:text-red-500"
          }`}
        >
          <AlertCircle size={10} />
          בעיכוב
        </button>
      </div>

      {/* Scrollable list items */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-0.5 custom-scrollbar pb-6">
        {filteredPoints.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 font-medium">
            לא נמצאו תוצאות התואמות לסינון.
          </div>
        ) : (
          filteredPoints.map((p, idx) => {
            let statusColor = "bg-amber-500";
            if (p.status === "synced") statusColor = "bg-emerald-500";
            else if (p.status === "delayed") statusColor = "bg-red-500 animate-pulse";

            const isSelected = p.id === selectedPinId;

            return (
              <div
                key={`${p.id}-${idx}`}
                onClick={() => {
                  if (p.coords) {
                    zoomToPoint(p.coords.lat, p.coords.lng, p.id);
                    // On mobile, auto-close the drawer when selecting an order to let them see the map
                    if (window.innerWidth < 1024) {
                      setShowMobileDrawer(false);
                    }
                  }
                }}
                className={`p-3 rounded-xl border text-right cursor-pointer transition-all transform hover:-translate-y-0.5 hover:shadow-xs ${
                  isSelected
                    ? darkMode
                      ? "bg-indigo-950/45 border-indigo-500 text-white ring-1 ring-indigo-500/30"
                      : "bg-indigo-50/70 border-indigo-250 text-indigo-950 ring-1 ring-indigo-500/10"
                    : darkMode
                      ? "bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/50 text-slate-200"
                      : "bg-white border-slate-100 hover:bg-slate-50/85 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                    <span className="font-mono text-[10px] font-bold">#{p.id}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                    p.status === "synced"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : p.status === "delayed"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-amber-500/10 text-amber-500"
                  }`}>
                    {p.status === "synced" ? "סונכרן" : p.status === "delayed" ? "עיכוב" : "ממתין"}
                  </span>
                </div>

                <div className="font-bold text-xs truncate mb-1">{p.customerName}</div>
                
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="text-slate-500" />
                    <span className="truncate max-w-[100px]">{p.city}</span>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded text-[9px]">מחסן: {p.warehouse}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // --- FULL SCREEN PAGE LAYOUT ---
  if (fullScreenMode) {
    return (
      <div 
        id="fullscreen-map-page" 
        className={`w-full h-full flex flex-col font-sans select-none relative overflow-hidden ${
          darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-800"
        }`}
        dir="rtl"
      >
        {/* Full-screen topbar */}
        <header className={`px-4 py-3 border-b flex items-center justify-between z-30 shadow-md backdrop-blur-md shrink-0 ${
          darkMode ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white/95 border-slate-100 text-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 font-bold text-xs ${
                  darkMode
                    ? "bg-slate-950 hover:bg-slate-800 border-slate-850 text-slate-300 hover:text-white"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                }`}
                title="חזרה ללוח הבקרה"
              >
                <ArrowRight size={15} />
                <span>חזרה ללוח הבקרה</span>
              </button>
            )}
            
            <div className="hidden md:block">
              <h1 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                <span>מערך הפצה ארצי - SabanOS</span>
                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md font-mono text-[10px] font-bold">
                  {mapPoints.length} יעדים פעילים
                </span>
              </h1>
            </div>
          </div>

          {/* Quick region selectors */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 hidden sm:inline ml-1">מיקוד אזור:</span>
            <button
              onClick={() => zoomToRegion("all")}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                darkMode ? "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              ארצי
            </button>
            <button
              onClick={() => zoomToRegion("north")}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                darkMode ? "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              צפון
            </button>
            <button
              onClick={() => zoomToRegion("center")}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                darkMode ? "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              מרכז
            </button>
            <button
              onClick={() => zoomToRegion("south")}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                darkMode ? "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              דרום
            </button>
          </div>
        </header>

        {/* Full-screen content layout */}
        <div className="flex-1 w-full relative flex overflow-hidden">
          {/* DESKTOP SIDEBAR (Visible on lg+) */}
          <aside className={`hidden lg:flex flex-col w-80 shrink-0 p-4 border-l h-full overflow-hidden transition-colors ${
            darkMode ? "border-slate-800 bg-[#0c111d]" : "border-slate-100 bg-slate-50/30"
          }`}>
            {renderSidebarContent()}
          </aside>

          {/* MAP CANVAS (Takes rest of screen on desktop, and 100% on mobile) */}
          <main className="flex-1 h-full w-full relative z-10">
            {!isLeafletLoaded ? (
              <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${
                darkMode ? "bg-slate-950 text-slate-400" : "bg-slate-100 text-slate-500"
              }`}>
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-xs font-bold">טוען ממשק מפות לווין מתקדם...</span>
              </div>
            ) : (
              <div id={mapContainerId} className="w-full h-full" />
            )}

            {/* FLOATING INSTRUCTIONS / LEGEND */}
            <div className={`absolute bottom-4 right-4 z-20 px-3 py-2 rounded-2xl text-[10px] shadow-lg border backdrop-blur-md select-none transition-all ${
              darkMode ? "bg-slate-950/90 border-slate-850 text-slate-300" : "bg-white/95 border-slate-200 text-slate-700"
            }`}>
              <div className="font-extrabold mb-1.5 border-b pb-1 border-slate-750/30 dark:border-slate-800/60">מקרא סימונים:</div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>הזמנה מסונכרנת בהצלחה</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>הזמנה בממתין (טרם סונכרנה)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span>עיכוב קריטי (מעל 48 שעות)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-indigo-600 text-white rounded flex items-center justify-center text-[8px] font-bold">🏠</div>
                  <span>מרכז הפצה / מחסן מנפק</span>
                </div>
              </div>
            </div>

            {/* MOBILE FLOATING TRIGGER (Visible on < lg) */}
            <div className="absolute bottom-4 left-4 z-20 lg:hidden flex flex-col gap-2">
              <button
                onClick={() => setShowMobileDrawer(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-indigo-400/20 transition-all transform hover:scale-105 active:scale-95"
              >
                <List size={14} />
                <span>הצג {filteredPoints.length} משלוחים</span>
              </button>
            </div>
          </main>

          {/* MOBILE SLIDE-UP DRAWER (Visible on < lg) */}
          {showMobileDrawer && (
            <div className="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden animate-fade-in" onClick={() => setShowMobileDrawer(false)}>
              <div 
                className={`absolute bottom-0 inset-x-0 max-h-[80vh] rounded-t-3xl p-5 border-t shadow-2xl flex flex-col z-50 transform transition-transform duration-300 animate-slide-up ${
                  darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer handle / drag notch */}
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
                
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                    <span>רשימת משלוחים ויעדי הפצה</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
                      {filteredPoints.length} תוצאות
                    </span>
                  </h3>
                  
                  <button 
                    onClick={() => setShowMobileDrawer(false)}
                    className={`p-1.5 rounded-lg ${
                      darkMode ? "bg-slate-850 hover:bg-slate-800 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                    }`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Main scrollable body */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {renderSidebarContent()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- EMBEDDED WIDGET LAYOUT (Standard dashboard widget) ---
  return (
    <div
      id="logistics-map-widget"
      className={`border rounded-2xl overflow-hidden transition-all duration-300 shadow-xs flex flex-col ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/60"
      }`}
    >
      {/* Widget Header */}
      <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        darkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-100 bg-slate-50/40"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${darkMode ? "bg-slate-800 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
            <Compass size={18} className="animate-spin-slow" />
          </div>
          <div>
            <h3 className={`font-bold text-sm ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
              מפת הפצה ומיקומי משלוח
            </h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
              ניתוח פריסה גאוגרפית של {mapPoints.length} נקודות הפצה פעילות
            </p>
          </div>
        </div>

        {/* Region controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => zoomToRegion("all")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
              darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            כל הארץ
          </button>
          <button
            onClick={() => zoomToRegion("north")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
              darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            צפון
          </button>
          <button
            onClick={() => zoomToRegion("center")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
              darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            מרכז
          </button>
          <button
            onClick={() => zoomToRegion("south")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
              darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            דרום
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 h-[450px]">
        {/* Sidebar Destination List */}
        <div className={`p-4 border-l flex flex-col h-full overflow-hidden ${
          darkMode ? "border-slate-800 bg-[#0c111d]" : "border-slate-100 bg-slate-50/20"
        }`}>
          {renderSidebarContent()}
        </div>

        {/* Map Container */}
        <div className="col-span-2 relative h-full w-full">
          {!isLeafletLoaded ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${
              darkMode ? "bg-slate-950/40 text-slate-400" : "bg-slate-100/40 text-slate-500"
            }`}>
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold">טוען מפות לוגיסטיות...</span>
            </div>
          ) : (
            <div id={mapContainerId} className="w-full h-full z-10" />
          )}

          {/* Floating Instructions/Legend */}
          <div className={`absolute bottom-3 right-3 z-20 px-3 py-2 rounded-xl text-[10px] shadow-md border ${
            darkMode ? "bg-slate-950/90 border-slate-800 text-slate-300" : "bg-white/95 border-slate-200 text-slate-700"
          }`}>
            <div className="font-bold mb-1.5 border-b pb-1 border-slate-700/20">מקרא סימונים:</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>הזמנה מסונכרנת בהצלחה</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>הזמנה בממתין (טרם סונכרנה)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span>עיכוב קריטי (מעל 48 שעות)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 bg-indigo-600 text-white rounded flex items-center justify-center text-[8px] font-bold">🏠</div>
                <span>מרכז הפצה / מחסן מנפק</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
