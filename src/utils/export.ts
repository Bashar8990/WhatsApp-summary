import type { AnalysisResult } from '../types';

export function formatResultAsText(result: AnalysisResult): string {
  const parts: string[] = [];
  parts.push('ملخص المحادثة:');
  parts.push(result.summary || 'لا يوجد ملخص.');
  parts.push('');

  if (result.tasksForMe.length > 0) {
    parts.push('المطلوب مني:');
    result.tasksForMe.forEach((t, i) => {
      parts.push(`${i + 1}. ${t.task}${t.deadlineOriginal ? ` (الموعد: ${t.deadlineOriginal})` : ''}`);
    });
    parts.push('');
  }

  if (result.allTasks.length > 0) {
    parts.push('جميع المهام:');
    result.allTasks.forEach((t, i) => {
      parts.push(`${i + 1}. ${t.task}${t.assignedTo ? ` — ${t.assignedTo}` : ''}`);
    });
    parts.push('');
  }

  if (result.dates.length > 0) {
    parts.push('المواعيد:');
    result.dates.forEach((d, i) => {
      parts.push(`${i + 1}. ${d.event} (${d.originalDate})`);
    });
    parts.push('');
  }

  if (result.decisions.length > 0) {
    parts.push('القرارات:');
    result.decisions.forEach((d, i) => {
      parts.push(`${i + 1}. ${d.decision}${d.madeBy ? ` — ${d.madeBy}` : ''}`);
    });
    parts.push('');
  }

  if (result.people.length > 0) {
    parts.push('الأشخاص:');
    result.people.forEach((p, i) => {
      parts.push(`${i + 1}. ${p.name}${p.messageCount ? ` (${p.messageCount} رسالة)` : ''}${p.role ? ` — ${p.role}` : ''}`);
    });
    parts.push('');
  }

  if (result.warnings.length > 0) {
    parts.push('تنبيهات:');
    result.warnings.forEach((w) => parts.push(`- ${w}`));
  }

  return parts.join('\n');
}

export function formatSectionAsText(title: string, lines: string[]): string {
  return `${title}:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // محاولة بديلة
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAsTxt(result: AnalysisResult, title: string): void {
  const text = formatResultAsText(result);
  downloadFile(`${title}.txt`, text, 'text/plain;charset=utf-8');
}

export function exportAsJson(result: AnalysisResult, title: string): void {
  downloadFile(`${title}.json`, JSON.stringify(result, null, 2), 'application/json;charset=utf-8');
}

export function makeTitle(summary: string, messageCount: number): string {
  const base = summary.slice(0, 50).replace(/\n/g, ' ').trim();
  if (base.length > 0) return base;
  return `تحليل ${messageCount} رسالة`;
}

export function formatDateArabic(ts: number): string {
  try {
    return new Date(ts).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}
