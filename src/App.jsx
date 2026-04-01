import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, BookOpen, 
  Database, Activity, Info, Calendar, FileText, HelpCircle, 
  ChevronRight, ArrowRight, ExternalLink, Globe
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

const App = () => {
  const [view, setView] = useState('market'); // 'market', 'quarterly', 'wiki'
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. 匿名登录
  useEffect(() => {
    signInAnonymously(auth).catch(err => {
      console.error("Auth error:", err);
      setErrorMsg("身份验证失败，请确认 Firebase 后台已开启匿名登录。");
    });
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. 监听数据并进行清洗
  useEffect(() => {
    if (!user) return;

    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        
        // 价格清洗 (字符串 -> 数字)
        const cleanPrice = typeof raw.lme_price === 'string' 
          ? parseFloat(raw.lme_price.replace(/,/g, '')) 
          : raw.lme_price;

        // 涨跌幅清洗
        const cleanPercent = typeof raw.change_percent === 'string'
          ? parseFloat(raw.change_percent.replace('%', ''))
          : raw.change_percent;

        /**
         * 🛠 深度修复 Outlook 映射
         * 遍历所有可能的字段名，防止由于 AI 输出键名微调导致的显示为空
         */
        const outlookContent = 
          raw.outlook || 
          raw.outlook_analysis || 
          raw.outlookAnalysis || 
          raw.outlook_text || 
          raw.market_outlook || 
          raw.analysis ||
          "";

        return { 
          id: doc.id, 
          ...raw,
          outlook: outlookContent, // 统一导出为 outlook
          lme_price_numeric: cleanPrice,
          change_percent_numeric: cleanPercent
        };
      });
      
      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id));
      setReports(sortedData);
      setLatestReport(sortedData[0] || null);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setErrorMsg("获取数据失败，请检查数据库权限。");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 渲染助手：颜色判断
  const isNegative = (val) => {
    const num = parseFloat(String(val).replace('%', ''));
    return num < 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-500 font-black tracking-widest text-[10px] uppercase animate-pulse">Syncing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left selection:bg-blue-500/30">
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 text-left z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-black text-white leading-none tracking-tighter uppercase">Tin Market</span>
            <span className="text-[10px] text-blue-500 font-black tracking-[0.2em] uppercase">Control Center</span>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setView('market')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'market' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}
          >
            <Home size={18} /> 市场仪表盘
          </button>
          <button 
            onClick={() => setView('quarterly')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'quarterly' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}
          >
            <Calendar size={18} /> 季度深度报告
          </button>
          <button 
            onClick={() => setView('wiki')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'wiki' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-900'}`}
          >
            <BookOpen size={18} /> 锡业百科
          </button>
        </nav>

        <div className="mt-auto bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
          <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Connected
          </div>
          <p className="text-slate-500 text-[9px] font-mono truncate uppercase tracking-tighter">{appId}</p>
        </div>
      </aside>

      {/* 主界面 */}
      <main className="lg:ml-64 p-6 lg:p-12 max-w-7xl mx-auto text-left">
        {errorMsg && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
            <Info size={18} /> {String(errorMsg)}
          </div>
        )}

        {/* 1. 市场仪表盘视图 */}
        {view === 'market' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-12 text-left">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase italic shadow-lg shadow-blue-900/20">Market Live</span>
                <span className="text-blue-500 font-mono text-xs font-bold ml-2">BATCH: {latestReport?.id}</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tighter uppercase italic text-left">精锡市场周度监测报告</h1>
              {latestReport && (
                <div className="flex items-baseline gap-4 text-left">
                  <div className="text-5xl font-mono font-black text-white tracking-tighter italic">${latestReport.lme_price}</div>
                  <div className={`text-xl font-bold ${isNegative(latestReport.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {latestReport.change_percent}%
                  </div>
                </div>
              )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              {/* 图表卡片 */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[120px] -z-10" />
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8 italic text-left">
                  <BarChart3 size={22} className="text-blue-500" /> LME 价格趋势波动
                </h3>
                
                <div className="h-[300px] w-full text-left">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...reports].reverse()}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="id" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '12px' }}
                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="lme_price_numeric" stroke="#3b82f6" strokeWidth={5} fill="url(#chartGrad)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-10 p-8 bg-blue-900/10 border border-blue-500/20 rounded-[2rem] text-left">
                  <h4 className="text-[10px] font-black text-blue-400 mb-3 uppercase tracking-[0.3em] text-left">本周核心摘要</h4>
                  <p className="text-slate-200 leading-relaxed text-sm italic font-medium text-left">
                    "{latestReport?.summary || "正在同步最新的市场概览内容..."}"
                  </p>
                </div>
              </div>

              {/* 侧边分析 */}
              <div className="space-y-8 text-left">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[3rem] shadow-xl shadow-blue-900/20 relative overflow-hidden group text-left">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Zap size={64} fill="white" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-6 tracking-tight uppercase italic text-left">AI 预测策略</h3>
                  <p className="text-blue-50 text-[15px] leading-relaxed font-medium opacity-95 whitespace-pre-line text-left">
                    {latestReport?.outlook || latestReport?.outlook_analysis || "AI 正在对未来供需关系进行深度建模预测，请稍后刷新。"}
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[3rem] border-dashed text-left">
                  <h3 className="text-white font-black mb-6 flex items-center gap-2 italic uppercase text-sm tracking-widest text-slate-400 text-left">往期报告存档</h3>
                  <div className="space-y-4 text-left">
                    {reports.length > 1 ? (
                      reports.slice(1, 6).map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between group cursor-pointer text-left">
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase text-left">{r.id}</span>
                            <span className="text-sm font-bold text-slate-300 group-hover:text-blue-400 transition-colors tracking-tight text-left">${r.lme_price}</span>
                          </div>
                          <div className={`text-[10px] font-black ${isNegative(r.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {r.change_percent}%
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <Database className="mx-auto text-slate-800 mb-3" size={32} />
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">No Archived Data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 季度报告视图 */}
        {view === 'quarterly' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left">
            <header className="mb-12 text-left">
              <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase mb-4 inline-block shadow-lg shadow-indigo-900/20">Deep Analysis</span>
              <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic text-left">季度锡产业深度展望</h1>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              {[1, 2].map(i => (
                <div key={i} className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] group hover:border-blue-600/50 transition-all cursor-pointer text-left">
                  <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-xl font-black text-white mb-3 text-left">2026 Q{i} 锡精矿供应缺口分析</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6 text-left">针对主要生产国（缅甸、印尼、刚果金）的最新进出口数据及矿山复产进度的深度垂直报告...</p>
                  <div className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest text-left">
                    Read Report <ArrowRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. 百科视图 */}
        {view === 'wiki' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-left">
             <header className="mb-12 text-left">
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase mb-4 inline-block shadow-lg shadow-emerald-900/20">Knowledge Base</span>
              <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase italic text-left">锡产业百科词条</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 text-left">
              <div className="lg:col-span-1 space-y-2 text-left">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 text-left">词条分类</p>
                {['基础知识', '定价机制', '下游应用', '环保政策'].map(t => (
                  <button key={t} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all">{t}</button>
                ))}
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                 {['LME 升贴水', 'FOT 报价', '焊料应用', '半导体封测'].map(item => (
                   <div key={item} className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl flex items-center justify-between group hover:bg-slate-900 transition-colors cursor-pointer text-left">
                     <span className="font-bold text-slate-300 text-left">{item}</span>
                     <ChevronRight size={16} className="text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;