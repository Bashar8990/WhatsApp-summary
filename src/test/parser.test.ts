import { describe, expect, it } from 'vitest';
import { estimateMessageCount, parseWhatsAppChat } from '../services/parser/whatsappParser';
import {
  SAMPLE_CHAT,
  SAMPLE_CHAT_12H,
  SAMPLE_CHAT_BRACKETS,
  SAMPLE_MULTILINE,
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

  it('returns warnings for unrecognized format', () => {
    const { messages, warnings } = parseWhatsAppChat('هذا نص عادي بدون تواريخ');
    expect(messages.length).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('estimateMessageCount approximates', () => {
    expect(estimateMessageCount(SAMPLE_CHAT)).toBe(10);
  });
});
