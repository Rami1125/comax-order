import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Order } from "../types";
import { getCity, parseItems } from "../utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from "recharts";
import { 
  Map, 
  Warehouse, 
  MessageSquare, 
  TrendingUp, 
  Brain, 
  Sparkles, 
  X, 
  Search, 
  Calendar, 
  MapPin, 
  User, 
  ChevronLeft, 
  Copy, 
  Check, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ArrowUpRight
} from "lucide-react";

interface ChartsSectionProps {
  orders: Order[];
  darkMode?: boolean;
}

export default function ChartsSection({ orders, darkMode = false }: ChartsSectionProps) {
  const [selectedConclusion, setSelectedConclusion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState<number | null>(null);

  const stats = useMemo(() => {
    let analyzedCount = 0;
    let approvedCount = 0;
    let warningCount = 0;

    orders.forEach((o) => {
      const conclusion = o["מסקנות נועה AI"] || "";
      const trimmed = conclusion.trim();
      if (trimmed) {
        analyzedCount++;
        const lowerConclusion = trimmed.toLowerCase();
        if (
          lowerConclusion.includes("תקין") || 
          lowerConclusion.includes("מאושר") || 
          lowerConclusion.includes("בדרך") || 
          lowerConclusion.includes("סונכרן")
        ) {
          approvedCount++;
        } else if (
          lowerConclusion.includes("חוסר") || 
          lowerConclusion.includes("בעיה") || 
          lowerConclusion.includes("עיכוב") || 
          lowerConclusion.includes("בוטל") ||
          lowerConclusion.includes("נדרש") ||
          lowerConclusion.includes("אזהרה")
        ) {
          warningCount++;
        }
      }
    });

    return {
      analyzedCount,
      approvedCount,
      warningCount,
      pendingCount: orders.length - approvedCount - warningCount,
    };
  }, [orders]);

  // --- Prepare 30 Days Line Chart Data ---
  const last30DaysData = useMemo(() => {
    const data = [];
    let baseDate = new Date();
    
    // Anchor to the latest order's date if it exists and is valid, so the chart is never empty in demo/static environments
    let latestOrderTime = 0;
    orders.forEach((o) => {
      const dateStr = o["תאריך קליטה"];
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime()) && d.getTime() > latestOrderTime) {
            latestOrderTime = d.getTime();
          }
        } catch (e) {
          // ignore
        }
      }
    });
    
    if (latestOrderTime > 0) {
      baseDate = new Date(latestOrderTime);
    }
    
    // Map order dates to a format for lookup
    const orderDateMap: Record<string, number> = {};
    orders.forEach((o) => {
      const dateStr = o["תאריך קליטה"];
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            orderDateMap[dateKey] = (orderDateMap[dateKey] || 0) + 1;
          }
        } catch (e) {
          // ignore
        }
      }
    });

    // Generate last 30 days chronologically
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const formattedLabel = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      data.push({
        date: formattedLabel,
        fullDate: d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }),
        count: orderDateMap[dateKey] || 0,
      });
    }
    return data;
  }, [orders]);

  // --- Prepare Top Cities Data ---
  const cityCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const city = getCity(o["כתובת אספקה"]);
    if (city && city !== "לא ידוע") {
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
  });

  const cityData = Object.entries(cityCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // --- Prepare Warehouse Data ---
  const warehouseCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const wh = o["מחסן"] ? o["מחסן"].trim() : "אחר";
    warehouseCounts[wh] = (warehouseCounts[wh] || 0) + 1;
  });

  const warehouseData = Object.entries(warehouseCounts).map(([name, value]) => ({
    name,
    value
  }));

  // --- Prepare Warehouse Inventory & Real-Time Utilization Data ---
  const warehouseUtilizationData = useMemo(() => {
    const capacities: Record<string, number> = {
      "מחסן מרכז": 180,
      "מחסן צפון": 120,
      "מחסן דרום (שפלה)": 100,
      "אחר": 80,
    };

    const dispatchedVolumes: Record<string, number> = {
      "מחסן מרכז": 0,
      "מחסן צפון": 0,
      "מחסן דרום (שפלה)": 0,
      "אחר": 0,
    };

    const orderCounts: Record<string, number> = {
      "מחסן מרכז": 0,
      "מחסן צפון": 0,
      "מחסן דרום (שפלה)": 0,
      "אחר": 0,
    };

    orders.forEach((o) => {
      let wh = o["מחסן"] ? o["מחסן"].trim() : "אחר";
      if (!capacities[wh]) {
        const matched = Object.keys(capacities).find(key => wh.includes(key) || key.includes(wh));
        wh = matched || "אחר";
      }

      const parsed = parseItems(o["פריטים"]);
      const qtySum = parsed.reduce((sum, item) => sum + (item.quantity || 1), 0);
      
      dispatchedVolumes[wh] = (dispatchedVolumes[wh] || 0) + qtySum;
      orderCounts[wh] = (orderCounts[wh] || 0) + 1;
    });

    return Object.keys(capacities).map((wh) => {
      const volume = dispatchedVolumes[wh] || 0;
      const capacity = capacities[wh];
      const utilizationPercent = Math.min(100, Math.round((volume / capacity) * 100));
      return {
        name: wh,
        volume,
        capacity,
        utilization: utilizationPercent,
        ordersCount: orderCounts[wh] || 0,
      };
    });
  }, [orders]);

  // --- Prepare Noa AI Conclusions Stats ---
  const noaCounts: Record<string, number> = {};
  orders.forEach((o) => {
    let conclusion = o["מסקנות נועה AI"] ? o["מסקנות נועה AI"].trim() : "";
    if (!conclusion) {
      conclusion = "טרם נותח / ללא מסקנה";
    }
    noaCounts[conclusion] = (noaCounts[conclusion] || 0) + 1;
  });

  const noaData = Object.entries(noaCounts).map(([name, value]) => ({
    name,
    value
  }));

  // Matching orders for the selected conclusion in the popup
  const matchingOrders = useMemo(() => {
    if (!selectedConclusion) return [];
    return orders.filter((o) => {
      let conclusion = o["מסקנות נועה AI"] ? o["מסקנות נועה AI"].trim() : "";
      if (!conclusion) {
        conclusion = "טרם נותח / ללא מסקנה";
      }
      return conclusion === selectedConclusion;
    });
  }, [orders, selectedConclusion]);

  // Search filtered matching orders
  const filteredMatchingOrders = useMemo(() => {
    if (!searchQuery.trim()) return matchingOrders;
    const query = searchQuery.toLowerCase().trim();
    return matchingOrders.filter((o) => {
      return (
        o["שם לקוח"]?.toLowerCase().includes(query) ||
        o["מספר הזמנה"]?.toString().includes(query) ||
        o["מחסן"]?.toLowerCase().includes(query) ||
        getCity(o["כתובת אספקה"])?.toLowerCase().includes(query)
      );
    });
  }, [matchingOrders, searchQuery]);

  // --- Prepare Timeline/Trend Data (by day) ---
  const timelineCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const dateStr = o["תאריך קליטה"];
    if (dateStr) {
      try {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
          // Format as DD/MM
          const formatted = `${String(dateObj.getDate()).padStart(2, "0")}/${String(
            dateObj.getMonth() + 1
          ).padStart(2, "0")}`;
          timelineCounts[formatted] = (timelineCounts[formatted] || 0) + 1;
        }
      } catch (e) {
        // skip
      }
    }
  });

  // Sort timeline keys chronologically
  const sortedTimeline = Object.entries(timelineCounts)
    .map(([date, count]) => ({ date, count }))
    .reverse(); // Reverse if they are sorted from latest to earliest

  // Colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
  const WH_COLORS = ["#1e3a8a", "#0284c7", "#3b82f6", "#60a5fa"];

  return (
    <div id="charts-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-6">
      {/* 30 Days Line Chart (Full Width) */}
      <div
        id="thirty-days-chart-panel"
        className={`lg:col-span-2 rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20"
            : "glass-panel border-slate-200/50 bg-white text-slate-800"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-indigo-950/50 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>מגמת הזמנות יומית - 30 ימים אחרונים</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>ניתוח עומסי עבודה וצפי לוגיסטי</p>
          </div>
        </div>

        <div className="h-80 w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30DaysData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1f2937" : "#f1f5f9"} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }} 
                axisLine={false} 
                tickLine={false}
                interval={1}
              />
              <YAxis tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: darkMode ? "#1e293b" : "#ffffff",
                  border: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  color: darkMode ? "#fff" : "#0f172a",
                  fontSize: "12px",
                  direction: "rtl",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value: any) => [`${value} הזמנות`, "נפח יומי"]}
                labelFormatter={(label: string, items: any[]) => {
                  if (items && items[0]) {
                    return items[0].payload.fullDate;
                  }
                  return label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 3, stroke: "#6366f1", strokeWidth: 2, fill: darkMode ? "#111827" : "#fff" }}
                activeDot={{ r: 6, stroke: "#4f46e5", strokeWidth: 2, fill: "#818cf8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 1. Bar Chart: Top Cities */}
      <div
        id="city-chart-panel"
        className={`rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20"
            : "glass-panel border-slate-200/50 bg-white text-slate-800"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-blue-950/50 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
            <Map size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>התפלגות הזמנות לפי ערים (טופ 7)</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>הערים עם נפח המשלוחים הגבוה ביותר</p>
          </div>
        </div>

        <div className="h-72 w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cityData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1f2937" : "#f1f5f9"} />
              <XAxis dataKey="name" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                  direction: "rtl"
                }}
              />
              <Bar dataKey="count" fill="url(#colorCount)" radius={[4, 4, 0, 0]} barSize={36}>
                {cityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.5} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Timeline Trend Chart */}
      <div
        id="trend-chart-panel"
        className={`rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20"
            : "glass-panel border-slate-200/50 bg-white text-slate-800"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-indigo-950/50 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>מגמת הזמנות לאורך זמן</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>קצב קליטת הזמנות יומי</p>
          </div>
        </div>

        <div className="h-72 w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sortedTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1f2937" : "#f1f5f9"} />
              <XAxis dataKey="date" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                  direction: "rtl"
                }}
              />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Pie Chart: Warehouse Distribution */}
      <div
        id="wh-chart-panel"
        className={`rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20"
            : "glass-panel border-slate-200/50 bg-white text-slate-800"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-emerald-950/50 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
            <Warehouse size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>התפלגות מחסני הפצה</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>מקור ניפוק הסחורה</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-56 w-full flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={warehouseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {warehouseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={WH_COLORS[index % WH_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    direction: "rtl"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {warehouseData.map((item, idx) => {
              const percentage = ((item.value / orders.length) * 100).toFixed(1);
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-md"
                      style={{ backgroundColor: WH_COLORS[idx % WH_COLORS.length] }}
                    />
                    <span className={`font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{item.name}</span>
                  </div>
                  <div className={`flex gap-2 font-mono text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    <span className="font-semibold">{item.value}</span>
                    <span className={`${darkMode ? "text-slate-500" : "text-gray-400"}`}>({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Column Chart: Noa AI Conclusions Distribution */}
      <div
        id="noa-ai-chart-panel"
        className={`rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 shadow-slate-950/20 text-white bg-gradient-to-br from-slate-950 to-[#111827]"
            : "glass-panel border-slate-200/50 bg-white text-slate-800 bg-gradient-to-br from-white to-violet-50/10"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-violet-950/50 text-violet-400" : "bg-violet-100 text-violet-700"}`}>
            <Brain size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>ניתוח מסקנות נועה AI</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>התפלגות מסקנות מנוע הפיקדונומטר (עמודה K)</p>
          </div>
        </div>

        {/* Smart Stats Row */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            darkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50/60 border-slate-100"
          }`}>
            <span className={`block text-[10px] md:text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"}`}>סה"כ נותחו</span>
            <span className="block text-base font-bold text-indigo-500 mt-0.5">{stats.analyzedCount}</span>
          </div>
          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            darkMode ? "bg-emerald-950/20 border-emerald-900/30" : "bg-emerald-50/40 border-emerald-100"
          }`}>
            <span className={`block text-[10px] md:text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"}`}>מאושר / תקין</span>
            <span className="block text-base font-bold text-emerald-500 mt-0.5">{stats.approvedCount}</span>
          </div>
          <div className={`p-2.5 rounded-xl border text-center transition-all ${
            darkMode ? "bg-amber-950/20 border-amber-900/30" : "bg-amber-50/40 border-amber-100"
          }`}>
            <span className={`block text-[10px] md:text-xs font-medium ${darkMode ? "text-slate-400" : "text-gray-500"}`}>דורש טיפול / חריג</span>
            <span className="block text-base font-bold text-amber-500 mt-0.5">{stats.warningCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-56 w-full flex justify-center relative">
            {/* Prompt indicator inside chart center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-[10px] font-bold ${darkMode ? "text-slate-400" : "text-gray-400"}`}>לחץ על פלח</span>
              <span className={`text-xs font-extrabold text-violet-500`}>לפירוט</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={noaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  style={{ cursor: "pointer" }}
                >
                  {noaData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[(index + 4) % COLORS.length]} 
                      onClick={() => setSelectedConclusion(entry.name)}
                      className="hover:opacity-85 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    direction: "rtl"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {noaData.map((item, idx) => {
              const percentage = ((item.value / orders.length) * 100).toFixed(1);
              const color = COLORS[(idx + 4) % COLORS.length];
              return (
                <button
                  key={item.name}
                  onClick={() => setSelectedConclusion(item.name)}
                  className={`w-full text-right flex flex-col gap-1 p-2 rounded-xl border transition-all hover:translate-x-[-2px] active:scale-98 cursor-pointer ${
                    darkMode 
                      ? "bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700" 
                      : "bg-slate-50/60 border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-150"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <div
                        className="w-3 rounded-full h-3 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className={`font-medium truncate text-xs ${darkMode ? "text-slate-200" : "text-slate-700"}`} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`flex gap-1 font-mono text-[11px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="font-bold text-indigo-500">{item.value}</span>
                        <span className={`${darkMode ? "text-slate-500" : "text-gray-400"}`}>({percentage}%)</span>
                      </div>
                      <ChevronLeft size={12} className="text-slate-400/80" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Noa AI Conclusions POPUP Detail Modal */}
      <AnimatePresence>
        {selectedConclusion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedConclusion(null);
                setSearchQuery("");
              }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className={`relative w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col text-right direction-rtl ${
                darkMode
                  ? "bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/80"
                  : "bg-white border-slate-100 text-slate-800 shadow-xl"
              }`}
            >
              {/* Header Gradient Accent */}
              <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-l from-violet-500 via-indigo-500 to-cyan-500" />

              {/* Close Button & Header */}
              <div className={`p-4 flex items-start justify-between border-b mt-1.5 ${
                darkMode ? "border-slate-800" : "border-slate-100"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    darkMode ? "bg-violet-950/50 text-violet-400" : "bg-violet-50 text-violet-700"
                  }`}>
                    <Brain size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <span>פירוט הזמנות לפי קטגוריה</span>
                    </h3>
                    <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                      קטגוריה: <span className="text-violet-500 font-bold">{selectedConclusion}</span> ({matchingOrders.length} הזמנות)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedConclusion(null);
                    setSearchQuery("");
                  }}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    darkMode
                      ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                      : "bg-slate-50 border-slate-200/60 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Filter Search Input */}
              {matchingOrders.length > 2 && (
                <div className={`px-4 py-2 border-b flex items-center gap-2 ${
                  darkMode ? "bg-slate-950/20 border-slate-850" : "bg-slate-50/50 border-slate-100"
                }`}>
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חיפוש לפי לקוח, עיר, מספר הזמנה או מחסן..."
                    className={`w-full bg-transparent text-xs border-0 focus:ring-0 outline-hidden font-medium ${
                      darkMode ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-gray-400"
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      נקה
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable List of orders */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {filteredMatchingOrders.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-medium text-xs">
                    לא נמצאו הזמנות התואמות את החיפוש בתוך קטגוריה זו.
                  </div>
                ) : (
                  filteredMatchingOrders.map((o) => {
                    const oId = o["מספר הזמנה"];
                    const isCopied = copiedOrderId === oId;
                    const dateStr = o["תאריך קליטה"] ? new Date(o["תאריך קליטה"]).toLocaleDateString("he-IL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : "";
                    
                    return (
                      <div
                        key={oId}
                        className={`p-3.5 rounded-xl border transition-all text-right ${
                          darkMode
                            ? "bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80"
                            : "bg-slate-50/40 border-slate-150 hover:bg-slate-50"
                        }`}
                      >
                        {/* Order Meta Header */}
                        <div className="flex items-center justify-between mb-2.5 border-b pb-2 border-dashed border-slate-800/10 dark:border-slate-800/40">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-md font-mono text-[11px] font-bold">
                              #{oId}
                            </span>
                            <span className={`text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                              {o["שם לקוח"]}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                            {dateStr}
                          </span>
                        </div>

                        {/* Order details grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className={`font-medium text-[11px] ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                              יעד: {getCity(o["כתובת אספקה"])}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Warehouse size={12} className="text-slate-400 shrink-0" />
                            <span className={`font-medium text-[11px] ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                              מחסן: {o["מחסן"]}
                            </span>
                          </div>
                        </div>

                        {/* Order Conclusion text */}
                        <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                          darkMode ? "bg-slate-900/60 border-slate-850 text-slate-200" : "bg-white border-slate-100 text-slate-700"
                        }`}>
                          <Sparkles size={13} className="text-violet-500 mt-0.5 shrink-0" />
                          <div className="flex-1 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                            {o["מסקנות נועה AI"] || "לא קיימת מסקנה מפורטת עבור הזמנה זו במערכת."}
                          </div>
                        </div>

                        {/* Action buttons inside item */}
                        <div className="flex justify-end gap-2 mt-2.5">
                          <button
                            onClick={async () => {
                              const summaryText = `הזמנה #${oId} - ${o["שם לקוח"]}\nמסקנות נועה AI: ${o["מסקנות נועה AI"] || "אין"}`;
                              try {
                                await navigator.clipboard.writeText(summaryText);
                                setCopiedOrderId(oId);
                                setTimeout(() => setCopiedOrderId(null), 2000);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                              isCopied
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : darkMode
                                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check size={11} />
                                <span>הועתק!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>העתק סיכום</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-3 border-t flex items-center justify-between text-xs ${
                darkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
              }`}>
                <span className={`${darkMode ? "text-slate-400" : "text-slate-500"} font-medium`}>
                  הצגת {filteredMatchingOrders.length} מתוך {matchingOrders.length} הזמנות בקטגוריה
                </span>
                <button
                  onClick={() => {
                    setSelectedConclusion(null);
                    setSearchQuery("");
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  סגור
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Real-Time Warehouse Inventory & Utilization */}
      <div
        id="warehouse-utilization-chart-panel"
        className={`lg:col-span-2 rounded-2xl p-5 shadow-xs border transition-colors duration-300 ${
          darkMode
            ? "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 shadow-slate-950/20 text-white"
            : "glass-panel border-slate-200/50 bg-white text-slate-800"
        }`}
      >
        <div className={`flex items-center gap-2.5 mb-5 border-b pb-3 ${darkMode ? "border-slate-800/80" : "border-slate-100"}`}>
          <div className={`p-2 rounded-lg ${darkMode ? "bg-cyan-950/50 text-cyan-400" : "bg-cyan-50 text-cyan-600"}`}>
            <Warehouse size={18} />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>ניצולת מחסנים ומלאי בזמן אמת</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>ניתוח נפח ההזמנות המנופקות (יחידות פריט) מול קיבולת שירות מקסימלית</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Detailed Progress Bars */}
          <div className="lg:col-span-1 space-y-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>סטטוס ניצולת שוטף</h4>
            <div className="space-y-3.5">
              {warehouseUtilizationData.map((item, idx) => {
                const colors = [
                  { text: "text-blue-500", bg: "bg-blue-500", track: "bg-blue-500/10" },
                  { text: "text-emerald-500", bg: "bg-emerald-500", track: "bg-emerald-500/10" },
                  { text: "text-amber-500", bg: "bg-amber-500", track: "bg-amber-500/10" },
                  { text: "text-indigo-500", bg: "bg-indigo-500", track: "bg-indigo-500/10" },
                ];
                const clr = colors[idx % colors.length];
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={darkMode ? "text-slate-200" : "text-slate-700"}>{item.name}</span>
                      <span className={`font-mono font-semibold ${clr.text}`}>{item.utilization}% ({item.volume}/{item.capacity} יח')</span>
                    </div>
                    <div className={`h-2 w-full rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${clr.bg}`}
                        style={{ width: `${item.utilization}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>{item.ordersCount} הזמנות פעילות</span>
                      <span>קיבולת: {item.capacity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Graphical Comparison Bar Chart */}
          <div className="lg:col-span-2 h-64 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={warehouseUtilizationData}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={darkMode ? "#1f2937" : "#f1f5f9"} />
                <XAxis type="number" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    direction: "rtl"
                  }}
                  formatter={(value: any, name: any) => {
                    const label = name === "volume" ? "נפח מנופק" : "קיבולת מלאי";
                    return [`${value} יחידות`, label];
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(value) => {
                    return value === "volume" ? "נפח מנופק בפועל" : "קיבולת מקסימלית";
                  }}
                />
                <Bar dataKey="volume" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="capacity" fill={darkMode ? "#334155" : "#cbd5e1"} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
