export type RoutineLevel = 'minimal' | 'beginner' | 'moderate' | 'advanced';
export type Relation = 'helps' | 'supports' | 'may_worsen';
export type CompatLevel = 'compatible' | 'generally_compatible' | 'use_caution' | 'potential_irritation' | 'avoid_unless_advised';

export interface CatalogIngredient {
  position: number;
  rawName: string;
  slug: string | null; // null = not in our ingredient knowledge base yet
  inci: string | null;
  family: string | null;
  irritation: number; // 0-3 (draft values)
  isFragrance: boolean;
  introduceSlowly: boolean;
}

export interface CatalogProduct {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  priceTier: number | null;
  spf: number | null;
  fragranceFree: boolean | null; // null = unknown
  isDemo: boolean;
  skinTypes: string[];
  ingredients: CatalogIngredient[];
}

export interface ConcernLink { concern: string; relation: Relation; relevance: number }

export interface CompatRule {
  a: string; // family slug, a <= b alphabetically
  b: string;
  level: CompatLevel;
  reason: string;
  suggestion: string | null;
  basePenalty: number;
}

export interface Catalog {
  products: CatalogProduct[];
  ingredientConcerns: Map<string, ConcernLink[]>; // ingredient slug -> links
  compat: CompatRule[];
}

export interface UserContext {
  traits: Record<string, number>; // concern code -> effective score 0-100
  priorities: string[]; // main, secondary, long-term
  skinTypes: { primary: string | null; dehydrated: boolean; sensitive: boolean };
  pregnancyOrNursing: boolean | null;
  currentProducts: string[];
  restrictionsText: string | null;
  fragrancePreference: 'no_preference' | 'prefer_fragrance_free' | 'avoid_fragrance';
  budgetTier: number | null;
  routineComplexity: RoutineLevel;
}

export interface ProductSummary {
  id: number; slug: string; name: string; brand: string; category: string;
  priceTier: number | null; spf: number | null; fragranceFree: boolean | null;
  isDemo: boolean; keyIngredients: string[];
}

export interface Breakdown {
  concernMatch: number; skinFit: number; preferenceFit: number;
  budgetFit: number; routineFit: number; riskPenalty: number;
}

export interface Reason { code: string; message: string }

export interface ScoredProduct {
  product: ProductSummary;
  score: number; // a recommendation score, NOT a probability or a medical measure
  breakdown: Breakdown;
  reasons: Reason[];
  warnings: string[];
  families: string[];
  introduceSlowly: boolean;
}

export interface Exclusion { productId: number; name: string; reason: string }

export interface RoutineStep {
  order: number; category: string; product: ProductSummary; frequency: string;
  why: string; howToUse: string; cautions: string[];
}

export interface Routine {
  level: RoutineLevel; am: RoutineStep[]; pm: RoutineStep[];
  warnings: string[]; notes: string[]; activeCount: number;
}

export interface RecommendationOutput {
  engineVersion: string;
  generatedAt: string;
  routine: Routine;
  categories: { category: string; items: ScoredProduct[] }[];
  excluded: Exclusion[];
  notices: string[];
  dataNote: string | null;
  disclaimer: string;
}
