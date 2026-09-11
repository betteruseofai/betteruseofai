import type { APIRoute } from 'astro';
import dataset from '../../lib/dataset';

/**
 * The dataset, as the tools hold it in memory.
 *
 * Note what this is not. The published SHA-256 is taken over the raw source
 * files in packages/dataset/data, not over this response, because JavaScript
 * and Python write the same small number differently and a hash over a
 * re-serialisation would disagree across languages. So the hash below tells
 * you which dataset version produced this file. It is not a checksum of the
 * file itself, and computing one over these bytes will not match it.
 *
 * To verify, take the version from the header and the files from the repository
 * at that tag.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(dataset, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-dataset-version': dataset.version,
      'x-dataset-sha256': dataset.sha256,
    },
  });
