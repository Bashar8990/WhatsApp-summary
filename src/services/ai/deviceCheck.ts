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

export function getDeviceCompatibility(): DeviceCompatibility {
  const webgpu = checkWebGPU();
  const estimatedMemoryMB = estimateMemory();
  let status: DeviceCompatibility['status'] = 'incompatible';
  let label = 'غير متوافق مع التحليل الذكي، سيتم استخدام التحليل السريع.';

  if (webgpu) {
    if (estimatedMemoryMB !== null && estimatedMemoryMB < 2048) {
      status = 'slow';
      label = 'قد يكون بطيئًا. يمكنك تجربة التحليل الذكي أو استخدام التحليل السريع.';
    } else {
      status = 'compatible';
      label = 'جهازك متوافق مع التحليل الذكي المحلي.';
    }
  } else if (estimatedMemoryMB !== null && estimatedMemoryMB >= 4096) {
    status = 'slow';
    label = 'لا يتوفر WebGPU. يمكن استخدام التحليل السريع فقط.';
  }

  return { webgpu, estimatedMemoryMB, status, label };
}
