import type { Features } from './features.js';
import type { Rule, RuleResult } from './types.js';

/**
 * The rules, each one small enough to argue with.
 *
 * Confidences are set conservatively. A nudge that fires when it should not is
 * worse than one that stays quiet: the first gets the whole feature switched
 * off, and then nothing is measured at all. Every threshold here is a guess we
 * expect to revise once the recommender has met real prompts, and the numbers
 * live in this one file so revising them is a small change.
 */

const result = (
  ruleId: string,
  kind: RuleResult['kind'],
  confidence: number,
  reasons: string[],
  answer?: string,
): RuleResult => ({ ruleId, kind, confidence, reasons, ...(answer ? { answer } : {}) });

/** Shared guard: a prompt with code in it is nobody's idea of a small task. */
const looksLikeCode = (features: Features): boolean =>
  features.hasCodeFence || features.codeLikelihood >= 0.34;

// ------------------------------------------------------ questions with answers

const arithmetic: Rule = {
  id: 'no-llm.arithmetic',
  version: 1,
  kind: 'no-llm',
  evaluate({ features }) {
    if (!features.arithmetic) return null;
    if (features.words > 20) return null;
    return result(
      'no-llm.arithmetic',
      'no-llm',
      0.95,
      [`the whole prompt is the sum ${features.arithmetic.expression}`],
      features.arithmetic.answer,
    );
  },
};

const unitConversion: Rule = {
  id: 'no-llm.unit-conversion',
  version: 1,
  kind: 'no-llm',
  evaluate({ features }) {
    const conversion = features.unitConversion;
    if (!conversion?.answer) return null;
    if (features.words > 15) return null;
    return result(
      'no-llm.unit-conversion',
      'no-llm',
      0.9,
      [`converts ${conversion.from} to ${conversion.to}`],
      conversion.answer,
    );
  },
};

const dateMath: Rule = {
  id: 'no-llm.date-math',
  version: 1,
  kind: 'no-llm',
  evaluate({ features }) {
    if (!features.dateMath || features.words > 20) return null;
    // No answer offered: date arithmetic depends on a calendar and a timezone,
    // and a confidently wrong date is worse than no suggestion.
    return result('no-llm.date-math', 'no-llm', 0.8, [
      'asks for date arithmetic, which a calendar does better',
    ]);
  },
};

// -------------------------------------------------------------- downgrades

const rewriteTask: Rule = {
  id: 'downgrade.rewrite-task',
  version: 1,
  kind: 'downgrade',
  evaluate({ features }) {
    const verb = features.imperativeVerb;
    if (!verb) return null;
    if (!['rewrite', 'reword', 'rephrase', 'proofread', 'correct', 'spellcheck', 'tidy'].some((one) => verb.startsWith(one)) && !verb.includes('grammar')) {
      return null;
    }
    if (features.words > 400) return null;
    return result('downgrade.rewrite-task', 'downgrade', 0.8, [
      `starts with "${verb}"`,
      `${features.words} words`,
      features.codeLikelihood > 0 ? 'some code' : 'no code',
    ]);
  },
};

const summarise: Rule = {
  id: 'downgrade.summarise',
  version: 1,
  kind: 'downgrade',
  evaluate({ features }) {
    const verb = features.imperativeVerb;
    if (!verb || !['summarise', 'summarize', 'shorten'].includes(verb)) return null;
    return result('downgrade.summarise', 'downgrade', 0.75, [
      `starts with "${verb}"`,
      `${features.words} words`,
    ]);
  },
};

const translate: Rule = {
  id: 'downgrade.translate',
  version: 1,
  kind: 'downgrade',
  evaluate({ features }) {
    if (features.imperativeVerb !== 'translate') return null;
    return result('downgrade.translate', 'downgrade', 0.8, [
      'starts with "translate"',
      `${features.words} words`,
    ]);
  },
};

const classifyExtract: Rule = {
  id: 'downgrade.classify-extract',
  version: 1,
  kind: 'downgrade',
  evaluate({ features }) {
    const verb = features.imperativeVerb;
    if (!verb || !['extract', 'classify', 'categorise', 'categorize', 'label', 'tag', 'format', 'reformat'].includes(verb)) {
      return null;
    }
    return result('downgrade.classify-extract', 'downgrade', 0.7, [
      `starts with "${verb}"`,
      'a shaped output task rather than an open one',
    ]);
  },
};

const shortSimple: Rule = {
  id: 'downgrade.short-simple',
  version: 1,
  kind: 'downgrade',
  evaluate({ features }) {
    if (features.words > 25 || features.words < 3) return null;
    if (looksLikeCode(features)) return null;
    if (features.reasoningCues.length > 0) return null;
    if (features.constraintCount > 0) return null;
    return result('downgrade.short-simple', 'downgrade', 0.7, [
      `${features.words} words`,
      'no code',
      'nothing that needs working out',
    ]);
  },
};

const noReasoningCues: Rule = {
  id: 'downgrade.no-reasoning-cues',
  version: 1,
  kind: 'downgrade',
  // Weak on its own. It belongs in the report afterwards, not in an
  // interruption before you press send.
  reportOnly: true,
  evaluate({ features }) {
    if (features.reasoningCues.length > 0) return null;
    if (features.words > 120) return null;
    if (features.hasCodeFence) return null;
    return result('downgrade.no-reasoning-cues', 'downgrade', 0.55, [
      'nothing in the wording suggests the answer needs working out',
    ]);
  },
};

// ------------------------------------------------------------------ local

const smallTask: Rule = {
  id: 'local.small-task',
  version: 1,
  kind: 'local',
  evaluate({ features, hasLocalModel }) {
    // Never suggested unless the user has said they run models locally.
    // Telling somebody to use a tool they do not have is not a suggestion.
    if (!hasLocalModel) return null;
    if (features.words > 60 || features.hasCodeFence) return null;
    if (features.reasoningCues.length > 0) return null;
    // A genuinely tiny task outranks a downgrade, because running it here
    // removes the data centre entirely where a downgrade only shrinks the
    // model inside it. Above that size the case is weaker: a laptop running one
    // request at a time is not obviously lighter than a batched accelerator.
    const tiny = features.words <= 25 && features.constraintCount === 0;
    return result('local.small-task', 'local', tiny ? 0.75 : 0.6, [
      `${features.words} words`,
      tiny
        ? 'small enough to run on your own machine instead of in a data centre'
        : 'probably small enough for a model on your own machine',
    ]);
  },
};

// ----------------------------------------------------------------- vetoes

const deepReasoning: Rule = {
  id: 'keep.deep-reasoning',
  version: 1,
  kind: 'keep',
  evaluate({ features }) {
    if (features.reasoningCues.length === 0) return null;
    const confidence = Math.min(0.95, 0.6 + 0.15 * features.reasoningCues.length);
    const named = features.reasoningCues.slice(0, 3);
    const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return result('keep.deep-reasoning', 'keep', confidence, [
      `the wording asks for reasoning: ${list}`,
    ]);
  },
};

const longCode: Rule = {
  id: 'keep.long-code',
  version: 1,
  kind: 'keep',
  evaluate({ features }) {
    if (!features.hasCodeFence && features.codeLikelihood < 0.67) return null;
    if (features.words < 40 && !features.hasCodeFence) return null;
    return result('keep.long-code', 'keep', 0.85, [
      features.hasCodeFence ? 'contains a code block' : 'reads mostly as code',
      `${features.words} words`,
    ]);
  },
};

const multiStep: Rule = {
  id: 'keep.multi-step',
  version: 1,
  kind: 'keep',
  evaluate({ features }) {
    if (features.constraintCount < 3) return null;
    return result('keep.multi-step', 'keep', 0.8, [
      `${features.constraintCount} separate requirements`,
    ]);
  },
};

const deepConversation: Rule = {
  id: 'keep.deep-conversation',
  version: 1,
  kind: 'keep',
  evaluate({ features }) {
    if (features.conversationDepth < 8) return null;
    // Swapping models part way through a long conversation loses the thread,
    // whatever the next prompt looks like on its own.
    return result('keep.deep-conversation', 'keep', 0.75, [
      `${features.conversationDepth} turns into this conversation already`,
    ]);
  },
};

export const DEFAULT_RULES: Rule[] = [
  arithmetic,
  unitConversion,
  dateMath,
  rewriteTask,
  summarise,
  translate,
  classifyExtract,
  shortSimple,
  noReasoningCues,
  smallTask,
  deepReasoning,
  longCode,
  multiStep,
  deepConversation,
];
