import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, BookOpen, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, Share2, Mail, Sparkles, MessageSquare, Volume2, Loader2, Send, X, AlertCircle, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- Firebase 初始化 ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc } from 'firebase/firestore';

/**
 * 🛠️ Firebase 配置
 */
const firebaseConfig = {
  apiKey: "AIzaSyBtsRxUcSd_43pvPMrLNlR8vpJcuixusBo",
  authDomain: "tin-market-analyzer.firebaseapp.com",
  projectId: "tin-market-analyzer",
  storageBucket: "tin-market-analyzer.firebasestorage.app",
  messagingSenderId: "855081672383",
  appId: "1:855081672383:web:ad6f551501b28268bf700a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * 重要：锁定 appId 路径
 */
const appId = "tin-market-analyzer";

// --- Gemini API 服务配置 ---
const apiKey = ""; // 运行时环境会自动提供

const fetchWithRetry = async (url, options, retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) break;
    } catch (e) {}
    await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
  }
  throw new Error("Gemini API 请求失败。");
};

const pcmToWav = (pcmData, sampleRate) => {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);
  const pcmBytes = new Uint8Array(pcmData);
  for (let i = 0; i < pcmData.length; i++) view.setUint8(44 + i, pcmBytes[i]);
  return new Blob([buffer], { type: 'audio/wav' });
};

const App = () => {
  const [view, setView] = useState('market'); 
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Gemini 状态
  const [deepInsight, setDeepInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);

  // 1. Firebase 认证
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setErrorMsg(`认证错误: ${err.message}`);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 获取数据并进行多字段智能映射
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    
    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        
        // 🛠️ 智能字段映射：解决 outlook_analysis 引用问题
        // 尝试从 outlook, outlook_analysis 或 market_outlook 提取内容
        const outlookText = raw.outlook || raw.outlook_analysis || raw.market_outlook || "";
        
        // 同样处理社交媒体内容
        const linkedinText = raw.linkedin_text || raw.linkedin || raw.social_media_post || "";
        const emailContent = raw.email_content || raw.email || raw.newsletter || "";

        const priceStr = String(raw.lme_price || "0").replace(/,/g, '');
        
        return { 
          id: doc.id, 
          ...raw, 
          outlook: outlookText,
          linkedin_text: linkedinText,
          email_content: emailContent,
          lme_price_numeric: parseFloat(priceStr) 
        };
      });
      const sorted = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sorted);
      setLatestReport(sorted[0] || null);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setErrorMsg(`权限错误: 数据库拒绝了访问。请检查路径: artifacts/${appId}/...`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ✨ Gemini 功能
  const generateDeepInsight = async () => {
    if (!latestReport) return;
    setInsightLoading(true);
    try {
      const prompt = `分析锡价$${latestReport.lme_price}带来的行业影响：摘要为${latestReport.summary}。请给出深度解读。`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      setDeepInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "解读生成失败。");
    } catch (e) {
      setErrorMsg("AI 分析失败。");
    } finally {
      setInsightLoading(false);
    }
  };

  const speakReport = async () => {
    if (!latestReport || ttsLoading) return;
    setTtsLoading(true);
    try {
      const text = `Say in Chinese: 这里是本周锡市场报告。${latestReport.summary}`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { 
            responseModalities: ["AUDIO"], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } 
          }
        })
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = window.atob(base64Audio);
        const pcmData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);
        const wavBlob = pcmToWav(pcmData, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const systemPrompt = `分析师背景。当前锡市：${latestReport.summary}。`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: chatInput }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI 无法解析。";
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    } catch (e) {
      setErrorMsg("聊天连接失败。");
    } finally {
      setChatLoading(false);
    }
  };

  if (loading && !latestReport) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const isNegative = (val) => parseFloat(String(val || "0").replace('%', '')) < 0;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left relative overflow-x-hidden">
      <audio ref={audioRef} className="hidden" />
      
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 z-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-black text-white leading-none">TIN-MARKET</span>
            <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase">Intelligence</span>
          </div>
        </div>
        
        <nav className="space-y-1">
          <button onClick={() => setView('market')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'market' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Home size={18} /> 市场仪表盘
          </button>
          <button onClick={() => setView('quarterly')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'quarterly' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Calendar size={18} /> 季度分析
          </button>
        </nav>

        <div className="mt-auto space-y-4">
          <button onClick={() => setChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/20 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/30 transition-all">
            <MessageSquare size={16} /> ✨ AI 智库
          </button>
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 text-[9px] font-mono text-slate-500">
            <div className="flex items-center gap-2 text-emerald-500 font-black uppercase mb-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live System
            </div>
            ID: {appId}
          </div>
        </div>
      </aside>

      {/* 主界面 */}
      <main className="lg:ml-64 p-6 lg:p-12 max-w-7xl mx-auto pb-24 text-left">
        {errorMsg && (
          <div className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-400 text-sm animate-in fade-in duration-500">
            <ShieldAlert className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold mb-1 text-left">数据库访问受限 (Permission Denied)</p>
              <p className="opacity-90 leading-relaxed mb-3 text-left">{errorMsg}</p>
              <div className="bg-black/20 p-3 rounded-lg border border-red-500/10 text-xs leading-relaxed text-left">
                <strong>💡 解决方案：</strong>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  <li>请确认 Firebase Console 的 Rules 允许读取 <code>artifacts/{appId}/</code></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {view === 'market' && latestReport && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-left">
              <div>
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase mb-4 inline-block tracking-widest italic shadow-lg shadow-blue-500/20">LIVE SYNC</span>
                <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tighter uppercase italic text-left">精锡市场周度监测报告</h1>
                <div className="flex items-baseline gap-4 text-left">
                  <div className="text-5xl font-mono font-black text-white italic text-left">${latestReport.lme_price}</div>
                  <div className={`text-xl font-bold ${isNegative(latestReport.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {latestReport.change_percent}%
                  </div>
                </div>
              </div>
              <button onClick={speakReport} disabled={ttsLoading} className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-700 transition-all disabled:opacity-50">
                {ttsLoading ? <Loader2 className="animate-spin text-blue-500" size={18} /> : <Volume2 size={18} />} ✨ 播报报告
              </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8 italic text-left"><BarChart3 size={20} className="text-blue-500" /> 价格波动趋势</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...reports].reverse()}>
                        <defs>
                          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="id" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="lme_price_numeric" stroke="#3b82f6" strokeWidth={4} fill="url(#g)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-blue-600/10 border border-blue-600/20 p-8 rounded-[2.5rem] relative overflow-hidden text-left">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} /> AI Deep Insight</h4>
                    <button onClick={generateDeepInsight} disabled={insightLoading} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20">
                      {insightLoading ? <Loader2 className="animate-spin" size={14} /> : "✨ 生成深度解读"}
                    </button>
                  </div>
                  {deepInsight ? (
                    <div className="text-slate-300 text-[15px] leading-relaxed whitespace-pre-line animate-in fade-in duration-700 italic text-left">{deepInsight}</div>
                  ) : (
                    <p className="text-slate-500 text-sm italic leading-relaxed text-left">"{latestReport.summary}"</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group">
                    <div className="flex items-center gap-2 mb-4 text-blue-400 font-black text-xs uppercase italic text-left"><Share2 size={16}/> LinkedIn Draft</div>
                    <p className="text-slate-400 text-xs leading-relaxed italic line-clamp-4 group-hover:line-clamp-none transition-all text-left">{latestReport.linkedin_text || "等待同步内容..."}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group">
                    <div className="flex items-center gap-2 mb-4 text-indigo-400 font-black text-xs uppercase italic text-left"><Mail size={16}/> Newsletter</div>
                    <p className="text-slate-400 text-xs leading-relaxed italic line-clamp-4 group-hover:line-clamp-none transition-all text-left">{latestReport.email_content || "草案准备中..."}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8 text-left">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] shadow-2xl border border-blue-500/20">
                  <Zap className="text-yellow-400 mb-4 text-left" fill="currentColor" size={24} />
                  <h3 className="text-xl font-black text-white mb-6 uppercase italic text-left">AI 预测策略</h3>
                  <p className="text-blue-50 text-[15px] leading-relaxed font-medium opacity-95 whitespace-pre-line italic text-left">
                    {latestReport.outlook || "AI 正在评估未来趋势，请稍后刷新。"}
                  </p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] border-dashed text-left">
                  <h3 className="text-slate-500 font-black mb-6 uppercase text-[10px] tracking-widest text-left">历史数据快照</h3>
                  <div className="space-y-4">
                    {reports.slice(1, 6).map(r => (
                      <div key={r.id} className="flex justify-between items-center text-xs p-2 hover:bg-slate-800 rounded-lg transition-colors group">
                        <span className="text-slate-500 font-mono group-hover:text-blue-400">{r.id}</span>
                        <span className="text-white font-bold tracking-tighter">${r.lme_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI 智库 */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-2 text-white font-bold tracking-tight"><Sparkles size={18} /> ✨ 锡市 AI 智库</div>
              <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'}`}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-slate-800 p-4 rounded-2xl border border-slate-700"><Loader2 className="animate-spin text-blue-500" size={18} /></div></div>}
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-950">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleChat()} placeholder="咨询行业深度分析..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600" />
                <button onClick={handleChat} disabled={chatLoading} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50"><Send size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;