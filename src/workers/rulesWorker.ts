/// <reference lib="webworker" />
import { parseWhatsAppChat } from '../services/parser/whatsappParser';
import { analyzeWithRules } from '../services/analysis/rulesAnalysis';
import type { AnalysisResult } from '../types';

export type WorkerRequest = {
  text: string;
  currentUserName: string;
};

export type WorkerResponse = {
  result: AnalysisResult;
  messageCount: number;
  warnings: string[];
};

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { text, currentUserName } = e.data;
  const parsed = parseWhatsAppChat(text);
  const result = analyzeWithRules(parsed.messages, currentUserName);
  const response: WorkerResponse = {
    result,
    messageCount: parsed.messages.length,
    warnings: parsed.warnings,
  };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(response);
};
