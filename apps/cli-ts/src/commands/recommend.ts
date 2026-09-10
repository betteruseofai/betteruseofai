import { canonicalNumber, createRecommender } from '@betteruseofai/core';
import type { Range } from '@betteruseofai/core';

import { flagBool, flagString } from '../args.js';
import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';
import { emitJson, paint } from '../output.js';

/**
 * Ask what a prompt needs, without sending it anywhere.
 *
 * This exists partly so the recommender can be exercised from the shell and
 * partly so the parity harness can compare the two implementations on it. The
 * prompt is read, measured, and dropped: it is never stored and never sent.
 */

const out = (range: Range | null): Record<string, string> | null =>
  range === null
    ? null
    : {
        low: canonicalNumber(range.low),
        central: canonicalNumber(range.central),
        high: canonicalNumber(range.high),
      };

export const recommend = (context: Context, args: ParsedArgs): string => {
  const prompt = args.positional.join(' ');
  if (prompt.trim() === '') {
    throw new Error('Give me a prompt to look at. For example: betteruseofai recommend "17 * 23"');
  }

  const depth = flagString(args.flags, 'depth');
  const recommender = createRecommender({
    dataset: context.dataset,
    // Only offered when the user has said they run models locally.
    hasLocalModel: flagBool(args.flags, 'local'),
  });

  const result = recommender.recommend({
    prompt,
    modelId: flagString(args.flags, 'model') ?? 'claude-opus-5',
    surface: 'api',
    ...(depth ? { conversationDepth: Number.parseInt(depth, 10) } : {}),
  });

  if (context.json) {
    return emitJson(context, {
      command: 'recommend',
      recommendation: {
        kind: result.kind,
        ruleId: result.ruleId,
        confidence: canonicalNumber(result.confidence),
        reasons: result.reasons,
        target: result.target,
        answer: result.answer,
        vetoedBy: result.vetoedBy,
        explanation: result.explanation,
        showAsHint: result.showAsHint,
        showInReport: result.showInReport,
        estimatedSavings: result.estimatedSavings
          ? {
              energyWh: out(result.estimatedSavings.energyWh),
              waterMl: out(result.estimatedSavings.waterMl),
              carbonG: out(result.estimatedSavings.carbonG),
            }
          : null,
      },
    });
  }

  const lines = [result.explanation];

  if (result.estimatedSavings?.energyWh) {
    const saving = result.estimatedSavings;
    lines.push('');
    lines.push(
      paint(
        context,
        'dim',
        `  That swap would save roughly ${saving.energyWh?.central.toFixed(2)} Wh, ` +
          `${saving.waterMl?.central.toFixed(1)} mL and ${saving.carbonG?.central.toFixed(2)} g ` +
          'on a turn of this shape. The reply length is a guess, so treat it as a rough figure.',
      ),
    );
  }

  if (!result.showAsHint && result.showInReport) {
    lines.push('');
    lines.push(paint(context, 'dim', '  Not confident enough to interrupt you before you send.'));
  }

  return lines.join('\n');
};
