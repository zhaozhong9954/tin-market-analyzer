import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, BookOpen, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, Linkedin, Mail, Sparkles, MessageSquare, Volume2, Loader2, Send, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- Firebase 初始化 ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

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
  throw new Error("API 请求失败，请稍后重试。");
};

// PCM16 to WAV 转换辅助函数
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

  // Gemini 相关状态
  const [deepInsight, setDeepInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    signInAnonymously(auth).catch(() => setErrorMsg("Auth Failed"));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        const cleanPrice = parseFloat(String(raw.lme_price || "0").replace(/,/g, ''));
        return { id: doc.id, ...raw, lme_price_numeric: cleanPrice };
      });
      const sorted = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sorted);
      setLatestReport(sorted[0] || null);
      setLoading(false);
    }, (err) => {
      setErrorMsg(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ✨ 功能：生成深度洞察
  const generateDeepInsight = async () => {
    if (!latestReport) return;
    setInsightLoading(true);
    try {
      const prompt = `基于以下锡市场周报数据提供深度的行业洞察：价格$${latestReport.lme_price}, 变动${latestReport.change_percent}%, 摘要: ${latestReport.summary}, 展望: ${latestReport.outlook}。请分点讨论对矿方、冶炼厂和下游消费方的具体影响。`;
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

  // ✨ 功能：TTS 播报报告
  const speakReport = async () => {
    if (!latestReport || ttsLoading) return;
    setTtsLoading(true);
    try {
      const textToSpeak = `Say professionally in Chinese: 这里是本周锡市场核心摘要。${latestReport.summary}`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: textToSpeak }] }],
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

  // ✨ 功能：智库对话
  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const systemPrompt = `你是一个资深的金属行业分析师。当前的锡市报告上下文是：${JSON.stringify(latestReport)}。请基于此回答用户的问题，并给出专业建议。`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: chatInput }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我无法回答这个问题。";
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading && !latestReport) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isNegative = (val) => parseFloat(String(val || "0").replace('%', '')) < 0;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left relative overflow-x-hidden">
      <audio ref={audioRef} className="hidden" />
      
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 z-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white leading-none tracking-tight">TIN-MARKET</span>
            <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase">AI Analytics</span>
          </div>
        </div>
        
        <nav className="space-y-1">
          {[
            { id: 'market', icon: Home, label: '市场仪表盘' },
            { id: 'quarterly', icon: Calendar, label: '季度分析' },
            { id: 'wiki', icon: BookOpen, label: '锡业百科' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <button 
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/20 transition-all"
          >
            <MessageSquare size={16} /> ✨ 问问 AI 智库
          </button>
          
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
            <div className="flex items-center gap-2 text-emerald-500 text-[9px] font-black uppercase mb-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live Cloud
            </div>
            <p className="text-slate-600 text-[9px] font-mono truncate uppercase">{appId}</p>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="lg:ml-64 p-6 lg:p-12 max-w-7xl mx-auto pb-24">
        {view === 'market' && latestReport && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase italic">BATCH: {latestReport.id}</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">精锡市场周度监测报告</h1>
                <div className="flex items-baseline gap-4">
                  <div className="text-5xl font-mono font-black text-white italic">${latestReport.lme_price}</div>
                  <div className={`text-xl font-bold ${isNegative(latestReport.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {latestReport.change_percent}%
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={speakReport}
                  disabled={ttsLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  {ttsLoading ? <Loader2 className="animate-spin" size={18} /> : <Volume2 size={18} />}
                  ✨ 播报报告
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8 text-left">
                {/* 走势图 */}
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8 italic"><BarChart3 size={20} className="text-blue-500" /> LME 价格趋势</h3>
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

                {/* AI 深度洞察入口 */}
                <div className="bg-blue-600/10 border border-blue-600/20 p-8 rounded-[2.5rem] relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={14} /> AI Deep Insight
                    </h4>
                    <button 
                      onClick={generateDeepInsight}
                      disabled={insightLoading}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      {insightLoading ? <Loader2 className="animate-spin" size={14} /> : "✨ 点击生成深度解读"}
                    </button>
                  </div>
                  {deepInsight ? (
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line animate-in fade-in duration-500">
                      {deepInsight}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm italic">"{latestReport.summary}"</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-600/5 border border-blue-600/20 p-6 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4 text-blue-400 font-black text-xs uppercase"><Linkedin size={16}/> LinkedIn</div>
                    <p className="text-slate-400 text-xs leading-relaxed italic line-clamp-3">{latestReport.linkedin_text || "等待内容推送..."}</p>
                  </div>
                  <div className="bg-indigo-600/5 border border-indigo-600/20 p-6 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4 text-indigo-400 font-black text-xs uppercase"><Mail size={16}/> Newsletter</div>
                    <p className="text-slate-400 text-xs leading-relaxed italic line-clamp-3">{latestReport.email_content || "Newsletter 已就绪..."}</p>
                  </div>
                </div>
              </div>

              {/* 侧边分析 */}
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/20">
                  <Zap className="text-yellow-400 mb-4" fill="currentColor" />
                  <h3 className="text-xl font-black text-white mb-6 uppercase italic">AI 预测策略</h3>
                  <p className="text-blue-50 text-[15px] leading-relaxed font-medium opacity-90 whitespace-pre-line">
                    {latestReport.outlook || "AI 正在生成市场深度预测..."}
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] border-dashed">
                  <h3 className="text-slate-500 font-black mb-6 uppercase text-xs tracking-widest">历史报告</h3>
                  <div className="space-y-4">
                    {reports.slice(1, 5).map(r => (
                      <div key={r.id} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-mono">{r.id}</span>
                        <span className="text-white font-bold">${r.lme_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ✨ AI 聊天抽屉 */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <span className="font-bold">✨ 锡市 AI 智库</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl text-xs text-blue-400">
                你可以询问关于本报告的细节，例如：“为什么库存增加了？”或“下游焊料需求前景如何？”
              </div>
              
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 p-4 rounded-2xl">
                    <Loader2 className="animate-spin text-blue-500" size={18} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                  placeholder="输入你的问题..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
                <button 
                  onClick={handleChat}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;