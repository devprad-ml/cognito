import React from 'react';
import { Bot, User, Search, FileText, Loader2 } from 'lucide-react';
import { AgentStage } from '../hooks/useAgentStream';

interface ChatAreaProps {
  query: string;
  stage: AgentStage;
  plan: string[];
  report: string;
  isProcessing: boolean;
  // Removed onApprove since the flow is autonomous now
  chatEndRef: React.RefObject<HTMLDivElement>;
}

export default function ChatArea({ query, stage, plan, report, isProcessing, chatEndRef }: ChatAreaProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
      
      {/* Empty State */}
      {stage === 'idle' && (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4 opacity-70">
          <Bot className="w-16 h-16 text-slate-300" />
          <h3 className="text-xl font-medium text-slate-600">What would you like to research?</h3>
          <p className="text-sm text-slate-500">Cognito will deploy an Architect, a Researcher, and an Analyst to build a comprehensive report.</p>
        </div>
      )}

      {/* User Query */}
      {stage !== 'idle' && (
        <div className="flex gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm max-w-3xl ml-auto mr-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <User className="w-4 h-4" /> You
            </p>
            <p className="text-slate-600">{query}</p>
          </div>
        </div>
      )}

      {/* Architect Agent Output */}
      {(stage === 'architect' || plan.length > 0) && (
        <div className="flex gap-4 p-4 border border-blue-100 bg-blue-50/30 rounded-xl max-w-3xl ml-4 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-blue-800">Architect</p>
              {stage === 'architect' && plan.length === 0 && <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />}
            </div>
            
            {stage === 'architect' && plan.length === 0 ? (
              <p className="text-sm text-blue-600 animate-pulse">Generating execution plan...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">Execution plan generated:</p>
                <ul className="space-y-2">
                  {plan.map((step, idx) => (
                    <li key={idx} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-sm text-slate-600">
                      <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs font-bold">{idx + 1}</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Researcher Stage Progress */}
      {(stage === 'researcher' || stage === 'analyst' || stage === 'completed') && (
        <div className="flex gap-4 p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl max-w-3xl ml-4 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-emerald-800">Researcher</p>
              {stage === 'researcher' && <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />}
            </div>
            <p className="text-sm text-emerald-700">
              {stage === 'researcher' 
                ? "Searching web sources and extracting key data points..." 
                : "Deep research phase completed. Data handed over to Analyst."}
            </p>
          </div>
        </div>
      )}

      {/* Analyst Stage & Final Report */}
      {(stage === 'analyst' || stage === 'completed' || report.length > 0) && (
        <div className="flex gap-4 p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl max-w-3xl ml-4 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-indigo-800">Analyst</p>
              {stage === 'analyst' && <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />}
            </div>
            
            {stage === 'analyst' && report.length === 0 ? (
              <p className="text-sm text-indigo-700 animate-pulse">Synthesizing gathered data into final report...</p>
            ) : (
              <div className="bg-white p-6 rounded-lg border border-indigo-100 shadow-inner prose prose-sm prose-slate max-w-none">
                {report.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4">{line.replace('# ', '')}</h1>;
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-600">{line.replace('- ', '')}</li>;
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  return <p key={i} className="mb-2 text-slate-600 leading-relaxed">{line}</p>;
                })}
                {stage === 'completed' && (
                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest">
                    <span>Report Finalized</span>
                    <span>Cognito v1.0</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div ref={chatEndRef} />
    </div>
  );
}