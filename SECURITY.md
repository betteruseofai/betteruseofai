# Security

## What to report

Anything that makes one of these claims untrue is a security issue here:

- The extension, both command line tools and the Claude Code plugin make no network request of
  their own, ever. `apps/extension/test/no-network.test.ts` reads the built files and fails on any
  way of reaching the network that is not on a short list with a reason beside it.
- Prompt text is never stored. It lives for the length of one function call and is dropped.
- The extension asks for `storage`, `unlimitedStorage`, `alarms` and four site hosts, and nothing
  else. Localhost is optional and asked for only when you switch it on.
- The page-world interceptor watches only the addresses an adapter names, only after it has been
  handed a per-page nonce, and forwards nothing a page could forge.
- The website loads nothing from anywhere but itself and the one analytics beacon the privacy page
  names, and its content security policy starts from `default-src 'none'`.

A wrong number is not a security issue, and we would still like to hear about it. Open an issue.

## How to report

Write to the address on the GitHub profile of the maintainer, `gordianknot-legacy`, with the
subject line starting `security:`. If you would rather, open a draft security advisory on the
repository, which GitHub keeps private until it is published.

Say what you found, how to see it, and which build. A minimal page or fixture that shows it is
worth more than a description of it.

## What happens next

We reply within a week. A confirmed report gets a fix, a test that would have caught it, an entry
in the changelog, and credit by whatever name you like, or none. We do not run a bounty; there is
no money in this project to run one with.

## Out of scope

Cloudflare's own edge, which serves the site. Bugs in the browsers, in Node or in Python. Anything
that needs a person to install a modified build.
