import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Zap, Clock, ChevronRight, Share2, 
  BookOpen, Home, Database, Layers, BarChart3, Atom, Map, PieChart, FileText, ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- 导入 Firebase SDK ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

/**
 * ✅ 已经根据你提供的配置进行了修复
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

// 初始化 Firebase 服务
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * 重要：根据你之前的 Firestore 截图 (Unbenannt2.PNG)，
 * 你的 appId 应该是 "tin-market-analyzer" 而不是带 "-v1" 的版本。
 */
const appId = "tin-market-analyzer";

const App = () => {
  const [view, setView] = useState('market');
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. 处理身份认证 (匿名登录)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Firebase 认证失败:", err);
        if (err.code === 'auth/configuration-not-found') {
          setErrorMsg("请在 Firebase 控制台开启 'Anonymous' 登录方式");
        } else {
          setErrorMsg("Firebase 连接失败，请检查配置或网络");
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 实时监听 Firestore 数据
  useEffect(() => {
    if (!user) return;

    // 路径：artifacts / tin-market-analyzer / public / data / reports
    const reportsCol = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    
    const unsubscribe = onSnapshot(reportsCol, (snapshot) => {
      if (snapshot.empty) {
        console.warn("未在指定路径找到数据，请检查 appId 和集合名称");
      }
      
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // 按 ID (日期) 降序排列
      const sortedData = data.sort((a, b) => b.id.localeCompare(a.id));
      
      setReports(sortedData);
      setLatestReport(sortedData[0] || null);
      setLoading(false);
    }, (error) => {
      console.error("Firestore 同步错误:", error);
      setErrorMsg(`权限错误: 请确保 Firebase Rules 允许读取 artifacts/${appId} 路径`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 报错状态
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-3xl max-w-md">
          <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="text-rose-500" />
          </div>
          <h2 className="text-white font-bold mb-2 text-left">连接或配置异常</h2>
          <p className="text-rose-200/70 text-sm leading-relaxed text-left">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // 加载状态
  if (loading || !latestReport) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-blue-500 font-black tracking-widest text-xs animate-pulse uppercase">
            {loading ? "Synchronizing with Cloud..." : "Waiting for Firestore Data..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 text-left">
      {/* 侧边导航 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-6 text-left">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 text-left">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-lg font-black text-white leading-none tracking-tighter">TIN-MARKET</span>
            <span className="text-[10px] text-blue-500 font-black tracking-[0.2em] uppercase">Analyzer</span>
          </div>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          <button onClick={() => setView('market')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'market' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Home size={18} /> <span className="font-bold text-sm">市场分析</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-900 text-left">
          <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50">
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              LIVE CONNECTED
            </div>
            <p className="text-slate-500 text-[10px] leading-tight italic text-left">
              数据源: Google Firestore
            </p>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="lg:ml-64 p-4 lg:p-10 max-w-7xl mx-auto text-left">
        <header className="mb-10 text-left">
          <div className="flex items-center gap-2 mb-2 text-left">
            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase italic shadow-lg shadow-blue-900/40">REAL-TIME DATA</span>
            <span className="text-blue-500 font-bold text-sm ml-2 text-left">ID: {latestReport.id}</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tighter text-left">精锡市场周度监测报告</h1>
          <div className="text-3xl font-mono font-bold text-white tracking-tighter italic text-left">
            ${latestReport.lme_price} 
            <span className={`text-sm ml-2 ${String(latestReport.change_percent).includes('-') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {latestReport.change_percent}%
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none text-left" />
            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2 italic text-left"><BarChart3 size={20} className="text-blue-500 text-left" /> 价格趋势分析</h3>
            <div className="h-[350px] w-full text-left">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...reports].reverse()}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="id" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="lme_price" stroke="#3b82f6" strokeWidth={4} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl text-left">
              <h4 className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-[0.2em] text-left">本周 AI 核心摘要</h4>
              <p className="text-slate-300 leading-relaxed italic text-sm text-left">"{latestReport.summary}"</p>
            </div>
          </div>

          <div className="space-y-6 text-left">
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/30 text-left">
              <Zap className="text-yellow-400 mb-4 text-left" fill="currentColor" />
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight text-left text-left">AI 预测策略</h3>
              <p className="text-blue-100 text-sm leading-relaxed mb-6 text-left">
                {latestReport.outlook}
              </p>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] text-left">
              <h4 className="text-white font-bold mb-4 italic text-left">往期存档</h4>
              <div className="space-y-3 text-left">
                {reports.slice(1, 6).map((r, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-800 text-left">
                    <span className="text-slate-400 font-mono tracking-tighter text-left">{r.id}</span>
                    <span className="text-white font-bold text-left">${r.lme_price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;