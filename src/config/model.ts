export type ModelOption = {
  modelId: string;
  displayName: string;
  estimatedSizeMB: number;
  contextWindow: number;
  temperature: number;
  maxTokens: number;
  description: string;
  // مناسب للأجهزة منخفضة الموارد (الجوال)
  lowResource: boolean;
};

// قائمة النماذج المتاحة للمستخدم.
// مرتبة من الأخف إلى الأثقل.
export const MODEL_OPTIONS: ModelOption[] = [
  {
    modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen2.5 1.5B (q4f16)',
    estimatedSizeMB: 1100,
    contextWindow: 4096,
    temperature: 0.1,
    maxTokens: 1500,
    description: 'أخف نموذج — مناسب للجوال والأجهزة منخفضة الذاكرة. جودة أقل من النماذج الكبيرة.',
    lowResource: true,
  },
  {
    modelId: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen2.5 3B (q4f16)',
    estimatedSizeMB: 2000,
    contextWindow: 4096,
    temperature: 0.1,
    maxTokens: 1500,
    description: 'نموذج وسط — توازن بين الجودة والسرعة. مناسب لمعظم الأجهزة.',
    lowResource: true,
  },
  {
    modelId: 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC',
    displayName: 'Hermes 2 Theta Llama-3 8B (q4f16)',
    estimatedSizeMB: 4500,
    contextWindow: 4096,
    temperature: 0.1,
    maxTokens: 1500,
    description: 'النموذج الافتراضي — أعلى جودة لكنه يتطلب ذاكرة كبيرة (~4.5GB).',
    lowResource: false,
  },
];

// المفتاح الافتراضي للنموذج المختار
export const DEFAULT_MODEL_ID = 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC';

// يُرجع إعدادات النموذج المختار
export function getModelConfig(modelId: string = DEFAULT_MODEL_ID): ModelOption {
  return MODEL_OPTIONS.find((m) => m.modelId === modelId) ?? MODEL_OPTIONS[MODEL_OPTIONS.length - 1];
}

// للتوافق مع الكود الحالي — يُرجع إعدادات النموذج الافتراضي
export const MODEL_CONFIG = getModelConfig();
