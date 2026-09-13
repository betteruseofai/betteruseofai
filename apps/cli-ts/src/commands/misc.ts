import { canonicalNumber, downgradeTarget, selectBenchmark } from '@betteruseofai/core';
import { defaultClaudeDir, defaultCodexDir, exists } from '@betteruseofai/readers';

import { flagBool, flagString } from '../args.js';
import type { ParsedArgs } from '../args.js';
import type { Context } from '../context.js';
import { loadEvents } from '../context.js';
import { emitJson, paint, table } from '../output.js';

/** The model table, and where its numbers come from. */
export const models = (context: Context, args: ParsedArgs): string => {
  const showAll = flagBool(args.flags, 'all');
  const at = context.now.toISOString().slice(0, 10);

  const rows = context.dataset.models.map((model) => {
    const row = selectBenchmark(model, context.dataset, { at });
    const target = downgradeTarget(model, context.dataset);
    return { model, row, target };
  });

  if (context.json) {
    return emitJson(context, {
      command: 'models',
      models: rows.map(({ model, row, target }) => ({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        family: model.family,
        tier: model.tier,
        ordinal: model.ordinal,
        reasoning: model.reasoning,
        aliases: [...model.aliases].sort(),
        benchmarkRowId: row?.id ?? null,
        methodology: row?.methodology ?? null,
        boundary: row?.boundary ?? null,
        qualityScore: row?.qualityScore ?? null,
        sourceUrl: row?.source.url ?? null,
        downgradeTarget: target?.id ?? null,
      })),
      ...(showAll
        ? {
            regions: context.dataset.regions.map((region) => ({
              code: region.code,
              name: region.name,
              gridGco2PerKwh: canonicalNumber(region.gridGco2PerKwh.central),
              year: region.year,
            })),
          }
        : {}),
    });
  }

  const lines = [
    table(
      context,
      ['model', 'tier', 'thinks', 'measured by', 'quality', 'one rung down'],
      rows.map(({ model, row, target }) => [
        model.displayName,
        model.tier,
        model.reasoning ? 'yes' : 'no',
        row?.methodology ?? 'nothing',
        row ? `${row.qualityScore} of 5` : 'unknown',
        target?.displayName ?? 'nothing smaller',
      ]),
    ),
  ];

  if (showAll) {
    lines.push('');
    lines.push(paint(context, 'dim', 'REGIONS'));
    lines.push(
      table(
        context,
        ['code', 'name', 'gCO2e per kWh', 'year'],
        context.dataset.regions.map((region) => [
          region.code,
          region.name,
          String(Math.round(region.gridGco2PerKwh.central)),
          String(region.year),
        ]),
        ['left', 'left', 'right', 'right'],
      ),
    );
  }

  lines.push('');
  lines.push(
    paint(
      context,
      'dim',
      '  A quality of 2 means the figure is scaled from a different model, because nobody has measured this one.',
    ),
  );
  return lines.join('\n');
};

/** Every turn as a row, for a spreadsheet. */
export const exportEvents = async (context: Context, args: ParsedArgs): Promise<string> => {
  const format = flagString(args.flags, 'format') ?? (context.json ? 'json' : 'csv');
  const { pairs } = await loadEvents(context, args);

  if (format === 'json') {
    return emitJson(context, {
      command: 'export',
      events: pairs.map(({ event, estimate }) => ({
        id: event.id,
        timestamp: event.timestamp,
        surface: event.surface,
        sessionId: event.sessionId ?? null,
        modelRaw: event.modelRaw,
        modelId: estimate.modelId,
        inputTokens: event.tokens.input ?? 0,
        outputTokens: event.tokens.output ?? 0,
        cachedReadTokens: event.tokens.cachedRead ?? 0,
        cachedWriteTokens: event.tokens.cachedWrite ?? 0,
        thinkingTokens: event.tokens.thinking,
        energyWhCentral: estimate.energyWh ? canonicalNumber(estimate.energyWh.central) : null,
        waterMlCentral: estimate.waterMl ? canonicalNumber(estimate.waterMl.central) : null,
        carbonGCentral: estimate.carbonG ? canonicalNumber(estimate.carbonG.central) : null,
        benchmarkRowId: estimate.basis.benchmarkRowId,
        flags: [...estimate.basis.flags].sort(),
      })),
    });
  }

  if (format !== 'csv') throw new Error('--format must be csv or json.');

  /*
   * An unknown figure is an empty cell, never a zero. A spreadsheet will sum a
   * column of zeroes quite happily and produce a total that is a lie.
   */
  const cell = (value: number | null | undefined): string =>
    value === null || value === undefined ? '' : canonicalNumber(value);

  const header = [
    'timestamp',
    'surface',
    'session',
    'model',
    'model_raw',
    'input_tokens',
    'cached_read_tokens',
    'cached_write_tokens',
    'output_tokens',
    'thinking_tokens',
    'energy_wh_low',
    'energy_wh_central',
    'energy_wh_high',
    'water_ml_central',
    'carbon_g_central',
    'benchmark_row',
    'flags',
  ].join(',');

  const escape = (text: string): string =>
    /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

  const rows = pairs.map(({ event, estimate }) =>
    [
      event.timestamp,
      event.surface,
      event.sessionId ?? '',
      estimate.modelId ?? '',
      event.modelRaw,
      String(event.tokens.input ?? 0),
      String(event.tokens.cachedRead ?? 0),
      String(event.tokens.cachedWrite ?? 0),
      String(event.tokens.output ?? 0),
      event.tokens.thinking === null ? '' : String(event.tokens.thinking ?? 0),
      cell(estimate.energyWh?.low),
      cell(estimate.energyWh?.central),
      cell(estimate.energyWh?.high),
      cell(estimate.waterMl?.central),
      cell(estimate.carbonG?.central),
      estimate.basis.benchmarkRowId ?? '',
      [...estimate.basis.flags].sort().join(' '),
    ]
      .map(escape)
      .join(','),
  );

  return [header, ...rows].join('\n');
};

/** Checks the things that go wrong, and says what to do about each. */
export const doctor = async (context: Context, args: ParsedArgs): Promise<string> => {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  const claudeDir = defaultClaudeDir();
  const codexDir = defaultCodexDir();
  const claudeThere = await exists(claudeDir);
  const codexThere = await exists(codexDir);

  checks.push({
    name: 'Claude Code transcripts',
    ok: claudeThere,
    detail: claudeThere
      ? claudeDir
      : `Nothing at ${claudeDir}. Set BUAI_CLAUDE_DIR if yours lives somewhere else.`,
  });
  checks.push({
    name: 'Codex CLI rollouts',
    ok: codexThere,
    detail: codexThere
      ? codexDir
      : `Nothing at ${codexDir}. Set CODEX_HOME if yours lives somewhere else. Rollouts written before 6 September 2025 carry no token counts.`,
  });

  const nodeOk = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10) >= 20;
  checks.push({
    name: 'Node version',
    ok: nodeOk,
    detail: nodeOk ? process.versions.node : `${process.versions.node}, and we need 20 or newer.`,
  });

  checks.push({
    name: 'Dataset',
    ok: true,
    detail: `${context.dataset.version}, ${context.dataset.benchmarks.length} benchmark rows, sha ${context.dataset.sha256.slice(0, 12)}`,
  });

  const { pairs, readers } = await loadEvents(context, args);
  const warnings = readers.flatMap((result) => result.warnings);
  const unknown = pairs.filter((pair) => pair.estimate.basis.flags.includes('model-unknown'));

  checks.push({
    name: 'Turns found',
    ok: pairs.length > 0,
    detail: pairs.length > 0 ? `${pairs.length} in the window` : 'none in the window; try --since 30d',
  });
  checks.push({
    name: 'Models recognised',
    ok: unknown.length === 0,
    detail:
      unknown.length === 0
        ? 'all of them'
        : `${unknown.length} turns used: ${[...new Set(unknown.map((p) => p.event.modelRaw))].join(', ')}. Adding them to the dataset would fix that.`,
  });
  checks.push({
    name: 'Lines we could not parse',
    ok: warnings.length === 0,
    detail: warnings.length === 0 ? 'none' : `${warnings.length}, which were skipped`,
  });

  if (context.json) {
    return emitJson(context, {
      command: 'doctor',
      checks: checks.map((check) => ({ name: check.name, ok: check.ok, detail: check.detail })),
    });
  }

  const lines = checks.map(
    (check) =>
      `  ${check.ok ? paint(context, 'green', 'ok  ') : paint(context, 'yellow', 'note')}  ${check.name.padEnd(26)}  ${check.detail}`,
  );
  lines.push('');
  lines.push(paint(context, 'dim', '  Nothing here contacts a network. Every figure is worked out on this machine.'));
  return lines.join('\n');
};
