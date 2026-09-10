import type { Dataset, Model, Range, Surface } from '../types.js';
import type { Features } from './features.js';

/**
 * The recommender is rule based and says which rule fired.
 *
 * A recommendation nobody can argue with is a recommendation nobody trusts, so
 * every result carries the rule that produced it and the observations that
 * satisfied it. A classifier can be added later as one more rule, blended in
 * alongside the rest rather than replacing them.
 */

export type RuleKind =
  /** The question does not need a model at all, and we have the answer. */
  | 'no-llm'
  /** A smaller model on the same ladder would do. */
  | 'downgrade'
  /** A model on your own machine would do. */
  | 'local'
  /** Stay where you are. Also the kind of a veto. */
  | 'keep';

export interface RuleResult {
  ruleId: string;
  kind: RuleKind;
  /** Zero to one. Thresholds are applied by the recommender, not the rule. */
  confidence: number;
  /** Plain observations, joined into the explanation. */
  reasons: string[];
  /** For a no-llm rule that worked the answer out locally. */
  answer?: string;
}

export interface RuleContext {
  features: Features;
  model: Model | null;
  surface: Surface;
  dataset: Dataset;
  /** Set when the user has told us they run models locally. */
  hasLocalModel: boolean;
}

export interface Rule {
  id: string;
  version: number;
  kind: RuleKind;
  /** Report only rules never surface as a pre-send hint, however confident. */
  reportOnly?: boolean;
  evaluate(context: RuleContext): RuleResult | null;
}

export interface Savings {
  energyWh: Range | null;
  waterMl: Range | null;
  carbonG: Range | null;
}

export interface Recommendation {
  kind: RuleKind;
  ruleId: string;
  confidence: number;
  reasons: string[];
  /** The model we suggest instead, when there is one. */
  target: { id: string; displayName: string } | null;
  /** What the swap would save on a turn of this shape, when we can work it out. */
  estimatedSavings: Savings | null;
  /** Rules that blocked a downgrade or a local suggestion. */
  vetoedBy: string[];
  /** A locally computed answer, for the arithmetic and conversion rules. */
  answer: string | null;
  /** One sentence naming the rule and what it saw. */
  explanation: string;
  /** Confident enough to interrupt before sending. */
  showAsHint: boolean;
  /** Worth mentioning in the report afterwards. */
  showInReport: boolean;
}

export interface RecommenderOptions {
  dataset: Dataset;
  /** Extra rules, including a future classifier wrapped as one. */
  rules?: Rule[];
  /** Set true only when the user has said they run models locally. */
  hasLocalModel?: boolean;
  /** Raise this where an interruption is more costly, such as inside a coding agent. */
  hintThreshold?: number;
  reportThreshold?: number;
  /** Rules to leave out by id, for the mute command. */
  muted?: string[];
}

export interface RecommendInput {
  prompt: string;
  /** The model about to be used. */
  modelId?: string | null;
  modelRaw?: string;
  surface?: Surface;
  conversationDepth?: number;
  /** Token counts to price the saving against. Estimated from the prompt when absent. */
  expectedOutputTokens?: number;
}
