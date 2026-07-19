import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Send, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  RefreshCw, 
  FileText, 
  AlertCircle, 
  MapPin, 
  Building2, 
  Lightbulb,
  Bot,
  User,
  Trash2
} from "lucide-react";

interface NoaChatProps {
  orders: any[];
  stats: any;
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export default function NoaChat({ orders, stats, darkMode, isOpen, onClose, onOpen }: NoaChatProps) {
  const [viewMode, setViewMode] = useState<"drawer" | "popup">("drawer");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          text: `
            <div class="noa-response">
              <h2>שלום, אני נועה 😊</h2>
              <p>העוזרת החכמה שלך מבית <strong>ח. סבן חומרי בניין 1994 בע"מ</strong>.</p>
              <p>אני כאן כדי לעזור לך לנהל ולנתח את נתוני שרשרת האספקה, מצב ההזמנות, המחסנים, וההפצה בזמן אמת.</p>
              <p>איך אפשר לעזור היום?</p>
            </div>
          `,
          timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Build context for Noa AI
      const context = {
        stats,
        orders: orders.map(o => ({
          id: o["מספר הזמנה"],
          client: o["שם לקוח"],
          warehouse: o["מחסן"],
          destination: o["כתובת אספקה"],
          whatsappStatus: o["סטטוס ווצאפ"],
          syncStatus: o["סטטוס סנכרון"],
          aiConclusions: o["מסקנות נועה AI"],
          date: o["תאריך קליטה"]
        }))
      };

      // Map messages for API (exclude first greeting if desired, or send full chat log)
      const apiHistory = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const response = await fetch("/api/noa/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: textToSend,
          history: apiHistory,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error("חלה שגיאה בקבלת תשובה מנועה AI");
      }

      const result = await response.json();
      
      if (result.success) {
        const aiMsg: Message = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          text: result.text,
          timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(result.error || "שגיאה לא ידועה");
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        text: `
          <div class="noa-response">
            <h4 class="text-rose-500 font-bold">⚠️ שגיאת תקשורת</h4>
            <p>מצטערת, חלה שגיאה זמנית בחיבור לשרת ה-AI של נועה.</p>
            <p class="text-xs opacity-80">${err.message || ""}</p>
          </div>
        `,
        timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage(inputValue);
    }
  };

  const clearChat = () => {
    if (window.confirm("האם ברצונך למחוק את כל היסטוריית הצ'אט עם נועה?")) {
      setMessages([]);
    }
  };

  const suggestions = [
    { text: "📋 דוח מצב הזמנות הנוכחי", icon: FileText, query: "תני לי דוח מפורט על מצב ההזמנות הנוכחי במערכת" },
    { text: "🚨 איזה הזמנות בעיכוב?", icon: AlertCircle, query: "איזה הזמנות בעיכוב או חריגה מ-48 שעות אספקה?" },
    { text: "🏘️ מהו המחסן הפעיל ביותר?", icon: Building2, query: "איזה מחסנים הכי פעילים כרגע ואיזה מחסן מוביל?" },
    { text: "📍 מהי עיר היעד המובילה?", icon: MapPin, query: "מהי עיר היעד המובילה ואיזה הזמנות מיועדות אליה?" },
    { text: "💡 3 טיפים לשיפור שרשרת האספקה", icon: Lightbulb, query: "תני לי 3 טיפים קונקרטיים כיועצת עסקית לשיפור תהליך הלוגיסטיקה והאספקה של ח. סבן חומרי בניין" }
  ];

  return (
    <>
      {/* Pulse Floating Quick Button in the bottom corner */}
      <div className="fixed bottom-6 left-6 z-50">
        <motion.button
          onClick={onOpen}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border border-indigo-500/30 group"
          id="noa-floating-trigger"
        >
          <div className="relative">
            <MessageSquare size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-indigo-600 animate-ping" />
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-indigo-600" />
          </div>
          <span className="text-xs sm:text-sm tracking-wide">צ'אט עם נועה AI ⚡</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dark background Backdrop - only visible in popup mode */}
            {viewMode === "popup" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-950 z-52 backdrop-blur-xs"
              />
            )}

            {/* Backdrop for drawer (optional, subtle blur outside) */}
            {viewMode === "drawer" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/30 z-52 lg:hidden"
              />
            )}

            {/* Chat Container */}
            <motion.div
              id="noa-chat-container"
              dir="rtl"
              initial={
                viewMode === "drawer" 
                  ? { x: "-100%", opacity: 0.9 } 
                  : { scale: 0.9, y: 30, opacity: 0 }
              }
              animate={
                viewMode === "drawer" 
                  ? { x: 0, opacity: 1, width: "min(460px, 100vw)" } 
                  : { scale: 1, y: 0, opacity: 1, width: "min(1000px, 92vw)", height: "85vh" }
              }
              exit={
                viewMode === "drawer" 
                  ? { x: "-100%", opacity: 0 } 
                  : { scale: 0.9, y: 30, opacity: 0 }
              }
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={`fixed z-53 shadow-2xl flex flex-col overflow-hidden border transition-all duration-300 ${
                viewMode === "drawer"
                  ? "left-0 top-0 bottom-0 h-screen"
                  : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl max-h-[85vh]"
              } ${
                darkMode 
                  ? "bg-slate-900 border-slate-800 text-white" 
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              {/* Noa Brand Header */}
              <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center border border-indigo-400 shadow-md">
                      <Bot size={22} className="text-white animate-pulse" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-sm sm:text-base text-white">נועה - עוזרת לוגיסטית</h3>
                      <span className="text-[9px] font-bold bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded-md border border-indigo-500/20">AI</span>
                    </div>
                    <p className="text-[10px] text-slate-400">ח. סבן חומרי בניין 1994 בע"מ</p>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode(viewMode === "drawer" ? "popup" : "drawer")}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title={viewMode === "drawer" ? "תצוגת מסך מלא" : "תצוגת צדדית צרה"}
                  >
                    {viewMode === "drawer" ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                  </button>
                  <button
                    onClick={clearChat}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-400 transition-all cursor-pointer"
                    title="מחק היסטוריית צ'אט"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 transition-all cursor-pointer"
                    title="סגור צ'אט"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Chat history & pre-made question selector */}
              <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
                darkMode ? "bg-slate-950/40" : "bg-slate-50/50"
              }`}>
                {/* Intro advice if no custom messages yet */}
                {messages.length <= 1 && (
                  <div className="mb-6 animate-fade-in">
                    <p className={`text-xs font-semibold mb-2.5 tracking-wide uppercase ${darkMode ? "text-slate-450" : "text-slate-500"}`}>שאלות נפוצות להפעלה מהירה:</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {suggestions.map((s, index) => {
                        const Icon = s.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => handleSendMessage(s.query)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-right transition-all duration-200 cursor-pointer active:scale-98 text-xs sm:text-sm font-medium ${
                              darkMode 
                                ? "bg-slate-900/80 hover:bg-slate-800 border-slate-800/80 hover:border-slate-700/80 text-slate-250" 
                                : "bg-white hover:bg-slate-100 border-slate-100 hover:border-slate-200 text-slate-700 shadow-2xs hover:shadow-xs"
                            }`}
                          >
                            <span className={`p-1.5 rounded-lg ${darkMode ? "bg-indigo-950/55 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                              <Icon size={14} />
                            </span>
                            <span>{s.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Messages Stream */}
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 max-w-[85%] ${
                        m.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        m.role === "user" 
                          ? "bg-slate-700 text-white" 
                          : "bg-indigo-600 text-white border border-indigo-400"
                      }`}>
                        {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
                      </div>

                      {/* Content Bubble */}
                      <div className="flex flex-col space-y-1">
                        <div
                          className={`rounded-2xl p-4 shadow-xs text-xs sm:text-sm leading-relaxed ${
                            m.role === "user"
                              ? darkMode
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-indigo-600 text-white rounded-tr-none"
                              : darkMode
                                ? "bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none"
                                : "bg-white border border-slate-250 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          {m.role === "user" ? (
                            <p className="whitespace-pre-line">{m.text}</p>
                          ) : (
                            /* Render beautiful HTML output directly to preserve tables and styled cards */
                            <div 
                              className="noa-html-content"
                              dangerouslySetInnerHTML={{ __html: m.text }}
                            />
                          )}
                        </div>
                        <span className={`text-[9px] ${darkMode ? "text-slate-500" : "text-slate-400"} ${m.role === "user" ? "text-left" : "text-right"}`}>
                          {m.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Thinking loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3 max-w-[80%] ml-auto animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/60 text-white flex items-center justify-center shrink-0">
                        <Bot size={14} />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <div className={`rounded-2xl rounded-tl-none p-4 ${darkMode ? "bg-slate-900 text-slate-300 border border-slate-800" : "bg-slate-100 text-slate-600"}`}>
                          <div className="flex items-center gap-2">
                            <RefreshCw size={13} className="animate-spin text-indigo-500" />
                            <span className="text-xs font-semibold">נועה חושבת ומנתחת נתונים...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Suggestions quick toolbar at the bottom */}
              {messages.length > 1 && (
                <div className={`px-4 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none border-t ${
                  darkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"
                }`}>
                  {suggestions.slice(0, 3).map((s, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(s.query)}
                      className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        darkMode 
                          ? "bg-slate-950/60 border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white" 
                          : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Input Area */}
              <div className={`p-4 border-t ${
                darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-150"
              }`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="שאלי אותי משהו (למשל: איזה הזמנות בעיכוב?)..."
                    disabled={isLoading}
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 transition-all ${
                      darkMode
                        ? "bg-slate-950 border-slate-800 text-white placeholder-slate-500"
                        : "bg-slate-50 border-slate-250 text-slate-850 placeholder-slate-400 focus:bg-white"
                    }`}
                  />
                  <button
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim() || isLoading}
                    className={`p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center`}
                    title="שלח הודעה"
                  >
                    <Send size={16} className="rotate-180" />
                  </button>
                </div>
                <p className={`text-[9px] text-center mt-1.5 ${darkMode ? "text-slate-500" : "text-gray-400"}`}>
                  נועה AI משתמשת בנתוני מערכת ח.סבן ומספקת תשובות מבוססות הקשר.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
