import { ApiError, apiFetch } from '../../lib/api';

export type RoutineLevel = 'minimal' | 'beginner' | 'moderate' | 'advanced';

export interface ProductSummary {
  id: number; slug: string; name: string; brand: string; category: string;
  priceTier: number | null; spf: number | null; fragranceFree: boolean | null;
  isDemo: boolean; keyIngredients: string[];
}
export interface Breakdown {
  concernMatch: number; skinFit: number; preferenceFit: number;
  budgetFit: number; routineFit: number; riskPenalty: number;
}
export interface ScoredProduct {
  product: ProductSummary; score: number; breakdown: Breakdown;
  reasons: { code: string; message: string }[]; warnings: string[];
}
export interface RoutineStep {
  order: number; category: string; product: ProductSummary; frequency: string;
  why: string; howToUse: string; cautions: string[];
}
export interface Recommendations {
  runId: string; createdAt: string; engineVersion: string;
  routine: { level: RoutineLevel; am: RoutineStep[]; pm: RoutineStep[]; warnings: string[]; notes: string[]; activeCount: number };
  categories: { category: string; items: ScoredProduct[] }[];
  excluded: { productId: number; name: string; reason: string }[];
  notices: string[]; dataNote: string | null; disclaimer: string;
}

export const createRecommendations = (assessmentId: string, complexity?: RoutineLevel) =>
  apiFetch<Recommendations>(`/api/v1/assessments/${assessmentId}/recommendations`, {
    method: 'POST',
    body: JSON.stringify(complexity ? { complexity } : {}),
  });

/** Returns null when this assessment has no saved recommendations yet. */
export async function getLatestRecommendations(assessmentId: string): Promise<Recommendations | null> {
  try {
    return await apiFetch<Recommendations>(`/api/v1/assessments/${assessmentId}/recommendations/latest`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
