<div align="center">

# Quonex

A full-stack Discord ticket-management bot with a companion web dashboard.

Built by **Sinlt (辛特)** and the **Quonex Team**.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

</div>

---

## What is Quonex?

Quonex is a Discord bot for running a support-ticket system — panels,
multi-category routing, multi-staff-role permissions, and customizable
intake forms — paired with a Next.js web dashboard so server staff can
manage panels, settings, premium, and open tickets without touching
Discord commands.

**Highlights:**

- 🎫 **Ticket panels** — multiple categories per panel with automatic
  load-balancing across Discord's 50-channel category cap.
- 👥 **Multi-staff-role support** — assign several staff roles per panel;
  permissions sync automatically across every open ticket.
- 📝 **Custom intake forms** — up to 10 questions per panel, with
  multi-page modal support for forms longer than Discord's 5-field limit.
- 🖥️ **Web dashboard** — manage panels, prefixes, no-prefix access,
  premium, and tickets from a browser, backed by the same database as
  the bot.
- 💎 **Free / Premium tiers** — configurable limits for panels,
  categories, staff roles, active tickets, and form questions.
- 🛡️ **Crash-resistant** — every command path is wrapped so a single
  failing command can't take the whole bot down.

## Project Structure

This is an npm-workspaces monorepo containing both the bot and the
dashboard:

```
/              Discord bot (Node.js + discord.js v14)
  src/         bot source
  prisma/      shared database schema (Prisma + PostgreSQL)
dashboard/     Next.js 15 dashboard (npm workspace)
```

The bot and dashboard share one Prisma database and talk to each other
over a local Unix domain socket for actions that need live Discord state
(posting panel messages, closing tickets, etc).

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your Discord token, client ID, database URL
npx prisma db push      # create the database tables
npm run deploy          # register slash commands
npm start                # start the bot
```

For local dashboard development, Prisma setup details, the bot↔dashboard
communication design, environment variables, and the full command
reference, see **[DEVELOPMENT.md](./DEVELOPMENT.md)**.

## License

Quonex is licensed under the **Apache License 2.0** — see [LICENSE](./LICENSE)
and [NOTICE](./NOTICE).

You're welcome to fork this project, self-host it, and build your own
features on top of it. If you do, you must keep the `LICENSE` and
`NOTICE` files intact and credit the original project, for example:

> "Built upon [Quonex](https://github.com/sinlt0/quonex) by Sinlt"

You may **not** strip the license, remove attribution, or present this
codebase as something you built entirely from scratch. See
[NOTICE](./NOTICE) for the full attribution requirement, and
[CREDITS.md](./CREDITS.md) for a full list of credits.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for
how the project is structured and how to submit changes.
