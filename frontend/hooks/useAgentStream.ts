import { useState, useCallback } from 'react';

export type AgentStage = 'idle' | 'architect' | 'researcher' | 'analyst' | 'critic' | 'completed';

export interface ResearchActivity {
  tool: string;        // 'web_search' | 'read_url'
  detail: string;      // the query or URL
  status: 'running' | 'done';
  round: number;       // which research round produced it
}

export interface Critique {
  passed: boolean;
  feedback: string;
  missing: string[];
}

const BACKEND_URL = "http://localhost:8000";

export function useAgentStream() {
  const [stage, setStage] = useState<AgentStage>('idle');
  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activities, setActivities] = useState<ResearchActivity[]>([]);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [round, setRound] = useState<number>(1);

  const upsertActivity = (incoming: ResearchActivity) => {
    setActivities(prev => {
      // Match the most recent running entry for this tool+detail and complete it.
      const idx = [...prev].reverse().findIndex(
        a => a.tool === incoming.tool && a.detail === incoming.detail && a.status === 'running'
      );
      if (incoming.status === 'done' && idx !== -1) {
        const realIdx = prev.length - 1 - idx;
        const next = [...prev];
        next[realIdx] = { ...next[realIdx], status: 'done' };
        return next;
      }
      if (incoming.status === 'running') return [...prev, incoming];
      return prev;
    });
  };

  const processStream = async (response: Response) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';          // carries partial lines across network chunks
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) buffer += decoder.decode(value, { stream: true });

      // Only consume up to the last newline; keep any partial tail in the buffer.
      const lastNl = buffer.lastIndexOf('\n');
      if (lastNl === -1) continue;
      const lines = buffer.slice(0, lastNl).split('\n');
      buffer = buffer.slice(lastNl + 1);

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice('data: '.length).trim();
        if (dataStr === '[DONE]') { setStage('completed'); setIsProcessing(false); continue; }
        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);

          if (parsed.type === 'node_update') {
            if (parsed.node === 'architect' && parsed.data?.plan) {
              setPlan(parsed.data.plan);
              setStage('researcher');
            } else if (parsed.node === 'researcher') {
              setStage('analyst');
            } else if (parsed.node === 'analyst') {
              if (parsed.data?.final_report) setReport(parsed.data.final_report);
              setStage('critic');
            } else if (parsed.node === 'critic') {
              const passed = !!parsed.data?.critique_passed;
              setCritique({
                passed,
                feedback: parsed.data?.critique ?? '',
                missing: parsed.data?.missing_info ?? [],
              });
              if (passed) setStage('completed');
            }
          } else if (parsed.type === 'research_activity') {
            upsertActivity({ tool: parsed.tool, detail: parsed.detail, status: parsed.status, round });
          } else if (parsed.type === 'revision') {
            setRound(parsed.round ?? round + 1);
            setStage('researcher');
          } else if (parsed.type === 'report_reset') {
            setReport('');
          } else if (parsed.type === 'token') {
            setReport(prev => prev + parsed.content);
          } else if (parsed.type === 'error') {
            console.error('Server error:', parsed.message);
            setIsProcessing(false);
          }
        } catch (e) {
          console.error('Parse error:', e, dataStr);
        }
      }
    }
  };

  const startResearch = useCallback(async (query: string) => {
    setStage('architect');
    setIsProcessing(true);
    setPlan([]);
    setReport('');
    setActivities([]);
    setCritique(null);
    setRound(1);

    try {
      const response = await fetch(`${BACKEND_URL}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      await processStream(response);
    } catch (error) {
      console.error('Connection failed. Is the backend running?', error);
      setIsProcessing(false);
    }
  }, [round]);

  return { stage, plan, report, isProcessing, activities, critique, round, startResearch };
}
