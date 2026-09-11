import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createRecommender,
  extractFeatures,
  readArithmetic,
  readUnitConversion,
} from '../src/recommender/index.js';
import { loadDataset } from './helpers.js';

const dataset = loadDataset();
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');

interface Case {
  name: string;
  prompt: string;
  why?: string;
  modelId?: string;
  conversationDepth?: number;
  hasLocalModel?: boolean;
  expect: {
    kind?: string;
    ruleId?: string;
    answer?: string | null;
    vetoedBy?: string[];
    showAsHint?: boolean;
    showInReport?: boolean;
    confidence?: number;
  };
}

const cases: Case[] = readFileSync(join(fixtures, 'recommender', 'cases.jsonl'), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line) as Case);

describe('the shared recommender cases', () => {
  it.each(cases)('$name', (testCase) => {
    const recommender = createRecommender({
      dataset,
      hasLocalModel: testCase.hasLocalModel === true,
    });
    const got = recommender.recommend({
      prompt: testCase.prompt,
      modelId: testCase.modelId ?? 'claude-opus-5',
      ...(testCase.conversationDepth !== undefined
        ? { conversationDepth: testCase.conversationDepth }
        : {}),
    });

    const wanted = testCase.expect;
    if (wanted.kind !== undefined) expect(got.kind, testCase.why).toBe(wanted.kind);
    if (wanted.ruleId !== undefined) expect(got.ruleId).toBe(wanted.ruleId);
    if (wanted.answer !== undefined) expect(got.answer).toBe(wanted.answer);
    if (wanted.vetoedBy !== undefined) {
      for (const veto of wanted.vetoedBy) expect(got.vetoedBy).toContain(veto);
    }
    if (wanted.showAsHint !== undefined) expect(got.showAsHint).toBe(wanted.showAsHint);
    if (wanted.showInReport !== undefined) expect(got.showInReport).toBe(wanted.showInReport);
    if (wanted.confidence !== undefined) expect(got.confidence).toBe(wanted.confidence);
  });
});

describe('the arithmetic reader', () => {
  it('never evaluates what it was given', () => {
    // If this were eval, any of these would run. They must all come back null.
    for (const attack of [
      'process.exit(1)',
      '1 + require("fs")',
      'constructor.constructor("return 1")()',
      '[].map.call(1,1)',
      '1 + 1; console.log(2)',
    ]) {
      expect(readArithmetic(attack), attack).toBeNull();
    }
  });

  it('refuses a sum it cannot finish rather than guessing', () => {
    expect(readArithmetic('5 / 0')).toBeNull();
    expect(readArithmetic('5 +')).toBeNull();
    expect(readArithmetic('(5 + 3')).toBeNull();
    expect(readArithmetic('5 5')).toBeNull();
  });

  it('reads the sums people actually type', () => {
    expect(readArithmetic('17*23')?.answer).toBe('391');
    expect(readArithmetic('what is 100 - 37')?.answer).toBe('63');
    expect(readArithmetic('(2 + 3) * 4')?.answer).toBe('20');
    expect(readArithmetic('-5 + 12')?.answer).toBe('7');
    expect(readArithmetic('10 % 3')?.answer).toBe('1');
  });

  it('gives up on anything long enough to be a denial of service', () => {
    expect(readArithmetic(`1${'+1'.repeat(200)}`)).toBeNull();
  });
});

describe('the unit reader', () => {
  it('converts only within one kind of quantity', () => {
    expect(readUnitConversion('5 km in miles')?.answer).toBe('3.106856 miles');
    expect(readUnitConversion('2 kg in pounds')?.answer).toBe('4.4092452 pounds');
    expect(readUnitConversion('5 km in kilograms')).toBeNull();
    expect(readUnitConversion('5 parsecs in bananas')).toBeNull();
  });
});

describe('features', () => {
  it('does not go quadratic on a long prompt', () => {
    // The real budget is two milliseconds, behind a 400 ms debounce. The
    // ceiling here is twenty times that, because a wall-clock assertion on a
    // loaded machine is flaky and a flaky test teaches people to ignore
    // failures. This catches an accidental quadratic, nothing finer.
    const prompt = 'Rewrite this paragraph so it reads more plainly. '.repeat(40);
    const started = performance.now();
    for (let run = 0; run < 100; run += 1) extractFeatures({ prompt });
    expect((performance.now() - started) / 100).toBeLessThan(40);
  });

  it('counts separate requirements from bullets and joins', () => {
    expect(extractFeatures({ prompt: '- one\n- two\n- three' }).constraintCount).toBe(3);
    expect(extractFeatures({ prompt: 'do this and also that' }).constraintCount).toBe(1);
  });

  it('spots a code block', () => {
    expect(extractFeatures({ prompt: '```js\nconst a = 1;\n```' }).hasCodeFence).toBe(true);
    expect(extractFeatures({ prompt: 'no code at all here' }).hasCodeFence).toBe(false);
  });
});

describe('what the recommender will not do', () => {
  const recommender = createRecommender({ dataset });

  it('never suggests a model it cannot name', () => {
    const got = recommender.recommend({
      prompt: 'What is the capital of Australia',
      modelId: 'claude-haiku-4.5',
    });
    expect(got.target).toBeNull();
    expect(got.kind).toBe('keep');
  });

  it('names the rule that fired, so the advice can be argued with', () => {
    const got = recommender.recommend({
      prompt: 'Rewrite this sentence so it is shorter.',
      modelId: 'claude-opus-5',
    });
    expect(got.explanation).toContain('downgrade.rewrite-task');
    expect(got.explanation).toContain('Claude Sonnet 5');
    expect(got.reasons.length).toBeGreaterThan(0);
  });

  it('prices the swap it suggests', () => {
    const got = recommender.recommend({
      prompt: 'Rewrite this sentence so it is shorter.',
      modelId: 'claude-opus-5',
    });
    expect(got.estimatedSavings?.energyWh?.central).toBeGreaterThan(0);
    expect(got.estimatedSavings?.carbonG?.central).toBeGreaterThan(0);
  });

  it('never reports a negative saving', () => {
    for (const model of dataset.models) {
      const got = recommender.recommend({
        prompt: 'Rewrite this sentence so it is shorter.',
        modelId: model.id,
      });
      const saving = got.estimatedSavings;
      if (!saving) continue;
      for (const value of [saving.energyWh, saving.waterMl, saving.carbonG]) {
        if (value === null) continue;
        expect(value.low, model.id).toBeGreaterThanOrEqual(0);
        expect(value.central, model.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('can be muted a rule at a time', () => {
    const quiet = createRecommender({ dataset, muted: ['downgrade.rewrite-task'] });
    const got = quiet.recommend({
      prompt: 'Rewrite this sentence so it is shorter.',
      modelId: 'claude-opus-5',
    });
    expect(got.ruleId).not.toBe('downgrade.rewrite-task');
  });

  it('takes a higher bar where interrupting costs more', () => {
    const careful = createRecommender({ dataset, hintThreshold: 0.9 });
    const got = careful.recommend({
      prompt: 'Rewrite this sentence so it is shorter.',
      modelId: 'claude-opus-5',
    });
    expect(got.showAsHint).toBe(false);
    expect(got.showInReport).toBe(true);
  });

  it('accepts an extra rule, which is where a classifier will plug in', () => {
    const withClassifier = createRecommender({
      dataset,
      rules: [
        {
          id: 'classifier.example',
          version: 1,
          kind: 'downgrade',
          evaluate: () => ({
            ruleId: 'classifier.example',
            kind: 'downgrade',
            confidence: 0.99,
            reasons: ['a model said so'],
          }),
        },
      ],
    });
    const got = withClassifier.recommend({ prompt: 'anything at all', modelId: 'claude-opus-5' });
    expect(got.ruleId).toBe('classifier.example');
  });

  it('is deterministic, so the two implementations agree', () => {
    for (const testCase of cases) {
      const first = recommender.recommend({ prompt: testCase.prompt, modelId: 'claude-opus-5' });
      const second = recommender.recommend({ prompt: testCase.prompt, modelId: 'claude-opus-5' });
      expect(second).toEqual(first);
    }
  });

  it('says nothing at all rather than something vague', () => {
    const got = recommender.recommend({ prompt: '   ', modelId: 'claude-opus-5' });
    expect(got.showAsHint).toBe(false);
    expect(got.showInReport).toBe(false);
    expect(got.confidence).toBe(0);
  });

  it('follows the copy rules in everything it says', () => {
    for (const testCase of cases) {
      const got = createRecommender({ dataset, hasLocalModel: true }).recommend({
        prompt: testCase.prompt,
        modelId: 'claude-opus-5',
      });
      expect(got.explanation).not.toMatch(/[–—!]/);
      expect(got.explanation).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });
});
