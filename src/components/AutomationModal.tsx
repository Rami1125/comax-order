import { useState, useEffect } from "react";
import { X, Settings, Zap, Send, Copy, Check, ExternalLink, Bell, Wifi, RefreshCw, Play, CheckCircle, Info, Lock } from "lucide-react";
import { Order } from "../types";
import { parseItems, getCity } from "../utils";

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  darkMode?: boolean;
}

export default function AutomationModal({ isOpen, onClose, orders, darkMode = false }: AutomationModalProps) {
  const [activeTab, setActiveTab] = useState<"make" | "onesignal">("make");
  const [copiedText, setCopiedText] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [isTriggeringMake, setIsTriggeringMake] = useState(false);
  const [makeConsoleLog, setMakeConsoleLog] = useState<any>(null);

  // OneSignal test variables
  const [pushTitle, setPushTitle] = useState("עדכון דחוף ממנהל הלוגיסטיקה 📡");
  const [pushMessage, setPushMessage] = useState("בוצע שינוי בסדר פריקת המכולות במחסן החרש. נא לבדוק סידור.");
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushConsoleLog, setPushConsoleLog] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (orders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(String(orders[0]["מספר הזמנה"]));
    }
  }, [orders, selectedOrderId]);

  // Check subscription status
  useEffect(() => {
    if (typeof window !== "undefined") {
      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        try {
          setIsSubscribed(OneSignal.User?.PushSubscription?.optedIn || false);
        } catch (e) {
          // OneSignal not fully loaded or old API version
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeOrder = orders.find(o => String(o["מספר הזמנה"]) === selectedOrderId) || orders[0];

  const handleCopyScenario = () => {
    const scenarioJSON = `{
  "name": "Comax LogiTrack ERP Sync Pipeline",
  "webhook": "https://your-make-webhook-url",
  "steps": [
    {
      "id": 1,
      "module": "gateway:webhook",
      "description": "Receive status change trigger from LogiTrack App"
    },
    {
      "id": 2,
      "module": "google-sheets:update-row",
      "description": "Locate order row in Google Sheet and update Status column to matched value"
    },
    {
      "id": 3,
      "module": "telegram:send-alert",
      "description": "Forward urgent alerts to Logistics Slack/Telegram channel if status is Delayed"
    }
  ]
}`;
    navigator.clipboard.writeText(scenarioJSON);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleTriggerMake = async () => {
    if (!activeOrder) return;
    setIsTriggeringMake(true);
    setMakeConsoleLog(null);

    try {
      const payload = {
        orderId: activeOrder["מספר הזמנה"],
        newStatus: activeOrder["סטטוס סנכרון"] || "סונכרן בהצלחה ✅",
        customerName: activeOrder["שם לקוח"],
        city: activeOrder["כתובת אספקה"] ? getCity(activeOrder["כתובת אספקה"]) : "לא ידוע",
        itemsCount: activeOrder["פריטים"] ? parseItems(activeOrder["פריטים"]).length : 0,
        date: activeOrder["תאריך קליטה"]
      };

      const response = await fetch("/api/make/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      setMakeConsoleLog(result);
    } catch (err: any) {
      setMakeConsoleLog({ success: false, error: err.message });
    } finally {
      setIsTriggeringMake(false);
    }
  };

  const handleSendPush = async () => {
    setIsSendingPush(true);
    setPushConsoleLog(null);

    try {
      const response = await fetch("/api/onesignal/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pushTitle,
          message: pushMessage,
          url: window.location.href,
          data: { triggeredBy: "LogiTrack Web Dashboard Manager" }
        })
      });

      const result = await response.json();
      setPushConsoleLog(result);
    } catch (err: any) {
      setPushConsoleLog({ success: false, error: err.message });
    } finally {
      setIsSendingPush(false);
    }
  };

  const handleRegisterOneSignal = () => {
    if (typeof window !== "undefined") {
      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        try {
          OneSignal.User.PushSubscription.optIn().then(() => {
            setIsSubscribed(true);
            alert("רישום ה-OneSignal בוצע בהצלחה! כעת תקבל התראות Push חיות מהמנהל.");
          }).catch((err: any) => {
            console.error(err);
            alert("רישום OneSignal נכשל. בדוק הרשאות התראה בדפדפן.");
          });
        } catch (e) {
          alert("מנוע OneSignal עדיין נטען, אנא נסה שוב בעוד מספר שניות.");
        }
      } else {
        alert("ספריית OneSignal לא אותרה. אנא בדוק אם חוסם פרסומות מונע את טעינת ה-SDK.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in" onClick={onClose}>
      <div 
        className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-colors duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between transition-colors duration-300 ${
          darkMode ? "bg-slate-900/60 border-slate-850" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600 text-white animate-pulse">
              <Settings size={18} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">מרכז בקרה, אוטומציה והתראות Push 📡</h2>
              <p className={`text-[10px] sm:text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                חיבור מלא לתשתית Make וניהול התראות קצה דו-כיווניות באמצעות OneSignal
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            darkMode ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          }`}>
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className={`flex border-b text-xs sm:text-sm font-semibold transition-colors duration-300 ${
          darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"
        }`}>
          <button
            onClick={() => setActiveTab("make")}
            className={`flex-1 py-3 px-4 border-b-2 text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "make" 
                ? "border-indigo-600 text-indigo-500 bg-indigo-500/5 font-extrabold" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap size={14} />
            <span>אוטומציית Make.com (Webhooks)</span>
          </button>
          <button
            onClick={() => setActiveTab("onesignal")}
            className={`flex-1 py-3 px-4 border-b-2 text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "onesignal" 
                ? "border-indigo-600 text-indigo-500 bg-indigo-500/5 font-extrabold" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bell size={14} />
            <span>התראות OneSignal (קשר דו-כיווני)</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === "make" && (
            <div className="space-y-5">
              {/* Introduction card */}
              <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed transition-colors duration-300 ${
                darkMode ? "bg-indigo-950/25 border-indigo-900/30 text-indigo-200" : "bg-indigo-50/50 border-indigo-100 text-indigo-900"
              }`}>
                <Info size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                <div className="space-y-1">
                  <p className="font-bold">תקשורת מלאה בזמן אמת מול Make.com</p>
                  <p>
                    מערכת LogiTrack משגרת אירועי עדכון סטטוסים, סנכרוני ERP, ותוצאות בינה מלאכותית של "נועה AI" ישירות ל-Webhook מותאם של Make. זה מאפשר לעדכן את גליונות Google Sheets, מערכות ניהול מחסנים (WMS), או לשלוח התראות דחופות לטלגרם של הנהגים ללא השהייה.
                  </p>
                </div>
              </div>

              {/* URL Configurations info */}
              <div className="space-y-2">
                <label className={`text-xs font-bold block ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  כתובת ה-Webhook הפעילה (Make Trigger)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={process.env.MAKE_WEBHOOK_URL || "https://hook.us2.make.com/abc123xyz-live-logitrack-connector"}
                    className={`flex-1 text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none font-mono ${
                      darkMode ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  />
                  <div className={`px-3 py-2 rounded-xl text-xs flex items-center gap-1 border font-bold ${
                    process.env.MAKE_WEBHOOK_URL 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${process.env.MAKE_WEBHOOK_URL ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span>{process.env.MAKE_WEBHOOK_URL ? "מחובר ל-Make" : "מצב הדמיה (ללא מפתח)"}</span>
                  </div>
                </div>
              </div>

              {/* Interactive test triggers */}
              <div className={`p-4 rounded-xl border space-y-4 transition-colors duration-300 ${
                darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-2">
                  <Play size={14} className="text-indigo-500" />
                  <h4 className="text-xs sm:text-sm font-bold">סימולציה ושיגור ידני של אירוע (Test automation trigger)</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">בחר הזמנה לשיגור</label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className={`w-full text-xs p-2.5 rounded-xl border focus:outline-none transition-colors ${
                        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    >
                      {orders.map(o => (
                        <option key={o["מספר הזמנה"]} value={o["מספר הזמנה"]}>
                          הזמנה #{o["מספר הזמנה"]} - {o["שם לקוח"]} ({getCity(o["כתובת אספקה"] || "")})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">סטטוס סנכרון נוכחי</label>
                    <div className={`text-xs px-3 py-2.5 rounded-xl font-bold border ${
                      darkMode ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"
                    }`}>
                      {activeOrder?.["סטטוס סנכרון"] || "ממתין לסנכרון ⏳"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleTriggerMake}
                  disabled={isTriggeringMake || orders.length === 0}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-md w-full sm:w-auto"
                >
                  {isTriggeringMake ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>שולח אירוע ל-Make...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>שגר אירוע סנכרון ל-Make.com 🚀</span>
                    </>
                  )}
                </button>
              </div>

              {/* Console log response */}
              {makeConsoleLog && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 block">CONSOLE LOG RESPONSE</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      makeConsoleLog.success ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    }`}>
                      {makeConsoleLog.source === "live_make_webhook" ? "LIVE OUT" : "LOCAL EMULATION"}
                    </span>
                  </div>
                  <pre className="p-4 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[150px] bg-slate-950 text-emerald-400 border border-slate-800 shadow-inner">
                    {JSON.stringify(makeConsoleLog, null, 2)}
                  </pre>
                </div>
              )}

              {/* JSON Blueprint to copy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold block ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                    מבנה נתוני JSON לשיגור (Payload Schema Blueprint)
                  </label>
                  <button
                    onClick={handleCopyScenario}
                    className="text-[11px] text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <Check size={11} className="text-emerald-500" />
                        <span className="text-emerald-500">הועתק ללוח</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>העתק קוד JSON Blueprint</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl font-mono text-[10px] sm:text-[11px] leading-relaxed overflow-x-auto max-h-[160px] bg-slate-950 text-slate-400 border border-slate-850">
{`{
  "event": "order_status_updated",
  "timestamp": "${new Date().toISOString()}",
  "orderId": "50450",
  "newStatus": "סונכרן בהצלחה ✅",
  "customerName": "סבן חומרי בניין",
  "city": "הוד השרון",
  "itemsCount": 4,
  "system": "Comax / SabanOS"
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "onesignal" && (
            <div className="space-y-5">
              {/* Introduction card */}
              <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed transition-colors duration-300 ${
                darkMode ? "bg-indigo-950/25 border-indigo-900/30 text-indigo-200" : "bg-indigo-50/50 border-indigo-100 text-indigo-900"
              }`}>
                <Bell size={16} className="shrink-0 mt-0.5 text-indigo-500 animate-bounce" />
                <div className="space-y-1">
                  <p className="font-bold">התראות מנהל דו-כיווניות (OneSignal Push Platform)</p>
                  <p>
                    מערכת OneSignal מוטמעת ישירות במאגר האפליקציה. המנהל יכול לשלוח התראות Push חיות ודחופות לכל מכשירי הקצה (נהגים, מנהלי מחסנים ומלקטים) גם כשהאפליקציה סגורה או מותקנת כאפליקציית PWA בנייד.
                  </p>
                </div>
              </div>

              {/* Status and Action Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Registration / Subscription */}
                <div className={`p-4 rounded-xl border space-y-3 transition-colors duration-300 ${
                  darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                }`}>
                  <h4 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span>הרשמה וזיהוי לקוח קצה</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    כדי לבדוק את ההתראות ממכשיר זה, רשום את הדפדפן שלך לערוץ ההתראות של OneSignal.
                  </p>
                  
                  <div className="pt-2">
                    {isSubscribed ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <CheckCircle size={14} />
                        <span>רשום ומסונכרן (OneSignal Subscribed)</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleRegisterOneSignal}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Bell size={13} />
                        <span>הפעל הרשמה ל-Push בטאבלט/נייד 🔔</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* API Setup Information */}
                <div className={`p-4 rounded-xl border space-y-3 transition-colors duration-300 ${
                  darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                }`}>
                  <h4 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <Lock size={13} className="text-indigo-400" />
                    <span>מפתחות אינטגרציה פעילים</span>
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>OneSignal App ID:</span>
                      <span className="font-mono bg-slate-950 text-indigo-400 px-1.5 py-0.5 rounded">
                        {process.env.VITE_ONESIGNAL_APP_ID ? "✓ מוגדר" : "Fallback (Demo)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>REST API Key:</span>
                      <span className="font-mono bg-slate-950 text-indigo-400 px-1.5 py-0.5 rounded">
                        {process.env.ONESIGNAL_REST_API_KEY ? "✓ מוגדר בשרת" : "הדמיית מנהל"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch form - Manager to client */}
              <div className={`p-4 rounded-xl border space-y-4 transition-colors duration-300 ${
                darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Send size={14} className="text-indigo-500" />
                  <h4 className="text-xs sm:text-sm font-bold">שיגור התראת מנהל דחופה (Manager Push Dispatcher)</h4>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">כותרת ההתראה (עברית)</label>
                    <input
                      type="text"
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">תוכן ההודעה (משתמשי קצה בניידים ודפדפן)</label>
                    <textarea
                      value={pushMessage}
                      rows={2}
                      onChange={(e) => setPushMessage(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendPush}
                  disabled={isSendingPush || !pushTitle || !pushMessage}
                  className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-md w-full sm:w-auto"
                >
                  {isSendingPush ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>משגר התראה לשרת...</span>
                    </>
                  ) : (
                    <>
                      <Bell size={13} className="animate-pulse" />
                      <span>שגר התראת Push לכל מכשירי המערכת 🔔</span>
                    </>
                  )}
                </button>
              </div>

              {/* Console log push response */}
              {pushConsoleLog && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 block">ONESIGNAL PUSH DISPATCH LOGGER</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      pushConsoleLog.success ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    }`}>
                      {pushConsoleLog.source === "live_onesignal" ? "LIVE ONESIGNAL OK" : "LOCAL EMULATION MODE"}
                    </span>
                  </div>
                  <pre className="p-4 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[150px] bg-slate-950 text-emerald-400 border border-slate-800 shadow-inner">
                    {JSON.stringify(pushConsoleLog, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors duration-300 ${
          darkMode ? "bg-slate-900/60 border-slate-850" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
            <Wifi size={12} className="text-indigo-500" />
            <span>תיווך תשתית עבודה בזמן אמת פעילה לוגיסטית</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              darkMode ? "bg-slate-850 border-slate-800 hover:bg-slate-800 text-slate-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-750"
            }`}
          >
            סגור חלון
          </button>
        </div>
      </div>
    </div>
  );
}
