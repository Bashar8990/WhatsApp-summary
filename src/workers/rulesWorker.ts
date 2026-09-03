/// <reference lib="webworker" />
import { analyzeWithRules } from '../services/analysis/rulesAnalysis';
import type { AnalysisResult, WhatsAppMessage } from '../types';

export type WorkerRequest = {
  messages: WhatsAppMessage[];
  currentUserName: string;
};

export type WorkerResponse = {
  result: AnalysisResult;
};

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { messages, currentUserName } = e.data;
  const result = analyzeWithRules(messages, currentUserName);
  const response: WorkerResponse = { result };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(response);
};
