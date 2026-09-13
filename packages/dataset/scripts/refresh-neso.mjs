#!/usr/bin/env node
/**
 * Great Britain as consumed, from the National Energy System Operator.
 *
 * The Carbon Intensity API publishes half-hourly carbon intensity for the
 * electricity consumed in Great Britain, including imports, under CC BY 4.0.
 * Its statistics endpoint answers for at most 31 days at a time, so this makes
 * twelve calls for the last twelve full months and takes the mean of the
 * monthly averages as the central figure, the lowest and highest month as
 * the range.
 *
 * Ember's figure for the United Kingdom is power sector CO2 per kWh generated;
 * NESO's is per kWh consumed, with its own factors. In 2025 the two were 217
 * and 129. Both are official. The dataset carries both as separate rows, and
 * the method page says they count different things rather than picking one.
 *
 * Run with --write to change regions.json. Without it, it prints what it would do.
 */

import { fetchText, load, report, save, today } from './refresh-common.mjs';

const API = 'https://api.carbonintensity.org.uk';
const CODE = 'GB-NESO';

/** The last twelve full months before this one, oldest first. */
const months = (now = new Date()) => {
  const out = [];
  for (let back = 12; back >= 1; back -= 1) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    out.push({ from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) });
  }
  return out;
};

export const readNeso = async () => {
  const averages = [];
  for (const { from, to } of months()) {
    const text = await fetchText(`${API}/intensity/stats/${from}T00:00Z/${to}T23:59Z`);
    if (!text) return null;
    const stats = JSON.parse(text).data?.[0]?.intensity;
    if (typeof stats?.average !== 'number') return null;
    averages.push({ from, average: stats.average });
  }
  const values = averages.map((one) => one.average);
  const central = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    central: Math.round(central * 10) / 10,
    low: Math.min(...values),
    high: Math.max(...values),
    from: averages[0].from,
    to: averages[averages.length - 1].from.slice(0, 7),
    monthly: values,
  };
};

export const refreshNeso = async ({ write }) => {
  const got = await readNeso();
  if (!got) {
    report(['NESO: the Carbon Intensity API could not be read, so Great Britain as consumed was left as it was.']);
    return false;
  }

  const regions = load('regions');
  const ember = regions.regions.find((one) => one.code === 'GB');
  if (!ember) throw new Error('no GB row to pair with');

  const year = Number(got.to.slice(0, 4));
  const row = {
    code: CODE,
    name: 'Great Britain (NESO, as consumed)',
    kind: 'country',
    continent: 'Europe',
    gridGco2PerKwh: { low: got.low, central: got.central, high: got.high },
    // The same water factor as the Ember row: the WRI figure is for Great Britain.
    waterOffsiteLPerKwh: ember.waterOffsiteLPerKwh,
    year,
    source: {
      title: 'Carbon Intensity API, monthly statistics',
      url: `${API}/`,
      publisher: 'National Energy System Operator',
      date: String(year),
      retrieved: today(),
      licence: 'CC BY 4.0',
    },
    waterSource: ember.waterSource,
    provenance: { method: 'fetched', recorded: today() },
    notes:
      `Carbon intensity of the electricity consumed in Great Britain, including imports, on NESO's own ` +
      `factors. Central is the mean of the twelve monthly averages from ${got.from.slice(0, 7)} to ${got.to}; ` +
      `the range is the lowest and highest month (${got.monthly.join(', ')}). Ember's United Kingdom row ` +
      `counts power sector CO2 per kWh generated and comes out higher; the two are official figures ` +
      `for different things, and the dataset keeps both. Read from the API on ${today()}. ` +
      `Off-site water is the WRI factor for Great Britain, as on the Ember row.`,
  };

  const existing = regions.regions.find((one) => one.code === CODE);
  const same =
    existing &&
    JSON.stringify(existing.gridGco2PerKwh) === JSON.stringify(row.gridGco2PerKwh) &&
    existing.year === row.year;

  if (same) {
    report([`NESO: Great Britain as consumed is unchanged at ${row.gridGco2PerKwh.central} gCO2/kWh.`]);
    return false;
  }

  if (ember.name === 'United Kingdom') ember.name = 'United Kingdom (Ember, as generated)';
  if (existing) Object.assign(existing, row);
  else regions.regions.splice(regions.regions.indexOf(ember) + 1, 0, row);

  const line =
    `Great Britain as consumed (NESO) ${existing ? 'moved to' : 'added at'} ${row.gridGco2PerKwh.central} gCO2/kWh ` +
    `(months ${row.gridGco2PerKwh.low} to ${row.gridGco2PerKwh.high}), twelve months to ${got.to}.`;
  report([`NESO: ${line}`]);
  if (write) save('regions', regions);
  return line;
};

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const changed = await refreshNeso({ write: process.argv.includes('--write') });
  if (!process.argv.includes('--write') && changed) console.log('(dry run; pass --write to change regions.json)');
}
