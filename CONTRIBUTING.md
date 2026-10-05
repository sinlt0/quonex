# Contributing to Quonex

Thanks for your interest in contributing to Quonex! This document covers
how the project is structured and how to propose changes.

## Before You Start

Quonex is licensed under the **Apache License 2.0** (see `LICENSE` and
`NOTICE`). By submitting a contribution, you agree that it will be
licensed under the same terms, and that the project's attribution
requirements (crediting Sinlt as original author) continue to apply.

## Project Structure

This is an npm-workspaces monorepo:

```
/                     bot (Node.js + discord.js)
  src/                bot source code
  prisma/             shared Prisma schema (used by both bot and dashboard)
  dashboard/           Next.js dashboard (npm workspace)
```

The bot and dashboard communicate over a Unix domain socket (see
`DEVELOPMENT.md` for the full technical breakdown of the architecture).

## Getting Set Up

1. Clone the repository.
2. Copy `.env.example` to `.env` (and `dashboard/.env.example` to
   `dashboard/.env` if present) and fill in your own values — **never**
   commit real tokens, secrets, or database URLs.
3. Install dependencies:
   ```
   npm install
   ```
4. Push the Prisma schema to your database:
   ```
   npx prisma db push
   ```
5. Run the bot and dashboard (see `DEVELOPMENT.md` for details on local
   development and scripts).

## Making Changes

- Keep pull requests focused — one feature or fix per PR where possible.
- Match the existing code style (see existing files in `src/` and
  `dashboard/src/` for conventions).
- Do not import bot files that depend on `discord.js` directly into the
  dashboard — see `DEVELOPMENT.md` for the dashboard/bot reuse boundary
  rules before adding new shared code.
- Test your changes locally before opening a PR.

## Submitting a Pull Request

1. Fork the repository and create a feature branch.
2. Make your changes with clear, descriptive commit messages.
3. Open a pull request describing what you changed and why.
4. Be responsive to review feedback.

## Reporting Issues

When filing an issue, please include:

- What you expected to happen vs. what actually happened.
- Steps to reproduce.
- Relevant logs or error messages (with secrets redacted).

## Code of Conduct

Be respectful and constructive. Harassment, discrimination, or abusive
behavior toward other contributors will not be tolerated.

## License & Attribution Reminder

Any fork or redistribution of this project must retain the `LICENSE` and
`NOTICE` files and the required attribution to the original author,
Sinlt. See `NOTICE` for the exact requirements.
