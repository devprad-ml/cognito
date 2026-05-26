"use client";

import { useRef, useState, useEffect } from 'react';
import { Bot, User, Search, FileText, Loader2, CheckCircle2, BookOpen, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { AgentStage, ResearchActivity, Critique } from '../hooks/useAgentStream';

interface ChatAreaProps {
  query: string;
  stage: AgentStage;
  plan: string[];
  report: string;
  activities: ResearchActivity[];
  critique: Critique | null;
  round: number;
}

function ActivityIcon({ tool, status }: { tool: string; status: ResearchActivity['status'] }) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" />;
  if (tool === 'read_url') return <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
}

function activityLabel(tool: string) {
  if (tool === 'web_search') return 'Searched';
  if (tool === 'read_url') return 'Read';
  return tool;
}

export default function ChatArea({ query, stage, plan, report, activities, critique, round }: ChatAreaProps) {
  const researching = stage === 'researcher' || stage === 'analyst' || stage === 'critic' || stage === 'completed';

  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep the view pinned to the bottom only while the user is already there,
  // so they can freely scroll up to read earlier output during generation.
  const [stick, setStick] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStick(atBottom);
  };

  useEffect(() => {
    if (!stick) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [report, activities, critique, plan, stage, stick]);

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">

      {/* Empty State */}
      {stage === 'idle' && (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4 opacity-70">
          <Bot className="w-16 h-16 text-slate-300" />
          <h3 className="text-xl font-medium text-slate-600">What would you like to research?</h3>
          <p className="text-sm text-slate-500">Cognito deploys an Architect, an autonomous Researcher, an Analyst, and a Critic to build — and self-correct — a comprehensive report.</p>
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

      {/* Architect */}
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
              <p className="text-sm text-blue-600 animate-pulse">Generating execution plan…</p>
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

      {/* Researcher — autonomous tool activity feed */}
      {researching && (
        <div className="flex gap-4 p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl max-w-3xl ml-4 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-emerald-800">Researcher</p>
              {stage === 'researcher' && <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />}
              {round > 1 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5" /> Revision {round - 1}
                </span>
              )}
            </div>
            {activities.length === 0 && stage === 'researcher' && (
              <p className="text-sm text-emerald-700 animate-pulse">Deciding where to look…</p>
            )}
            {activities.length > 0 && (
              <ul className="space-y-1.5">
                {activities.map((a, idx) => (
                  <li key={idx} className="bg-white rounded-lg border border-emerald-100 p-2.5 flex items-start gap-2 shadow-sm">
                    <ActivityIcon tool={a.tool} status={a.status} />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-500">{activityLabel(a.tool)}: </span>
                      <span className="text-sm text-slate-700 break-words">{a.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(stage === 'analyst' || stage === 'critic' || stage === 'completed') && (
              <p className="text-sm text-emerald-700">
                Research complete — {activities.length} tool call{activities.length !== 1 ? 's' : ''} across {round} round{round !== 1 ? 's' : ''}. Data handed to Analyst.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Analyst & Final Report */}
      {(stage === 'analyst' || stage === 'critic' || stage === 'completed' || report.length > 0) && (
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
              <p className="text-sm text-indigo-700 animate-pulse">Synthesizing gathered data into final report…</p>
            ) : (
              <div className="bg-white p-6 rounded-lg border border-indigo-100 shadow-inner prose prose-sm prose-slate max-w-none">
                {report.split('\n').map((line, i) => {
                  if (line.startsWith('# '))   return <h1 key={i} className="text-2xl font-bold mb-4">{line.replace('# ', '')}</h1>;
                  if (line.startsWith('## '))  return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('- '))   return <li key={i} className="ml-4 list-disc text-slate-600">{line.replace('- ', '')}</li>;
                  if (line.trim() === '')       return <div key={i} className="h-2" />;
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

      {/* Critic — editorial verdict */}
      {(stage === 'critic' || critique) && (
        <div className={`flex gap-4 p-4 border rounded-xl max-w-3xl ml-4 shadow-sm ${
          critique?.passed ? 'border-emerald-100 bg-emerald-50/30' : 'border-amber-100 bg-amber-50/30'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            critique?.passed ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {critique?.passed
              ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
              : <ShieldAlert className="w-4 h-4 text-amber-600" />}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${critique?.passed ? 'text-emerald-800' : 'text-amber-800'}`}>Critic</p>
              {stage === 'critic' && !critique && <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />}
            </div>
            {stage === 'critic' && !critique ? (
              <p className="text-sm text-amber-700 animate-pulse">Reviewing the report for accuracy and completeness…</p>
            ) : critique && (
              <>
                <p className="text-sm font-medium text-slate-700">
                  {critique.passed ? 'Report accepted ✅' : 'Sent back for another research round 🔁'}
                </p>
                {critique.feedback && <p className="text-sm text-slate-600">{critique.feedback}</p>}
                {!critique.passed && critique.missing.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {critique.missing.map((m, i) => (
                      <li key={i} className="text-xs text-amber-700 flex gap-2"><span>↳</span>{m}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
