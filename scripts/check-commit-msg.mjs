#!/usr/bin/env node
/**
 * Rejects commit messages that attribute the work to an AI model or vendor.
 *
 * The rule, in full, lives in CONTRIBUTING.md. The short version: whatever tools
 * you used, the commit is attributed to you. This hook is the mechanical backstop
 * so a default trailer from some tool cannot slip one in.
 *
 * Usage: node scripts/check-commit-msg.mjs <path-to-COMMIT_EDITMSG>
 * Exit 0 to accept, exit 1 with an explanation to reject.
 */

import { readFileSync } from 'node:fs';

/** Vendors and model families that must never appear as an author. */
const VENDOR = String.raw`claude|opus|sonnet|haiku|fable|gpt|chatgpt|codex|gemini|bard|copilot|cursor|anthropic|openai|deepseek|mistral|llama|grok|\bai\b`;

/**
 * Each rule is { id, test, explain }. `test` takes the message with comment
 * lines already stripped and returns the offending text, or null.
 */
export const RULES = [
  {
    id: 'coauthor-ai',
    explain: 'a Co-Authored-By trailer naming an AI model or vendor',
    pattern: new RegExp(String.raw`^\s*co-authored-by\s*:.*(?:${VENDOR}).*$`, 'gim'),
  },
  {
    id: 'generated-with',
    explain: 'a "Generated with" or similar generated-by footer',
    pattern: /^\s*(?:🤖\s*)?(?:generated|created|written|authored|made)\s+(?:with|by|using)\b.*$/gim,
  },
  {
    id: 'assisted-by',
    explain: 'an assisted-by or AI-assisted attribution line',
    pattern: /^\s*(?:ai[- ]assisted|assisted[- ]by|generated[- ]by)\s*[:\-].*$/gim,
  },
  {
    id: 'robot-emoji',
    explain: 'a robot emoji, which we read as an AI attribution marker',
    pattern: /\u{1F916}/gu,
  },
];

/** Strip git comment lines and everything after a scissors line. */
export function stripComments(raw) {
  const scissors = raw.indexOf('\n# ------------------------ >8 ------------------------');
  const body = scissors === -1 ? raw : raw.slice(0, scissors);
  return body
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n');
}

/** Returns an array of { id, explain, match } for every rule that fired. */
export function checkCommitMessage(raw) {
  const message = stripComments(raw);
  const found = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    const matches = message.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        found.push({ id: rule.id, explain: rule.explain, match: match.trim() });
      }
    }
  }
  return found;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('check-commit-msg: no commit message file given');
    process.exit(1);
  }
  const problems = checkCommitMessage(readFileSync(path, 'utf8'));
  if (problems.length === 0) process.exit(0);

  console.error('\nCommit rejected. This repository never attributes work to an AI model.\n');
  for (const problem of problems) {
    console.error(`  ${problem.id}: ${problem.explain}`);
    console.error(`    found: ${problem.match}\n`);
  }
  console.error('Remove the line and commit again. See CONTRIBUTING.md.\n');
  process.exit(1);
}

// Run as a hook when git hands us a message path; stay silent when imported by tests.
if (process.argv[1]?.endsWith('check-commit-msg.mjs') && process.argv[2]) {
  main();
}
