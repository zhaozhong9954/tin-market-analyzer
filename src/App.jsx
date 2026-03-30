import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Zap, Clock, ChevronRight, Share2, 
  BookOpen, Home, Database, Layers, BarChart3, Atom, Map, PieChart, FileText, ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const HISTORY_DATA = [
  { week: 'W10', price: 27200 }, { week: 'W11', price: 28100 },
  { week: 'W12', price: 28350 }, { week: 'W13', price: 28500 },
];

const BALANCE_DATA = [
  { q: '2025-Q4', supply: 87, demand: 93 }, { q: '2026-Q1', supply: 85, demand: 94 },
];

export default function App() {
  const [view, setView] = useState('market');

  const report = {
    week: "2026-W13", price: "28,500.00", change: "-0.5%",
    summary: "本周锡市进入整理期，半导体补库信号与供应侧不确定性交织。",
    outlook: "短期看震荡，重点关注印尼出口许可审批进度。"
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-950 border-r border-slate-800 hidden lg:flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><Layers className="text-white" /></div>
          <span className="text-lg font-black text-white">TIN-MARKET</span>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setView('market')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${view === 'market' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500'}`}><Home size={18} /> 市场分析</button>
          <button onClick={() => setView('macro')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${view === 'macro' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-500'}`}><PieChart size={18} /> 宏观专题</button>
          <button onClick={() => setView('wiki')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${view === 'wiki' ? 'bg-emerald-600/10 text-emerald-400' : 'text-slate-500'}`}><BookOpen size={18} /> 知识百科</button>
        </nav>
      </aside>

      {/* 主内容 */}
      <main className="lg:ml-64 p-10 max-w-7xl mx-auto">
        {view === 'market' ? (
          <div className="text-left">
            <header className="mb-10">
              <span className="bg-blue-600 text-[10px] px-2 py-1 rounded font-black tracking-widest uppercase">WEEKLY INSIGHT {report.week}</span>
              <h1 className="text-4xl font-black text-white mt-4 tracking-tighter">精锡市场监测报告</h1>
              <div className="text-3xl font-mono font-bold text-white mt-4">${report.price} <span className="text-rose-400 text-sm">{report.change}</span></div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-8 rounded-[2rem]">
                <h3 className="mb-8 flex items-center gap-2"><BarChart3 size={20} className="text-blue-500" /> 价格趋势</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={HISTORY_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="week" stroke="#475569" fontSize={12} />
                      <YAxis stroke="#475569" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617' }} />
                      <Area type="monotone" dataKey="price" stroke="#3b82f6" fill="#3b82f633" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2rem] shadow-xl">
                <Zap className="text-yellow-400 mb-4" fill="currentColor" />
                <h3 className="text-xl font-bold mb-4">策略建议</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">{report.summary}</p>
                <div className="pt-4 border-t border-white/10 text-xs font-bold uppercase tracking-widest">预测: {report.outlook}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-left animate-in slide-in-from-right-4 duration-500">
             <header className="mb-10">
              <h1 className="text-4xl font-black text-white mb-4">专题内容建设中...</h1>
              <p className="text-slate-400">目前核心周报数据已打通，下周我们将填充宏观与百科板块。</p>
            </header>
          </div>
        )}
      </main>
    </div>
  );
}