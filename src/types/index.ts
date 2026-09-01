export type WhatsAppMessage = {
  id: string;
  sender: string | null;
  timestamp: string | null;
  rawDate: string | null;
  content: string;
  isSystemMessage: boolean;
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type TaskItem = {
  id: string;
  task: string;
  assignedTo: string | null;
  isForCurrentUser: boolean;
  deadlineOriginal: string | null;
  normalizedDeadline: string | null;
  sourceMessage: string | null;
  confidence: ConfidenceLevel;
};

export type DateItem = {
  id: string;
  event: string;
  originalDate: string;
  normalizedDate: string | null;
  relatedPerson: string | null;
  sourceMessage: string | null;
  confidence: ConfidenceLevel;
};

export type DecisionItem = {
  id: string;
  decision: string;
  madeBy: string | null;
  sourceMessage: string | null;
  confidence: ConfidenceLevel;
};

export type PersonItem = {
  id: string;
  name: string;
  role: string | null;
  responsibilities: string[];
  messageCount: number | null;
};

export type AnalysisResult = {
  summary: string;
  tasksForMe: TaskItem[];
  allTasks: TaskItem[];
  dates: DateItem[];
  decisions: DecisionItem[];
  people: PersonItem[];
  warnings: string[];
  processingMode: 'local-ai' | 'rules-only';
};

export type AnalysisType =
  | 'full'
  | 'summary'
  | 'tasks-for-me'
  | 'dates'
  | 'decisions'
  | 'people';

export type ProcessingMode = 'auto' | 'local-ai' | 'rules-only';

export type SummaryLength = 'short' | 'medium' | 'detailed';

export type SavedAnalysis = {
  id: string;
  title: string;
  createdAt: number;
  userName: string;
  messageCount: number;
  processingMode: 'local-ai' | 'rules-only';
  result: AnalysisResult;
};

export type DeviceCompatibility = {
  webgpu: boolean;
  estimatedMemoryMB: number | null;
  status: 'compatible' | 'slow' | 'incompatible';
  label: string;
};

export type ModelLoadProgress = {
  progress: number;
  stage: string;
  loadedMB: number | null;
  totalMB: number | null;
};
