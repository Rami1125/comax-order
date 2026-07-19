import { DashboardStats } from "../types";
import { Package, CheckCircle2, Clock, MapPin, Building2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardsProps {
  stats: DashboardStats;
  prevStats?: DashboardStats | null;
  darkMode?: boolean;
  onCardClick?: (cardId: string) => void;
  activeCardId?: string | null;
}

export default function KPICards({ stats, prevStats = null, darkMode = false, onCardClick, activeCardId = null }: KPICardsProps) {
  const cards = [
    {
      id: "total-orders",
      title: "סה\"כ הזמנות",
      value: stats.totalOrders,
      prevValue: prevStats?.totalOrders,
      subtitle: "הזמנות שנקלטו במערכת",
      icon: Package,
      gradient: darkMode 
        ? "from-blue-500/15 to-indigo-500/5 text-blue-400" 
        : "from-blue-500/20 to-indigo-500/10 text-blue-600",
      borderColor: darkMode ? "border-blue-900/40" : "border-blue-200/50"
    },
    {
      id: "synced-orders",
      title: "סונכרנו בהצלחה",
      value: stats.syncedOrders,
      prevValue: prevStats?.syncedOrders,
      subtitle: `${((stats.syncedOrders / (stats.totalOrders || 1)) * 100).toFixed(0)}% מכלל ההזמנות`,
      icon: CheckCircle2,
      gradient: darkMode 
        ? "from-emerald-500/15 to-teal-500/5 text-emerald-400" 
        : "from-emerald-500/20 to-teal-500/10 text-emerald-600",
      borderColor: darkMode ? "border-emerald-900/40" : "border-emerald-200/50"
    },
    {
      id: "pending-orders",
      title: "ממתינים לסנכרון",
      value: stats.pendingOrders,
      prevValue: prevStats?.pendingOrders,
      subtitle: "הזמנות בתהליך טיפול",
      icon: Clock,
      gradient: darkMode 
        ? "from-amber-500/15 to-orange-500/5 text-amber-400" 
        : "from-amber-500/20 to-orange-500/10 text-amber-600",
      borderColor: darkMode ? "border-amber-900/40" : "border-amber-200/50"
    },
    {
      id: "delayed-orders",
      title: "הזמנות בעיכוב",
      value: stats.delayedOrders,
      prevValue: prevStats?.delayedOrders,
      subtitle: "חריגה מ-48 שעות אספקה",
      icon: AlertTriangle,
      gradient: darkMode 
        ? "from-red-500/15 to-rose-500/5 text-red-400" 
        : "from-red-500/20 to-rose-500/10 text-red-600",
      borderColor: darkMode ? "border-red-900/40" : "border-red-200/50"
    },
    {
      id: "top-city",
      title: "עיר מובילה",
      value: stats.topCity,
      subtitle: `${stats.topCityCount} הזמנות בעיר זו`,
      icon: MapPin,
      gradient: darkMode 
        ? "from-rose-500/15 to-pink-500/5 text-rose-400" 
        : "from-rose-500/20 to-pink-500/10 text-rose-600",
      borderColor: darkMode ? "border-rose-900/40" : "border-rose-200/50"
    },
    {
      id: "active-warehouses",
      title: "מחסנים פעילים",
      value: stats.activeWarehouses,
      prevValue: prevStats?.activeWarehouses,
      subtitle: "מרכזי הפצה משגרים",
      icon: Building2,
      gradient: darkMode 
        ? "from-violet-500/15 to-purple-500/5 text-violet-400" 
        : "from-violet-500/20 to-purple-500/10 text-violet-600",
      borderColor: darkMode ? "border-violet-900/40" : "border-violet-200/50"
    }
  ];

  const getTrend = (value: number, prevValue: number | undefined, metricId: string) => {
    if (prevValue === undefined || prevValue === null) return null;
    const delta = value - prevValue;
    if (delta === 0) return null;

    // Positive metrics where growth is good (higher is better)
    const isPositiveMetric = !["pending-orders", "delayed-orders"].includes(metricId);
    const isGood = isPositiveMetric ? delta > 0 : delta < 0;
    const text = delta > 0 ? `+${delta}` : `${delta}`;

    return {
      delta,
      text,
      isGood,
      direction: delta > 0 ? "up" : "down"
    };
  };

  return (
    <div id="kpi-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeCardId === card.id;
        
        let borderClass = card.borderColor;
        if (isActive) {
          borderClass = darkMode 
            ? "ring-2 ring-indigo-500 border-transparent shadow-lg shadow-indigo-500/10" 
            : "ring-2 ring-indigo-600 border-transparent shadow-lg shadow-indigo-600/10";
        }

        return (
          <button
            key={card.id}
            id={`kpi-card-${card.id}`}
            type="button"
            onClick={() => onCardClick?.(card.id)}
            className={`w-full text-right border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between cursor-pointer active:scale-98 select-none focus:outline-hidden ${borderClass} ${
              darkMode 
                ? isActive ? "bg-indigo-950/40" : "bg-[#111827]/80 backdrop-blur-md border-slate-800/80 text-white shadow-slate-950/20 hover:bg-slate-900/60" 
                : isActive ? "bg-indigo-50/50" : "glass-panel border-slate-100 text-slate-800 bg-white hover:bg-slate-50/70"
            }`}
          >
            <div className="flex items-center justify-between mb-4 w-full">
              <span className={`text-xs font-semibold ${darkMode ? "text-slate-450" : "text-gray-500"}`}>{card.title}</span>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient}`}>
                <IconComponent size={16} className="stroke-[2.5px]" />
              </div>
            </div>
            
            <div className="w-full">
              <div className="flex items-baseline gap-2 mb-1 justify-start">
                <span className={`text-2xl font-bold tracking-tight font-mono ${
                  darkMode ? "text-slate-100" : "text-slate-800"
                }`}>
                  {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                </span>

                {/* Trend indicator */}
                {typeof card.value === "number" && card.prevValue !== undefined && (
                  (() => {
                    const trend = getTrend(card.value, card.prevValue, card.id);
                    if (!trend) return null;

                    const TrendIcon = trend.direction === "up" ? TrendingUp : TrendingDown;
                    const badgeClass = trend.isGood
                      ? darkMode
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : darkMode
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                        : "bg-rose-50 text-rose-700 border-rose-200";

                    return (
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border font-mono ${badgeClass}`} dir="ltr">
                        <TrendIcon size={10} className="stroke-[2.5px]" />
                        <span>{trend.text}</span>
                      </div>
                    );
                  })()
                )}
              </div>
              <p className={`text-[10px] font-normal leading-normal ${darkMode ? "text-slate-450" : "text-gray-400"}`}>{card.subtitle}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
