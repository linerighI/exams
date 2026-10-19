export type Question = {
  kind?: import('./questionFormats').QuestionKind;
  points?: number;
  correctChoices?: number[];
  acceptedAnswers?: string[];
  blankAnswers?: string[];
  pairs?: { left: string; right: string }[];
  orderCorrect?: number[];
  rubric?: string;
  keywordGrading?: import('./keywordGrading').KeywordGrading;
  keywordTarget?: number;
  blankCount?: number;
  matchLeft?: string[];
  matchRight?: string[];
  id: string;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  page: number;
  image?: string;
  difficulty?: string;
  bankId?: string;
  geometryId?: string;
  chapter?: string;
  audio?: import('./AudioAttachment').ExamAudio;
};
export type Exam = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  section: string;
  term: string;
  kind: string;
  duration: number;
  total: number;
  difficulty: string;
  cameraRequired: boolean;
  opensAt: string;
  closesAt: string;
  questions: Question[];
  sourceId?: string;
  sourcePages?: number[];
  sourceExcludeFiller?: boolean;
  status: 'draft' | 'published' | 'closed';
  code: string;
  resultsPublished: boolean;
  version: number;
  createdAt: string;
  delivery?: {
    mode: 'random';
    count: number;
    quotas: { chapter: string; difficulty: string; count: number }[];
  };
  calculatorAllowed?: boolean;
  geogebraAllowed?: boolean;
  appearance?: import('./examAppearance').ExamAppearance;
  audio?: import('./AudioAttachment').ExamAudio;
};
export type Student = { id: string; name: string; grade: string; section: string; code: string; loginMethod?: 'national' };
export type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  examTitle?: string;
  startedAt: number;
  deadline: number;
  submittedAt: number | null;
  answers: Record<string, import('./questionFormats').Answer>;
  lateAnswers: Record<string, import('./questionFormats').Answer>;
  manualGrades?: Record<string, number>;
  gradingPending?: boolean;
  revisions: Record<string, number>;
  score: number | null;
  status: string;
  cameraExempt: boolean;
  cameraAvailable: boolean;
  assignedQuestions?: Question[];
  assignmentRank?: string;
  questionCount?: number;
  photos?: { id: string; createdAt: number }[];
  cameraRequests?: { id: string; state: string; createdAt: number }[];
};
export type Source = {
  id: string;
  name: string;
  pages: { page: number; text: string; images: string[] }[];
};
export type Settings = {
  school: string;
  retentionDays: number;
  model: string;
  pythonPath: string;
  aiProvider?: 'ollama' | 'gemini' | 'openai';
  openaiModel?: string;
  hasOpenaiKey?: boolean;
  geminiModel?: string;
  localSpeed?: 'fast' | 'manual';
  hasGeminiKey?: boolean;
};
export type TeacherAccount = {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  disabled: boolean;
  grades?: string[];
  classes?: SchoolClass[];
};
export type SchoolClass = {id:string;grade:string;section:string;count?:number};
export type Session = {
  token: string;
  role: 'teacher' | 'student';
  student?: Student;
  teacherId?: string;
  teacher?: TeacherAccount;
};
export interface DesktopAPI {
  updateState: () => Promise<import('../desktop/appUpdater').UpdateState>;
  checkUpdates: (previews?: boolean) => Promise<import('../desktop/appUpdater').UpdateState>;
  downloadUpdate: () => Promise<import('../desktop/appUpdater').UpdateState>;
  cancelUpdate: () => Promise<import('../desktop/appUpdater').UpdateState>;
  installUpdate: () => Promise<import('../desktop/appUpdater').UpdateState>;
  studentSession: () => Promise<Session | null>;
  connectionState: () => Promise<TeacherConnection>;
  connectTeacher: (host: string, code: string) => Promise<TeacherConnection>;
  request: (path: string, method?: string, body?: unknown) => Promise<any>;
  host: () => Promise<any>;
  discover: () => Promise<any[]>;
  pair: (host: string, code: string) => Promise<any>;
  readBackup: () => Promise<boolean>;
  saveBackup: () => Promise<boolean>;
  exportCSV: (csv: string) => Promise<boolean>;
  exportSpreadsheet: (kind:'students'|'results'|'template'|'database') => Promise<boolean>;
  downloadModel: (model: string) => Promise<any>;
  openOllama: () => Promise<void>;
  openProvider: (provider: string) => Promise<void>;
  speechStatus: () => Promise<{ready:boolean;engine:string;offline:boolean}>;
  transcribeSpeech: (pcm:string, language:'ar'|'en') => Promise<{text:string}>;
  synthesizeSpeech: (text:string, language:'ar'|'en') => Promise<{audio:string;sampleRate:number}>;
  openTeacherResource: (url: string) => Promise<void>;
  exportBankPDF: (bookId: string, options?: import('./pdfOptions').BankPDFOptions) => Promise<boolean>;
  exportReportPDF: (options: import('./pdfOptions').ReportOptions) => Promise<boolean>;
  onEvent: (callback: (event: any) => void) => () => void;
}
export type TeacherConnection = {
  connected: boolean;
  local: boolean;
  school?: string;
  host?: string;
  fingerprint?: string;
};
declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
