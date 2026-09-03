import { describe, expect, it } from 'vitest';
import { analyzeWithRulesAsync, WORKER_THRESHOLD } from '../services/analysis/rulesWorkerClient';
import { parseWhatsAppChat } from '../services/parser/whatsappParser';
import { SAMPLE_CHAT } from './fixtures/sampleChats';

describe('analyzeWithRulesAsync (worker client)', () => {
  const { messages } = parseWhatsAppChat(SAMPLE_CHAT);

  it('runs on main thread for small conversations (below threshold)', async () => {
    // SAMPLE_CHAT صغير — يجب أن يعمل على main thread مباشرةً
    const result = await analyzeWithRulesAsync(messages, 'أحمد');
    expect(result.processingMode).toBe('rules-only');
    expect(result.people.length).toBeGreaterThan(0);
  });

  it('falls back to main thread when worker is unavailable (jsdom)', async () => {
    // jsdom لا يدعم workers — نُجبر مسار worker بإنشاء محادثة كبيرة فوق الحد
    // ثم نتحقق أن fallback يعمل ويعيد نتيجة صحيحة
    const bigMessages = [];
    while (bigMessages.length < WORKER_THRESHOLD + 10) bigMessages.push(...messages);
    // ملاحظة: في jsdom، new Worker() يفشل فيُلتقط ويُنفّذ على main thread
    const result = await analyzeWithRulesAsync(bigMessages, 'أحمد');
    expect(result.processingMode).toBe('rules-only');
    expect(result.people.length).toBeGreaterThan(0);
  });

  it('respects AbortSignal in worker path (pre-aborted)', async () => {
    // نُجبر مسار worker بمحادثة كبيرة ونُلغي قبل البدء
    const bigMessages = [];
    while (bigMessages.length < WORKER_THRESHOLD + 10) bigMessages.push(...messages);
    const controller = new AbortController();
    controller.abort();
    // في jsdom: new Worker() يفشل أولاً، لكن فحص signal.aborted يحدث قبل محاولة الإنشاء
    // لذا يجب أن يُرفض بـ DOMException باسم AbortError
    await expect(
      analyzeWithRulesAsync(bigMessages, 'أحمد', controller.signal),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof DOMException && err.name === 'AbortError';
    });
  });
});
