export const TRAIT_CODES = [
  'acne', 'blackheads', 'whiteheads', 'dryness', 'dehydration', 'oiliness', 'redness',
  'uneven_tone', 'dark_spots', 'hyperpigmentation', 'dullness', 'texture', 'visible_pores',
  'fine_lines', 'under_eye', 'sensitivity',
] as const;
export type TraitCode = (typeof TRAIT_CODES)[number];

export const UNDERTONES = ['warm', 'cool', 'neutral', 'olive'] as const;
export type Undertone = (typeof UNDERTONES)[number];

export type Category = 'low' | 'moderate' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type SectionId = 'oil_hydration' | 'sensitivity' | 'breakouts' | 'tone_marks' | 'color' | 'safety_habits';

export interface QuizOption {
  id: string;
  label: string;
  /** How strongly this answer points to each trait, 0 to 1. A missing trait means "no information". */
  signals?: Partial<Record<TraitCode, number>>;
  /** Undertone votes (only used by the undertone questions). */
  votes?: Partial<Record<Undertone, number>>;
  /** Depth bin 1 (lightest) to 10 (deepest) (only used by the depth question). */
  depthBin?: number;
}

export interface QuizQuestion {
  id: string;
  section: SectionId;
  /** Short name used when explaining a result. */
  short: string;
  prompt: string;
  hint?: string;
  type: 'single' | 'multi' | 'text';
  /** Importance in scoring. 0 means the question is not part of trait scoring. */
  weight: number;
  options: QuizOption[];
}

export type Answers = Record<string, string | string[]>;

export interface Evidence {
  questionId: string;
  question: string;
  answer: string;
  /** How many of the 100 score points came from this answer. */
  points: number;
}

export interface TraitResult {
  code: TraitCode;
  score: number;
  category: Category;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  evidence: Evidence[];
  explanation: string;
}

export type SkinTypeName = 'dry' | 'oily' | 'combination' | 'normal';

export interface SkinTypeResult {
  primary: SkinTypeName;
  dehydrated: boolean;
  sensitive: boolean;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  explanation: string;
}

export interface ToneResult {
  depthBin: number | null;
  undertone: Undertone | null;
  depthConfidence: number;
  undertoneConfidence: number;
  depthConfidenceLevel: ConfidenceLevel;
  undertoneConfidenceLevel: ConfidenceLevel;
  notes: string[];
}

export interface Notice {
  level: 'info' | 'consult' | 'urgent';
  code: string;
  message: string;
}

export interface AssessmentFlags {
  pregnancyOrNursing: boolean | null;
  currentProducts: string[];
  sunscreenHabit: string | null;
  restrictionsText: string | null;
}

export interface AssessmentResult {
  rulesVersion: string;
  traits: TraitResult[];
  skinType: SkinTypeResult | null;
  tone: ToneResult;
  priorities: TraitCode[];
  notices: Notice[];
  flags: AssessmentFlags;
  disclaimer: string;
}

export class InvalidInputError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join(' '));
    this.issues = issues;
  }
}
