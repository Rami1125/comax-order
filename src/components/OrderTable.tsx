import { useState, useMemo, ChangeEvent, TouchEvent } from "react";
import { motion } from "motion/react";
import { Order } from "../types";
import { getCity, formatDate, parseItems, isOrderDelayed, getDelayHours, getWhatsAppUrl } from "../utils";
import { Search, Filter, RefreshCw, Eye, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Calendar, AlertTriangle, Clock, MapPin, Trash2, X, MessageSquare } from "lucide-react";

interface OrderTableProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onViewOnMap?: (order: Order) => void;
  onRefresh: () => void;
  isLoading: boolean;
  darkMode?: boolean;
  onDeleteOrder?: (orderId: string | number) => void;
  onUpdateSyncStatus?: (orderId: string | number, newStatus: string) => void;

  // Lifted filter states
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (wh: string) => void;
  selectedSyncStatus: string;
  setSelectedSyncStatus: (status: string) => void;
  selectedWaStatus: string;
  setSelectedWaStatus: (status: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  showDelayedOnly: boolean;
  setShowDelayedOnly: (val: boolean) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  onClearKpiFilter?: () => void;
}

export default function OrderTable({ 
  orders, 
  onSelectOrder, 
  onViewOnMap, 
  onRefresh, 
  isLoading, 
  darkMode = false, 
  onDeleteOrder,
  onUpdateSyncStatus,
  searchTerm,
  setSearchTerm,
  selectedWarehouse,
  setSelectedWarehouse,
  selectedSyncStatus,
  setSelectedSyncStatus,
  selectedWaStatus,
  setSelectedWaStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  showDelayedOnly,
  setShowDelayedOnly,
  currentPage,
  setCurrentPage,
  onClearKpiFilter
}: OrderTableProps) {
  const itemsPerPage = 8;

  // Swipe-to-Action states
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [activeSwipeOrderId, setActiveSwipeOrderId] = useState<string | number | null>(null);
  const [swipedOrderId, setSwipedOrderId] = useState<string | number | null>(null);

  const handleTouchStart = (e: TouchEvent, orderId: string | number) => {
    if (swipedOrderId && swipedOrderId !== orderId) {
      setSwipedOrderId(null);
    }
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setSwipeOffset(0);
    setActiveSwipeOrderId(orderId);
  };

  const handleTouchMove = (e: TouchEvent, orderId: string | number) => {
    if (touchStartX === null || touchStartY === null || activeSwipeOrderId !== orderId) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    // Primarily horizontal movement
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        // Dragging left (negative value)
        setSwipeOffset(Math.max(diffX, -150));
      } else {
        setSwipeOffset(0);
      }
    }
  };

  const handleTouchEnd = (orderId: string | number) => {
    if (activeSwipeOrderId === orderId) {
      if (swipeOffset < -50) {
        setSwipedOrderId(orderId);
      } else {
        setSwipedOrderId(null);
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setSwipeOffset(0);
    setActiveSwipeOrderId(null);
  };

  // Extract unique filters from actual data
  const warehouses = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o && o["מחסן"]) set.add(String(o["מחסן"]).trim());
    });
    return Array.from(set);
  }, [orders]);

  const waStatuses = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o && o["סטטוס ווצאפ"]) set.add(String(o["סטטוס ווצאפ"]).trim());
    });
    return Array.from(set);
  }, [orders]);

  // Reset page when filters or search change
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleWhFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedWarehouse(e.target.value);
    setCurrentPage(1);
  };

  const handleSyncFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSyncStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleWaFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedWaStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedWarehouse("all");
    setSelectedSyncStatus("all");
    setSelectedWaStatus("all");
    setStartDate("");
    setEndDate("");
    setShowDelayedOnly(false);
    if (onClearKpiFilter) onClearKpiFilter();
    setCurrentPage(1);
  };

  // Filter and Search Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order) return false;
      // Search
      const orderId = order["מספר הזמנה"] !== undefined && order["מספר הזמנה"] !== null ? String(order["מספר הזמנה"]) : "";
      const customerName = order["שם לקוח"] ? String(order["שם לקוח"]) : "";
      const address = order["כתובת אספקה"] ? String(order["כתובת אספקה"]) : "";
      const items = order["פריטים"] ? String(order["פריטים"]) : "";
      
      const searchStr = `${orderId} ${customerName} ${address} ${items}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());

      // Warehouse
      const warehouseStr = order["מחסן"] ? String(order["מחסן"]).trim() : "";
      const matchesWh = selectedWarehouse === "all" || warehouseStr === selectedWarehouse;

      // Sync
      let matchesSync = true;
      if (selectedSyncStatus !== "all") {
        const syncStatus = order["סטטוס סנכרון"];
        const isSynced = syncStatus && typeof syncStatus === "string" && (syncStatus.includes("סונכרן") || syncStatus.includes("✅"));
        matchesSync = selectedSyncStatus === "synced" ? !!isSynced : !isSynced;
      }

      // WhatsApp Model
      const waStatusStr = order["סטטוס ווצאפ"] ? String(order["סטטוס ווצאפ"]).trim() : "";
      const matchesWa = selectedWaStatus === "all" || waStatusStr === selectedWaStatus;

      // Date Range Filter
      let matchesDate = true;
      if (order["תאריך קליטה"]) {
        try {
          const orderDate = new Date(order["תאריך קליטה"]);
          if (!isNaN(orderDate.getTime())) {
            if (startDate) {
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              if (orderDate < start) matchesDate = false;
            }
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              if (orderDate > end) matchesDate = false;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Delayed Filter from KPI Card
      const matchesDelayed = !showDelayedOnly || isOrderDelayed(order);

      return matchesSearch && matchesWh && matchesSync && matchesWa && matchesDate && matchesDelayed;
    });
  }, [orders, searchTerm, selectedWarehouse, selectedSyncStatus, selectedWaStatus, startDate, endDate, showDelayedOnly]);

  // Paginated Data
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;

  // Compute totals for filtered orders (סה"כ)
  const totals = useMemo(() => {
    let syncedCount = 0;
    let totalItemsQuantity = 0;
    const uniqueWarehouses = new Set<string>();
    const uniqueCities = new Set<string>();

    filteredOrders.forEach(o => {
      // Synced check
      const isSynced = o["סטטוס סנכרון"] && (o["סטטוס סנכרון"].includes("סונכרן") || o["סטטוס סנכרון"].includes("✅"));
      if (isSynced) syncedCount++;

      // Items qty sum
      const parsed = parseItems(o["פריטים"]);
      parsed.forEach(item => {
        totalItemsQuantity += item.quantity;
      });

      // Warehouses
      if (o["מחסן"]) {
        uniqueWarehouses.add(o["מחסן"].trim());
      }

      // Cities
      const city = getCity(o["כתובת אספקה"]);
      if (city && city !== "לא ידוע") {
        uniqueCities.add(city);
      }
    });

    return {
      totalOrders: filteredOrders.length,
      syncedCount,
      totalItemsQuantity,
      uniqueWarehousesCount: uniqueWarehouses.size,
      uniqueCitiesCount: uniqueCities.size
    };
  }, [filteredOrders]);

  return (
    <div
      id="order-table-section"
      className={`border rounded-2xl p-5 shadow-sm mt-6 transition-colors duration-300 ${
        darkMode
          ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20"
          : "glass-panel border-slate-200/50 bg-white text-slate-800"
      }`}
    >
      {/* Header and Search Actions */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-5 ${
        darkMode ? "border-slate-800/80" : "border-slate-100"
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className={`font-semibold text-lg ${darkMode ? "text-slate-100" : "text-slate-850"}`}>רשימת הזמנות מלאה</h3>
            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              ⚡ Ctrl+K לחיפוש מהיר
            </span>
            <span className="inline-flex lg:hidden items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              📱 גרירה שמאלה לפעולות מהירות
            </span>
          </div>
          <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>ניהול, סינון ואיתור מהיר של הזמנות פעילות</p>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            id="reset-filters-btn"
            onClick={handleResetFilters}
            className={`text-xs transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg border ${
              darkMode
                ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-indigo-400"
                : "bg-white border-slate-200/60 text-gray-500 hover:text-indigo-600 shadow-xs"
            }`}
          >
            איפוס מסננים
          </button>
          
          <button
            id="refresh-data-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-2 border rounded-xl shadow-xs transition-all flex items-center gap-2 text-xs font-medium cursor-pointer ${
              darkMode
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-slate-800/50"
                : "bg-white border-slate-200/60 text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
            }`}
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>רענן נתונים</span>
          </button>
        </div>
      </div>

      {/* Filters Form */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6 p-3.5 rounded-xl border ${
        darkMode ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50/50 border-slate-100"
      }`}>
        {/* Search Input */}
        <div className="relative">
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>חיפוש חופשי</label>
          <div className="relative">
            <input
              id="search-input"
              type="text"
              placeholder="מספר הזמנה, שם לקוח, מוצר..."
              value={searchTerm}
              onChange={handleSearchChange}
              className={`w-full pl-3 pr-9 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all text-right ${
                darkMode ? "bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-200 text-slate-700"
              }`}
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Warehouse Filter */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>מחסן מנפק</label>
          <select
            id="warehouse-select"
            value={selectedWarehouse}
            onChange={handleWhFilterChange}
            className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all cursor-pointer ${
              darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <option value="all">כל המחסנים</option>
            {warehouses.map(wh => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
          </select>
        </div>

        {/* Sync Status Filter */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>סטטוס סנכרון</label>
          <select
            id="sync-status-select"
            value={selectedSyncStatus}
            onChange={handleSyncFilterChange}
            className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all cursor-pointer ${
              darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="synced">סונכרן בהצלחה ✅</option>
            <option value="pending">ממתין לסנכרון ⏳</option>
          </select>
        </div>

        {/* WhatsApp Model Filter */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>מודל בינה מלאכותית</label>
          <select
            id="wa-model-select"
            value={selectedWaStatus}
            onChange={handleWaFilterChange}
            className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all cursor-pointer ${
              darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <option value="all">כל המודלים</option>
            {waStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>תאריך התחלה</label>
          <div className="relative">
            <input
              id="start-date-input"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className={`w-full pl-3 pr-9 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all text-right cursor-pointer ${
                darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
              }`}
            />
            <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* End Date Filter */}
        <div>
          <label className={`block text-xs font-medium mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>תאריך סיום</label>
          <div className="relative">
            <input
              id="end-date-input"
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className={`w-full pl-3 pr-9 py-2 text-sm border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all text-right cursor-pointer ${
                darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
              }`}
            />
            <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Orders Table view */}
      <div className={`overflow-x-auto rounded-xl border transition-colors duration-300 ${
        darkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-white"
      }`}>
        <table className="w-full text-right border-collapse min-w-[800px]">
          <thead>
            <tr className={`border-b text-xs font-semibold transition-colors duration-300 ${
              darkMode 
                ? "border-slate-800 bg-slate-900/50 text-slate-400" 
                : "border-slate-100 bg-slate-50 text-slate-500"
            }`}>
              <th className="px-4 py-3.5">מספר הזמנה</th>
              <th className="px-4 py-3.5">תאריך קליטה</th>
              <th className="px-4 py-3.5">שם לקוח</th>
              <th className="px-4 py-3.5">מחסן</th>
              <th className="px-4 py-3.5">יעד (עיר)</th>
              <th className="px-4 py-3.5"> / AI מסקנות נועה</th>
              <th className="px-4 py-3.5 text-center">סטטוס סנכרון</th>
              <th className="px-4 py-3.5 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className={`divide-y text-sm transition-colors duration-300 ${
            darkMode ? "divide-slate-900 text-slate-300" : "divide-slate-50 text-slate-700"
          }`}>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-indigo-500" size={24} />
                    <span>טוען הזמנות משרת Google Sheets...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">
                  לא נמצאו הזמנות התואמות את החיפוש והסינונים שלך.
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order, idx) => {
                const city = getCity(order["כתובת אספקה"]);
                const isSynced = order["סטטוס סנכרון"] && (order["סטטוס סנכרון"].includes("סונכרן") || order["סטטוס סנכרון"].includes("✅"));
                const isDelayed = isOrderDelayed(order);
                const delayHours = getDelayHours(order);
                
                const rowBgClass = isDelayed
                  ? darkMode
                    ? "border-red-950/40 bg-red-950/15 hover:bg-red-950/25 text-red-200"
                    : "border-red-100 bg-red-50/45 hover:bg-red-100/50 text-red-900"
                  : darkMode 
                    ? "border-slate-900/40 hover:bg-slate-900/30 text-slate-300" 
                    : "border-slate-50 hover:bg-slate-50/70 text-slate-700";

                // Render Swipe-to-Action panel if this row is currently swiped
                if (swipedOrderId === order["מספר הזמנה"]) {
                  return (
                    <tr 
                      key={`${order["מספר הזמנה"]}-${idx}-swipe`}
                      className={`border-b transition-all duration-300 ${
                        darkMode ? "border-slate-800 bg-slate-900/90" : "border-indigo-100 bg-indigo-50/60"
                      }`}
                    >
                      <td colSpan={8} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          className="flex flex-wrap items-center justify-between px-4 py-3 gap-3 min-h-[58px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 font-mono text-[11px] font-semibold">
                              #{order["מספר הזמנה"]}
                            </span>
                            <span className={`text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>
                              פעולות מהירות עבור {order["שם לקוח"]}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Details Button */}
                            <button
                              onClick={() => {
                                onSelectOrder(order);
                                setSwipedOrderId(null);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                darkMode 
                                  ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700" 
                                  : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-xs"
                              }`}
                            >
                              <Eye size={13} />
                              <span>פרטי הזמנה</span>
                            </button>

                            {/* WhatsApp Button */}
                            <a
                              href={getWhatsAppUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setSwipedOrderId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                            >
                              <MessageSquare size={13} />
                              <span>וואטסאפ</span>
                            </a>

                            {/* Update status button */}
                            {onUpdateSyncStatus && (
                              <button
                                onClick={() => {
                                  onUpdateSyncStatus(order["מספר הזמנה"], "סונכרן בהצלחה ✅");
                                  setSwipedOrderId(null);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                              >
                                <CheckCircle2 size={13} />
                                <span>סנכרן ל-ERP ✅</span>
                              </button>
                            )}

                            {/* Close/Cancel Button */}
                            <button
                              onClick={() => setSwipedOrderId(null)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                darkMode
                                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}
                              title="סגור פעולות"
                            >
                              <X size={13} className="text-rose-500" />
                            </button>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  );
                }

                // Normal row styling
                const isCurrentActiveSwipe = activeSwipeOrderId === order["מספר הזמנה"];
                const inlineStyle = isCurrentActiveSwipe
                  ? { transform: `translateX(${swipeOffset}px)`, transition: "none" }
                  : { transition: "transform 0.25s ease-out" };

                return (
                  <tr
                    key={`${order["מספר הזמנה"]}-${idx}`}
                    onClick={() => onSelectOrder(order)}
                    onTouchStart={(e) => handleTouchStart(e, order["מספר הזמנה"])}
                    onTouchMove={(e) => handleTouchMove(e, order["מספר הזמנה"])}
                    onTouchEnd={() => handleTouchEnd(order["מספר הזמנה"])}
                    style={inlineStyle}
                    className={`transition-all cursor-pointer group border-b ${rowBgClass}`}
                  >
                    {/* Order ID */}
                    <td className={`px-4 py-3.5 font-mono text-xs font-semibold ${
                      isDelayed
                        ? "text-red-500 font-bold"
                        : darkMode ? "text-blue-400" : "text-slate-900"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {isDelayed && (
                          <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" />
                        )}
                        <span>#{order["מספר הזמנה"]}</span>
                      </div>
                    </td>
                    
                    {/* Date */}
                    <td className={`px-4 py-3.5 text-xs font-medium ${
                      isDelayed
                        ? darkMode ? "text-red-300/80" : "text-red-700/85"
                        : darkMode ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className={isDelayed ? "text-red-400" : "text-gray-400"} />
                        <span>{formatDate(order["תאריך קליטה"])}</span>
                      </div>
                    </td>
                    
                    {/* Customer Name */}
                    <td className={`px-4 py-3.5 font-medium ${
                      isDelayed
                        ? darkMode ? "text-red-200 font-semibold" : "text-red-950 font-semibold"
                        : darkMode ? "text-slate-200" : "text-slate-800"
                    }`}>
                      {order["שם לקוח"]}
                    </td>
                    
                    {/* Warehouse */}
                    <td className="px-4 py-3.5 text-xs">
                      <span className={`px-2.5 py-1 rounded-md font-medium border ${
                        isDelayed
                          ? darkMode 
                            ? "bg-red-950/50 text-red-200 border-red-900/50" 
                            : "bg-red-100/50 text-red-800 border-red-200/55"
                          : darkMode 
                            ? "bg-slate-900 text-slate-300 border-slate-800" 
                            : "bg-slate-100 text-slate-700 border-slate-200/40"
                      }`}>
                        {order["מחסן"]}
                      </span>
                    </td>
                    
                    {/* Delivery Destination */}
                    <td className={`px-4 py-3.5 text-xs font-medium ${
                      isDelayed
                        ? darkMode ? "text-red-300/90" : "text-red-800"
                        : darkMode ? "text-slate-300" : "text-slate-600"
                    }`}>
                      {city}
                    </td>
                    
                    {/* AI Model */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border font-mono ${
                        isDelayed
                          ? darkMode
                            ? "bg-red-950/30 text-red-300 border-red-900/40"
                            : "bg-red-50/50 text-red-700 border-red-150"
                          : darkMode 
                            ? "bg-blue-950/40 text-blue-300 border-blue-900/50" 
                            : "bg-blue-50 text-blue-600 border-blue-100"
                      }`}>
                        {order["סטטוס ווצאפ"] || "ללא מודל"}
                      </span>
                    </td>
                    
                    {/* Sync Status */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 size={12} className="stroke-[2.5px]" />
                            <span>סונכרן</span>
                          </span>
                        ) : isDelayed ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all duration-300 shadow-2xs ${
                            darkMode
                              ? "bg-red-950 text-red-300 border-red-900"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}>
                            <Clock size={12} className="animate-pulse" />
                            <span>חריגה ({delayHours} ש') ⏳</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <AlertCircle size={12} className="stroke-[2.5px]" />
                            <span>ממתין</span>
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-3.5 text-left">
                      <div className="flex items-center gap-1 justify-end">
                        {onViewOnMap && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewOnMap(order);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDelayed
                                ? darkMode
                                  ? "text-red-400 hover:text-red-200 hover:bg-red-950"
                                  : "text-red-500 hover:text-red-700 hover:bg-red-100"
                                : darkMode 
                                  ? "text-emerald-400 hover:text-emerald-200 hover:bg-slate-900" 
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            }`}
                            title="צפה במפת הפצה"
                          >
                            <MapPin size={15} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(order);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isDelayed
                              ? darkMode
                                ? "text-red-400 hover:text-red-200 hover:bg-red-950"
                                : "text-red-500 hover:text-red-700 hover:bg-red-100"
                              : darkMode 
                                ? "text-slate-400 hover:text-indigo-400 hover:bg-slate-900" 
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          }`}
                          title="צפה בפרטים"
                        >
                          <Eye size={15} />
                        </button>

                        {onDeleteOrder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`האם אתה בטוח שברצונך למחוק את הזמנה #${order["מספר הזמנה"]}?`)) {
                                onDeleteOrder(order["מספר הזמנה"]);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDelayed
                                ? darkMode
                                  ? "text-red-400 hover:text-red-200 hover:bg-red-950"
                                  : "text-red-500 hover:text-red-700 hover:bg-red-100"
                                : darkMode
                                  ? "text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                            title="מחק הזמנה"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Permanent Totals Row */}
          {!isLoading && filteredOrders.length > 0 && (
            <tfoot className={`border-t-2 font-semibold text-xs transition-colors duration-300 ${
              darkMode 
                ? "border-slate-800 bg-slate-900/80 text-slate-300" 
                : "border-slate-200 bg-slate-50/80 text-slate-800"
            }`}>
              <tr>
                <td className={`px-4 py-3.5 font-bold ${darkMode ? "text-blue-400" : "text-slate-950"}`}>
                  סה"כ הזמנות: {totals.totalOrders}
                </td>
                <td className="px-4 py-3.5 text-slate-400/60">-</td>
                <td className="px-4 py-3.5 text-slate-400/60">-</td>
                <td className="px-4 py-3.5">
                  <span className={`px-2 py-0.5 rounded ${darkMode ? "bg-slate-850 text-slate-300 border border-slate-800" : "bg-slate-200/60 text-slate-700"}`}>
                    {totals.uniqueWarehousesCount} מחסנים
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`px-2 py-0.5 rounded ${darkMode ? "bg-slate-850 text-slate-300 border border-slate-800" : "bg-slate-200/60 text-slate-700"}`}>
                    {totals.uniqueCitiesCount} ערים
                  </span>
                </td>
                <td className={`px-4 py-3.5 font-bold ${darkMode ? "text-indigo-400" : "text-indigo-700"}`}>
                  סה"כ פריטים: {totals.totalItemsQuantity}
                </td>
                <td className={`px-4 py-3.5 text-center font-bold ${darkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                  סונכרנו: {totals.syncedCount} / {totals.totalOrders}
                </td>
                <td className="px-4 py-3.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && filteredOrders.length > 0 && (
        <div className={`flex items-center justify-between mt-4 border-t pt-3.5 text-xs transition-colors duration-300 ${
          darkMode ? "border-slate-900 text-slate-400" : "border-slate-100 text-gray-500"
        }`}>
          <div>
            מציג <span className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{Math.min(filteredOrders.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredOrders.length, currentPage * itemsPerPage)}</span> מתוך <span className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{filteredOrders.length}</span> הזמנות
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                darkMode 
                  ? "border-slate-850 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900" 
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white"
              }`}
            >
              <ChevronRight size={14} />
            </button>
            
            <div className={`font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              עמוד {currentPage} מתוך {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                darkMode 
                  ? "border-slate-850 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900" 
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white"
              }`}
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
