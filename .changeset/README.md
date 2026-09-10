# Changesets

Run `pnpm changeset` when you change a published package. The group in `config.json` keeps `core`,
`dataset`, `tokenizers`, `readers` and the npm CLI on one version number, so a user can tell at a
glance which dataset a given CLI shipped with. The Python CLI version is copied from the npm one by
`scripts/sync-py-version.mjs`.
