import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, BarChart3, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, ExternalLink, Globe, Search,
  Sparkles, MessageSquare, Volume2, Loader2, Send, X, Share2, Mail, ShieldAlert,
  ChevronDown, ChevronUp, Tag, Menu, Layers, BookOpen, Lock
} from 'lucide-react';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
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

// --- Helper Functions ---
const parseVal = (val, fallback = 'N/A') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    return val.current ?? val.pct_change ?? val.diff ?? fallback;
  }
  return String(val);
};

const parseWow = (val, fallback = '0') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    return val.pct_change ?? val.diff ?? fallback;
  }
  return String(val);
};

const parseNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object') {
    val = val.current ?? val.pct_change ?? 0;
  }
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/,/g, '').replace('%', '')) || 0;
  return 0;
};

// --- Clean Markdown (Remove References/Sources Section) ---
const cleanMarkdownReferences = (text) => {
  if (!text || typeof text !== 'string') return "";
  return text.split(/(?=#+\s*(References|Sources|参考|参考资料|Reference))/i)[0].trim();
};

// --- Sub-component: Markdown Viewer ---
const MarkdownViewer = ({ content }) => {
  const cleanedContent = cleanMarkdownReferences(content);
  if (!cleanedContent) {
    return <div className="text-slate-500 italic text-sm py-4">No report content available.</div>;
  }

  const renderFormattedMarkdown = (text) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-black text-white mt-8 mb-4 italic uppercase border-b border-slate-800 pb-2">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold text-blue-400 mt-6 mb-3 uppercase tracking-wide">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold text-slate-200 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={index} className="my-4 border-l-4 border-blue-500 bg-slate-900/60 p-4 rounded-r-xl italic text-slate-300">
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={index} className="ml-6 list-disc text-slate-300 my-1 leading-relaxed">
            {line.replace(/^[-*]\s+/, '')}
          </li>
        );
      }
      if (line.trim() === '') return <div key={index} className="h-4" />;

      return (
        <p key={index} className="text-slate-300 text-sm lg:text-base leading-relaxed my-2">
          {line}
        </p>
      );
    });
  };

  return <div className="markdown-body space-y-2">{renderFormattedMarkdown(cleanedContent)}</div>;
};

// --- Sub-component: KPI Metric Card ---
const KpiCard = ({ title, value, wow, subText }) => {
  const wowStr = parseWow(wow, '0');
  const wowNum = parseFloat(wowStr.replace('%', '')) || 0;
  const isPositive = wowNum >= 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-lg">
      <div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</div>
        <div className="text-xl lg:text-2xl font-mono font-black text-white italic tracking-tight">{parseVal(value)}</div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
        <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{wowStr ? `${isPositive && !wowStr.startsWith('+') ? '+' : ''}${wowStr}% WoW` : '0%'}</span>
        </div>
        {subText && <span className="text-[9px] text-slate-500 font-mono italic">{parseVal(subText)}</span>}
      </div>
    </div>
  );
};

// --- Sub-component: Quarterly Card ---
const QuarterlyCard = ({ q, formatContent, onOpenReader }) => {
  const tags = Array.isArray(q.tags) ? q.tags : (q.tags ? String(q.tags).split(/[,，]/) : []);

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-6 lg:p-12 rounded-[2rem] lg:rounded-[3.5rem] hover:border-blue-600/50 transition-all text-left group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 lg:w-14 lg:h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-lg shrink-0 overflow-hidden">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-xl lg:text-3xl font-black text-white uppercase italic leading-tight">{parseVal(q.title)}</h3>
            <div className="flex flex-wrap gap-2 mt-3 text-left">
              {tags.map((tag, idx) => (
                <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                  <Tag size={8} /> {String(tag).trim()}
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
        {q.summary ? formatContent(q.summary) : "Deep quarterly fundamental & macro outlook..."}
      </div>

      <button 
        onClick={() => onOpenReader(q.title || `Quarterly Report ${q.id}`, q.content || q.summary)}
        className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
      >
        <BookOpen size={14} /> Read Full Quarterly Report
      </button>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState('market'); 
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [quarterlyReports, setQuarterlyReports] = useState([]); 
  const [selectedWeekId, setSelectedWeekId] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // 弹窗状态管理
  const [fullReaderData, setFullReaderData] = useState(null); // 控制全文阅读器弹窗 ({ title, content })
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false); // 控制 Ask Think Tank 订阅弹窗
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [deepInsight, setDeepInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
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
        const webData = raw.webData || {};
        const metricsGrid = webData.metricsGrid || {};
        const baseline = webData.baseline || {};

        // 兼容 lme_3m_price 与 lme_price
        const lmePriceObj = metricsGrid.lme_3m_price ?? metricsGrid.lme_price ?? raw.lme_price;
        const shfePriceObj = metricsGrid.shfe_price ?? raw.shfe_price;
        const dxyObj = metricsGrid.dxy ?? raw.dxy;
        const lmeStockObj = metricsGrid.lme_stock ?? raw.lme_stock;
        const shfeStockObj = metricsGrid.shfe_stock ?? raw.shfe_stock;

        return { 
          id: doc.id, 
          ...raw, 
          webData,
          metricsGrid,
          baseline,
          
          // 统一提取价格与 WoW 字段
          lme_price_val: parseVal(lmePriceObj),
          lme_price_wow: parseWow(lmePriceObj ?? metricsGrid.lme_wow ?? raw.change_percent),
          
          shfe_price_val: parseVal(shfePriceObj),
          shfe_price_wow: parseWow(shfePriceObj ?? metricsGrid.shfe_wow),

          dxy_val: parseVal(dxyObj, '104.5'),
          dxy_wow: parseWow(dxyObj ?? metricsGrid.dxy_wow),

          lme_stock_val: parseVal(lmeStockObj),
          lme_stock_wow: parseWow(lmeStockObj ?? metricsGrid.lme_stock_wow),

          shfe_stock_val: parseVal(shfeStockObj),
          shfe_stock_wow: parseWow(shfeStockObj ?? metricsGrid.shfe_stock_wow),

          summary: parseVal(webData.summary || raw.summary, ""),
          outlook: parseVal(webData.outlook || raw.outlook_analysis || raw.outlook, ""),
          fullContentMarkdown: parseVal(webData.fullContentMarkdown || raw.content, ""),
          
          // 图表数值计算
          lme_price_numeric: parseNumber(lmePriceObj), 
          shfe_price_numeric: parseNumber(shfePriceObj),
          dxy_numeric: parseNumber(dxyObj),
          lme_stock_numeric: parseNumber(lmeStockObj),
          shfe_stock_numeric: parseNumber(shfeStockObj)
        };
      });

      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sortedData);
      
      if (sortedData.length > 0) {
        if (!selectedWeekId) setSelectedWeekId(sortedData[0].id);
        setLatestReport(sortedData.find(r => r.id === (selectedWeekId || sortedData[0].id)) || sortedData[0]);
      }
      setLoading(false);
    }, () => setErrorMsg("Database restricted access"));
    return () => unsubscribe();
  }, [user, selectedWeekId]);

  useEffect(() => {
    if (!user) return;
    const qReportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'quarterly_reports');
    const unsubscribe = onSnapshot(qReportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title || doc.id, ...doc.data() }));
      setQuarterlyReports(data.sort((a, b) => b.id.localeCompare(a.id)));
    });
    return () => unsubscribe();
  }, [user]);

  const activeReport = reports.find(r => r.id === selectedWeekId) || latestReport;

  const formatContent = (text) => {
    if (!text) return "";
    return parseVal(text, "").trim();
  };

  const generateDeepInsight = async () => {
    if (!activeReport) return;
    setInsightLoading(true);
    try {
      const priceVal = parseVal(activeReport.metricsGrid?.lme_price || activeReport.lme_price);
      const prompt = `Analyze the impact of Tin price at $${priceVal} based on: ${activeReport.summary}. Output in English.`;
      const result = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      setDeepInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.");
    } catch (e) { console.error(e); } finally { setInsightLoading(false); }
  };

  const speakReport = async () => {
    if (!activeReport || ttsLoading) return;
    setTtsLoading(true);
    try {
      const text = `Say clearly in English: Market Summary. ${activeReport.summary}`;
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

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <img src="tin analyzer logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-800" onError={(e) => e.target.src="https://placehold.co/50x50?text=Sn"} />
           <span className="font-black text-white text-xs uppercase tracking-tight italic">Tin Terminal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-400 hover:text-white"><Menu size={24} /></button>
      </header>

      {/* Mobile Menu Drawer */}
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
            <img src="tin analyzer logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.src = "https://placehold.co/100x100?text=Sn"} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white leading-none uppercase tracking-tighter italic">Tin Terminal</span>
            <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase text-left">Intelligence</span>
          </div>
        </div>
        <nav className="space-y-2 flex-1"><NavContent /></nav>
        <div className="mt-auto space-y-4">
          <button 
            onClick={() => setSubscriptionModalOpen(true)} 
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/20 transition-all"
          >
            <MessageSquare size={16} /> ✨ Ask Think Tank
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:ml-64 p-6 lg:p-12 mt-16 lg:mt-0 max-w-7xl mx-auto text-left flex-1 w-full">
        {errorMsg && reports.length === 0 && (
          <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4 text-rose-400 text-sm">
            <ShieldAlert className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold mb-1 text-left">Data Connection Tip</p>
              <p className="opacity-90 leading-relaxed text-left">{errorMsg}</p>
            </div>
          </div>
        )}

        {view === 'market' && activeReport && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 text-left space-y-8">
            
            {/* Header / Week Selector Bar */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase italic shadow-lg">Weekly Report</span>
                  <span className="text-blue-500 font-mono text-[10px] font-bold">ID: {activeReport.id}</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter italic uppercase">Global Tin Market Dashboard</h1>
              </div>

              {/* Week Selector Dropdown & Speak Button */}
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                {reports.length > 0 && (
                  <div className="relative">
                    <select 
                      value={selectedWeekId || activeReport.id} 
                      onChange={(e) => setSelectedWeekId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl appearance-none pr-10 focus:outline-none focus:border-blue-500 cursor-pointer shadow-lg"
                    >
                      {reports.map(r => (
                        <option key={r.id} value={r.id}>{r.id} (${parseVal(r.metricsGrid?.lme_price || r.lme_price)})</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
                <button onClick={speakReport} disabled={ttsLoading} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-700 shadow-lg transition-all">
                  {ttsLoading ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} className="text-blue-500" />} Speak Summary
                </button>
              </div>
            </header>

            {/* 1. TOP: Executive Key Metrics Grid (5 Cards) */}
            <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard 
                title="LME 3M Price" 
                value={`$${parseVal(activeReport.metricsGrid?.lme_price || activeReport.lme_price)}`} 
                wow={parseWow(activeReport.metricsGrid?.lme_wow || activeReport.change_percent)} 
                subText="USD / MT"
              />
              <KpiCard 
                title="SHFE Main Price" 
                value={`¥${parseVal(activeReport.metricsGrid?.shfe_price || activeReport.shfe_price)}`} 
                wow={parseWow(activeReport.metricsGrid?.shfe_wow)} 
                subText="RMB / MT"
              />
              <KpiCard 
                title="DXY Index" 
                value={parseVal(activeReport.metricsGrid?.dxy || activeReport.dxy, '104.5')} 
                wow={parseWow(activeReport.metricsGrid?.dxy_wow)} 
                subText="USD Index"
              />
              <KpiCard 
                title="LME Stock" 
                value={`${parseVal(activeReport.metricsGrid?.lme_stock || activeReport.lme_stock)} MT`} 
                wow={parseWow(activeReport.metricsGrid?.lme_stock_wow)} 
                subText={activeReport.baseline?.lme_stock_avg ? `4W Avg: ${parseVal(activeReport.baseline.lme_stock_avg)} MT` : 'LME Inventory'}
              />
              <KpiCard 
                title="SHFE Stock" 
                value={`${parseVal(activeReport.metricsGrid?.shfe_stock || activeReport.shfe_stock)} MT`} 
                wow={parseWow(activeReport.metricsGrid?.shfe_stock_wow)} 
                subText={activeReport.baseline?.shfe_stock_avg ? `4W Avg: ${parseVal(activeReport.baseline.shfe_stock_avg)} MT` : 'SHFE Inventory'}
              />
            </section>

            {/* 2. MIDDLE: Interactive Charts Section (Dual Charts) */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Price (LME/SHFE) vs DXY */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-[2rem] shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 italic">
                    <BarChart3 size={18} className="text-blue-500" /> Price vs. DXY Macro Alignment
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">LME (Left Y) / DXY (Right Y)</span>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...reports].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="id" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#3b82f6" fontSize={9} axisLine={false} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={9} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Area yAxisId="left" type="monotone" dataKey="lme_price_numeric" name="LME Price ($)" stroke="#3b82f6" fillOpacity={0.15} fill="#3b82f6" strokeWidth={3} />
                      <Line yAxisId="right" type="monotone" dataKey="dxy_numeric" name="DXY Index" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: LME Inventory vs SHFE Stock (Arbitrage) */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-[2rem] shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 italic">
                    <Layers size={18} className="text-emerald-500" /> Inventory & Regional Arbitrage
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">LME (Left Y) / SHFE (Right Y)</span>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...reports].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="id" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#10b981" fontSize={9} axisLine={false} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={9} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="lme_stock_numeric" name="LME Stock (MT)" stroke="#10b981" strokeWidth={3} />
                      <Line yAxisId="right" type="monotone" dataKey="shfe_stock_numeric" name="SHFE Stock (MT)" stroke="#8b5cf6" strokeWidth={3} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </section>

            {/* 3. BOTTOM: Executive Summary & Full Article Modal Trigger */}
            <section className="space-y-6">
              
              {/* AI Summary Callout Box */}
              <div className="bg-blue-950/40 border-l-4 border-blue-500 border-y border-r border-slate-800/80 p-6 lg:p-8 rounded-r-2xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={16} /> AI Executive Summary & Outlook Strategy
                  </h4>
                  <button onClick={generateDeepInsight} disabled={insightLoading} className="text-[10px] font-bold text-blue-400 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20 hover:bg-blue-600/20 transition-all">
                    {insightLoading ? <Loader2 className="animate-spin" size={10} /> : "✨ Regenerate Insight"}
                  </button>
                </div>
                
                <p className="text-slate-200 text-sm lg:text-base leading-relaxed font-medium italic">
                  {deepInsight || activeReport.summary}
                </p>

                {activeReport.outlook && (
                  <div className="pt-3 border-t border-blue-900/40 text-xs lg:text-sm text-blue-300 font-sans">
                    <strong className="text-blue-400 uppercase tracking-wider text-[10px] block mb-1">Market Outlook:</strong>
                    {activeReport.outlook}
                  </div>
                )}
              </div>

              {/* 开放阅读全文的入口（带预告提醒） */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-6 lg:p-8 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:border-blue-500/30 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-mono uppercase">
                    <FileText size={16} className="text-blue-500" />
                    <span>Full Weekly Intelligence Report ({activeReport.id})</span>
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-white italic">
                    Deep Dive: Weekly Macro & Physical Fundamental Analysis
                  </h3>
                  <p className="text-slate-400 text-xs lg:text-sm line-clamp-2 max-w-3xl">
                    {cleanMarkdownReferences(activeReport.fullContentMarkdown).substring(0, 220)}...
                  </p>
                </div>

                <button 
                  onClick={() => setFullReaderData({ title: `Tin Weekly Report (${activeReport.id})`, content: activeReport.fullContentMarkdown })}
                  className="shrink-0 flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30"
                >
                  <BookOpen size={16} /> Read Full Report
                </button>
              </div>

            </section>

          </div>
        )}

        {view === 'quarterly' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            <h1 className="text-3xl lg:text-5xl font-black text-white mb-8 lg:mb-10 tracking-tighter uppercase italic text-left">Quarterly Deep Analysis</h1>
            <div className="grid grid-cols-1 gap-8 text-left">
              {quarterlyReports.length > 0 ? quarterlyReports.map(q => (
                <QuarterlyCard 
                  key={q.id} 
                  q={q} 
                  formatContent={formatContent} 
                  onOpenReader={(title, content) => setFullReaderData({ title, content })} 
                />
              )) : (
                <div className="bg-slate-900/30 border border-slate-800 border-dashed p-16 lg:p-24 rounded-[2rem] lg:rounded-[3.5rem] text-center"><HelpCircle className="mx-auto text-slate-800 mb-6" size={48} /><p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">No Quarterly Reports Found</p></div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ✅ 全文阅读沉浸式 Modal（带未来订阅提醒 Banner） */}
      {fullReaderData && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex justify-center overflow-y-auto animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-slate-950 border-x border-slate-800 min-h-screen p-6 lg:p-12 text-left relative flex flex-col my-0 shadow-2xl">
            
            {/* Top Reader Header */}
            <div className="sticky top-0 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 pb-4 mb-6 flex justify-between items-center z-10 pt-2">
              <div className="flex items-center gap-3">
                <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded tracking-widest uppercase italic">Full Reader</span>
                <span className="text-blue-500 font-mono text-xs font-bold">{fullReaderData.title}</span>
              </div>
              <button 
                onClick={() => setFullReaderData(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all border border-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* 💡 未来订阅提示 Banner */}
            <div className="mb-8 bg-blue-950/40 border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3 text-xs text-blue-300">
              <Lock size={16} className="text-yellow-400 shrink-0" />
              <div>
                <strong className="text-white uppercase tracking-wide text-[10px] block mb-0.5">Free Public Preview Active</strong>
                Full reports are currently open to the public. In future versions, this deep analysis will move to our <strong>Pro Subscription Tier</strong>.
              </div>
            </div>

            {/* Markdown Body */}
            <div className="flex-1 text-slate-200">
              <MarkdownViewer content={fullReaderData.content} />
            </div>

            {/* Footer Back Button */}
            <div className="mt-12 pt-6 border-t border-slate-800 flex justify-between items-center">
              <button 
                onClick={() => setFullReaderData(null)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-800 transition-all"
              >
                ← Back to Dashboard
              </button>
              <span className="text-slate-600 text-[10px] font-mono uppercase">End of Intelligence Report</span>
            </div>

          </div>
        </div>
      )}

      {/* Ask Think Tank 订阅弹窗 */}
      {subscriptionModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 p-8 lg:p-10 rounded-[2.5rem] max-w-md w-full text-center relative shadow-2xl space-y-6">
            <button 
              onClick={() => setSubscriptionModalOpen(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white p-2 rounded-xl bg-slate-900"
            >
              <X size={18} />
            </button>

            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} className="text-yellow-400" />
            </div>

            <div className="space-y-2">
              <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest italic">
                Pro & Enterprise Service
              </span>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">AI Think Tank Coming Soon</h3>
              <p className="text-slate-400 text-xs leading-relaxed pt-2">
                Interactive AI Q&A and customized market hedging alerts will be officially unlocked in our upcoming **Pro Subscription Tier**.
              </p>
            </div>

            <button 
              onClick={() => setSubscriptionModalOpen(false)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/40"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer Footer */}
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

      {/* Floating AI Button for Mobile -> Triggers Subscription Notice */}
      <button 
        onClick={() => setSubscriptionModalOpen(true)} 
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 border border-blue-400/30 transition-transform active:scale-95"
      >
        <Sparkles size={24} />
      </button>

    </div>
  );
};

export default App;
