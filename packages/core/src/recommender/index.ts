import { estimate } from '../estimate.js';
import { downgradeTarget, getModel, resolveModel } from '../resolve.js';
import type { Model, Range, UsageEvent } from '../types.js';
import { extractFeatures } from './features.js';
import { DEFAULT_RULES } from './rules.js';
import type {
  RecommendInput,
  Recommendation,
  RecommenderOptions,
  Rule,
  RuleContext,
  RuleResult,
  Savings,
} from './types.js';

export * from './features.js';
export * from './types.js';
export { DEFAULT_RULES } from './rules.js';

/**
 * The recommender.
 *
 * Every rule is run, the strongest suggestion wins, and any veto above its
 * threshold blocks a downgrade or a local suggestion and is named in the
 * result. Nothing here changes a model or blocks a send. It produces a
 * sentence, and the person decides.
 *
 * Two thresholds. Above the hint threshold we are confident enough to say
 * something before you press send. Above the report threshold it is worth
 * mentioning afterwards, when interrupting nobody costs nothing.
 */

export const DEFAULT_HINT_THRESHOLD = 0.6;
export const DEFAULT_REPORT_THRESHOLD = 0.45;

/** A veto this confident stops a downgrade or a local suggestion. */
export const VETO_THRESHOLD = 0.7;

const nothing = (reason: string): Recommendation => ({
  kind: 'keep',
  ruleId: 'keep.default',
  confidence: 0,
  reasons: [reason],
  target: null,
  estimatedSavings: null,
  vetoedBy: [],
  answer: null,
  explanation: reason,
  showAsHint: false,
  showInReport: false,
});

const subtract = (before: Range | null, after: Range | null): Range | null => {
  if (before === null || after === null) return null;
  return {
    low: Math.max(0, before.low - after.high),
    central: Math.max(0, before.central - after.central),
    high: Math.max(0, before.high - after.low),
  };
};

/** A sentence that names the rule and what it saw, so the advice can be argued with. */
const explain = (winner: RuleResult, target: Model | null, vetoedBy: string[]): string => {
  const seen = winner.reasons.join('; ');
  if (vetoedBy.length > 0) {
    return `Rule ${winner.ruleId} fired (${seen}), but ${vetoedBy.join(' and ')} held it back.`;
  }
  switch (winner.kind) {
    case 'no-llm':
      return winner.answer
        ? `Rule ${winner.ruleId} fired: ${seen}. The answer is ${winner.answer}.`
        : `Rule ${winner.ruleId} fired: ${seen}.`;
    case 'downgrade':
      return target
        ? `Rule ${winner.ruleId} fired: ${seen}. ${target.displayName} would probably do.`
        : `Rule ${winner.ruleId} fired: ${seen}.`;
    case 'local':
      return `Rule ${winner.ruleId} fired: ${seen}. A model on your own machine would probably do.`;
    default:
      return `Rule ${winner.ruleId} fired: ${seen}.`;
  }
};

export interface Recommender {
  recommend(input: RecommendInput): Recommendation;
  readonly rules: Rule[];
}

export const createRecommender = (options: RecommenderOptions): Recommender => {
  const muted = new Set(options.muted ?? []);
  const rules = [...DEFAULT_RULES, ...(options.rules ?? [])].filter((rule) => !muted.has(rule.id));
  const hintThreshold = options.hintThreshold ?? DEFAULT_HINT_THRESHOLD;
  const reportThreshold = options.reportThreshold ?? DEFAULT_REPORT_THRESHOLD;
  const dataset = options.dataset;

  const recommend = (input: RecommendInput): Recommendation => {
    const features = extractFeatures({
      prompt: input.prompt,
      ...(input.conversationDepth !== undefined
        ? { conversationDepth: input.conversationDepth }
        : {}),
    });

    if (features.words === 0) return nothing('Nothing to look at yet.');

    const model =
      getModel(input.modelId ?? null, dataset) ?? resolveModel(input.modelRaw ?? null, dataset);

    const context: RuleContext = {
      features,
      model,
      surface: input.surface ?? 'api',
      dataset,
      hasLocalModel: options.hasLocalModel === true,
    };

    const fired: Array<{ rule: Rule; result: RuleResult }> = [];
    for (const rule of rules) {
      const outcome = rule.evaluate(context);
      if (outcome !== null) fired.push({ rule, result: outcome });
    }

    const vetoes = fired.filter(({ result }) => result.kind === 'keep');
    const blocking = vetoes
      .filter(({ result }) => result.confidence >= VETO_THRESHOLD)
      .map(({ result }) => result.ruleId)
      .sort();

    const suggestions = fired
      .filter(({ result }) => result.kind !== 'keep')
      // A veto blocks a downgrade or a local suggestion, but not an answer we
      // can give outright. If the sum is on the page, the sum is on the page.
      .filter(({ result }) => result.kind === 'no-llm' || blocking.length === 0)
      .sort((a, b) => {
        if (a.result.confidence !== b.result.confidence) {
          return b.result.confidence - a.result.confidence;
        }
        return a.result.ruleId < b.result.ruleId ? -1 : 1;
      });

    const chosen = suggestions[0];
    if (!chosen) {
      if (blocking.length > 0) {
        const held = vetoes.find(({ result }) => result.ruleId === blocking[0]);
        return {
          ...nothing(
            held
              ? `Stay where you are: ${held.result.reasons.join('; ')}.`
              : 'Stay where you are.',
          ),
          vetoedBy: blocking,
          ruleId: blocking[0] as string,
          confidence: held?.result.confidence ?? 0,
        };
      }
      return nothing('No rule fired, so no suggestion.');
    }

    const winner = chosen.result;
    const target = winner.kind === 'downgrade' && model ? downgradeTarget(model, dataset) : null;

    // A downgrade with nowhere to go is not a downgrade. Say nothing rather
    // than suggesting a swap we cannot name.
    if (winner.kind === 'downgrade' && model && target === null) {
      return nothing(
        `${model.displayName} is already the smallest model we know on its ladder.`,
      );
    }

    const savings = target && model ? priceSwap(input, features, model, target, dataset) : null;

    return {
      kind: winner.kind,
      ruleId: winner.ruleId,
      confidence: winner.confidence,
      reasons: winner.reasons,
      target: target ? { id: target.id, displayName: target.displayName } : null,
      estimatedSavings: savings,
      vetoedBy: blocking,
      answer: winner.answer ?? null,
      explanation: explain(winner, target, blocking),
      showAsHint: chosen.rule.reportOnly !== true && winner.confidence >= hintThreshold,
      showInReport: winner.confidence >= reportThreshold,
    };
  };

  return { recommend, rules };
};

/**
 * What the swap would save on a turn of this shape.
 *
 * The output length is a guess, so this is a rough figure and the interface
 * should say so. It is still worth showing: the gap between a frontier model
 * and the rung below it is usually a factor, not a few per cent.
 */
const priceSwap = (
  input: RecommendInput,
  features: { words: number },
  from: Model,
  to: Model,
  dataset: RecommenderOptions['dataset'],
): Savings | null => {
  // Roughly four characters to a token, and a reply about three times the
  // length of the prompt for the sort of task these rules fire on.
  const inputTokens = Math.max(1, Math.round(features.words * 1.4));
  const outputTokens = input.expectedOutputTokens ?? Math.max(50, inputTokens * 3);

  const shape = (modelId: string): UsageEvent => ({
    id: 'recommendation',
    surface: input.surface ?? 'api',
    hosting: 'cloud',
    modelRaw: modelId,
    modelId,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      thinking: null,
      estimated: true,
      estimator: 'words',
    },
    timestamp: new Date(0).toISOString(),
  });

  const before = estimate(shape(from.id), { dataset, at: '2026-09-10' });
  const after = estimate(shape(to.id), { dataset, at: '2026-09-10' });
  if (before.energyWh === null && after.energyWh === null) return null;

  return {
    energyWh: subtract(before.energyWh, after.energyWh),
    waterMl: subtract(before.waterMl, after.waterMl),
    carbonG: subtract(before.carbonG, after.carbonG),
  };
};
