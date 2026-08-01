import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, BarChart3, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, ExternalLink, Globe, Search,
  Sparkles, MessageSquare, Volume2, Loader2, Send, X, Share2, Mail, ShieldAlert,
  ChevronDown, ChevronUp, Tag, Menu, Layers
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

// --- Sub-component: Simple Markdown Formatter ---
const MarkdownViewer = ({ content }) => {
  if (!content) return null;

  // Converts standard markdown headings, tables, bold text, lists into HTML layout
  const renderFormattedMarkdown = (text) => {
    const lines = text.split('\n');
    let inTable = false;
    let tableHeader = [];
    let tableRows = [];

    return lines.map((line, index) => {
      // Heading 1 & 2
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-black text-white mt-8 mb-4 italic uppercase border-b border-slate-800 pb-2">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold text-blue-400 mt-6 mb-3 uppercase tracking-wide">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold text-slate-200 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }

      // Blockquotes / Callouts
      if (line.startsWith('> ')) {
        return (
          <blockquote key={index} className="my-4 border-l-4 border-blue-500 bg-slate-900/60 p-4 rounded-r-xl italic text-slate-300">
            {line.replace('> ', '')}
          </blockquote>
        );
      }

      // Unordered List
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.replace(/^[-*]\s+/, '');
        return (
          <li key={index} className="ml-6 list-disc text-slate-300 my-1 leading-relaxed">
            {itemText}
          </li>
        );
      }

      // Simple Table Parser
      if (line.includes('|')) {
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cells.length > 0) {
          if (line.includes('---')) return null; // Table divider
          if (!inTable) {
            inTable = true;
            tableHeader = cells;
            return null;
          } else {
            tableRows.push(cells);
            return (
              <div key={index} className="overflow-x-auto my-4">
                <table className="w-full text-left border-collapse bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
                  <thead className="bg-slate-800/80 text-blue-400 text-xs uppercase tracking-wider">
                    <tr>{tableHeader.map((th, i) => <th key={i} className="p-3 border-b border-slate-700">{th}</th>)}</tr>
                  </thead>
                  <tbody className="text-sm text-slate-300 divide-y divide-slate-800">
                    {tableRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-800/30">
                        {row.map((td, cIdx) => <td key={cIdx} className="p-3">{td}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
      } else {
        inTable = false;
        tableHeader = [];
        tableRows = [];
      }

      // Paragraph
      if (line.trim() === '') return <div key={index} className="h-4" />;

      return (
        <p key={index} className="text-slate-300 text-sm lg:text-base leading-relaxed my-2">
          {line}
        </p>
      );
    });
  };

  return <div className="markdown-body space-y-2">{renderFormattedMarkdown(content)}</div>;
};

// --- Sub-component: KPI Metric Card ---
const KpiCard = ({ title, value, wow, subText, isPrice = false }) => {
  const isPositive = parseFloat(wow) >= 0;
  return (
    <div className="bg-slate-900/80 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-lg group">
      <div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</div>
        <div className="text-xl lg:text-2xl font-mono font-black text-white italic tracking-tight">{value || 'N/A'}</div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
        <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{wow ? `${isPositive ? '+' : ''}${wow}% WoW` : '0%'}</span>
        </div>
        {subText && <span className="text-[9px] text-slate-500 font-mono italic">{subText}</span>}
      </div>
    </div>
  );
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
  const [selectedWeekId, setSelectedWeekId] = useState(null);
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
        const webData = raw.webData || {};
        
        // Extract Metrics Grid Data with fallbacks
        const metricsGrid = webData.metricsGrid || {};
        const baseline = webData.baseline || {};

        const lmePrice = metricsGrid.lme_price || raw.lme_price || 0;
        const shfePrice = metricsGrid.shfe_price || raw.shfe_price || 0;
        const dxyVal = metricsGrid.dxy || raw.dxy || 0;
        const lmeStock = metricsGrid.lme_stock || raw.lme_stock || 0;
        const shfeStock = metricsGrid.shfe_stock || raw.shfe_stock || 0;

        return { 
          id: doc.id, 
          ...raw, 
          webData,
          metricsGrid,
          baseline,
          summary: webData.summary || raw.summary || "",
          outlook: webData.outlook || raw.outlook_analysis || raw.outlook || "",
          fullContentMarkdown: webData.fullContentMarkdown || raw.content || "",
          
          // Chart Numerical Values
          lme_price_numeric: typeof lmePrice === 'string' ? parseFloat(lmePrice.replace(/,/g, '')) : parseFloat(lmePrice), 
          shfe_price_numeric: typeof shfePrice === 'string' ? parseFloat(shfePrice.replace(/,/g, '')) : parseFloat(shfePrice),
          dxy_numeric: typeof dxyVal === 'string' ? parseFloat(dxyVal) : parseFloat(dxyVal),
          lme_stock_numeric: typeof lmeStock === 'string' ? parseFloat(lmeStock.replace(/,/g, '')) : parseFloat(lmeStock),
          shfe_stock_numeric: typeof shfeStock === 'string' ? parseFloat(shfeStock.replace(/,/g, '')) : parseFloat(shfeStock)
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
    return String(text).trim();
  };

  const generateDeepInsight = async () => {
    if (!activeReport) return;
    setInsightLoading(true);
    try {
      const prompt = `Analyze the impact of Tin price at $${activeReport.metricsGrid?.lme_price || activeReport.lme_price} based on: ${activeReport.summary}. Output in English.`;
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

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const systemPrompt = `You are a senior metal industry analyst. Current context: Tin price $${activeReport?.metricsGrid?.lme_price}. Please answer in English.`;
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
          <button onClick={() => setChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600/20 transition-all"><MessageSquare size={16} /> ✨ Ask Think Tank</button>
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
                        <option key={r.id} value={r.id}>{r.id} ({r.metricsGrid?.lme_price ? `$${r.metricsGrid.lme_price}` : `$${r.lme_price}`})</option>
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
                value={activeReport.metricsGrid?.lme_price ? `$${activeReport.metricsGrid.lme_price}` : `$${activeReport.lme_price}`} 
                wow={activeReport.metricsGrid?.lme_wow || activeReport.change_percent} 
                subText="USD / MT"
              />
              <KpiCard 
                title="SHFE Main Price" 
                value={activeReport.metricsGrid?.shfe_price ? `¥${activeReport.metricsGrid.shfe_price}` : `¥${activeReport.shfe_price || 'N/A'}`} 
                wow={activeReport.metricsGrid?.shfe_wow || '0'} 
                subText="RMB / MT"
              />
              <KpiCard 
                title="DXY Index" 
                value={activeReport.metricsGrid?.dxy || activeReport.dxy || '104.5'} 
                wow={activeReport.metricsGrid?.dxy_wow || '0'} 
                subText="USD Index"
              />
              <KpiCard 
                title="LME Stock" 
                value={activeReport.metricsGrid?.lme_stock ? `${activeReport.metricsGrid.lme_stock} MT` : `${activeReport.lme_stock || 'N/A'} MT`} 
                wow={activeReport.metricsGrid?.lme_stock_wow || '0'} 
                subText={activeReport.baseline?.lme_stock_avg ? `4W Avg: ${activeReport.baseline.lme_stock_avg} MT` : 'LME Inventory'}
              />
              <KpiCard 
                title="SHFE Stock" 
                value={activeReport.metricsGrid?.shfe_stock ? `${activeReport.metricsGrid.shfe_stock} MT` : `${activeReport.shfe_stock || 'N/A'} MT`} 
                wow={activeReport.metricsGrid?.shfe_stock_wow || '0'} 
                subText={activeReport.baseline?.shfe_stock_avg ? `4W Avg: ${activeReport.baseline.shfe_stock_avg} MT` : 'SHFE Inventory'}
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

            {/* 3. BOTTOM: Executive Summary Callout + Full Markdown Article */}
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

              {/* Full Markdown Article Body */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-6 lg:p-10 rounded-[2rem] shadow-2xl">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-6">
                  <FileText size={18} className="text-blue-500" />
                  <h3 className="text-base font-black text-white uppercase italic">Full Intelligence Report</h3>
                </div>

                {activeReport.fullContentMarkdown ? (
                  <MarkdownViewer content={activeReport.fullContentMarkdown} />
                ) : (
                  <div className="text-slate-500 italic text-sm py-8 text-center">
                    No full content markdown body uploaded for this week.
                  </div>
                )}
              </div>

            </section>

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
