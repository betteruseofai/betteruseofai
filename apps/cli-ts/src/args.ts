/**
 * Argument parsing, written by hand rather than pulled from a library.
 *
 * Two reasons. The help text has to follow the project copy rules, and a
 * library that generates its own wording ("display help for command") does not.
 * And this file is the specification the Python tool mirrors, so keeping it
 * small and explicit is worth more than the convenience.
 */

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
  errors: string[];
}

/** Flags that take a value. Everything else is a switch. */
export const VALUE_FLAGS = new Set([
  'since',
  'until',
  'by',
  'region',
  'format',
  'source',
  'dir',
  'now',
  'water-scope',
  'carbon-basis',
  'limit',
  'interval',
  'model',
  'depth',
]);

export const SWITCH_FLAGS = new Set([
  'json',
  'no-color',
  'help',
  'version',
  'ascii',
  'cheap',
  'all',
  'verbose',
  'local',
]);

export const parseArgs = (argv: string[]): ParsedArgs => {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  const errors: string[] = [];

  let index = 0;
  while (index < argv.length) {
    const token = argv[index] as string;
    index += 1;

    if (token === '--') {
      positional.push(...argv.slice(index));
      break;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equals = body.indexOf('=');
      const name = equals === -1 ? body : body.slice(0, equals);
      const inline = equals === -1 ? null : body.slice(equals + 1);

      if (VALUE_FLAGS.has(name)) {
        if (inline !== null) {
          flags[name] = inline;
        } else if (index < argv.length && !(argv[index] as string).startsWith('--')) {
          flags[name] = argv[index] as string;
          index += 1;
        } else {
          errors.push(`--${name} needs a value.`);
        }
      } else if (SWITCH_FLAGS.has(name)) {
        if (inline !== null) errors.push(`--${name} does not take a value.`);
        flags[name] = true;
      } else {
        errors.push(`No such option: --${name}`);
      }
      continue;
    }

    if (token === '-h') {
      flags['help'] = true;
      continue;
    }
    if (token === '-v') {
      flags['version'] = true;
      continue;
    }

    positional.push(token);
  }

  const command = positional.shift() ?? '';
  return { command, positional, flags, errors };
};

/**
 * Turns a relative window such as 7d into an ISO timestamp.
 *
 * `now` is injected rather than read from the clock, so a fixture run produces
 * the same output on any day.
 */
export const resolveSince = (value: string | undefined, now: Date): string | undefined => {
  if (!value) return undefined;
  const relative = /^(\d+)([dhwm])$/.exec(value.trim());
  if (!relative) return value;
  const amount = Number.parseInt(relative[1] as string, 10);
  const unit = relative[2] as string;
  const hours = unit === 'h' ? amount : unit === 'd' ? amount * 24 : unit === 'w' ? amount * 168 : amount * 720;
  return new Date(now.getTime() - hours * 3600_000).toISOString();
};

export const flagString = (flags: ParsedArgs['flags'], name: string): string | undefined => {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
};

export const flagBool = (flags: ParsedArgs['flags'], name: string): boolean => flags[name] === true;
