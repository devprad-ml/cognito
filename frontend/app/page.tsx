"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAgentStream } from '../hooks/useAgentStream';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

export default function Dashboard() {
  const [queryInput, setQueryInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Custom Hook managing our SSE connection and state
  const { stage, plan, report, isProcessing, startResearch, approvePlan } = useAgentStream();

  // Auto-scroll logic
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stage, plan, report]);

  const handleStart = () => {
    if (!queryInput.trim()) return;
    setActiveQuery(queryInput);
    startResearch(queryInput);
    setQueryInput('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-4 shadow-sm flex justify-between items-center z-10">
          <h2 className="text-lg font-semibold text-slate-700">Research Terminal</h2>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${stage !== 'idle' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
              Status: {stage.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </header>

        {/* Main Conversation Area */}
        <ChatArea 
          query={activeQuery}
          stage={stage}
          plan={plan}
          report={report}
          isProcessing={isProcessing}
          onApprove={approvePlan}
          chatEndRef={chatEndRef}
        />

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="max-w-3xl mx-auto flex gap-3 relative">
            <input 
              type="text" 
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={stage !== 'idle'}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              placeholder="E.g., Analyze the current market landscape for solid-state batteries..."
              className="flex-1 bg-slate-100 border-none rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
              onClick={handleStart}
              disabled={stage !== 'idle' || !queryInput.trim()}
              className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Start <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}