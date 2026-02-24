import { useState, useCallback } from 'react';

export type AgentStage = 'idle' | 'architect' | 'researcher' | 'analyst' | 'completed';

// Change this if your backend port is different
const BACKEND_URL = "http://localhost:8000";

export function useAgentStream() {
  const [stage, setStage] = useState<AgentStage>('idle');
  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const processStream = async (response: Response) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              setIsProcessing(false);
              continue;
            }
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              
              if (parsed.type === 'node_update') {
                if (parsed.node === 'architect' && parsed.data?.plan) {
                  setPlan(parsed.data.plan);
                  // Since we removed human-in-the-loop, update stage to researcher
                  setStage('researcher'); 
                }
                  else if (parsed.node === 'researcher') {
                    setStage('analyst')

                  }
                 else if (parsed.node === 'analyst') {
                  if (parsed.data?.final_report) {
                    setReport(parsed.data.final_report);
                  }
                  setStage('completed');
                }
              } else if (parsed.type === 'token') {
                setReport(prev => prev + parsed.content);
              }
            } catch (e) {
              console.error("Parse Error:", e);
            }
          }
        }
      }
    }
  };

  const startResearch = useCallback(async (query: string) => {
    setStage('architect');
    setIsProcessing(true);
    setPlan([]);
    setReport('');

    try {
      // FIX: Use absolute URL to hit the FastAPI backend on port 8000
      const response = await fetch(`${BACKEND_URL}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      await processStream(response);
    } catch (error) {
      console.error("Connection failed. Is the backend running?", error);
      setIsProcessing(false);
    }
  }, []);

  return { stage, plan, report, isProcessing, startResearch };
}