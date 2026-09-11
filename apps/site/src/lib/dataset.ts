/**
 * The dataset, typed once.
 *
 * The dataset package generates its own declarations and types the arrays as
 * `unknown[]`, because it is language-neutral JSON and knows nothing about the
 * TypeScript interfaces in core. Every consumer casts it; the extension and
 * the command line tool each do it in one place, and so does this. The cast is
 * safe because the dataset build validates the same JSON against the schema
 * those interfaces were written from.
 */

import bundle from '@betteruseofai/dataset';
import type { Dataset } from '@betteruseofai/core';

export const dataset = bundle as unknown as Dataset;

export default dataset;
