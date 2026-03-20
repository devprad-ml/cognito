"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Play, BarChart2 } from 'lucide-react';

export default function Sidebar() {
  const path = usePathname();

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 p-2 rounded transition-colors ${
        path === href ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-300'
      }`}
    >
      {icon} {label}
    </Link>
  );

  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col p-4">
      <div className="flex items-center gap-3 mb-8 text-white">
        <Database className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold tracking-wide">Cognito</h1>
      </div>

      <nav className="space-y-2 flex-1">
        {navItem('/',       <Play className="w-4 h-4" />,     'New Research')}
        {navItem('/evals',  <BarChart2 className="w-4 h-4" />, 'Eval Dashboard')}
        
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
        Orchestrator-Worker Pattern <br />
        LangGraph • Next.js
      </div>
    </aside>
  );
}