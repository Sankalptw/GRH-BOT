import React, { useState, useRef, useEffect } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      type: "bot", 
      text: "👋 Hello! I'm **GRH Intelligence**, your dedicated research assistant.\n\nI can help you with:\n• Information about GRH programs and services\n• Research collaboration opportunities\n• Publication guidelines\n• 🧠 Evaluate your research aptitude\n\nHow may I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [assessmentState, setAssessmentState] = useState({
    active: false,
    phase: null,
    currentQuestion: 0,
    questions: [],
    answers: {},
    selectedDomain: null,
    mindsetAnswers: {},
    domainAnswers: {}
  });
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current && !assessmentState.active) {
      inputRef.current.focus();
    }
  }, [open, assessmentState.active]);

  const toggleOpen = () => {
    setOpen(!open);
  };

  const formatMessageText = (text) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split('**').map((part, j) => 
          j % 2 === 0 ? part : <strong key={j}>{part}</strong>
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const startAssessment = async () => {
    setLoading(true);
    
    const userMsg = {
      type: "user",
      text: "Start Psychometric Evaluation",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/assessment/start`);
      const data = await res.json();
      
      setAssessmentState({
        active: true,
        phase: 'mindset',
        currentQuestion: 0,
        questions: data.questions,
        answers: {},
        selectedDomain: null,
        mindsetAnswers: {},
        domainAnswers: {}
      });
      
      const introMsg = {
        type: "bot",
        text: `Perfect! Let's discover your research potential! 🚀\n\n**Phase 1: Research Mindset Assessment**\n\nI'll ask you ${data.total_questions} questions to understand your research thinking and approach. This helps me evaluate if you have the mindset for research work.\n\nThere are no wrong answers - just be honest! Ready? Let's begin! 🎯`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, introMsg]);
      
      setTimeout(() => {
        askQuestion(data.questions, 0);
      }, 2000);
      
    } catch (error) {
      const errorMsg = {
        type: "bot",
        text: "Sorry, I couldn't load the assessment. Please make sure the backend is running.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
    
    setLoading(false);
  };

  const askQuestion = (questions, index) => {
    if (index < questions.length) {
      const q = questions[index];
      let optionsText = '';
      
      if (q.options) {
        optionsText = '\n\n' + Object.entries(q.options)
          .map(([key, value]) => `${key}) ${value}`)
          .join('\n');
      }
      
      const questionMsg = {
        type: "bot",
        text: `**Question ${index + 1}/${questions.length}**\n\n${q.question}${optionsText}\n\n_Reply with A, B, C, or D_`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, questionMsg]);
    }
  };

  const handleMindsetAnswer = (answer) => {
    const { questions, currentQuestion, mindsetAnswers } = assessmentState;
    const questionId = questions[currentQuestion].id;
    
    const userMsg = {
      type: "user",
      text: answer.toUpperCase(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    const newAnswers = {
      ...mindsetAnswers,
      [questionId]: answer.toUpperCase()
    };
    
    const nextQuestion = currentQuestion + 1;
    
    if (nextQuestion < questions.length) {
      setAssessmentState({
        ...assessmentState,
        currentQuestion: nextQuestion,
        mindsetAnswers: newAnswers
      });
      
      setTimeout(() => {
        askQuestion(questions, nextQuestion);
      }, 800);
    } else {
      setAssessmentState({
        ...assessmentState,
        mindsetAnswers: newAnswers,
        phase: 'domain-selection'
      });
      
      setTimeout(() => {
        showDomainSelection();
      }, 1000);
    }
  };

  const showDomainSelection = async () => {
    setLoading(true);
    
    const completeMsg = {
      type: "bot",
      text: "✅ **Phase 1 Complete!** Great job!\n\nNow let's find the best research domain for you.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, completeMsg]);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/assessment/domains`);
      const data = await res.json();
      
      const domainMsg = {
        type: "bot",
        text: `**Phase 2: Domain Selection**\n\n${data.message}\n\nAvailable domains:\n${data.domains.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n_Reply with the number or name of your chosen domain_`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, domainMsg]);
      
    } catch (error) {
      const errorMsg = {
        type: "bot",
        text: "Sorry, couldn't load domains. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
    
    setLoading(false);
  };

  const handleDomainSelection = async (input) => {
    const domains = ["Computer Science", "Biology", "Physics", "Chemistry", "Social Sciences"];
    
    let selectedDomain = null;
    
    const num = parseInt(input);
    if (!isNaN(num) && num >= 1 && num <= domains.length) {
      selectedDomain = domains[num - 1];
    } else {
      selectedDomain = domains.find(d => 
        d.toLowerCase().includes(input.toLowerCase()) || 
        input.toLowerCase().includes(d.toLowerCase())
      );
    }
    
    if (!selectedDomain) {
      const errorMsg = {
        type: "bot",
        text: "I didn't understand that. Please reply with 1-5 or the domain name (e.g., 'Computer Science', 'Biology')",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }
    
    const userMsg = {
      type: "user",
      text: selectedDomain,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    setLoading(true);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/assessment/domain-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selectedDomain })
      });
      
      const data = await res.json();
      
      setAssessmentState({
        ...assessmentState,
        phase: 'domain-test',
        selectedDomain: selectedDomain,
        currentQuestion: 0,
        questions: data.questions,
        domainAnswers: {}
      });
      
      const phaseMsg = {
        type: "bot",
        text: `Excellent choice! 🎯\n\n**Phase 3: ${selectedDomain} Aptitude Test**\n\nNow I'll test your learning potential and thinking style for ${selectedDomain}. These questions assess if you can **learn** this field, not what you already know.\n\n${data.total_questions} questions coming up. Let's see how your mind works! 🧠`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, phaseMsg]);
      
      setTimeout(() => {
        askQuestion(data.questions, 0);
      }, 2000);
      
    } catch (error) {
      const errorMsg = {
        type: "bot",
        text: "Sorry, couldn't load domain questions. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
    
    setLoading(false);
  };

  const handleDomainAnswer = (answer) => {
    const { questions, currentQuestion, domainAnswers } = assessmentState;
    const questionId = questions[currentQuestion].id;
    
    const userMsg = {
      type: "user",
      text: answer.toUpperCase(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    const newAnswers = {
      ...domainAnswers,
      [questionId]: answer.toUpperCase()
    };
    
    const nextQuestion = currentQuestion + 1;
    
    if (nextQuestion < questions.length) {
      setAssessmentState({
        ...assessmentState,
        currentQuestion: nextQuestion,
        domainAnswers: newAnswers
      });
      
      setTimeout(() => {
        askQuestion(questions, nextQuestion);
      }, 800);
    } else {
      setAssessmentState({
        ...assessmentState,
        domainAnswers: newAnswers
      });
      
      submitCompleteAssessment(newAnswers);
    }
  };

  const submitCompleteAssessment = async (domainAnswers) => {
    setLoading(true);
    
    const processingMsg = {
      type: "bot",
      text: "🎉 **All questions answered!**\n\nAnalyzing your responses and generating your personalized evaluation... ⏳",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, processingMsg]);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/assessment/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mindset_answers: assessmentState.mindsetAnswers,
          domain: assessmentState.selectedDomain,
          domain_answers: domainAnswers
        })
      });
      
      const result = await res.json();
      
      const resultsMsg = {
        type: "bot",
        text: `✨ **PSYCHOMETRIC EVALUATION RESULTS** ✨\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n**📊 Overall Assessment: ${result.fit_level}**\n\n**Research Mindset Score:** ${result.research_aptitude_score}/100 (${result.research_aptitude_percentage}%)\n**${assessmentState.selectedDomain} Aptitude:** ${result.domain_fit_score}/100 (${result.domain_fit_percentage}%)\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n**🎯 Evaluation:**\n${result.overall_assessment}\n\n**💪 Your Strengths:**\n${result.strengths.length > 0 ? result.strengths.map(s => `• ${s}`).join('\n') : '• Building your foundation'}\n\n**📈 Areas to Develop:**\n${result.areas_to_develop.length > 0 ? result.areas_to_develop.map(a => `• ${a}`).join('\n') : '• Well-rounded across all areas'}\n\n**🔬 Domain-Specific Insight:**\n${result.domain_specific_feedback}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n**🎓 Recommendations:**\n${result.recommendation}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\nWould you like to:\n• Retake the assessment\n• Learn more about recommended programs\n• Ask me anything else`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, resultsMsg]);
      
    } catch (error) {
      const errorMsg = {
        type: "bot",
        text: "Sorry, I couldn't evaluate your responses. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
    
    setLoading(false);
    
    setAssessmentState({
      active: false,
      phase: null,
      currentQuestion: 0,
      questions: [],
      answers: {},
      selectedDomain: null,
      mindsetAnswers: {},
      domainAnswers: {}
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    if (assessmentState.active) {
      if (assessmentState.phase === 'mindset') {
        handleMindsetAnswer(input);
      } else if (assessmentState.phase === 'domain-selection') {
        handleDomainSelection(input);
      } else if (assessmentState.phase === 'domain-test') {
        handleDomainAnswer(input);
      }
      setInput("");
      return;
    }
    
    const userMessage = { 
      type: "user", 
      text: input.trim(),
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

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
      const botMessage = { 
        type: "bot", 
        text: data.answer || "I couldn't find an answer to that question.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("Error:", err);
      const botMessage = { 
        type: "bot", 
        text: "I'm having trouble connecting right now. Please make sure the backend is running and try again.",
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
        text: "👋 Hello! I'm **GRH Intelligence**, your dedicated research assistant.\nHow may I assist you today?",
        timestamp: new Date()
      }
    ]);
    setAssessmentState({
      active: false,
      phase: null,
      currentQuestion: 0,
      questions: [],
      answers: {},
      selectedDomain: null,
      mindsetAnswers: {},
      domainAnswers: {}
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickActions = [
    { icon: "🎓", text: "Research Programs", query: "Tell me about your research programs" },
    { icon: "📚", text: "Publications", query: "What are your publication opportunities?" }
  ];

  const handleQuickAction = (action) => {
    if (action.action === "assessment") {
      startAssessment();
    } else {
      setInput(action.query);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!open && (
        <button
          onClick={toggleOpen}
          className="group relative rounded-full w-16 h-16 shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4A3D7A 0%, #5E4D8F 100%)' }}
        >
          <svg viewBox="0 0 1500 1500" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
            <path d="M500 300 L300 800 L700 800 L500 1200 L1100 600 L700 600 L900 200 Z" fill="#F5A54A" stroke="none"/>
            <path d="M200 400 Q200 300 300 300 L600 300 L500 500 L400 500 Q300 500 300 600 L300 900 Q300 1000 400 1000 L700 1000 L600 800 L500 800 Q600 800 600 700 L600 600" fill="none" stroke="#4A3D7A" strokeWidth="80" strokeLinecap="round"/>
            <path d="M200 1100 Q300 1200 500 1200 Q700 1200 800 1100" fill="none" stroke="#F5A54A" strokeWidth="60" strokeLinecap="round"/>
          </svg>
          
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-white" style={{ backgroundColor: '#F5A54A' }}></span>
          </span>
        </button>
      )}

      {open && (
        <div className="flex flex-col w-[450px] h-[680px] bg-white rounded-3xl shadow-2xl overflow-hidden border-2" style={{ borderColor: '#4A3D7A' }}>
          <div className="relative text-white p-5 shadow-xl" style={{ background: 'linear-gradient(135deg, #4A3D7A 0%, #5E4D8F 50%, #6B5BA0 100%)' }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-lg shadow-lg" style={{ backgroundColor: 'rgba(245, 165, 74, 0.2)', border: '2px solid rgba(245, 165, 74, 0.3)' }}>
                    <svg viewBox="0 0 1500 1500" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
                      <path d="M500 300 L300 800 L700 800 L500 1200 L1100 600 L700 600 L900 200 Z" fill="#F5A54A" stroke="none"/>
                      <path d="M200 400 Q200 300 300 300 L600 300 L500 500 L400 500 Q300 500 300 600 L300 900 Q300 1000 400 1000 L700 1000 L600 800 L500 800 Q600 800 600 700 L600 600" fill="none" stroke="white" strokeWidth="80" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span className="absolute -bottom-1 -right-1 block h-4 w-4 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: '#F5A54A' }}></span>
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">GRH Intelligence</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#F5A54A' }}></div>
                    <p className="text-xs font-medium" style={{ color: '#E8D5FF' }}>Active • Ready to assist</p>
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

          <div className="flex-1 p-5 overflow-y-auto bg-gradient-to-b from-purple-50 to-white space-y-5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.type === "bot" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white" style={{ background: 'linear-gradient(135deg, #4A3D7A 0%, #6B5BA0 100%)' }}>
                      <svg viewBox="0 0 20 20" className="w-5 h-5" fill="#F5A54A">
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                      </svg>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <div
                      className={`p-4 rounded-2xl shadow-md ${
                        msg.type === "user"
                          ? "rounded-br-md text-white"
                          : "rounded-bl-md border-2"
                      }`}
                      style={msg.type === "user" ? { background: 'linear-gradient(135deg, #F5A54A 0%, #FF9A3C 100%)' } : { backgroundColor: 'white', borderColor: '#E8D5FF' }}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={msg.type === "user" ? {} : { color: '#2D2640' }}>
                        {formatMessageText(msg.text)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 font-medium ${msg.type === "user" ? "text-right" : "text-left"}`} style={{ color: '#9B8AB5' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white" style={{ background: 'linear-gradient(135deg, #4A3D7A 0%, #6B5BA0 100%)' }}>
                    <svg viewBox="0 0 20 20" className="w-5 h-5" fill="#F5A54A">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                    </svg>
                  </div>
                  <div className="border-2 p-4 rounded-2xl rounded-bl-md shadow-md" style={{ backgroundColor: 'white', borderColor: '#E8D5FF' }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#4A3D7A' }}></div>
                      <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#4A3D7A', animationDelay: "0.15s" }}></div>
                      <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#4A3D7A', animationDelay: "0.3s" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {messages.length === 1 && !loading && (
              <div className="space-y-4 pt-4">
                <p className="text-xs font-semibold px-2 mb-3" style={{ color: '#4A3D7A' }}>⚡ Quick Actions:</p>
                
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(action)}
                      className="flex items-center gap-2 px-3 py-3 text-sm bg-white border-2 rounded-xl hover:shadow-lg transition-all duration-200 group"
                      style={{ borderColor: '#E8D5FF' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#4A3D7A';
                        e.currentTarget.style.backgroundColor = '#F9F7FC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E8D5FF';
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <span className="text-xl">{action.icon}</span>
                      <span className="text-xs font-medium" style={{ color: '#4A3D7A' }}>{action.text}</span>
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={startAssessment}
                  className="w-full p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-white relative overflow-hidden group"
                  style={{ background: 'linear-gradient(135deg, #F5A54A 0%, #FF9A3C 100%)' }}
                >
                  <div className="absolute inset-0 bg-white/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 61, 122, 0.2)' }}>
                        <span className="text-2xl">🧠</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">Psychometric Evaluation</p>
                        <p className="text-xs opacity-90">Discover your research potential</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            )}<div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t-2 bg-white" style={{ borderColor: '#E8D5FF' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything about GRH..."
            disabled={loading}
            className="flex-1 border-2 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200 placeholder-gray-400"
            style={{ borderColor: '#E8D5FF', focusRingColor: '#4A3D7A' }}
            onFocus={(e) => e.target.style.borderColor = '#4A3D7A'}
            onBlur={(e) => e.target.style.borderColor = '#E8D5FF'}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="text-white p-3.5 rounded-2xl hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center min-w-[52px]"
            style={{ background: loading || !input.trim() ? '#9B8AB5' : 'linear-gradient(135deg, #F5A54A 0%, #FF9A3C 100%)' }}
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
          <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: '#9B8AB5' }}>
            <svg className="w-3.5 h-3.5" fill="#F5A54A" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Powered by Advanced AI
          </p>
          <p className="text-xs font-medium" style={{ color: '#9B8AB5' }}>
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
