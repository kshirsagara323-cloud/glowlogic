import { apiFetch } from '../../lib/api';

export type Answers = Record<string, string | string[]>;
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type Category = 'low' | 'moderate' | 'high';

export interface QuizOption { id: string; label: string }
export interface QuizQuestion {
  id: string;
  section: string;
  prompt: string;
  hint: string | null;
  type: 'single' | 'multi' | 'text';
  options: QuizOption[];
}
export interface QuizSection { id: string; title: string; description: string }
export interface Quiz {
  rulesVersion: string;
  sections: QuizSection[];
  questions: QuizQuestion[];
  concerns: { code: string; label: string }[];
}

export interface Evidence { questionId: string; question: string; answer: string; points: number }
export interface TraitResult {
  code: string; score: number; category: Category; confidence: number;
  confidenceLevel: ConfidenceLevel; evidence: Evidence[]; explanation: string;
}
export interface SkinTypeResult {
  primary: 'dry' | 'oily' | 'combination' | 'normal'; dehydrated: boolean; sensitive: boolean;
  confidence: number; confidenceLevel: ConfidenceLevel; explanation: string;
}
export interface ToneResult {
  depthBin: number | null; undertone: string | null;
  depthConfidenceLevel: ConfidenceLevel; undertoneConfidenceLevel: ConfidenceLevel; notes: string[];
}
export interface Notice { level: 'info' | 'consult' | 'urgent'; code: string; message: string }
export interface AssessmentResult {
  rulesVersion: string; traits: TraitResult[]; skinType: SkinTypeResult | null;
  tone: ToneResult; priorities: string[]; notices: Notice[]; disclaimer: string;
}
export interface EffectiveTrait { code: string; score: number; category: Category; confidence: number; source: string }
export interface EffectiveTone { depthBin: number | null; undertone: string | null; confidence: number; source: string }
export interface AssessmentDetail {
  id: string; createdAt: string; rulesVersion: string; result: AssessmentResult;
  effectiveTraits: EffectiveTrait[]; effectiveTone: EffectiveTone | null; priorities: string[];
}
export interface OverrideRequest {
  traits?: Record<string, Category | null>;
  tone?: { depthBin: number | null; undertone: string | null };
}

export const getQuiz = () => apiFetch<Quiz>('/api/v1/quiz');
export const listAssessments = () => apiFetch<{ assessments: { id: string; createdAt: string }[] }>('/api/v1/assessments');
export const createAssessment = (body: { answers: Answers; priorities: string[] }) =>
  apiFetch<AssessmentDetail>('/api/v1/assessments', { method: 'POST', body: JSON.stringify(body) });
export const getAssessment = (id: string) => apiFetch<AssessmentDetail>(`/api/v1/assessments/${id}`);
export const overrideAssessment = (id: string, body: OverrideRequest) =>
  apiFetch<AssessmentDetail>(`/api/v1/assessments/${id}/overrides`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteAssessment = (id: string) => apiFetch<void>(`/api/v1/assessments/${id}`, { method: 'DELETE' });
