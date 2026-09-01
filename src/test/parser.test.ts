import { describe, expect, it } from 'vitest';
import { estimateMessageCount, parseWhatsAppChat } from '../services/parser/whatsappParser';
import {
  SAMPLE_CHAT,
  SAMPLE_CHAT_12H,
  SAMPLE_CHAT_BRACKETS,
  SAMPLE_MULTILINE,
  SAMPLE_NO_DATES_SENDER,
  SAMPLE_PLAIN_TEXT,
  SAMPLE_SYSTEM,
} from './fixtures/sampleChats';

describe('whatsappParser', () => {
  it('parse basic chat with sender and content', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_CHAT);
    expect(messages.length).toBe(10);
    expect(messages[0].sender).toBe('أحمد');
    expect(messages[0].content).toBe('السلام عليكم يا خالد');
    expect(messages[0].isSystemMessage).toBe(false);
  });

  it('parse bracket format', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_CHAT_BRACKETS);
    expect(messages.length).toBe(3);
    expect(messages[0].sender).toBe('أحمد');
    expect(messages[0].timestamp).not.toBeNull();
  });

  it('parse 12-hour format', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_CHAT_12H);
    expect(messages.length).toBe(3);
    expect(messages[0].sender).toBe('أحمد');
  });

  it('handles multiline messages', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_MULTILINE);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toContain('السطر الثالث');
  });

  it('detects system messages', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_SYSTEM);
    expect(messages[0].isSystemMessage).toBe(true);
  });

  it('handles plain text as fallback messages with warning', () => {
    const { messages, warnings } = parseWhatsAppChat('هذا نص عادي بدون تواريخ');
    // في الوضع الاحتياطي، النص بدون تواريخ يُعامل كرسالة
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('estimateMessageCount approximates', () => {
    expect(estimateMessageCount(SAMPLE_CHAT)).toBe(10);
  });

  it('parses direct copy with sender names but no dates', () => {
    const { messages, warnings } = parseWhatsAppChat(SAMPLE_NO_DATES_SENDER);
    expect(messages.length).toBe(4);
    expect(messages[0].sender).toBe('أحمد');
    expect(messages[0].content).toBe('السلام عليكم يا خالد');
    expect(messages[0].timestamp).toBeNull();
    expect(warnings.some((w) => w.includes('تواريخ'))).toBe(true);
  });

  it('parses plain text without senders or dates', () => {
    const { messages } = parseWhatsAppChat(SAMPLE_PLAIN_TEXT);
    expect(messages.length).toBe(4);
    expect(messages[0].sender).toBeNull();
    expect(messages[0].content).toBe('السلام عليكم');
  });
});
