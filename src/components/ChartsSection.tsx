import { useMemo } from "react";
import { Order } from "../types";
import { getCity } from "../utils";
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
import { Map, Warehouse, MessageSquare, TrendingUp, Brain, Sparkles } from "lucide-react";

interface ChartsSectionProps {
  orders: Order[];
  darkMode?: boolean;
}

export default function ChartsSection({ orders, darkMode = false }: ChartsSectionProps) {
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-56 w-full flex justify-center">
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
                >
                  {noaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
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
            {noaData.map((item, idx) => {
              const percentage = ((item.value / orders.length) * 100).toFixed(1);
              return (
                <div key={item.name} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: COLORS[(idx + 4) % COLORS.length] }}
                      />
                      <span className={`font-medium line-clamp-1 ${darkMode ? "text-slate-200" : "text-slate-700"}`} title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className={`flex gap-2 font-mono text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <span className="font-semibold">{item.value}</span>
                      <span className={`${darkMode ? "text-slate-500" : "text-gray-400"}`}>({percentage}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
