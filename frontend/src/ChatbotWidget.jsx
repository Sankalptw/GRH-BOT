import React, { useState, useRef, useEffect } from "react";
import PsychometricQuiz from './PsychometricQuiz';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false); // ADD THIS LINE
  const [messages, setMessages] = useState([
    { 
      type: "bot", 
      text: "Hello! I'm **GRH Intelligence**, your dedicated research assistant.\nHow may I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const toggleOpen = () => {
    setOpen(!open);
  };

  const formatMessageText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\n)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      } else if (part === '\n') {
        return <br key={index} />;
      } else if (part.startsWith('•')) {
        return <span key={index} className="block ml-2">{part}</span>;
      }
      return part;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = { 
      type: "user", 
      text: input.trim(),
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input.trim() }),
      });
      
      if (!res.ok) {
        throw new Error("HTTP error");
      }
      
      const data = await res.json();
      
      setTimeout(() => {
        setIsTyping(false);
        const botMessage = { 
          type: "bot", 
          text: data.answer || "I couldn't find specific information about that. Could you please rephrase your question or ask about our research programs, services, or collaboration opportunities?",
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, botMessage]);
      }, 1000);
      
    } catch (err) {
      console.error("Error:", err);
      setIsTyping(false);
      const botMessage = { 
        type: "bot", 
        text: "I apologize, but I'm experiencing connectivity issues at the moment. Please ensure the backend service is running and try again. If the problem persists, feel free to reach out to our support team directly.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMessage]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      { 
        type: "bot", 
        text: "Hello! I'm **GRH Intelligence**, your dedicated research assistant.\nHow may I assist you today?",
        timestamp: new Date()
      }
    ]);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickActions = [
    { icon: "🎓", text: "Research Programs", query: "Tell me about your research programs" },
    { icon: "📚", text: "Publications", query: "What are your publication opportunities?" },
    { icon: "📊", text: "Psychometric Test", action: "quiz" }, // ADDED THIS
  ];

  const handleQuickAction = (query, action) => {
    if (action === "quiz") {
      setShowQuiz(true);
    } else {
      setInput(query);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Psychometric Quiz Modal */}
      {showQuiz && (
        <PsychometricQuiz onClose={() => setShowQuiz(false)} />
      )}

      {!open && (
        <button
          onClick={toggleOpen}
          className="group relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white rounded-full w-16 h-16 shadow-2xl hover:shadow-blue-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center"
        >
          <svg 
            className="w-8 h-8 transition-transform group-hover:rotate-12" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
            />
          </svg>
          
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
          </span>
        </button>
      )}

      {open && (
        <div className="flex flex-col w-[420px] h-[650px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-slide-in">
          {/* Enhanced Header */}
          <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-5 shadow-xl">
            <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
            <div className="relative flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-white/30 rounded-2xl flex items-center justify-center backdrop-blur-lg shadow-lg border border-white/20">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                    </svg>
                  </div>
                  <span className="absolute -bottom-1 -right-1 block h-4 w-4 rounded-full bg-emerald-400 border-2 border-white shadow-lg"></span>
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">GRH Intelligence</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <p className="text-xs text-blue-100 font-medium">Active • Ready to assist</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={clearChat}
                  className="hover:bg-white/20 rounded-xl p-2.5 transition-all duration-200 backdrop-blur-sm"
                  title="New conversation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={toggleOpen}
                  className="hover:bg-white/20 rounded-xl p-2.5 transition-all duration-200 backdrop-blur-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-5 overflow-y-auto bg-gradient-to-b from-gray-50 to-white space-y-5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"} animate-slide-in`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.type === "bot" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                      </svg>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <div
                      className={`p-4 rounded-2xl shadow-md ${
                        msg.type === "user"
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
                          : "bg-white text-gray-800 rounded-bl-md border-2 border-gray-100"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">
                        {formatMessageText(msg.text)}
                      </p>
                    </div>
                    <span className={`text-xs text-gray-400 px-2 font-medium ${msg.type === "user" ? "text-right" : "text-left"}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start animate-slide-in">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                    </svg>
                  </div>
                  <div className="bg-white border-2 border-gray-100 p-4 rounded-2xl rounded-bl-md shadow-md">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></div>
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {messages.length === 1 && !loading && (
              <div className="space-y-3 pt-4">
                <p className="text-xs text-gray-500 font-semibold px-2 mb-3">⚡ Quick Actions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(action.query, action.action)}
                      className="flex items-center gap-2 px-3 py-3 text-sm bg-white border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 text-gray-700 group"
                    >
                      <span className="text-xl">{action.icon}</span>
                      <span className="text-xs font-medium group-hover:text-blue-600 transition-colors">{action.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Enhanced Input Area */}
          <div className="p-4 border-t-2 border-gray-100 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about GRH..."
                disabled={loading}
                className="flex-1 border-2 border-gray-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:hover:shadow-lg flex items-center justify-center min-w-[52px]"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex justify-between items-center mt-3 px-1">
              <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                Powered by Advanced AI
              </p>
              <p className="text-xs text-gray-400 font-medium">
                Secured & Private
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatbotWidget;