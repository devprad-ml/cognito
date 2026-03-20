import { useState, useCallback } from 'react';

export type AgentStage = 'idle' | 'architect' | 'researcher' | 'analyst' | 'completed';

export interface ResearchStep {
  step: string;
  status: 'searching' | 'extracting' | 'done';
  sources?: string[];
}

const BACKEND_URL = "http://localhost:8000";

export function useAgentStream() {
  const [stage, setStage] = useState<AgentStage>('idle');
  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);

  const updateStep = (incoming: ResearchStep) => {
    setResearchSteps(prev => {
      const idx = prev.findIndex(s => s.step === incoming.step);
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  };

  const processStream = async (response: Response) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (!value) continue;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') { setIsProcessing(false); continue; }
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
              setStage('completed');
            }
          } else if (parsed.type === 'research_step') {
            updateStep({ step: parsed.step, status: parsed.status, sources: parsed.sources });
          } else if (parsed.type === 'token') {
            setReport(prev => prev + parsed.content);
          } else if (parsed.type === 'error') {
            console.error('Server error:', parsed.message);
            setIsProcessing(false);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  };

  const startResearch = useCallback(async (query: string) => {
    setStage('architect');
    setIsProcessing(true);
    setPlan([]);
    setReport('');
    setResearchSteps([]);

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
  }, []);

  return { stage, plan, report, isProcessing, researchSteps, startResearch };
}