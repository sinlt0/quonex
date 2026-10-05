# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Quonex (bot or dashboard),
please **do not** open a public GitHub issue. Instead, report it
privately so it can be fixed before it's disclosed publicly.

- Open a [GitHub Security Advisory](../../security/advisories/new) on
  this repository, **or**
- Contact Sinlt directly through the support server / contact method
  listed in the repository's about section.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce it (minimal reproduction if possible).
- Any relevant logs, with secrets/tokens redacted.

## Supported Versions

Only the latest version on the `main` branch is actively supported with
security fixes.

## Secrets

Never commit real secrets (`DISCORD_TOKEN`, OAuth client secrets,
`AUTH_SECRET`, database connection strings, `INTERNAL_API_SECRET`, etc.)
to this repository. Use `.env` / `dashboard/.env` (both gitignored) and
the provided `.env.example` files as templates. If you accidentally
commit a secret, rotate it immediately — removing it from a later commit
does not remove it from git history.
