import React from 'react';
import { Bot, User, PauseCircle, CheckCircle, Search, FileText, Loader2 } from 'lucide-react';
import { AgentStage } from '../hooks/useAgentStream';

interface ChatAreaProps {
  query: string;
  stage: AgentStage;
  plan: string[];
  report: string;
  isProcessing: boolean;
  onApprove: (approved: boolean) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

export default function ChatArea({ query, stage, plan, report, isProcessing, onApprove, chatEndRef }: ChatAreaProps) {
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
              {stage === 'architect' && <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />}
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

      {/* Human-in-the-Loop Interruption Node */}
      {stage === 'awaiting_approval' && (
        <div className="flex gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl max-w-3xl mx-auto shadow-md">
          <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
            <PauseCircle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-800 mb-1">Human-in-the-Loop Required</h4>
            <p className="text-sm text-amber-700 mb-4">Please review the Architect's plan. Proceed to spend tokens and execute searches?</p>
            <div className="flex gap-3">
              <button onClick={() => onApprove(true)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Approve & Execute
              </button>
              <button onClick={() => onApprove(false)} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-amber-200 py-2 rounded-lg text-sm font-medium transition">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Researcher and Analyst UI nodes omitted for brevity but they follow the exact same structural pattern as the Architect. */}
      
      <div ref={chatEndRef} />
    </div>
  );
}