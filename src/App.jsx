import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Zap, Clock, ChevronRight, Share2, 
  BookOpen, Home, Database, Layers, BarChart3, Atom, Map, PieChart, FileText, ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

// --- 模拟数据 (后续将替换为 Firebase 实时数据) ---
const WEEKLY_TREND = [
  { week: 'W10', price: 27200 },
  { week: 'W11', price: 28100 },
  { week: 'W12', price: 28350 },
  { week: 'W13', price: 28500 },
];

const QUARTERLY_BALANCE = [
  { q: '2025-Q3', supply: 89, demand: 91 },
  { q: '2025-Q4', supply: 87, demand: 93 },
  { q: '2026-Q1', supply: 85, demand: 94 },
];

const App = () => {
  const [view, setView] = useState('market'); // 'market', 'macro', 'wiki'
  const [loading, setLoading] = useState(true);

  // 模拟加载效果
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const currentReport = {
    week_label: "2026-W13",
    lme_price: "28,500.00",
    change: "-0.5%",
    is_positive: false,
    summary: "本周锡市进入整理期，半导体补库信号与供应侧不确定性交织。LME库存微增对现货升水产生压力。",
    outlook: "短期看震荡，重点关注印尼出口许可审批进度及缅甸矿区政策变动。",
    dynamics: "AI 服务器对高可靠性焊料的需求较传统服务器提升约 35%，成为支撑消费端的核心动力。",
    inventory: "LME 库存本周增加 30 吨至 4,380 吨。SHFE 库存维持在 1.1 万吨附近，国内供需结构偏弱。"
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-blue-500 font-black tracking-widest text-xs animate-pulse">LOADING TIN-MARKET DATA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* 侧边导航 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Layers className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-white leading-none tracking-tighter">TIN-MARKET</span>
            <span className="text-[10px] text-blue-500 font-black tracking-[0.2em] uppercase text-left">Analyzer</span>
          </div>
        </div>
        
        <nav className="space-y-1.5 flex-1 text-left">
          <button onClick={() => setView('market')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'market' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <Home size={18} /> <span className="font-bold text-sm">市场分析 (周)</span>
          </button>
          <button onClick={() => setView('macro')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'macro' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <PieChart size={18} /> <span className="font-bold text-sm">宏观专题 (季)</span>
          </button>
          <button onClick={() => setView('wiki')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'wiki' ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20' : 'text-slate-500 hover:bg-slate-900'}`}>
            <BookOpen size={18} /> <span className="font-bold text-sm">锡知识百科</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-900">
          <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50">
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase mb-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              AI 系统在线
            </div>
            <p className="text-slate-500 text-[10px] leading-tight text-left">由 n8n + Gemini 2.5 驱动</p>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="lg:ml-64 p-4 lg:p-10 max-w-7xl mx-auto">
        
        {view === 'market' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <header className="mb-10 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">WEEKLY INSIGHT</span>
                <span className="text-blue-500 font-bold text-sm ml-2">{currentReport.week_label}</span>
              </div>
              <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">精锡市场监测报告</h1>
              <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">LME现货报价</span>
                  <div className="text-3xl font-mono font-bold text-white tracking-tighter italic">
                    ${currentReport.lme_price} 
                    <span className={`text-sm ml-2 ${currentReport.is_positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {currentReport.change}
                    </span>
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-slate-800" />
                <div className="flex flex-col">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">分析深度</span>
                  <div className="text-xl font-bold text-blue-400">Professional + AI</div>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2 italic"><BarChart3 size={20} className="text-blue-500" /> 价格趋势分析</h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={WEEKLY_TREND}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="week" stroke="#475569" axisLine={false} tickLine={false} dy={10} fontSize={12} />
                      <YAxis stroke="#475569" axisLine={false} tickLine={false} domain={['auto', 'auto']} fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={4} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl text-left">
                  <h4 className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-[0.2em]">本周智能摘要</h4>
                  <p className="text-slate-300 leading-relaxed italic text-sm">"{currentReport.summary}"</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] text-left shadow-xl shadow-blue-900/30">
                  <Zap className="text-yellow-400 mb-4" fill="currentColor" />
                  <h3 className="text-xl font-bold text-white mb-4 tracking-tight">操作策略建议</h3>
                  <p className="text-blue-100 text-sm leading-relaxed mb-6">
                    当前的逆价差结构显示近端供应依然偏紧，建议关注下周 SHFE 的库存去化速度以判断内外盘套利空间。
                  </p>
                  <div className="py-3 border-t border-white/10 text-xs text-blue-200 font-bold tracking-widest">
                    下周预测: {currentReport.outlook}
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] text-left">
                  <h4 className="text-white font-bold mb-4 italic">实物指标监控</h4>
                  <div className="space-y-5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">半导体开工率</span>
                      <span className="text-emerald-400 font-mono font-bold">72.4% ↑</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">注销仓单比例</span>
                      <span className="text-blue-400 font-mono font-bold">14.2% ↑</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">缅甸矿石出口</span>
                      <span className="text-rose-400 font-mono font-bold text-[10px]">REDUCED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'macro' && (
          <div className="animate-in slide-in-from-right-4 duration-500 text-left">
            <header className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">QUARTERLY REPORT</span>
                <span className="text-indigo-400 font-bold text-sm ml-2">2026-Q1</span>
              </div>
              <h1 className="text-4xl font-black text-white mb-4 leading-tight max-w-3xl tracking-tighter">全球锡供应链碎裂化与数字化复苏</h1>
            </header>
            <div className="bg-slate-950 border border-slate-800 p-10 rounded-[2.5rem]">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white italic">宏观供需缺口预测</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">基于对全球主要冶炼厂的调查和半导体补库周期的测算，预计 2026 年全年精锡缺口将扩大至 1.2 万吨。</p>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={QUARTERLY_BALANCE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="q" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                        <Bar dataKey="supply" fill="#312e81" name="供给" radius={[4,4,0,0]} />
                        <Bar dataKey="demand" fill="#6366f1" name="需求" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-3xl">
                    <h4 className="text-indigo-400 font-bold mb-2">💡 核心研报结论</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">“锡正在从'工业味精'转变为'数字能源金属'。AI 算力基建对焊料的品质要求提升了精锡的单体价值溢价。”</p>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all">
                    阅读完整季度宏观报告 <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'wiki' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 text-left">
            <header className="mb-12">
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">KNOWLEDGE BASE</span>
              <h1 className="text-4xl font-black text-white mt-4 tracking-tighter">锡 (Tin, Sn) 知识百科</h1>
              <p className="text-slate-400 mt-2 text-sm">由 NotebookLM 深度整合全球锡行业背景、物理特性及供应链全景知识。</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-10 bg-slate-950 border border-slate-800 rounded-[2.5rem] hover:border-emerald-500/50 transition-colors">
                <Atom className="text-emerald-500 mb-6" size={32} />
                <h3 className="text-xl font-bold text-white mb-4 italic">物理化学属性</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">低熔点 (231.9°C)、良好的延展性和抗腐蚀性，使其成为电子工业连接的基石。</p>
                <div className="text-xs font-mono text-emerald-400 bg-emerald-950/30 px-3 py-2 rounded-lg inline-block">Atomic Number: 50 | Density: 7.31 g/cm³</div>
              </div>
              <div className="p-10 bg-slate-950 border border-slate-800 rounded-[2.5rem] hover:border-emerald-500/50 transition-colors">
                <Map className="text-emerald-500 mb-6" size={32} />
                <h3 className="text-xl font-bold text-white mb-4 italic">全球供应地理</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">印尼、中国、缅甸和秘鲁贡献了全球 75% 以上的供应量。</p>
                <button className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">查看交互式地图 <ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;