/**
 * Help text, written by hand so it follows the project copy rules. British
 * English, short sentences, no generic phrasing, and no exclamation marks.
 */

export const VERSION = '0.0.0';

export const USAGE = `betteruseofai

  See the energy, water and carbon behind your own agent sessions. Everything is
  worked out on this machine. Nothing is sent anywhere.

USAGE
  betteruseofai <command> [options]

COMMANDS
  summary          What your sessions cost, grouped by day, week, model or session
  sessions         Every session, with its total
  session <id>     The report for one session, including its heaviest turns
  export           Every turn as a row, for a spreadsheet
  dashboard        Every session on this machine as one page, written to a file and opened
  prune            Drop turns before a date from the event log and compact it
  models           Which models we know, what measures them, and how good that measure is
  recommend <text> Ask what a prompt needs, without sending it anywhere
  statusline       Read a status line payload on stdin and print one line
  hook <event>     Read a hook payload on stdin and print hook JSON
  doctor           Check the things that go wrong, and say what to do about each

OPTIONS
  --since <when>          7d, 24h, 2w, or an ISO timestamp
  --until <when>          An ISO timestamp
  --by <bucket>           day, week, model, surface, session, hosting or all
  --source <names>        claude-code, codex, or both separated by a comma
  --dir <path>            Read transcripts from here instead of the usual place
  --region <code>         Grid to price the carbon against. Run "models --all" for the list
  --water-scope <scope>   on-site, "on-site + off-site" (the default), or lifecycle
  --carbon-basis <basis>  location-based (the default) or provider-reported
  --format <format>       table, json or csv, depending on the command
  --log <path>            Read and write the event log here instead of the usual place
  --no-log                Leave the event log alone for this run
  --out <path>            Where the dashboard writes its file; - for standard output
  --with-projects         Put directory and branch names on the dashboard
  --no-open               Write the dashboard without opening it
  --before <when>         On prune, drop turns older than this: 365d, or an ISO date
  --dry-run               On prune, say what would go and write nothing
  --json                  Same as --format json
  --now <iso>             Pretend it is this moment, so a fixture run is repeatable
  --ascii                 Avoid characters a plain terminal cannot draw
  --no-color              No escape codes
  --all                   Show the regions as well, on the models command
  --model <id>            The model a recommendation is measured against
  --depth <n>             How many turns into the conversation a prompt sits
  --local                 Say that you run models locally, so that can be suggested
  --cheap                 On the status line, read the cached total and parse nothing
  --brief                 On the session report, six lines and no tables
  -h, --help              This text
  -v, --version           The version and the dataset it ships with

THE EVENT LOG
  Claude Code deletes its transcripts after a while, thirty days by default, and
  a total that only reads transcripts forgets everything older. So every run of
  this tool, and the plugin's Stop hook, appends the turns it reads to a log of
  its own under ~/.claude/betteruseofai/log, one JSON line per turn, tokens and
  model only. Nothing is priced until it is read back, so a dataset update
  re-prices all of it. Nothing leaves the machine. "prune" trims it.

A NOTE ON THE FIGURES
  Every figure is a range, because the published measurements of AI energy use
  disagree by an order of magnitude. Where we do not know something we say so: an
  unrecognised model reads "unknown", and a model that hid its reasoning tokens
  gives a lower bound rather than a total. Run "session <id>" to see which
  sources a figure rests on.
`;

export const COMMAND_HELP: Record<string, string> = {
  dashboard: `betteruseofai dashboard

  Every session on this machine as one page: totals, every week and day, the
  saving against the largest model in each family, which models, which tool,
  the heaviest sessions, and what could not be priced. One file, with its
  fonts and its data inside it, so it opens with nothing to fetch.

  betteruseofai dashboard
  betteruseofai dashboard --since 90d --region GB
  betteruseofai dashboard --with-projects --out ~/Desktop/sessions.html
  betteruseofai dashboard --json

  Directory and branch names are left out unless --with-projects is given.
`,
  prune: `betteruseofai prune --before <when>

  Drops every turn older than a moment from the event log and compacts what
  remains, so each turn appears once. The log is never pruned on its own.

  betteruseofai prune --before 365d
  betteruseofai prune --before 2026-01-01 --dry-run
`,
  summary: `betteruseofai summary

  What your sessions cost. Defaults to grouping by day.

  betteruseofai summary --since 7d
  betteruseofai summary --since 30d --by model
  betteruseofai summary --by session --region GB --json
`,
  session: `betteruseofai session <id>

  The report for one session: what it cost, which model did most of it, its
  heaviest turns, and why the figures are uncertain. A partial id is enough.
  With --brief it is six lines: the three figures, the model that did most of
  the work, and how many caveats the full report carries.

  betteruseofai sessions
  betteruseofai session ba71e9d8
  betteruseofai session ba71e9d8 --brief
`,
  export: `betteruseofai export

  Every turn as a row. An unknown figure is an empty cell, never a zero, because
  a spreadsheet will happily sum a column of zeroes into a total that is a lie.

  betteruseofai export --since 30d > turns.csv
  betteruseofai export --format json
`,
  recommend: `betteruseofai recommend <text>

  Ask what a prompt needs. The prompt is read, measured, and dropped: it is
  never stored and never sent anywhere.

  betteruseofai recommend "17 * 23"
  betteruseofai recommend "rewrite this so it is shorter"
  betteruseofai recommend --model claude-opus-5 "explain why this deadlock happens"
`,
  doctor: `betteruseofai doctor

  Checks where your transcripts are, whether we recognise the models in them,
  and whether any lines could not be read.

  betteruseofai doctor
  betteruseofai doctor --json
`,
};
