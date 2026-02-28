"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAgentStream } from '../hooks/useAgentStream';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import { ArrowRight } from 'lucide-react';

export default function CognitoApp() {
  // Removed approvePlan/resetChat to match your reverted hook
  const { stage, plan, report, isProcessing, startResearch } = useAgentStream();
  
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stage, plan, report]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    setSubmittedQuery(input);
    startResearch(input);
    setInput('');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar Component */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Chat Area Component */}
        <ChatArea 
          query={submittedQuery}
          stage={stage}
          plan={plan}
          report={report}
          isProcessing={isProcessing}
          chatEndRef={chatEndRef}
        />

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="max-w-3xl mx-auto flex gap-3 relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={stage !== 'idle' && stage !== 'completed'}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="E.g., Analyze the current market landscape for solid-state batteries..."
              className="flex-1 bg-slate-100 border-none rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
              onClick={() => handleSubmit()}
              disabled={(stage !== 'idle' && stage !== 'completed') || !input.trim()}
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