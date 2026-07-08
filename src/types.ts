/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = "user" | "assistant";

export type NexaEngineId = "core" | "reasoning" | "vision" | "language" | "learning";

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface FactCheckDetails {
  confidenceScore: number; // 0 - 100
  reliabilityScore: number; // 0 - 100
  sourcesChecked: string[];
  verdict: "verified" | "misleading" | "unverified" | "debunked";
  explanation: string;
}

export interface DeepResearchReport {
  executiveSummary: string;
  detailedFindings: string;
  keyInsights: string[];
  references: GroundingSource[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface MCQQuiz {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questions: QuizQuestion[];
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  engineId?: NexaEngineId;
  sources?: GroundingSource[];
  factCheck?: FactCheckDetails;
  researchReport?: DeepResearchReport;
  quiz?: MCQQuiz;
  isWritingDraft?: boolean;
  selectedWritingStyle?: "formal" | "casual" | "academic" | "professional";
  attachment?: {
    name: string;
    type: string; // "pdf" | "docx" | "image" | "txt"
    size: string;
    dataUrl?: string; // base64 representation
    textPreview?: string;
  };
  reaction?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  isPinned: boolean;
  pinOrder?: number;
  mode: "general" | "research" | "study" | "factcheck" | "writing" | "quiz";
  selectedEngineId?: NexaEngineId; // custom force engine override if any, defaults to smart routing
}

export interface GamificationState {
  points: number;
  unlockedBadges: string[];
  stats: {
    chatsCompleted: number;
    enginesUsed: string[];
    deepResearchCompleted: number;
    studyCompleted: number;
    quizzesTaken: number;
    perfectQuizzes: number;
    factChecksCompleted: number;
  };
}

export interface UserProfile {
  email: string;
  fullName: string;
  isGuest: boolean;
  avatarUrl?: string;
  preferences?: {
    primaryLanguage: string;
    rememberPersonalization: boolean;
    personalizationContext: string;
  };
  gamification?: GamificationState;
}

export interface AppSettings {
  theme: "light" | "dark";
  language: string;
  personalizationActive: boolean;
  personalizationNotes: string;
  privacySaveHistory: boolean;
  turboMode?: boolean;
  isAdminVerified?: boolean;
  soundEffectsActive?: boolean;
  defaultAiMode?: "general" | "research" | "study" | "factcheck" | "writing" | "quiz";
  voiceSetting?: string;
}

export interface AdminMetrics {
  activeUsersCount: number;
  totalChatsCount: number;
  totalQueriesToday: number;
  averageResponseTimeMs: number;
  engineRoutingStats: {
    core: number;
    reasoning: number;
    vision: number;
    language: number;
    learning: number;
  };
  serverLoadPct: number;
  memoryUsageMb: number;
  feedbackSubmissions: Array<{
    id: string;
    userEmail: string;
    rating: number; // 1-5
    comment: string;
    timestamp: string;
  }>;
  recentErrors: Array<{
    id: string;
    message: string;
    engine: string;
    timestamp: string;
    severity: "low" | "medium" | "high";
  }>;
}

export interface NexaFeedback {
  id: string;
  userEmail?: string | null;
  userName?: string | null;
  email: string | null;
  feedbackType: "bug" | "feature" | "improvement" | "general" | "other" | string;
  message: string;
  screenshotUrl?: string | null;
  browser?: string;
  deviceType?: string;
  operatingSystem?: string;
  status: "pending" | "reviewed" | "resolved";
  timestamp: string;
}

