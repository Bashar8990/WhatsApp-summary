import { describe, expect, it } from 'vitest';
import { extractJsonFromText, parseAndValidateAnalysis, tryFixJson } from '../services/analysis/jsonValidation';

describe('jsonValidation', () => {
  it('extracts JSON from markdown fences', () => {
    const raw = '```json\n{"summary":"x"}\n```';
    expect(extractJsonFromText(raw)).toBe('{"summary":"x"}');
  });

  it('extracts JSON from surrounding text', () => {
    const raw = 'إليك النتيجة: {"summary":"x"} انتهى';
    expect(extractJsonFromText(raw)).toBe('{"summary":"x"}');
  });

  it('fixes trailing commas', () => {
    expect(tryFixJson('{"a":1,}')).toBe('{"a":1}');
    expect(tryFixJson('[1,2,]')).toBe('[1,2]');
  });

  it('parses valid analysis and applies defaults', () => {
    const raw = '{"summary":"ملخص","tasksForMe":[{"task":"مهمة"}]}';
    const res = parseAndValidateAnalysis(raw);
    expect(res).not.toBeNull();
    expect(res!.summary).toBe('ملخص');
    expect(res!.tasksForMe.length).toBe(1);
    expect(res!.tasksForMe[0].id).toBeTruthy();
    expect(res!.tasksForMe[0].confidence).toBe('medium');
    expect(res!.processingMode).toBe('local-ai');
  });

  it('returns null for invalid JSON', () => {
    expect(parseAndValidateAnalysis('ليس JSON')).toBeNull();
  });

  it('handles partial objects gracefully', () => {
    const res = parseAndValidateAnalysis('{"summary":"x","people":[{"name":"أحمد"}]}');
    expect(res).not.toBeNull();
    expect(res!.people.length).toBe(1);
    expect(res!.people[0].name).toBe('أحمد');
  });
});
