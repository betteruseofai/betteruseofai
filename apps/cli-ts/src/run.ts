import { parseArgs } from './args.js';
import { dashboard, prune } from './commands/dashboard.js';
import { doctor, exportEvents, models } from './commands/misc.js';
import { recommend } from './commands/recommend.js';
import { session, sessions } from './commands/sessions.js';
import { hook, statusline } from './commands/statusline.js';
import { summary } from './commands/summary.js';
import { buildContext } from './context.js';
import { COMMAND_HELP, USAGE, VERSION } from './help.js';

/**
 * The command router, kept separate from the entry point so the tests can call
 * it directly and read what came back rather than capturing a process.
 */

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

const ok = (stdout: string): RunResult => ({ stdout, stderr: '', code: 0 });
const fail = (stderr: string, code = 1): RunResult => ({ stdout: '', stderr, code });

export const run = async (argv: string[]): Promise<RunResult> => {
  const args = parseArgs(argv);

  if (args.errors.length > 0) {
    return fail(`${args.errors.join('\n')}\n\nRun "betteruseofai --help" for the options.`, 2);
  }

  if (args.flags['version'] === true) {
    const { loadDataset } = await import('./context.js');
    const dataset = loadDataset();
    return ok(`betteruseofai ${VERSION}, dataset ${dataset.version} (${dataset.sha256.slice(0, 12)})`);
  }

  if (args.command === '' || args.command === 'help' || (args.flags['help'] === true && args.command === '')) {
    return ok(USAGE.trimEnd());
  }

  if (args.flags['help'] === true) {
    return ok((COMMAND_HELP[args.command] ?? USAGE).trimEnd());
  }

  /*
   * The cheap status line answers from a cached line of text and never loads
   * the dataset, because on this machine the dataset read and parse is most of
   * what our own code costs. Bare Node start-up is the rest, and nothing here
   * can do anything about that.
   */
  if (args.command === 'statusline' && args.flags['cheap'] === true) {
    const { readCheapLine, parseStdinJson, readStdin } = await import('./commands/statusline.js');
    const input = parseStdinJson<{ session_id?: string }>(await readStdin());
    if (!input?.session_id) return ok('');
    return ok(readCheapLine(input.session_id) ?? '');
  }

  const { context, errors } = buildContext(args);
  if (errors.length > 0) return fail(errors.join('\n'), 2);

  try {
    switch (args.command) {
      case 'summary':
        return ok(await summary(context, args));
      case 'sessions':
        return ok(await sessions(context, args));
      case 'session':
        return ok(await session(context, args));
      case 'export':
        return ok(await exportEvents(context, args));
      case 'dashboard':
        return ok(await dashboard(context, args));
      case 'prune':
        return ok(await prune(context, args));
      case 'models':
        return ok(models(context, args));
      case 'doctor':
        return ok(await doctor(context, args));
      case 'recommend':
        return ok(recommend(context, args));
      case 'statusline':
        // A status line that fails must print nothing rather than an error, or
        // the error becomes the status line.
        try {
          return ok(await statusline(context, args));
        } catch {
          return ok('');
        }
      case 'hook':
        // Same reasoning: a hook always exits zero with valid JSON.
        try {
          return ok(await hook(context, args));
        } catch {
          return ok('{}');
        }
      case 'watch':
        return fail(
          'The watch command lands with the extension. For now, run "summary" again after a session.',
          3,
        );
      default:
        return fail(
          `No such command: ${args.command}\n\nRun "betteruseofai --help" for the list.`,
          2,
        );
    }
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause), 1);
  }
};
