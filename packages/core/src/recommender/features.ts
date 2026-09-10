/**
 * Features pulled out of a prompt, using regular expressions and nothing else.
 *
 * Two constraints shape this file. It runs on every keystroke behind a 400 ms
 * debounce in a browser extension, so it has to finish in about two
 * milliseconds. And it must never evaluate anything the user typed: the
 * arithmetic reader below is a hand-written grammar over numbers and five
 * operators, not a call to eval or Function.
 *
 * Nothing here is stored or sent anywhere. The prompt is read, measured, and
 * dropped.
 */

export interface Arithmetic {
  /** The expression we recognised, normalised. */
  expression: string;
  /** The answer, worked out locally. */
  answer: string;
}

export interface UnitConversion {
  value: number;
  from: string;
  to: string;
  answer: string | null;
}

export interface Features {
  words: number;
  chars: number;
  lines: number;
  /** Rough odds that this prompt is mostly code, from zero to one. */
  codeLikelihood: number;
  hasCodeFence: boolean;
  /** A sum we can do ourselves, with the answer. */
  arithmetic: Arithmetic | null;
  unitConversion: UnitConversion | null;
  /** Date arithmetic, such as how many days between two dates. */
  dateMath: boolean;
  /** The leading verb, when the prompt is an instruction. */
  imperativeVerb: string | null;
  /** Phrases that suggest the answer needs working out rather than recalling. */
  reasoningCues: string[];
  /** Separate requirements in the prompt, counted from bullets and "and also" joins. */
  constraintCount: number;
  questionCount: number;
  /** How many turns deep the conversation already is. */
  conversationDepth: number;
  /** Share of characters outside the latin range. */
  nonLatinShare: number;
}

// ------------------------------------------------------------- arithmetic

/**
 * A tiny recursive descent parser over numbers, brackets and + - * / %.
 *
 * Written out by hand on purpose. Evaluating a string the user typed, however
 * carefully sandboxed, is not something a tool that promises to keep everything
 * local should be doing.
 */
const evaluateExpression = (text: string): number | null => {
  let index = 0;
  const source = text.replace(/\s+/g, '');
  if (source === '' || source.length > 120) return null;

  const peek = (): string | undefined => source[index];

  const number = (): number | null => {
    const start = index;
    while (index < source.length && /[0-9.]/.test(source[index] as string)) index += 1;
    if (index === start) return null;
    const value = Number.parseFloat(source.slice(start, index));
    return Number.isFinite(value) ? value : null;
  };

  const factor = (): number | null => {
    if (peek() === '-') {
      index += 1;
      const inner = factor();
      return inner === null ? null : -inner;
    }
    if (peek() === '(') {
      index += 1;
      const inner = expression();
      if (peek() !== ')') return null;
      index += 1;
      return inner;
    }
    return number();
  };

  const term = (): number | null => {
    let left = factor();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const operator = peek() as string;
      index += 1;
      const right = factor();
      if (right === null) return null;
      if ((operator === '/' || operator === '%') && right === 0) return null;
      left = operator === '*' ? left * right : operator === '/' ? left / right : left % right;
    }
    return left;
  };

  function expression(): number | null {
    let left = term();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const operator = peek() as string;
      index += 1;
      const right = term();
      if (right === null) return null;
      left = operator === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = expression();
  return index === source.length && result !== null && Number.isFinite(result) ? result : null;
};

/** Formats an answer the way a person would write it. */
const formatAnswer = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  const rounded = Number.parseFloat(value.toPrecision(10));
  return String(rounded);
};

const ARITHMETIC = /^(?:what(?:'s| is)|calculate|compute|work out|how much is)?\s*([0-9()+\-*/%.\s]{3,120}?)\s*(?:=|\?)?$/i;

export const readArithmetic = (prompt: string): Arithmetic | null => {
  const text = prompt.trim();
  // At least one operator and one digit, or it is not a sum.
  if (!/[0-9]/.test(text) || !/[+\-*/%]/.test(text)) return null;
  const match = ARITHMETIC.exec(text);
  if (!match?.[1]) return null;
  const expression = match[1].trim();
  if (!/[+\-*/%]/.test(expression)) return null;
  const value = evaluateExpression(expression);
  if (value === null) return null;
  return { expression: expression.replace(/\s+/g, ' '), answer: formatAnswer(value) };
};

// --------------------------------------------------------- unit conversion

/**
 * Conversion factors we are confident about. Deliberately short: a wrong
 * conversion given confidently is worse than sending the question to a model.
 */
const UNITS: Record<string, { base: string; factor: number }> = {
  km: { base: 'm', factor: 1000 },
  m: { base: 'm', factor: 1 },
  cm: { base: 'm', factor: 0.01 },
  mm: { base: 'm', factor: 0.001 },
  mile: { base: 'm', factor: 1609.344 },
  miles: { base: 'm', factor: 1609.344 },
  foot: { base: 'm', factor: 0.3048 },
  feet: { base: 'm', factor: 0.3048 },
  ft: { base: 'm', factor: 0.3048 },
  inch: { base: 'm', factor: 0.0254 },
  inches: { base: 'm', factor: 0.0254 },
  kg: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  lb: { base: 'g', factor: 453.59237 },
  lbs: { base: 'g', factor: 453.59237 },
  pound: { base: 'g', factor: 453.59237 },
  pounds: { base: 'g', factor: 453.59237 },
  oz: { base: 'g', factor: 28.349523125 },
  litre: { base: 'l', factor: 1 },
  litres: { base: 'l', factor: 1 },
  liter: { base: 'l', factor: 1 },
  liters: { base: 'l', factor: 1 },
  l: { base: 'l', factor: 1 },
  ml: { base: 'l', factor: 0.001 },
  gallon: { base: 'l', factor: 3.785411784 },
  gallons: { base: 'l', factor: 3.785411784 },
};

const CONVERSION =
  /(-?[0-9][0-9,.]*)\s*([a-z]+)\s*(?:in|to|into|as)\s+([a-z]+)/i;

export const readUnitConversion = (prompt: string): UnitConversion | null => {
  const match = CONVERSION.exec(prompt.trim());
  if (!match) return null;
  const value = Number.parseFloat((match[1] as string).replace(/,/g, ''));
  const from = (match[2] as string).toLowerCase();
  const to = (match[3] as string).toLowerCase();
  if (!Number.isFinite(value)) return null;

  const source = UNITS[from];
  const target = UNITS[to];
  if (!source || !target || source.base !== target.base) return null;

  const answer = formatAnswer(Number.parseFloat(((value * source.factor) / target.factor).toPrecision(8)));
  return { value, from, to, answer: `${answer} ${to}` };
};

// ------------------------------------------------------------ the rest

const CODE_SIGNALS = [
  /```/,
  /\bfunction\s+\w+\s*\(/,
  /\b(?:const|let|var)\s+\w+\s*=/,
  /\bdef\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\bimport\s+[\w{*]/,
  /\breturn\b/,
  /[;{}]\s*$/m,
  /^\s*(?:#include|package |using )/m,
  /\bSELECT\b.+\bFROM\b/i,
  /=>/,
  /\$\{/,
];

const IMPERATIVES = [
  'rewrite', 'reword', 'rephrase', 'summarise', 'summarize', 'shorten', 'expand',
  'translate', 'proofread', 'correct', 'fix the grammar', 'fix grammar', 'spellcheck',
  'extract', 'classify', 'categorise', 'categorize', 'label', 'tag', 'list',
  'format', 'reformat', 'convert', 'capitalise', 'capitalize', 'tidy', 'clean up',
] as const;

const REASONING_CUES = [
  'why', 'prove', 'derive', 'explain how', 'explain why', 'work out',
  'trade-off', 'tradeoff', 'compare', 'design', 'architect', 'debug',
  'root cause', 'step by step', 'reason about', 'implications', 'strategy',
  'edge case', 'race condition', 'optimise', 'optimize', 'refactor',
] as const;

const DATE_MATH =
  /\b(?:how many (?:days|weeks|months|years)|days? (?:between|until|since|from now)|what day (?:is|was)|add \d+ days)\b/i;

export interface FeatureInput {
  prompt: string;
  /** How many turns have already happened in this conversation. */
  conversationDepth?: number;
}

export const extractFeatures = (input: FeatureInput): Features => {
  const prompt = input.prompt ?? '';
  const trimmed = prompt.trim();

  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  const lines = trimmed === '' ? 0 : trimmed.split('\n').length;

  const hasCodeFence = /```/.test(prompt);
  const hits = CODE_SIGNALS.reduce((total, pattern) => total + (pattern.test(prompt) ? 1 : 0), 0);
  const codeLikelihood = Math.min(1, hits / 3);

  const lower = trimmed.toLowerCase();
  const imperativeVerb =
    IMPERATIVES.find((verb) => lower.startsWith(verb) || lower.startsWith(`please ${verb}`)) ?? null;

  /*
   * A longer cue swallows a shorter one it contains, so "explain why" does not
   * also count as "why". Without this the confidence climbs on one phrase and
   * the explanation reads as a list of near-duplicates.
   */
  const allCues = REASONING_CUES.filter((cue) => lower.includes(cue));
  const reasoningCues = allCues.filter(
    (cue) => !allCues.some((other) => other !== cue && other.includes(cue)),
  );

  // Bullets, numbered points, and "and also" joins each mark a separate ask.
  const bullets = (prompt.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) ?? []).length;
  const joins = (lower.match(/\b(?:and also|as well as|then also|additionally)\b/g) ?? []).length;
  const constraintCount = bullets + joins;

  const questionCount = (prompt.match(/\?/g) ?? []).length;

  const nonLatin = (prompt.match(/[^ -ɏ\s]/g) ?? []).length;
  const nonLatinShare = prompt.length === 0 ? 0 : nonLatin / prompt.length;

  return {
    words,
    chars: trimmed.length,
    lines,
    codeLikelihood,
    hasCodeFence,
    arithmetic: readArithmetic(trimmed),
    unitConversion: readUnitConversion(trimmed),
    dateMath: DATE_MATH.test(trimmed),
    imperativeVerb,
    reasoningCues: [...reasoningCues],
    constraintCount,
    questionCount,
    conversationDepth: input.conversationDepth ?? 0,
    nonLatinShare,
  };
};
