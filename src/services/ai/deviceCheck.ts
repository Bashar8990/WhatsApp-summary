import type { DeviceCompatibility } from '../../types';

export function checkWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function estimateMemory(): number | null {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number') {
      return Math.round(nav.deviceMemory * 1024);
    }
  } catch {
    /* ignore */
  }
  return null;
}

// يكتشف نوع المتصفح من user agent (تقديري)
export function detectBrowser(): { name: string; isSupported: boolean; recommendation: string } {
  if (typeof navigator === 'undefined') {
    return { name: 'غير معروف', isSupported: false, recommendation: '' };
  }
  const ua = navigator.userAgent;
  // ترتيب الفحص مهم: Edge يحتوي على "Edg" و "Chrome"، لذا نفحص Edge أولًا
  if (/Edg\//i.test(ua)) {
    return { name: 'Microsoft Edge', isSupported: true, recommendation: '' };
  }
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    return { name: 'Google Chrome', isSupported: true, recommendation: '' };
  }
  if (/Firefox\//i.test(ua)) {
    return {
      name: 'Mozilla Firefox',
      isSupported: false,
      recommendation: 'Firefox لا يدعم WebGPU بعد. استخدم Chrome أو Edge حديثًا للتحليل الذكي، أو استخدم التحليل السريع.',
    };
  }
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    // iOS Safari بدأ دعم WebGPU تدريجيًا في iOS 18+ لكنه قد لا يكون مفعّلًا افتراضيًا
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isIOS) {
      return {
        name: 'Safari (iOS)',
        isSupported: false,
        recommendation: 'iOS Safari بدأ دعم WebGPU في iOS 18+ لكنه قد لا يكون مفعّلًا. استخدم Chrome أو Edge على سطح المكتب، أو استخدم التحليل السريع.',
      };
    }
    return {
      name: 'Safari',
      isSupported: false,
      recommendation: 'Safari لا يدعم WebGPU بشكل مستقر بعد. استخدم Chrome أو Edge حديثًا للتحليل الذكي، أو استخدم التحليل السريع.',
    };
  }
  if (/Chromium\//i.test(ua)) {
    return { name: 'Chromium', isSupported: true, recommendation: '' };
  }
  return { name: 'غير معروف', isSupported: false, recommendation: 'استخدم Chrome أو Edge حديثًا للتحليل الذكي.' };
}

export function getDeviceCompatibility(): DeviceCompatibility {
  const webgpu = checkWebGPU();
  const estimatedMemoryMB = estimateMemory();
  const browser = detectBrowser();
  let status: DeviceCompatibility['status'] = 'incompatible';
  let label = 'غير متوافق مع التحليل الذكي، سيتم استخدام التحليل السريع.';

  if (webgpu) {
    if (estimatedMemoryMB !== null && estimatedMemoryMB < 2048) {
      status = 'slow';
      label = `جهازك يدعم WebGPU (${browser.name}) لكن الذاكرة محدودة. قد يكون التحليل الذكي بطيئًا.`;
    } else {
      status = 'compatible';
      label = `جهازك متوافق مع التحليل الذكي المحلي (${browser.name}).`;
    }
  } else {
    // WebGPU غير متوفر
    if (browser.isSupported) {
      // متصفح مدعوم لكن WebGPU غير مفعّل
      label = `${browser.name} يدعم WebGPU لكنه غير مفعّل. حدّث المتصفح أو فعّل WebGPU من إعدادات المتصفح. سيتم استخدام التحليل السريع.`;
      status = 'slow';
    } else {
      label = browser.recommendation || 'لا يتوفر WebGPU. سيتم استخدام التحليل السريع.';
      if (estimatedMemoryMB !== null && estimatedMemoryMB >= 4096) {
        status = 'slow';
      }
    }
  }

  return { webgpu, estimatedMemoryMB, status, label };
}
