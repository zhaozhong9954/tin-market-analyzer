import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Zap, Home, Layers, BarChart3, BookOpen, Database, Activity, Info
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
        
        // 数据清洗：统一处理价格
        const cleanPrice = typeof raw.lme_price === 'string' 
          ? parseFloat(raw.lme_price.replace(/,/g, '')) 
          : raw.lme_price;

        // 数据清洗：统一处理涨跌幅 (确保为数字)
        const cleanPercent = typeof raw.change_percent === 'string'
          ? parseFloat(raw.change_percent.replace('%', ''))
          : raw.change_percent;

        /**
         * 🛠 修复：字段映射适配
         * 处理 n8n 输出可能为 outlook_analysis 的情况
         */
        const outlookContent = raw.outlook || raw.outlook_analysis || "";

        return { 
          id: doc.id, 
          ...raw,
          outlook: outlookContent, // 统一导出为 outlook 供前端使用
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
      setErrorMsg("获取数据失败，请检查数据库权限规则设置。");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-500 font-black tracking-widest text-[10px] uppercase animate-pulse">Data Syncing...</p>
        </div>
      </div>
    );
  }

  // 渲染错误边界预防
  const isNegative = (val) => {
    const num = parseFloat(String(val).replace('%', ''));
    return num < 0;
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans text-left">
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-8 text-left">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white leading-none tracking-tighter">TIN-MARKET</span>
            <span className="text-[10px] text-blue-500 font-black tracking-[0.2em] uppercase">Control Center</span>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-600/20 font-bold text-sm">
            <Home size={18} /> 市场仪表盘
          </button>
        </nav>

        <div className="mt-auto bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 text-left">
          <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Connected
          </div>
          <p className="text-slate-500 text-[9px] font-mono truncate">{appId}</p>
        </div>
      </aside>

      <main className="lg:ml-64 p-6 lg:p-12 max-w-7xl mx-auto">
        {errorMsg && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
            <Info size={18} /> {String(errorMsg)}
          </div>
        )}

        {latestReport ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Latest Batch</span>
                <span className="text-blue-500 font-mono text-xs font-bold">ID: {latestReport.id}</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tighter">精锡市场周度监测报告</h1>
              <div className="flex items-baseline gap-4">
                <div className="text-4xl font-mono font-black text-white tracking-tighter">${latestReport.lme_price}</div>
                <div className={`text-lg font-bold ${isNegative(latestReport.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {latestReport.change_percent}%
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[120px] -z-10" />
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-8 italic">
                  <BarChart3 size={20} className="text-blue-500" /> LME 价格走势分析
                </h3>
                
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...reports].reverse()}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="id" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="lme_price_numeric" stroke="#3b82f6" strokeWidth={4} fill="url(#chartGrad)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-10 p-6 bg-blue-900/10 border border-blue-500/20 rounded-3xl">
                  <h4 className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-[0.2em]">本周核心摘要</h4>
                  <p className="text-slate-300 leading-relaxed text-sm italic font-medium">
                    "{latestReport.summary || "正在生成市场总结..."}"
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/20">
                  <Zap className="text-yellow-400 mb-4" fill="currentColor" size={28} />
                  <h3 className="text-xl font-bold text-white mb-4 tracking-tight text-left">AI 预测策略</h3>
                  <p className="text-blue-50 text-sm leading-relaxed opacity-90 text-left whitespace-pre-line">
                    {latestReport.outlook || "AI 正在评估未来趋势，请稍后刷新。"}
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem]">
                  <h3 className="text-white font-bold mb-6 flex items-center gap-2 italic text-left">往期存档</h3>
                  <div className="space-y-4">
                    {reports.length > 1 ? (
                      reports.slice(1, 6).map((report, idx) => (
                        <div key={idx} className="flex items-center justify-between group cursor-pointer text-left">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{report.id}</span>
                            <span className="text-sm font-bold text-slate-300 group-hover:text-blue-400 transition-colors">${report.lme_price}</span>
                          </div>
                          <div className={`text-[10px] font-bold ${isNegative(report.change_percent) ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {report.change_percent}%
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                        <Database className="mx-auto text-slate-700 mb-2" size={24} />
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">暂无更多存档</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-900/20 rounded-[3rem] border border-dashed border-slate-800">
            <Activity className="mx-auto text-slate-700 mb-4 animate-pulse" size={48} />
            <h2 className="text-xl font-bold text-slate-500">等待数据库推送第一份报告...</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;