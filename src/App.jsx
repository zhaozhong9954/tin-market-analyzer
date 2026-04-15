import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, BookOpen, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, ExternalLink, Globe, Search,
  Sparkles, MessageSquare, Volume2, Loader2, Send, X, Share2, Mail, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- 导入 Firebase SDK ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

/**
 * ✅ Firebase 配置
 */
const firebaseConfig = {
  apiKey: "AIzaSyBtsRxUcSd_43pvPMrLNlR8vpJcuixusBo",
  authDomain: "tin-market-analyzer.firebaseapp.com",
  projectId: "tin-market-analyzer",
  storageBucket: "tin-market-analyzer.firebasestorage.app",
  messagingSenderId: "855081672383",
  appId: "1:855081672383:web:ad6f551501b28268bf700a",
  measurementId: "G-7TE0M3R7KB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "tin-market-analyzer";

// --- Gemini API 服务配置 ---
const apiKey = ""; 

const fetchWithRetry = async (url, options, retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) break;
    } catch (e) {}
    await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
  }
  throw new Error("Gemini API 请求超时。");
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
  const [quarterlyReports, setQuarterlyReports] = useState([]); 
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [deepInsight, setDeepInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);

  // 1. 匿名登录
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch(err => setErrorMsg("登录失败"));
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 周报监听
  useEffect(() => {
    if (!user) return;
    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        const cleanPrice = typeof raw.lme_price === 'string' ? parseFloat(raw.lme_price.replace(/,/g, '')) : raw.lme_price;
        const cleanPercent = typeof raw.change_percent === 'string' ? parseFloat(raw.change_percent.replace('%', '')) : raw.change_percent;
        return { 
          id: doc.id, 
          ...raw,
          outlook: raw.outlook || raw.outlook_analysis || raw.outlook_text || "",
          lme_price_numeric: cleanPrice,
          change_percent_numeric: cleanPercent
        };
      });
      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sortedData);
      setLatestReport(sortedData[0] || null);
      setLoading(false);
    }, (error) => {
      if (reports.length === 0) setErrorMsg("数据同步受限，请确认 Firestore 规则。");
    });
    return () => unsubscribe();
  }, [user]);

  // 3. 季度报告监听
  useEffect(() => {
    if (!user) return;
    const qReportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'quarterly_reports');
    const unsubscribe = onSnapshot(qReportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        return {
          id: doc.id,
          title: raw.title || doc.id,
          content: raw.summary || raw.content || "",
          ...raw
        };
      });
      setQuarterlyReports(data.sort((a, b) => b.id.localeCompare(a.id)));
    });
    return () => unsubscribe();
  }, [user]);

  // --- 排版助手：修复多余换行导致的标点孤行问题 ---
  const formatContent = (text) => {
    if (!text) return "";
    return text
      .replace(/\n\s*[。|·|•]\s*\n/g, '\n• ') // 将孤立的符号转为行首列表项
      .replace(/\n\n+/g, '\n\n') // 压缩过多的空白行
      .trim();
  };

  const generateDeepInsight = async () => {
    if (!latestReport) return;
    setInsightLoading(true);
    try {
      const prompt = `分析锡价$${latestReport.lme_price}的影响：${latestReport.summary}。给出深度解读。`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      setDeepInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "暂无解读。");
    } catch (e) {
      console.error(e);
    } finally {
      setInsightLoading(false);
    }
  };

  const speakReport = async () => {
    if (!latestReport || ttsLoading) return;
    setTtsLoading(true);
    try {
      const text = `Say in Chinese: 这里是市场报告摘要。${latestReport.summary}`;
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
      if (base64Audio && audioRef.current) {
        const binaryString = window.atob(base64Audio);
        const pcmData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);
        const wavBlob = pcmToWav(pcmData, 24000);
        audioRef.current.src = URL.createObjectURL(wavBlob);
        audioRef.current.play();
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
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: chatInput }] }] })
      });
      setChatMessages(prev => [...prev, { role: 'ai', content: result.candidates?.[0]?.content?.parts?.[0]?.text || "AI 无响应。" }]);
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  const isNegative = (val) => parseFloat(String(val).replace('%', '')) < 0;

  if (loading && !latestReport) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left relative overflow-x-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-black text-white leading-none uppercase tracking-tighter italic">Tin Intelligence</span>
            <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase">Dashboard</span>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <button onClick={() => setView('market')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'market' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Home size={18} /> 市场仪表盘
          </button>
          <button onClick={() => setView('quarterly')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'quarterly' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Calendar size={18} /> 季度分析报告
          </button>
        </nav>

        <div className="mt-auto space-y-4">
          <button onClick={() => setChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/20 transition-all">
            <MessageSquare size={16} /> ✨ 问问 AI 智库
          </button>
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 text-left">
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> 系统在线
            </div>
            <p className="text-slate-500 text-[9px] font-mono truncate uppercase tracking-tighter">{appId}</p>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 p-6 lg:p-12 max-w-7xl mx-auto text-left">
        {errorMsg && reports.length === 0 && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
            <ShieldAlert size={18} /> {errorMsg}
          </div>
        )}

        {view === 'market' && latestReport && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase italic">Live Sync</span>
                  <span className="text-blue-500 font-mono text-xs font-bold ml-2">BATCH: {latestReport.id}</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tighter italic uppercase text-left">精锡市场周度监测报告</h1>
                <div className="flex items-baseline gap-4">
                  <div className="text-5xl font-mono font-black text-white italic tracking-tighter text-left">${latestReport.lme_price}</div>
                  <div className={`text-xl font-bold ${isNegative(latestReport.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {latestReport.change_percent}%
                  </div>
                </div>
              </div>
              <button onClick={speakReport} disabled={ttsLoading} className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-700 transition-all shadow-lg">
                {ttsLoading ? <Loader2 className="animate-spin text-blue-500" size={18} /> : <Volume2 size={18} className="text-blue-500" />} ✨ 播报摘要
              </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-left">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8 italic"><BarChart3 size={22} className="text-blue-500" /> LME 价格趋势波动</h3>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...reports].reverse()}>
                        <defs>
                          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="id" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                        <Area type="monotone" dataKey="lme_price_numeric" stroke="#3b82f6" strokeWidth={5} fill="url(#g)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-blue-600/10 border border-blue-600/20 p-8 rounded-[2.5rem] relative overflow-hidden group text-left">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 text-left"><Sparkles size={14} /> AI Deep Insight</h4>
                    <button onClick={generateDeepInsight} disabled={insightLoading} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20 shadow-sm">
                      {insightLoading ? <Loader2 className="animate-spin" size={14} /> : "✨ 生成深度解读"}
                    </button>
                  </div>
                  {deepInsight ? (
                    <div className="text-slate-300 text-[15px] leading-relaxed whitespace-pre-line italic text-left">{deepInsight}</div>
                  ) : (
                    <p className="text-slate-500 text-sm italic leading-relaxed text-left">"{latestReport.summary}"</p>
                  )}
                </div>
              </div>

              <div className="space-y-8 text-left">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[3rem] shadow-xl text-left border border-blue-500/20">
                  <Zap className="text-yellow-400 mb-4" fill="currentColor" size={28} />
                  <h3 className="text-xl font-black text-white mb-6 uppercase italic text-left">AI 预测策略</h3>
                  <p className="text-blue-50 text-[15px] leading-relaxed font-medium opacity-95 whitespace-pre-line text-left">
                    {latestReport.outlook || "AI 正在对未来供需进行深度建模..."}
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] border-dashed text-left">
                  <h3 className="text-white font-black mb-6 flex items-center gap-2 italic uppercase text-xs tracking-widest text-slate-400">往期快照</h3>
                  <div className="space-y-4">
                    {reports.slice(1, 6).map((r, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs group">
                        <span className="text-slate-500 font-mono uppercase group-hover:text-blue-400 transition-colors">{r.id}</span>
                        <span className="text-white font-bold tracking-tighter">${r.lme_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'quarterly' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-10 tracking-tighter uppercase italic text-left">季度深度分析存档</h1>
            <div className="grid grid-cols-1 gap-12 text-left">
              {quarterlyReports.length > 0 ? quarterlyReports.map(q => (
                <div key={q.id} className="bg-slate-900/50 border border-slate-800 p-8 lg:p-12 rounded-[3.5rem] hover:border-blue-600/50 transition-all text-left group">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10"><FileText size={28} /></div>
                    <h3 className="text-2xl lg:text-3xl font-black text-white uppercase italic text-left leading-tight">{q.title}</h3>
                  </div>
                  <div className="text-slate-300 leading-[1.8] whitespace-pre-line text-[16px] italic mb-10 text-left bg-slate-950/30 p-8 rounded-[2rem] border border-slate-800/50 tracking-wide overflow-hidden">
                    {formatContent(q.content)}
                  </div>
                  <div className="flex flex-wrap gap-3 text-left">
                    <span className="text-[10px] font-black bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 uppercase tracking-widest border border-slate-700">REF: {q.id}</span>
                    <span className="text-[10px] font-black bg-blue-600/20 px-3 py-1.5 rounded-lg text-blue-400 uppercase italic tracking-widest">NotebookLM Insight</span>
                  </div>
                </div>
              )) : (
                <div className="bg-slate-900/30 border border-slate-800 border-dashed p-24 rounded-[3.5rem] text-center">
                   <HelpCircle className="mx-auto text-slate-800 mb-6" size={56} />
                   <p className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] text-center">暂无季度报告存档</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* AI 聊天抽屉 */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-400 text-left">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 text-left">
              <div className="flex items-center gap-2 text-white font-bold tracking-tight text-left"><Sparkles size={18} className="text-indigo-400" /> ✨ 锡市 AI 智库</div>
              <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-900 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm"><Loader2 className="animate-spin text-blue-500" size={18} /></div></div>}
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-950 text-left">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleChat()} placeholder="咨询深度行业分析..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600" />
                <button onClick={handleChat} disabled={chatLoading} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 shadow-lg"><Send size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
