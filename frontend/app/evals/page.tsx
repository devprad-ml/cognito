"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ShieldCheck, ShieldAlert, Activity,
  BookOpen, Microscope, TrendingUp, Globe, HeartPulse, Cpu,
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

// ── types ──────────────────────────────────────────────────────────────────
interface Run {
  run_id: string;
  run_at: string;
  avg_composite: number;
  avg_accuracy: number;
  avg_depth: number;
  avg_hallucination: number;
  avg_citations: number;
  n: number;
  by_domain: Record<string, number>;
  passed: boolean;
}

interface Question {
  question_id: string;
  domain: string;
  difficulty: string;
  question: string;
  accuracy: number;
  depth: number;
  hallucination: number;
  citations: number;
  composite: number;
}

// ── helpers ────────────────────────────────────────────────────────────────
const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  Energy:        <TrendingUp className="w-3.5 h-3.5" />,
  "AI/Robotics": <Cpu className="w-3.5 h-3.5" />,
  Finance:       <Activity className="w-3.5 h-3.5" />,
  Health:        <HeartPulse className="w-3.5 h-3.5" />,
  Geopolitics:   <Globe className="w-3.5 h-3.5" />,
};

const DOMAIN_COLORS: Record<string, string> = {
  Energy:        "bg-yellow-100 text-yellow-700 border-yellow-200",
  "AI/Robotics": "bg-blue-100 text-blue-700 border-blue-200",
  Finance:       "bg-emerald-100 text-emerald-700 border-emerald-200",
  Health:        "bg-pink-100 text-pink-700 border-pink-200",
  Geopolitics:   "bg-purple-100 text-purple-700 border-purple-200",
};

const DIFF_COLORS: Record<string, string> = {
  easy:   "text-emerald-600 bg-emerald-50 border-emerald-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  hard:   "text-red-600 bg-red-50 border-red-200",
};

const DIM_META = [
  { key: "avg_accuracy",     label: "Accuracy",         color: "#3b82f6" },
  { key: "avg_depth",        label: "Depth",            color: "#8b5cf6" },
  { key: "avg_hallucination",label: "No Hallucination", color: "#10b981" },
  { key: "avg_citations",    label: "Citations",        color: "#f59e0b" },
];

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-6 text-right">{value}</span>
    </div>
  );
}

function CompositeGauge({ value }: { value: number }) {
  const color = value >= 4 ? "#10b981" : value >= 3 ? "#f59e0b" : "#ef4444";
  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r;
  const dash = ((value / 5) * 100 / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.6s ease" }} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="700" fill={color}>{value}</text>
    </svg>
  );
}

// ── Time-series chart (pure SVG, no dependencies) ─────────────────────────
function TrendChart({ runs }: { runs: Run[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [activeDims, setActiveDims] = useState<Set<string>>(
    new Set(["avg_composite", ...DIM_META.map(d => d.key)])
  );

  const toggleDim = (key: string) => {
    setActiveDims(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (runs.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Run the eval suite at least twice to see trends over time.
      </div>
    );
  }

  // Chronological order
  const sorted = [...runs].reverse();
  const W = 680, H = 220, PAD = { top: 16, right: 20, bottom: 40, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xStep = chartW / (sorted.length - 1);
  const yScale = (v: number) => PAD.top + chartH - ((v / 5) * chartH);
  const xAt = (i: number) => PAD.left + i * xStep;

  const allLines = [
    { key: "avg_composite", label: "Composite", color: "#6366f1", width: 2.5 },
    ...DIM_META.map(d => ({ key: d.key, label: d.label, color: d.color, width: 1.5 })),
  ];

  const gridLines = [1, 2, 3, 3.5, 4, 5];

  return (
    <div className="space-y-3">
      {/* Legend toggles */}
      <div className="flex flex-wrap gap-2">
        {allLines.map(l => (
          <button key={l.key} onClick={() => toggleDim(l.key)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
              activeDims.has(l.key)
                ? "bg-white border-slate-300 text-slate-700 shadow-sm"
                : "bg-slate-100 border-slate-200 text-slate-400"
            }`}>
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: activeDims.has(l.key) ? l.color : "#cbd5e1" }} />
            {l.label}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <div className="overflow-x-auto">
        <svg width={W} height={H} style={{ fontFamily: "inherit" }}>
          {/* Grid lines */}
          {gridLines.map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + chartW}
                y1={yScale(v)} y2={yScale(v)}
                stroke={v === 3.5 ? "#f59e0b" : "#e2e8f0"}
                strokeWidth={v === 3.5 ? 1.5 : 1}
                strokeDasharray={v === 3.5 ? "4 3" : undefined} />
              <text x={PAD.left - 6} y={yScale(v) + 4}
                textAnchor="end" fontSize="10" fill={v === 3.5 ? "#f59e0b" : "#94a3b8"}>
                {v}
              </text>
            </g>
          ))}

          {/* Threshold label */}
          <text x={PAD.left + chartW + 4} y={yScale(3.5) + 4}
            fontSize="9" fill="#f59e0b">gate</text>

          {/* Lines */}
          {allLines.filter(l => activeDims.has(l.key)).map(l => {
            const pts = sorted.map((r, i) =>
              `${xAt(i)},${yScale((r as any)[l.key])}`
            ).join(" ");
            return (
              <polyline key={l.key} points={pts} fill="none"
                stroke={l.color} strokeWidth={l.width} strokeLinejoin="round" strokeLinecap="round" />
            );
          })}

          {/* Data points + hover */}
          {sorted.map((run, i) => (
            <g key={run.run_id}>
              {allLines.filter(l => activeDims.has(l.key)).map(l => (
                <circle key={l.key} cx={xAt(i)} cy={yScale((run as any)[l.key])}
                  r={hovered === i ? 5 : 3.5} fill={l.color}
                  stroke="white" strokeWidth="1.5"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)} />
              ))}
              {/* X axis label */}
              <text x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {run.run_id}
              </text>
              {/* Hover tooltip */}
              {hovered === i && (
                <g>
                  <rect x={xAt(i) - 72} y={PAD.top - 12} width={144} height={90}
                    rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))" />
                  <text x={xAt(i)} y={PAD.top + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569">
                    Run {run.run_id} · {new Date(run.run_at).toLocaleDateString()}
                  </text>
                  {allLines.map((l, li) => (
                    <text key={l.key} x={xAt(i)} y={PAD.top + 18 + li * 14}
                      textAnchor="middle" fontSize="10" fill={l.color}>
                      {l.label}: {(run as any)[l.key]}
                    </text>
                  ))}
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EvalsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("All");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/evals`)
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setQuestions(d.questions ?? []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const domains = ["All", ...Array.from(new Set(questions.map(q => q.domain)))];
  const filteredQs = domainFilter === "All" ? questions : questions.filter(q => q.domain === domainFilter);
  const latestRun = runs[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <Microscope className="w-5 h-5 text-indigo-600" />
          <h1 className="font-bold text-slate-800">Eval Dashboard</h1>
        </div>
        <span className="ml-auto text-xs text-slate-400">
          LLM-as-Judge · {questions.length} questions · {runs.length} run{runs.length !== 1 ? "s" : ""}
        </span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {loading && (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading eval history…</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            Could not load eval data: {error}. Make sure the backend is running and you have run pytest at least once.
          </div>
        )}
        {!loading && !error && runs.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-600">No eval runs yet</p>
            <p className="text-sm text-slate-400">
              Run <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">pytest backend/tests/test_ai_quality.py -v -s</code> to populate this dashboard.
            </p>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`rounded-xl border p-4 flex items-center gap-3 ${latestRun.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                {latestRun.passed
                  ? <ShieldCheck className="w-7 h-7 text-emerald-500 shrink-0" />
                  : <ShieldAlert className="w-7 h-7 text-red-500 shrink-0" />}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Gate</p>
                  <p className={`font-bold text-lg ${latestRun.passed ? "text-emerald-700" : "text-red-700"}`}>
                    {latestRun.passed ? "Passing" : "Failing"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <CompositeGauge value={latestRun.avg_composite} />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Latest Run</p>
                  <p className="font-bold text-lg text-slate-800">{latestRun.avg_composite} / 5</p>
                  <p className="text-xs text-slate-400">{latestRun.n} questions</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <Activity className="w-7 h-7 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">All-time Avg</p>
                  <p className="font-bold text-lg text-slate-800">
                    {runs.length ? (runs.reduce((s, r) => s + r.avg_composite, 0) / runs.length).toFixed(3) : "—"} / 5
                  </p>
                  <p className="text-xs text-slate-400">{runs.length} run{runs.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-slate-300 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Pass Rate</p>
                  <p className="font-bold text-lg text-slate-800">
                    {Math.round((runs.filter(r => r.passed).length / runs.length) * 100)}%
                  </p>
                  <p className="text-xs text-slate-400">≥ 3.5 threshold</p>
                </div>
              </div>
            </div>

            {/* Time-series chart */}
            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Quality Over Time
              </h2>
              <TrendChart runs={runs} />
            </section>

            {/* Run history table */}
            <section>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Run History</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Run", "Date", "Composite", "Accuracy", "Depth", "No Halluc.", "Citations", "Gate"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, i) => (
                      <tr key={run.run_id} className={`border-b border-slate-50 ${i === 0 ? "font-medium" : ""} hover:bg-slate-50`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {run.run_id} {i === 0 && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-600 rounded px-1">latest</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(run.run_at).toLocaleString()}</td>
                        {([run.avg_composite, run.avg_accuracy, run.avg_depth, run.avg_hallucination, run.avg_citations] as number[]).map((v, vi) => (
                          <td key={vi} className="px-4 py-3">
                            <span className={`font-bold ${v >= 4 ? "text-emerald-600" : v >= 3 ? "text-amber-600" : "text-red-600"}`}>{v}</span>
                            <span className="text-slate-400 text-xs"> /5</span>
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          {run.passed
                            ? <span className="text-emerald-600 flex items-center gap-1 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Pass</span>
                            : <span className="text-red-500 flex items-center gap-1 text-xs"><ShieldAlert className="w-3.5 h-3.5" /> Fail</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per-question breakdown */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Question Breakdown <span className="text-slate-400 font-normal normal-case">(latest run)</span>
                </h2>
                <div className="flex gap-1.5 flex-wrap">
                  {domains.map(d => (
                    <button key={d} onClick={() => setDomainFilter(d)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        domainFilter === d ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {filteredQs.map(q => (
                  <div key={q.question_id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] border rounded-full px-2 py-0.5 flex items-center gap-1 ${DOMAIN_COLORS[q.domain] ?? "bg-slate-100 text-slate-600"}`}>
                            {DOMAIN_ICONS[q.domain]} {q.domain}
                          </span>
                          <span className={`text-[10px] border rounded-full px-2 py-0.5 ${DIFF_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{q.question_id}</span>
                        </div>
                        <p className="text-sm text-slate-700">{q.question}</p>
                      </div>
                      <CompositeGauge value={q.composite} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Accuracy</p>
                        <ScoreBar value={q.accuracy} color="bg-blue-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Depth</p>
                        <ScoreBar value={q.depth} color="bg-violet-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">No Hallucination</p>
                        <ScoreBar value={q.hallucination} color="bg-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Citations</p>
                        <ScoreBar value={q.citations} color="bg-amber-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}