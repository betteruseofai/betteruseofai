#!/usr/bin/env node
/**
 * Deprecation dates from Modelfax, and a list of what we do not know.
 *
 * Modelfax publishes one JSON file per provider with model ids, context
 * windows, prices and dates, MIT code and CC BY 4.0 data, in a repository this
 * can read without a key. Two things come out of it:
 *
 *   1. A model we list that Modelfax says is deprecated, with a date that has
 *      passed, gets that date written into models.json. The engine then stops
 *      offering it as a downgrade target. A date still in the future is
 *      reported and not written, because the model is still what people use.
 *   2. Models Modelfax knows and we do not are listed in the pull request
 *      body for a person, because each one needs a benchmark row and a
 *      family ladder position, which is judgement rather than data.
 *
 * Run with --write to change models.json. Without it, it prints what it would do.
 */

import { pathToFileURL } from 'node:url';
import { fetchText, load, report, save, today } from './refresh-common.mjs';

const RAW = 'https://raw.githubusercontent.com/bytebrujo/modelfax/main/data';
const PROVIDERS = ['anthropic', 'google', 'openai'];
const CITE = 'Modelfax (github.com/bytebrujo/modelfax, CC BY 4.0)';

/** Our ids use dots between version digits; Modelfax uses hyphens. */
const norm = (text) => text.toLowerCase().replace(/[.\s]/g, '-');

export const refreshModels = async ({ write }) => {
  const files = [];
  for (const provider of PROVIDERS) {
    const text = await fetchText(`${RAW}/${provider}.json`);
    if (!text) {
      report([`Modelfax: ${provider}.json could not be read, so nothing was changed.`]);
      return false;
    }
    files.push(JSON.parse(text));
  }

  const models = load('models');
  const byAlias = new Map();
  for (const model of models.models) {
    for (const alias of [model.id, ...model.aliases]) byAlias.set(norm(alias), model);
  }

  const written = [];
  const future = [];
  const unknown = [];
  const now = today();

  for (const file of files) {
    for (const theirs of file.models) {
      const ours = byAlias.get(norm(theirs.model_id));
      if (!ours) {
        if (theirs.status !== 'retired') unknown.push(`${theirs.provider}: ${theirs.model_id} (${theirs.status})`);
        continue;
      }
      const date = theirs.dates?.deprecated;
      if (!date) continue;
      if (date > now) {
        future.push(`${ours.id}: deprecation announced for ${date}`);
        continue;
      }
      if (ours.deprecated === date) continue;
      ours.deprecated = date;
      const note = `Deprecated ${date}, per ${CITE}, read ${now}.`;
      ours.notes = ours.notes ? `${ours.notes} ${note}` : note;
      written.push(`${ours.id} deprecated ${date}`);
    }
  }

  const lines = [];
  if (written.length > 0) lines.push(`Modelfax: deprecation dates written for ${written.join('; ')}.`);
  else lines.push('Modelfax: no new deprecation dates for the models we list.');
  if (future.length > 0) lines.push(`Modelfax: announced, not yet effective, so not written: ${future.join('; ')}.`);
  if (unknown.length > 0) {
    lines.push(`Modelfax knows ${unknown.length} models we do not list. Each needs a benchmark row and a rung on its family ladder before it can be added:`);
    for (const one of unknown) lines.push(`  - ${one}`);
  }
  report(lines);

  if (written.length > 0 && write) save('models', models);
  return written.length > 0 ? lines[0].replace('Modelfax: ', '') : false;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const changed = await refreshModels({ write: process.argv.includes('--write') });
  if (!process.argv.includes('--write') && changed) console.log('(dry run; pass --write to change models.json)');
}
