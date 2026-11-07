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
  /** Words that name parts of a program, so "correct the failing tests" reads as code work. */
  codeNouns: string[];
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
    const text = source.slice(start, index);
    // "1.2.3" is not a number. parseFloat would read 1.2 and Python would refuse.
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;
    const value = Number.parseFloat(text);
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

/**
 * Digits and dashes that are not a sum. "2026-10-19" is a date, not 1997, and
 * "020-7946-0018" is a telephone number. Three or more groups joined by the same
 * dash or slash with no spaces, or any number with a leading zero, is read as a
 * date, a number or a code, and left alone. "100-37" with one dash is still a sum.
 */
const notASum = (expression: string): boolean =>
  /^\d+([-/])\d+(?:\1\d+)+$/.test(expression) || /(?:^|[^\d.])0\d/.test(expression);

const ARITHMETIC = /^(?:what(?:'s| is)|calculate|compute|work out|how much is)?\s*([0-9()+\-*/%.\s]{3,120}?)\s*(?:=|\?)?$/i;

export const readArithmetic = (prompt: string): Arithmetic | null => {
  const text = prompt.trim();
  // At least one operator and one digit, or it is not a sum.
  if (!/[0-9]/.test(text) || !/[+\-*/%]/.test(text)) return null;
  const match = ARITHMETIC.exec(text);
  if (!match?.[1]) return null;
  const expression = match[1].trim();
  if (!/[+\-*/%]/.test(expression)) return null;
  if (notASum(expression)) return null;
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

/*
 * One well-formed number, with thousands commas or a decimal point but not
 * both mixed up, and not the tail of a longer one: "1.2.3 km" is nothing, not
 * 1.2 km or 2.3 km.
 */
const CONVERSION =
  /(?<![\d.,])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?![\d.,])\s*([a-z]+)\s*(?:in|to|into|as)\s+([a-z]+)/i;

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

// A whole word at the start, so "listen" is not "list" and "tagline" is not "tag".
const IMPERATIVE_PATTERNS = IMPERATIVES.map((verb) => ({
  verb,
  pattern: new RegExp(`^(?:please\\s+)?${verb}(?![a-z])`),
}));

const REASONING_CUES = [
  'why', 'prove', 'derive', 'explain how', 'explain why', 'work out',
  'trade-off', 'tradeoff', 'compare', 'design', 'architect', 'debug',
  'root cause', 'step by step', 'reason about', 'implications', 'strategy',
  'edge case', 'race condition', 'optimise', 'optimize', 'refactor',
] as const;

/*
 * Words that name parts of a program. "Extract the parser into its own module"
 * starts like a shaped task and is a refactor. Words with an everyday sense
 * ("file", "script", "branch", "test", "class") are left out on purpose.
 */
const CODE_NOUNS =
  /\b(?:functions?|methods?|modules?|parsers?|tests|(?:unit|failing) tests?|bugs?|repos?|repository|codebase|commits?|endpoints?|components?|variables?|compiler|linter|stack trace|regex|schema|migrations?|pull request|api|dependency|dependencies|exceptions?|git|type errors?|source code|the code)\b/g;

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
  const imperativeVerb = IMPERATIVE_PATTERNS.find(({ pattern }) => pattern.test(lower))?.verb ?? null;

  const codeNouns = [...new Set((lower.match(CODE_NOUNS) ?? []).map((word) => word.trim()))];

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

  const nonLatin = (prompt.match(/[^\u0000-ɏ\s]/g) ?? []).length;
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
    codeNouns,
    reasoningCues: [...reasoningCues],
    constraintCount,
    questionCount,
    conversationDepth: input.conversationDepth ?? 0,
    nonLatinShare,
  };
};
