import { describe, expect, it } from 'vitest';
import {
  chunkToText,
  deduplicateResults,
  mergeAnalysisResults,
  splitConversationIntoChunks,
} from '../services/analysis/chunking';
import type { AnalysisResult, WhatsAppMessage } from '../types';

function mkMsg(id: string, content: string, sender = 'أحمد'): WhatsAppMessage {
  return { id, sender, timestamp: null, rawDate: '01/09/2026, 10:30', content, isSystemMessage: false };
}

describe('chunking', () => {
  it('splits messages into chunks preserving order', () => {
    const msgs = Array.from({ length: 100 }, (_, i) => mkMsg(`m${i}`, `رسالة ${i}`));
    const chunks = splitConversationIntoChunks(msgs, 30, 3);
    expect(chunks.length).toBeGreaterThan(1);
    // أول رسالة في الجزء الأول هي m0
    expect(chunks[0][0].id).toBe('m0');
    // آخر رسالة في الجزء الأخير هي m99
    const last = chunks[chunks.length - 1];
    expect(last[last.length - 1].id).toBe('m99');
  });

  it('does not split small conversations', () => {
    const msgs = [mkMsg('a', 'x'), mkMsg('b', 'y')];
    expect(splitConversationIntoChunks(msgs, 60, 4)).toHaveLength(1);
  });

  it('chunkToText produces readable text', () => {
    const text = chunkToText([mkMsg('a', 'السلام')]);
    expect(text).toContain('السلام');
    expect(text).toContain('أحمد');
  });

  it('merges results and deduplicates', () => {
    const r1: AnalysisResult = {
      summary: 'ملخص 1',
      tasksForMe: [],
      allTasks: [
        { id: 't1', task: 'أرسل التقرير', assignedTo: 'أحمد', isForCurrentUser: true, deadlineOriginal: null, normalizedDeadline: null, sourceMessage: null, confidence: 'high' },
      ],
      dates: [{ id: 'd1', event: 'غدًا', originalDate: 'غدًا', normalizedDate: null, relatedPerson: null, sourceMessage: null, confidence: 'medium' }],
      decisions: [],
      people: [{ id: 'p1', name: 'أحمد', role: null, responsibilities: [], messageCount: 5 }],
      warnings: [],
      processingMode: 'local-ai',
    };
    const r2: AnalysisResult = {
      summary: 'ملخص 2',
      tasksForMe: [],
      allTasks: [
        { id: 't2', task: 'أرسل التقرير', assignedTo: null, isForCurrentUser: false, deadlineOriginal: null, normalizedDeadline: null, sourceMessage: null, confidence: 'medium' },
      ],
      dates: [{ id: 'd2', event: 'غدًا', originalDate: 'غدًا', normalizedDate: null, relatedPerson: null, sourceMessage: null, confidence: 'low' }],
      decisions: [],
      people: [{ id: 'p2', name: 'أحمد', role: 'مدير', responsibilities: ['متابعة'], messageCount: 3 }],
      warnings: ['تنبيه'],
      processingMode: 'local-ai',
    };
    const merged = mergeAnalysisResults([r1, r2]);
    // تكرار المهمة
    expect(merged.allTasks.length).toBe(1);
    // تكرار الموعد
    expect(merged.dates.length).toBe(1);
    // دمج الأشخاص
    expect(merged.people.length).toBe(1);
    expect(merged.people[0].messageCount).toBe(8);
    expect(merged.people[0].role).toContain('مدير');
    // دمج الملخص
    expect(merged.summary).toContain('ملخص 1');
    expect(merged.summary).toContain('ملخص 2');
  });

  it('deduplicateResults removes duplicates', () => {
    const r: AnalysisResult = {
      summary: 'x',
      tasksForMe: [],
      allTasks: [
        { id: 'a', task: 'مهمة مكررة', assignedTo: null, isForCurrentUser: false, deadlineOriginal: null, normalizedDeadline: null, sourceMessage: null, confidence: 'low' },
        { id: 'b', task: 'مهمة مكررة', assignedTo: null, isForCurrentUser: false, deadlineOriginal: null, normalizedDeadline: null, sourceMessage: null, confidence: 'low' },
      ],
      dates: [],
      decisions: [],
      people: [],
      warnings: [],
      processingMode: 'local-ai',
    };
    expect(deduplicateResults(r).allTasks.length).toBe(1);
  });
});
