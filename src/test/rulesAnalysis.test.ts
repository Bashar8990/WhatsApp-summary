import { describe, expect, it } from 'vitest';
import { analyzeWithRules } from '../services/analysis/rulesAnalysis';
import { parseWhatsAppChat } from '../services/parser/whatsappParser';
import { SAMPLE_CHAT } from './fixtures/sampleChats';

describe('rulesAnalysis', () => {
  const { messages } = parseWhatsAppChat(SAMPLE_CHAT);
  const result = analyzeWithRules(messages, 'أحمد');

  it('extracts people with message counts', () => {
    expect(result.people.length).toBe(2);
    const ahmed = result.people.find((p) => p.name === 'أحمد');
    expect(ahmed).toBeDefined();
    expect(ahmed?.messageCount).toBeGreaterThan(0);
  });

  it('extracts dates', () => {
    expect(result.dates.length).toBeGreaterThan(0);
    expect(result.dates.some((d) => d.event.includes('غد'))).toBe(true);
  });

  it('extracts tasks', () => {
    expect(result.allTasks.length).toBeGreaterThan(0);
    expect(result.allTasks.some((t) => t.task.includes('جهّز'))).toBe(true);
  });

  it('extracts decisions', () => {
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions.some((d) => d.decision.includes('تم الاتفاق'))).toBe(true);
  });

  it('marks tasks for current user', () => {
    expect(result.tasksForMe.length).toBeGreaterThan(0);
  });

  it('produces a summary', () => {
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('processingMode is rules-only', () => {
    expect(result.processingMode).toBe('rules-only');
  });
});
