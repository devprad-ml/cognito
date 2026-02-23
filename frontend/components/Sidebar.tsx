import React from 'react';

import { Database, Play, FileText, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col p-4">
      <div className="flex items-center gap-3 mb-8 text-white">
        <Database className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold tracking-wide">Cognito</h1>
      </div>
      
      <nav className="space-y-2 flex-1">
        <button className="w-full flex items-center gap-3 p-2 rounded bg-slate-800 text-white transition-colors">
          <Play className="w-4 h-4" /> New Research
        </button>
        <button className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition-colors">
          <FileText className="w-4 h-4" /> History (pgvector)
        </button>
        <button className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition-colors">
          <Settings className="w-4 h-4" /> Agent Settings
        </button>
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
        Orchestrator-Worker Pattern <br/> 
        LangGraph • Next.js
      </div>
    </aside>
  );
}