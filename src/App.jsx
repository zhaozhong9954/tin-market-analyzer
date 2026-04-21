import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, ExternalLink, Globe, Search,
  Sparkles, MessageSquare, Volume2, Loader2, Send, X, Share2, Mail, ShieldAlert,
  ChevronDown, ChevronUp, Tag, Menu
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

/**
 * ✅ Firebase Config
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
  throw new Error("Gemini API Request Timeout.");
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

// --- Sub-component: Quarterly Report Card ---
const QuarterlyCard = ({ q, formatContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tags = Array.isArray(q.tags) ? q.tags : (q.tags ? String(q.tags).split(/[,，]/) : []);

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-6 lg:p-12 rounded-[2rem] lg:rounded-[3.5rem] hover:border-blue-600/50 transition-all text-left group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-lg shrink-0 overflow-hidden">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-xl lg:text-3xl font-black text-white uppercase italic leading-tight">{q.title}</h3>
            <div className="flex flex-wrap gap-2 mt-3 text-left">
              {tags.map((tag, idx) => (
                <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  <Tag size={8} /> {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <span className="text-[9px] font-black bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 uppercase tracking-widest border border-slate-700">ID: {q.id}</span>
        </div>
      </div>

      <div className="text-slate-300 leading-[1.8] text-[15px] lg:text-[16px] mb-6 italic text-left tracking-wide">
        {q.summary ? formatContent(q.summary) : "Expand to view deep analysis summary..."}
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="text-slate-400 leading-[1.9] whitespace-pre-line text-[14px] lg:text-[15px] text-left bg-slate-950/40 p-6 lg:p-8 rounded-[1.5rem] border border-slate-800/50 tracking-normal break-words">
            {formatContent(q.content || "Content syncing...")}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-4 flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
      >
        {isExpanded ? <><ChevronUp size={14} /> Hide Content</> : <><ChevronDown size={14} /> Read Full Report</>}
      </button>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState('market'); 
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [quarterlyReports, setQuarterlyReports] = useState([]); 
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [deepInsight, setDeepInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(() => setErrorMsg("Auth Error"));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        
        // --- Robust Data Mapping ---
        // Ensuring all possible AI output field names are captured
        const outlookContent = raw.outlook_analysis || "";
        const summaryContent = raw.summary || "";
        const linkedinContent = raw.linkedin_text || "";
        const emailContent = raw.email_content || raw.newsletter || raw.email || "";

        const cleanPrice = typeof raw.lme_price === 'string' ? parseFloat(raw.lme_price.replace(/,/g, '')) : raw.lme_price;
        const cleanPercent = typeof raw.change_percent === 'string' ? parseFloat(raw.change_percent.replace('%', '')) : raw.change_percent;
        
        return { 
          id: doc.id, 
          ...raw, 
          outlook: outlookContent,
          summary: summaryContent,
          linkedin_text: linkedinContent,
          email_content: emailContent,
          lme_price_numeric: cleanPrice, 
          change_percent_numeric: cleanPercent 
        };
      });
      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sortedData);
      setLatestReport(sortedData[0] || null);
      setLoading(false);
    }, () => setErrorMsg("Database restricted access"));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qReportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'quarterly_reports');
    const unsubscribe = onSnapshot(qReportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title || doc.id, ...doc.data() }));
      setQuarterlyReports(data.sort((a, b) => b.id.localeCompare(a.id)));
    });
    return () => unsubscribe();
  }, [user]);

  const formatContent = (text) => {
    if (!text) return "";
    return String(text).trim();
  };

  const generateDeepInsight = async () => {
    if (!latestReport) return;
    setInsightLoading(true);
    try {
      const prompt = `Analyze the impact of Tin price at $${latestReport.lme_price} based on: ${latestReport.summary}. Please output in English.`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      setDeepInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.");
    } catch (e) { console.error(e); } finally { setInsightLoading(false); }
  };

  const speakReport = async () => {
    if (!latestReport || ttsLoading) return;
    setTtsLoading(true);
    try {
      const text = `Say clearly in English: Market Summary. ${latestReport.summary}`;
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } }
        })
      });
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data && audioRef.current) {
        const pcm = new Uint8Array(window.atob(data).split("").map(c => c.charCodeAt(0)));
        audioRef.current.src = URL.createObjectURL(pcmToWav(pcm, 24000));
        audioRef.current.play();
      }
    } catch (e) { console.error(e); } finally { setTtsLoading(false); }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const systemPrompt = `You are a senior metal industry analyst. Current context: Tin price $${latestReport?.lme_price}. Please answer in English.`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: chatInput }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      setChatMessages(prev => [...prev, { role: 'ai', content: result.candidates?.[0]?.content?.parts?.[0]?.text || "AI offline." }]);
    } catch (e) { console.error(e); } finally { setChatLoading(false); }
  };

  if (loading && !latestReport) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  const NavContent = () => (
    <>
      <button onClick={() => { setView('market'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'market' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}>
        <Home size={18} /> Market Dashboard
      </button>
      <button onClick={() => { setView('quarterly'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'quarterly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}>
        <Calendar size={18} /> Quarterly Reports
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left relative overflow-x-hidden flex flex-col">
      <audio ref={audioRef} className="hidden" />

      {/* ✅ Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <img src="tin analyzer logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-800" onError={(e) => e.target.src="https://placehold.co/50x50?text=Sn"} />
           <span className="font-black text-white text-xs uppercase tracking-tight italic">Tin Terminal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-400 hover:text-white"><Menu size={24} /></button>
      </header>

      {/* ✅ Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 h-full bg-slate-950 border-r border-slate-800 p-8 animate-in slide-in-from-left duration-300">
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-6 right-6 text-slate-500"><X size={24} /></button>
            <div className="mb-12"><NavContent /></div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 z-20 text-left">
        <div className="flex items-center gap-3 mb-10 text-left">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden border border-slate-800">
            <img src="tin analyzer logo.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.src = "https://placehold.co/100x100?text=Sn"} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white leading-none uppercase tracking-tighter italic">Tin Terminal</span>
            <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase text-left">Intelligence</span>
          </div>
        </div>
        <nav className="space-y-2 flex-1"><NavContent /></nav>
        <div className="mt-auto space-y-4">
          <button onClick={() => setChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/20 transition-all"><MessageSquare size={16} /> ✨ Ask Think Tank</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-12 mt-16 lg:mt-0 max-w-7xl mx-auto text-left flex-1">
        {errorMsg && reports.length === 0 && (
          <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4 text-rose-400 text-sm">
            <ShieldAlert className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold mb-1 text-left">Data Connection Tip</p>
              <p className="opacity-90 leading-relaxed text-left">{errorMsg}</p>
            </div>
          </div>
        )}

        {view === 'market' && latestReport && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 text-left">
            <header className="mb-8 lg:mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="text-left">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase italic shadow-lg">Market Sync</span>
                  <span className="text-blue-500 font-mono text-[10px] font-bold ml-2">ID: {latestReport.id}</span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-black text-white mb-4 tracking-tighter italic uppercase text-left">Tin Weekly Market Monitor</h1>
                <div className="flex items-baseline gap-4">
                  <div className="text-4xl lg:text-5xl font-mono font-black text-white italic tracking-tighter text-left">${latestReport.lme_price}</div>
                  <div className={`text-lg lg:text-xl font-bold ${parseFloat(latestReport.change_percent) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{latestReport.change_percent}%</div>
                </div>
              </div>
              <button onClick={speakReport} disabled={ttsLoading} className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-700 shadow-lg transition-all">{ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} className="text-blue-500" />} ✨ Speak Summary</button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-950 border border-slate-800 p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] shadow-2xl overflow-hidden text-left">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6 italic text-left"><BarChart3 size={18} className="text-blue-500" /> LME Price Trend</h3>
                  <div className="h-[240px] lg:h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={[...reports].reverse()}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} /><XAxis dataKey="id" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} dy={10} /><Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} /><Area type="monotone" dataKey="lme_price_numeric" stroke="#3b82f6" strokeWidth={4} fill="url(#g)" /></AreaChart></ResponsiveContainer></div>
                </div>
                <div className="bg-blue-600/10 border border-blue-600/20 p-6 lg:p-8 rounded-[2rem] text-left">
                  <div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} /> AI Insight</h4><button onClick={generateDeepInsight} disabled={insightLoading} className="text-[10px] font-bold text-blue-400 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20">{insightLoading ? <Loader2 className="animate-spin" size={10} /> : "✨ Generate Insight"}</button></div>
                  <div className="text-slate-300 text-sm lg:text-base leading-relaxed italic">{deepInsight || latestReport.summary}</div>
                </div>
              </div>
              <div className="space-y-6 lg:space-y-8">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] shadow-xl text-left border border-blue-500/20">
                  <Zap className="text-yellow-400 mb-4" fill="currentColor" size={24} />
                  <h3 className="text-lg font-black text-white mb-4 uppercase italic">AI Outlook Strategy</h3>
                  <p className="text-blue-50 text-sm lg:text-base leading-relaxed font-medium opacity-95 whitespace-pre-line">
                    {latestReport.outlook || "AI generating outlook analysis..."}
                  </p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 p-6 lg:p-8 rounded-[2rem] border-dashed text-left"><h3 className="text-white font-black mb-4 text-[10px] uppercase tracking-widest text-slate-500">Archived Snapshots</h3><div className="space-y-3">{reports.slice(1, 5).map((r, idx) => (<div key={idx} className="flex justify-between items-center text-[11px] group"><span className="text-slate-500 font-mono group-hover:text-blue-400 transition-colors uppercase">{r.id}</span><span className="text-white font-bold tracking-tighter">${r.lme_price}</span></div>))}</div></div>
              </div>
            </div>
          </div>
        )}

        {view === 'quarterly' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            <h1 className="text-3xl lg:text-5xl font-black text-white mb-8 lg:mb-10 tracking-tighter uppercase italic text-left">Quarterly Deep Analysis</h1>
            <div className="grid grid-cols-1 gap-8 text-left">
              {quarterlyReports.length > 0 ? quarterlyReports.map(q => <QuarterlyCard key={q.id} q={q} formatContent={formatContent} />) : (
                <div className="bg-slate-900/30 border border-slate-800 border-dashed p-16 lg:p-24 rounded-[2rem] lg:rounded-[3.5rem] text-center"><HelpCircle className="mx-auto text-slate-800 mb-6" size={48} /><p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">No Quarterly Reports Found</p></div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ✅ Disclaimer Footer */}
      <footer className="w-full lg:pl-64 mt-auto border-t border-slate-800/50 bg-[#020617] pb-12 pt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-left">
          <div className="bg-slate-950/80 p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] border border-slate-800/60 shadow-inner">
            <div className="flex items-center gap-2 text-rose-500/80 font-black text-[9px] uppercase tracking-[0.25em] mb-4 text-left">
              <ShieldAlert size={14} /> IMPORTANT DISCLAIMER
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed italic text-left mb-4">
              The contents of this report and website (including but not limited to price analysis, market forecasts, AI insights, etc.) are for internal reference and information exchange purposes only. They **do not constitute any form of investment advice, legal advice, or business decision basis**.
            </p>
            <p className="text-slate-600 text-[10px] leading-relaxed italic text-left border-l-2 border-slate-800 pl-4">
              Investing in the market involves risk, and historical data is not indicative of future performance. Users are solely responsible for any investment actions taken based on the content of this site and the resulting consequences.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating AI Chat Button for Mobile */}
      <button onClick={() => setChatOpen(true)} className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 border border-blue-400/30 transition-transform active:scale-95"><Sparkles size={24} /></button>

      {/* AI Chat Drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-400 text-left">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950"><div className="flex items-center gap-2 text-white font-bold"><Sparkles size={18} className="text-indigo-400" /> ✨ Tin AI Think Tank</div><button onClick={() => setChatOpen(false)} className="text-slate-500 p-2 hover:bg-slate-900 rounded-lg"><X size={20} /></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide text-left">{chatMessages.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>{msg.content}</div></div>))}{chatLoading && <div className="flex justify-start text-left"><div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm"><Loader2 className="animate-spin text-blue-500" size={18} /></div></div>}</div>
            <div className="p-6 border-t border-slate-800 bg-slate-950"><div className="flex gap-2 text-left"><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleChat()} placeholder="Ask the analyst..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" /><button onClick={handleChat} disabled={chatLoading} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg shadow-blue-900/40"><Send size={18} /></button></div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
