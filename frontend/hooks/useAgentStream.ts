import { useState, useCallback } from 'react';

export type AgentStage = 'idle' | 'architect' | 'awaiting_approval' | 'researcher' | 'analyst' | 'completed';

export function useAgentStream() {
  const [stage, setStage] = useState<AgentStage>('idle');
  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Helper to parse the SSE stream from a POST request
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
              
              // Handle different event types from the FastAPI backend
              if (parsed.type === 'node_update') {
                if (parsed.node === 'architect') {
                  setPlan(parsed.data.plan || []);
                } else if (parsed.node === 'analyst') {
                  setReport(parsed.data.final_report || '');
                  setStage('completed');
                }
              } else if (parsed.type === 'interrupt') {
                setStage('awaiting_approval');
                setIsProcessing(false);
              } else if (parsed.type === 'token') {
                // If you want to stream the report character-by-character
                if (stage === 'analyst') {
                  setReport(prev => prev + parsed.content);
                }
              }
            } catch (e) {
              console.error("Failed to parse stream chunk", e);
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
      const response = await fetch('/api/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      await processStream(response);
    } catch (error) {
      console.error("Research failed:", error);
      setIsProcessing(false);
    }
  }, []);

  const approvePlan = useCallback(async (approved: boolean) => {
    if (!threadId) return;
    
    if (!approved) {
      setStage('idle');
      setPlan([]);
      return;
    }

    setStage('researcher');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/research/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, approved })
      });
      await processStream(response);
    } catch (error) {
      console.error("Approval failed:", error);
      setIsProcessing(false);
    }
  }, [threadId]);

  return {
    stage,
    plan,
    report,
    isProcessing,
    startResearch,
    approvePlan,
    setThreadId
  };
}