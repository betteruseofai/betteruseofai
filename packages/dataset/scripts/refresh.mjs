#!/usr/bin/env node
/**
 * The weekly dataset refresh: every source that can be re-read without a
 * person, in one run, with one version bump if anything moved.
 *
 * Today that is Great Britain as consumed from NESO and deprecation dates
 * from Modelfax. Ember, eGRID and WRI publish yearly or once, and are read by
 * hand when they release. Run with --write to change the data files; the
 * workflow does, and then rebuilds everything that inlines the dataset.
 */

import { bumpMinor, report } from './refresh-common.mjs';
import { refreshModels } from './refresh-models.mjs';
import { refreshNeso } from './refresh-neso.mjs';

const write = process.argv.includes('--write');
const changes = [];

for (const step of [refreshNeso, refreshModels]) {
  const changed = await step({ write });
  if (changed) changes.push(changed);
}

if (changes.length === 0) {
  report(['Nothing in the dataset moved this week.']);
} else if (write) {
  const version = bumpMinor(changes);
  report([`Dataset bumped to ${version}.`]);
} else {
  report(['(dry run; pass --write to apply and bump the version)']);
}
