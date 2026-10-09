# Quonex

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, `DATABASE_URL`, `DIRECT_URL` (Neon pooled + direct connection strings).
3. Database schema: if you're running via `node start.js` (see below), this happens automatically on every boot via `prisma db push` — skip to step 5. If you're running the bot directly with `npm start` instead, run `npx prisma db push` yourself first (creates every table in your actual database — `prisma generate` alone only builds client code, it never touches the database). Prefer real migration history instead? Run `npm run prisma:migrate:new -- init` locally instead (needs a real terminal — this command refuses to run in any non-interactive/CI-like environment).
4. If not using `start.js` and you're using versioned migrations instead of `db push`: every time the schema changes after that, run `npm run prisma:migrate:new -- <description>` (e.g. `npm run prisma:migrate:new -- add_ticket_priority`) — the `--` is required so npm passes `<description>` through to Prisma instead of trying to parse it itself.
5. `npm run deploy` to register slash commands.
6. `npm start` to run the bot.
7. Edit `devs.json` and set your Discord user IDs in `owners` and `devs`.
8. Edit `src/config/branding.js` and confirm `SUPPORT_SERVER` points to your real invite link.

## Error handling

Every command entry point — slash commands, prefix commands, no-prefix commands, and the ticket buttons/modals — runs through `src/lib/commandRunner.js`, which wraps execution in try/catch. If a command throws (a database error, a permissions issue, anything), it's logged to the console and the user gets a generic "something went wrong" reply instead of the whole bot crashing. `src/bot/handlers/eventHandler.js` also catches any rejected promise from an event handler generically, `src/bot/client.js` listens for the Client's own `error`/`shardError` events (an unlistened `'error'` event is fatal by default in Node), and `src/index.js` has last-resort `unhandledRejection`/`uncaughtException` listeners that log instead of exiting. None of this replaces fixing the actual bug behind an error — it just means one bad command can no longer take the whole bot offline for everyone.

## Structure

- `src/bot/client.js` — Discord client and intents.
- `src/bot/commands/slash/**` — slash commands, one file per command, auto-loaded recursively.
- `src/bot/commands/text/**` — shared text commands, one file per command, used by both the prefix and no-prefix handlers.
- `src/bot/events/**` — one file per Discord.js event, auto-loaded.
- `src/bot/handlers/**` — loaders that wire commands/events into the client.
- `src/lib/walkDir.js` — shared recursive file walker used by both the slash and text command loaders.
- `src/lib/db.js` — Prisma client singleton.
- `src/lib/components.js` — Components V2 helpers. `textContainer`/`v2Message` build a `ContainerBuilder` from an array of lines; drop the exported `SEPARATOR` symbol into that array anywhere you want a visual divider (`SeparatorBuilder`) instead of a text line. Every message gets a small "-# Made by Quonex Team | 辛特 (Sinlt)" footer automatically (separator + subtext line, using `CREDIT` from `src/config/branding.js`) unless the caller passes `{ footer: false }`.
- `src/lib/emojis.js` — loads every file in `src/emojis/` into one `em` object.
- `src/emojis/**` — emoji definitions, grouped by feature area, any filename works.
- `src/lib/permissions.js` — dev/owner checks and no-prefix/premium eligibility checks.
- `src/lib/prefix.js` — per-server prefix storage.
- `src/lib/support.js` — `supportLine()` helper appended to deny/error replies and info commands.
- `src/lib/tickets.js` — core ticket system logic (panels, tickets, limits, transcripts, button/modal handlers), shared by every ticket entry point.
- `src/lib/ticketFormSessions.js` — in-memory answer accumulator for multi-page intake forms (see Tickets section).
- `src/config/tickets.js` — ticket channel naming, modal page size, and shared error copy.
- `src/lib/help.js` — shared logic behind `/help` and the `help` text command: category grouping, pagination, hidden-command/category filtering.
- `src/config/help.js` — help menu config: page size, hidden categories, category descriptions.
- `src/lib/uptime.js` — uptime formatting used by `/ping`.
- `src/config/durations.js` — premium duration options used by the add/genkey commands.
- `src/config/limits.js` — free vs premium feature limits, referenced once ticket/panel limits are built.
- `src/config/branding.js` — bot name, team credit line, support server invite, default prefix.
- `devs.json` — `owners` and `devs` arrays; either grants full dev-level access.

## Emoji system

Add emojis to any file in `src/emojis/`:

```js
module.exports = {
  checkmark: { id: '123456789012345678', name: 'checkmark', animated: false }
};
```

Use anywhere:

```js
const { em } = require('../lib/emojis');
message.reply(`${em.checkmark} Done`);
```

## Prefix

- Default prefix is set in `src/config/branding.js` (`DEFAULT_PREFIX`).
- `/prefix view` — anyone can check the current prefix.
- `/prefix set <prefix>` / `/prefix reset` — requires Manage Server permission.

## No-prefix commands

Global (dev/owner managed): `npglobal add @user`, `npglobal remove @user`.

Per-server (premium only): `np enable`, `np disable`, `np enableuser @user`, `np disableuser @user`.

`npglobal` and `np` are text commands only (no slash command version) — usable with the server prefix, and bare (no prefix) by any account that already has no-prefix access, same as other text commands.

## Premium

Premium commands are text commands only (no slash command version):

- `premiumadd <serverid>` (dev only) — opens a duration select menu, applies it on selection.
- `premiumkey <3d|7d|1w|1mo|1y|2y|lifetime>` (dev only) — generates a redeemable key.
- `premiumclaim <key>` (Manage Server) — redeems a key for the current server, stacking onto existing time.

## Tickets

Panel management (Manage Server permission):

- `/panel create` / `panel create #category @StaffRole <name>` — creates a panel with one primary staff role and posts an "Open Ticket" button. The slash version also accepts an optional post channel and transcript channel; the prefix version defaults to the current channel and sets the transcript channel separately.
- `/panel delete` / `panel delete <panelid>` — deletes a panel (open tickets under it are cleared from the database, channels are left alone).
- `/panel list` / `panel list` — lists panel IDs and names.
- `/panel transcript` / `panel transcript <panelid> #channel` — sets or changes where that panel's closed-ticket transcripts are sent.
- `/panel addstaffrole` / `panel addstaffrole <panelid> @Role` and `/panel removestaffrole` / `panel removestaffrole <panelid> @Role` — a panel can have multiple staff roles (`Panel.staffRoleIds`, capped by `LIMITS.staffRoles` in `src/config/limits.js`, free/premium). Removing a panel's last staff role is blocked — a panel always needs at least one. Adding or removing a role also updates permission overwrites on every currently-open ticket channel for that panel, so existing tickets stay in sync, not just new ones.
- `/panel addcategory` / `panel addcategory <panelid> #category` and `/panel removecategory` / `panel removecategory <panelid> #category` — a panel can also span multiple ticket categories (`Panel.categoryIds`, capped by `LIMITS.panelCategories`, 5 free / 10 premium). This exists because Discord hard-caps a category at 50 channels; a single busy panel can outgrow one category. When a ticket opens, `pickCategoryForTicket` in `src/lib/tickets.js` picks whichever of the panel's categories currently has the fewest channels (and skips any at the 50 limit), so load balances automatically rather than needing you to pick manually. If every assigned category is full, opening a ticket fails with a clear error telling you to add another category. Removing a panel's last category is blocked, same as staff roles.
- `/panel addquestion` / `panel addquestion <panelid> <question>`, `/panel removequestion` / `panel removequestion <panelid> <number>`, `/panel questions` / `panel questions <panelid>` — intake questions shown before a ticket opens, capped by `LIMITS.formQuestions` (free 5, premium 10). If a panel has questions, clicking "Open Ticket" shows a modal instead of creating the channel immediately. Discord modals cap out at 5 fields, so panels with more than 5 questions chain multiple modals: after submitting one page, the user gets an ephemeral "Continue" button (Discord only allows `showModal()` in direct response to a button/select interaction, not to a modal submission itself — you can't chain modal-to-modal, so the button is the bridge), and clicking it opens the next page. Answers accumulate in an in-memory session (`src/lib/ticketFormSessions.js`, keyed by user+panel, auto-expiring after 10 minutes if abandoned) until the last page is submitted, at which point the ticket is created with every answer included in the welcome message. Panels with no questions skip all of this and open instantly.

Ticket management (any of the panel's staff roles, Manage Server, or devs — usable inside a ticket channel):

- `/ticket close` / `close` — closeable by staff or the ticket opener. Generates a transcript, posts it to the panel's transcript channel if set, then deletes the channel after a short delay.
- `/ticket claim` / `claim`, `/ticket release` / `release`.
- `/ticket add @user` / `add @user`, `/ticket remove @user` / `remove @user`.
- `/ticket rename <name>` / `rename <name>`.

Opening a ticket happens via the panel's button (or the intake modal, if the panel has questions) — never a command. It enforces the per-plan panel/active-ticket limits from `src/config/limits.js` and prevents a user from opening a second ticket on the same panel while one is already open. All the shared logic (limits, permission checks, channel creation, transcripts, staff-role sync) lives in `src/lib/tickets.js`, called identically by the slash commands, the prefix commands, and the panel/claim/close buttons and modal submit — so behavior never drifts between entry points.

## Applications

A second, parallel panel system for server/staff/partner applications — unlike tickets, an application never creates a channel. Instead, submissions post as an embed-style message to a review channel with Accept/Deny buttons, and the applicant is DMed the result. This mirrors Appy's application-bot feature, adapted to Quonex's existing panel/modal/limits architecture rather than copying Appy's implementation.

Application panel management (Manage Server permission):

- `/application create` / `application create #reviewchannel <name>` — creates an application panel and posts an "Apply" button. Requires a review channel (where submissions are sent for staff to accept/deny); the slash version also accepts an optional post channel and an accept-role to auto-grant on acceptance.
- `/application delete` / `application delete <panelid>` — deletes a panel (pending/decided applications under it are cleared from the database).
- `/application list` / `application list` — lists panel IDs and names.
- `/application setreviewchannel` / `application setreviewchannel <panelid> #channel` — changes where that panel's submissions are reviewed.
- `/application setacceptrole` / `application setacceptrole <panelid> [@Role]` — sets (or clears, if omitted) a role automatically granted to the applicant when their application is accepted.
- `/application addreviewerrole` / `application addreviewerrole <panelid> @Role` and `/application removereviewerrole` / `application removereviewerrole <panelid> @Role` — roles (beyond Manage Server/devs) allowed to accept/deny for that panel (`ApplicationPanel.reviewerRoleIds`, capped by `LIMITS.reviewerRoles`). Unlike ticket staff roles, a panel can have zero reviewer roles — Manage Server and devs can always review.
- `/application addquestion` / `application addquestion <panelid> <question>`, `/application removequestion` / `application removequestion <panelid> <number>`, `/application questions` / `application questions <panelid>` — questions shown before an application is submitted, capped by `LIMITS.applicationQuestions`. Uses the exact same multi-page modal chaining as ticket intake forms (`src/lib/applicationFormSessions.js` mirrors `src/lib/ticketFormSessions.js`), since Discord's 5-field-per-modal and no-modal-chaining-from-modal-submit limits apply here too.

Review flow: clicking "Apply" (or finishing the intake modal) creates an `Application` row with `status: "pending"` and posts it to the panel's review channel with Accept/Deny buttons. A user can only have one pending application per panel at a time. Clicking Accept or Deny (gated by `isReviewer` — Manage Server, devs, or one of the panel's reviewer roles) updates the application's status, edits the review message to show the decision and remove the buttons, grants the accept-role if one is configured, and DMs the applicant the outcome (silently ignored if their DMs are closed). All of this lives in `src/lib/applications.js`, structured to match `src/lib/tickets.js` function-for-function (`createApplicationPanel`/`createPanel`, `handleOpenButton`, etc.) so the two systems stay easy to compare and maintain side by side.

Applications are bot-only for now — there is no dashboard page for reviewing/managing application panels yet (unlike tickets, which do have one).

## Info commands

- `/owners`, `/devs` — list bot owners/developers.
- `/help`, `help` — help menu with two separate dropdowns, one for slash-command categories and one for prefix-command categories, plus pagination, built on Components V2. `premiumadd`, `premiumkey`, and `npglobal` are marked `hidden: true` and only show up for dev/owner accounts; `premiumclaim` and `np` stay visible to everyone since regular server managers use them. Fully hidden categories can be configured in `src/config/help.js` (`HELP_HIDDEN_CATEGORIES`), and page size is set there too (`COMMANDS_PER_PAGE`).
- `/ping`, `ping` — latency and uptime.

## Dashboard

`dashboard/` is a Next.js (App Router, JavaScript) web dashboard that lives inside this same project as an npm workspace — one repo, one `npm install`, one Prisma schema, one database. It does not have its own copy of the schema or its own generated Prisma client: `dashboard/src/lib/db.js` just re-exports `prisma` from the bot's own `src/lib/db.js`, so both processes talk to the exact same generated client definition. `src/lib/db.js` was updated with a `globalThis`-cached singleton so Next.js's dev-mode hot reloading doesn't spawn extra database connections — harmless for the bot too, since it only ever instantiates once in production.

### Setup

1. From the project root: `npm install` (installs both the bot's dependencies and, via the `dashboard` workspace, the dashboard's).
2. `npx prisma generate` at the root (already part of bot setup) — this is the only place the Prisma client gets generated; the dashboard reuses it.
3. Create a Discord OAuth2 application (or reuse the bot's application) at the Discord Developer Portal, add a redirect URL of `http://localhost:3000/api/auth/callback/discord` for local dev, and note the client ID/secret. **You'll add another redirect URL here for production** — see "Redirect URL / host configuration" below.
4. Copy `dashboard/.env.example` to `dashboard/.env` and fill in:
   - `AUTH_SECRET` — any random string (`npx auth secret` generates one).
   - `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` — from the OAuth2 app above.
   - `DISCORD_BOT_TOKEN` — the bot's token, used server-side to cross-reference which guilds the bot is actually in.
   - `DATABASE_URL` / `DIRECT_URL` — **must be the exact same Neon connection strings as the root `.env`.** This is still one database; the values are duplicated only because the bot and dashboard run as separate processes (and likely separate hosts — bot on Pterodactyl, dashboard wherever you deploy it) and each process needs the connection string in its own environment.
5. `npm run commands:manifest` at the root — generates `dashboard/content/commands.json`, which the `/commands` page and homepage stats read.
6. `npm run dashboard:dev` from the root (or `cd dashboard && npm run dev`) to start the dashboard locally — port 3000 by default, or whatever `PORT` is set to in `dashboard/.env` (see "Custom port" below).

### Redirect URL / host configuration

If sign-in redirects back to `localhost:<port>` instead of your real server address, this is why: off of Vercel, Auth.js doesn't automatically trust the incoming request's host when building the OAuth callback/redirect URL — it's a deliberate security default (prevents host-header spoofing), not a bug, but it means self-hosted deployments need one of two things configured:

- **`trustHost: true`** in `dashboard/src/auth.js` — already set. This makes Auth.js use whatever host the browser actually used to reach the dashboard (your real IP:port, or your domain) to build every auth-related URL, automatically, with nothing to configure. This is enough for most setups and is why sign-in should already redirect correctly with no further action after updating.
- **`AUTH_URL`** in `dashboard/.env` — an explicit override, for when auto-detection isn't reliable (behind a reverse proxy or CDN that doesn't forward the original `Host` header correctly, for instance). Set it to the full base URL, e.g. `AUTH_URL=http://203.0.113.5:3000` or `AUTH_URL=https://yourdomain.com` (no trailing slash). **This is the one line to change whenever your server's IP or port changes** — it's blank in `.env.example` on purpose, since there's no correct default to ship. If both `trustHost` and `AUTH_URL` are present, `AUTH_URL` wins.

Either way, there's a second piece that has to match or sign-in fails outright with an "invalid redirect_uri" error from Discord, not a silent localhost redirect: **the Discord Developer Portal needs the exact same URL registered as an OAuth2 redirect.** Go to your application → OAuth2 → Redirects, and add `<your base URL>/api/auth/callback/discord` — e.g. `http://203.0.113.5:3000/api/auth/callback/discord`. Keep the `localhost:3000` one from local dev too; Discord allows multiple redirect URLs on one application, so both work side by side without switching anything back and forth.

### How access works

Sign-in requests Discord's `identify guilds` scope. On the server list page, the dashboard fetches the user's guilds from Discord (`GET /users/@me/guilds` with the user's access token) and filters to ones where they're the owner or have Manage Server, then separately fetches the guilds the *bot* is in (`GET /users/@me/guilds` with the bot token) and intersects the two lists — so a server only shows up if both the user has permission there and the bot is actually present. The guild-scoped layout re-checks this on every request before rendering any tickets/panels/settings data, and `src/middleware.js` protects the whole `/servers/*` route tree so an unauthenticated request never reaches a page at all.

Every "are they signed in" check tests `session?.accessToken`, never just `session` on its own. A session object can exist without a usable access token — a leftover cookie from before a code change, an `AUTH_SECRET` rotation, an interrupted OAuth attempt — and if the homepage only checked truthiness, that state renders "Go to Dashboard" (a plain link straight to `/servers`) instead of the real "Sign in with Discord" form, which looks exactly like sign-in silently not working: no redirect to Discord ever happens, and the server list is empty because there's no real access token to call Discord's API with.

### What's real vs stubbed right now

- **Overview** (`/servers/[guildId]`) — real data: prefix, premium status, panel count, open ticket count.
- **Tickets** (`/servers/[guildId]/tickets`) — list of open tickets (number, opener, claimed-by, opened time) with working Claim/Release/Close per row. Claim and release are pure DB writes, reimplemented directly in `actions.js` rather than importing `lib/tickets.js` (same reasoning as panel categories/questions — that file isn't safe to import into the dashboard). Close goes through the bot's internal API (`/api/ticket-close`), since generating the transcript and eventually deleting the channel both need a live channel reference the dashboard doesn't have. No reply-from-dashboard yet — that's the one piece still missing here.
- **Panels** (`/servers/[guildId]/panels`) — fully functional: create a panel (name, category, staff role, post channel, optional transcript channel — dropdowns populated live from `src/lib/guildResources.js`, which fetches the guild's channels/roles from Discord), delete a panel, add/remove staff roles, add/remove ticket categories, add/remove intake questions. Every mutation is a real Server Action in `actions.js` — create/delete/staff-role go through the bot's internal API (see "Internal API" above), categories/questions write straight to Postgres since they don't need a live Discord call. Errors surface inline via `useActionState` (limit reached, bot unreachable, etc.) rather than failing silently.
- **Settings** (`/servers/[guildId]/settings`) — prefix (edit + reset to default), no-prefix (enable/disable for everyone, add/remove specific users by ID), and claiming a premium key are all editable Server Actions in `actions.js`, reusing the bot's actual `setPrefix`/`resetPrefix`/`isGuildPremium`/`PREMIUM_DURATIONS` via short dashboard-local re-export files (`src/lib/guildPrefix.js`, `src/lib/panelLimits.js`, `src/lib/premiumDurations.js`) rather than duplicating that logic or reaching several directories deep into bot code from a nested action file (did that once, got the relative path depth wrong — centralizing the reach-into-bot-code in one shallow file per concern is the safer pattern going forward). **Granting or generating premium stays dev-only and always will** — `claimPremiumAction` only *redeems an existing key* (mirrors the bot's `premiumclaim` command exactly: same key lookup, same already-used check, same stacking-onto-existing-time math), it can never create one. Key generation (`premiumkey`) stays a hidden, dev-only bot command with no dashboard equivalent, on purpose — a server's own admin shouldn't be able to self-grant premium out of thin air, only redeem a key someone with dev access actually gave them.

All four pages are now fully functional — the pattern that's carried through every one of them: Server Actions + `useActionState` for anything with validation, direct Prisma writes for pure data changes, the internal API only where Discord itself needs to act. What's left is genuinely new ground rather than filling in stubs — replying to tickets from the dashboard, a visual panel builder beyond the current form, that kind of thing.

### Custom port

Set `PORT` in `dashboard/.env` to change which port the dashboard binds to (self-hosted mode — `npm run dashboard:dev` / `npm run dashboard:start`, and by extension `node start.js`). This only matters if you're running the dashboard yourself as a long-running process; it's irrelevant if you deploy it on Vercel or similar, since those platforms manage the port themselves and ignore `start`/`dev` scripts entirely.

This needed a small workaround, worth knowing about if you ever touch `dashboard/package.json` or `dashboard/server.js`: Next's own `.env` loading happens *after* it's already decided which port to bind to, so a `PORT` value that only exists in `dashboard/.env` never reaches `next start`/`next dev` in time — you'd set it and nothing would change. `dashboard/server.js` is a tiny wrapper that loads `.env` itself with `dotenv` first, then always launches Next with an explicit `-p <port>` flag (`port || 3000`), which sidesteps the timing issue entirely. `dashboard/package.json`'s `dev`/`start` scripts run through this wrapper (`node server.js dev` / `node server.js start`) instead of calling `next` directly; `build` is unaffected since it doesn't bind a port.

### Deployment note

`next.config.mjs` sets `outputFileTracingRoot` to the monorepo root so that if you deploy the dashboard on a platform like Vercel with its Root Directory set to `dashboard/`, the build still correctly traces and includes the shared `src/lib/db.js` file and the root `node_modules` (where the Prisma client actually lives) rather than only what's inside `dashboard/`. Vercel's own npm-workspace monorepo detection should handle most of this automatically, but the explicit config is a safety net.

### Command manifest

`/commands` and the homepage's command count don't read the bot's actual command files at all — that was an earlier design that caused real problems (see below). Instead:

- `src/utils/commandCounter.js` (bot side) walks `src/bot/commands/slash/**` and `src/bot/commands/text/**` the same way the bot's own loaders do, and for each command extracts `name`/`description`/`category`/`usage`/`hidden`, plus every subcommand (parsed from the slash command's real `toJSON()` output — the same JSON Discord's API receives).
- `npm run commands:manifest` (root) runs `command-manifest.js`, which calls that and writes the result to `dashboard/content/commands.json`.
- The dashboard's `src/lib/commands.js` just does `import manifest from '../../content/commands.json'` — a plain JSON import, nothing else. No discord.js, no bot libs, no database, in that file at all.

**Run `npm run commands:manifest` after adding, removing, or changing any command** — the JSON file is a snapshot, not live. This is the same manual-regeneration tradeoff as `npm run deploy` for slash commands (you already have to remember to run that one too), just applied to command metadata instead of Discord's API.

We initially had the dashboard statically `import` the bot's real command files directly, on the theory that it'd be impossible for the site to drift out of sync with the bot. It technically worked in dev, but broke in production: those command files transitively require `discord.js` (for `SlashCommandBuilder` etc.) and `src/lib/emojis.js`, and `emojis.js` dynamically scans a directory (`fs.readdirSync` + `require(variable)`) to build its emoji map — a pattern Next's bundler can't statically analyze ("critical dependency: the request of a dependency is an expression"), so the emoji files never got included in the deployed build and it failed at runtime with `ENOENT` trying to read a directory that doesn't exist in the built output. The manifest approach avoids the whole category of problem: the dashboard never touches those files, so it never inherits their dependencies or their dynamic-loading patterns.

### Site stats

The homepage shows server count, total commands, ping, and uptime (`src/lib/stats.js`). These come from three different places, because they genuinely can't all come from the same source:

- **Total commands** — `commands.json`'s length. No network call.
- **Server count** — fetched live via `@discordjs/rest` (`Routes.userGuilds()` with the bot token). This is the lightweight, REST-only sibling of full `discord.js` — no gateway, no voice, no native dependencies (`zlib-sync`/`erlpack`), so it bundles cleanly, unlike the full package.
- **Ping and uptime** — these **cannot** be fetched from Discord's API by anything outside the bot's own process; there's no endpoint for "what's this bot's current gateway latency." The bot writes them to a `BotStatus` singleton row every 30 seconds (`src/lib/botStatus.js`, started from the `clientReady` event) and the dashboard just reads that row with Prisma, like everything else.

If the live REST call for server count fails for any reason, it falls back to the same `BotStatus` row's `guildCount` (also updated by the bot every 30s) rather than showing nothing.

### Internal API — dashboard mutations that need real Discord actions

Writing directly to Postgres from the dashboard isn't enough for anything that needs to actually *happen* in Discord — creating a panel means posting a real message with a real button in a real channel, not just inserting a `Panel` row. The bot is the only process with a live gateway connection, so it's the only one that can do that.

**How it works:** `src/lib/internalApi.js` runs a small HTTP server *inside the bot process*, started from the `clientReady` event once the client (and therefore `client.guilds.cache`) is actually populated. It listens on a **Unix domain socket** (`INTERNAL_API_SOCKET`, a file path — defaults to `/tmp/quonex-internal.sock`), not a TCP port at all. This isn't a style choice — it's what actually works on hosting where bot and dashboard share a container but you don't control or have spare ports to allocate for internal-only traffic: a Unix socket is pure filesystem-based IPC between two processes on the same machine, so it needs zero network binding, zero port allocation, and isn't reachable from outside the container by definition (unlike a TCP port bound to `0.0.0.0`, which — if you ever went that route to work around a networking quirk — would need the secret to be doing real security work, since that port becomes internet-reachable). On startup, the bot deletes any stale socket file left over from a previous run before listening, so a crash-and-restart cycle can't leave it stuck. Every request must still carry a matching `X-Internal-Secret` header (`INTERNAL_API_SECRET`, set identically in both `.env` files — same pattern as `DATABASE_URL` needing to match across the two processes) or it's rejected with 401 before anything else happens.

`dashboard/src/lib/botApi.js` can't use plain `fetch()` for this — `fetch` doesn't support Unix sockets — so it uses Node's `http.request()` directly with a `socketPath` option instead of a URL. `INTERNAL_API_SOCKET` must be set to the exact same file path in both `.env` files (or left at the shared default) for the two sides to find each other.

**The pattern, using panel creation as the concrete example:** when the dashboard adds a "create panel" form, it writes the `Panel` row to Postgres itself (name, category, staff role, everything except `messageId`, since no message exists yet), then calls `dashboard/src/lib/botApi.js`'s `notifyPanelCreated({ guildId, channelId, panelId })`, which sends a request over the socket to `/api/panel-created` on the bot. The bot looks up that panel by ID, resolves the live `guild`/`channel` objects from its own cache, calls `postPanelMessage()` — the exact same function `/panel create` already uses, extracted out of `createPanel()` specifically so this new path and the existing command path share one implementation instead of two — and writes `messageId` back. The dashboard gets the completed panel back in the response.

This is why the split isn't "dashboard writes, then tells the bot to go figure out what changed": that two-phase shape risks an orphaned DB row if the notify call fails after the write already succeeded. Instead the bot performs the DB write itself as part of handling the request, reusing the same functions the commands already call — so there's exactly one code path per action, not two to keep in sync, and no in-between state where a Panel row exists with no message anyone can click.

**Four routes exist right now**, and they're not all shaped the same way — deliberately:

| Route | Payload | Shape |
| --- | --- | --- |
| `POST /api/panel-created` | `{ guildId, channelId, panelId }` | Split — dashboard already wrote the `Panel` row, bot only posts the message and fills in `messageId` |
| `POST /api/panel-deleted` | `{ guildId, panelId }` | Fully bot-side — bot looks up the panel, deletes the posted message if one exists, then deletes the DB rows |
| `POST /api/staff-role-add` | `{ guildId, panelId, roleId }` | Fully bot-side — calls `addStaffRole()` wholesale |
| `POST /api/staff-role-remove` | `{ guildId, panelId, roleId }` | Fully bot-side — calls `removeStaffRole()` wholesale |
| `POST /api/ticket-close` | `{ guildId, channelId, closerId }` | Fully bot-side — calls `closeTicket()` wholesale, needs a live channel for the transcript and eventual deletion |

Panel creation stays split because that's genuinely fine there — the DB write itself (insert a row) has no validation that depends on live Discord state. Deletion and staff-role changes are fully bot-side instead, and that's not a style preference: `addStaffRole()`/`removeStaffRole()` already do the whole thing atomically (limit check, duplicate check, DB update, *and* syncing permission overwrites on every open ticket channel via a live `guild` object) — splitting that would mean either reimplementing those checks a second time on the dashboard side (duplicated logic, the exact thing this design avoids) or leaving the permission-sync step to happen separately and risk drifting out of sync with the DB write. Same reasoning for delete: cleaning up the stale panel message needs a live channel/message reference the dashboard doesn't have. So each route takes whichever shape its underlying function actually requires, not a shape picked for consistency's sake.

**Categories and questions deliberately don't have routes.** `addPanelCategory`/`removePanelCategory`/`addQuestion`/`removeQuestion` in `src/lib/tickets.js` are pure database operations right now — no `guild` parameter, no live Discord call anywhere inside them, just a limit check and an array update. There's nothing for the bot to *do* that the dashboard can't already do itself with a direct Prisma write once its own panel-management UI exists. If that ever changes — say, validating a category ID actually exists in the guild before saving it — that validation would need live Discord access and a route would move from "not needed" to "needed" at that point, following the same judgment call as everything else here.

**Adding a new action later:** add a handler function to `src/lib/internalApi.js`, register it in the `ROUTES` object (`'POST /api/your-route': yourHandler`), and add a matching thin wrapper in `dashboard/src/lib/botApi.js`. Decide split vs. fully-bot-side by asking the same question each route above answers: does the write itself depend on anything only the live client knows?

**The one real limitation:** this only works because bot and dashboard are guaranteed to be on the same filesystem right now (same container/host). If that ever changes — dashboard deployed to Vercel while the bot stays on Pterodactyl, for instance — a Unix socket stops being reachable entirely, since there's no shared filesystem between two separate hosts. That would need to become a real network call (a properly exposed port, or a tunnel) instead. Worth remembering before ever separating the two.

**Setting up the socket path:**

1. Pick any file path both processes can read and write. The default, `/tmp/quonex-internal.sock`, works out of the box on virtually any Linux host (including Pterodactyl containers) since `/tmp` is always writable — you don't need to change anything unless you have a specific reason to.
2. If you do want a different path (multiple bot instances on one host, a container filesystem where `/tmp` isn't persistent across restarts and you'd rather it live inside the project directory, etc.), set `INTERNAL_API_SOCKET` to that path in **both** `.env` files — the root one (bot) and `dashboard/.env` — to the exact same value. They're two separate processes reading two separate `.env` files, so this has to match on both sides the same way `DATABASE_URL` does.
3. Generate `INTERNAL_API_SECRET` (any long random string — `openssl rand -hex 32` works fine) and set that identically in both `.env` files too.
4. That's it — no port to open, nothing to configure in Pterodactyl's network/port allocation panel. Restart the bot and dashboard (or just run `node start.js`, which launches both) and check the bot's startup log for `Internal API listening on unix socket <path>` to confirm it bound successfully.
5. If you ever see a permissions error here instead, it means the path you chose isn't writable by whatever user the process runs as — either switch back to `/tmp/quonex-internal.sock`, or pick a path inside a directory you know that user owns.

### Running bot + dashboard together on one host

`start.js` at the project root is a single entry point for hosts (like Pterodactyl) that only give you one process to launch: it runs `prisma generate`, deploys slash commands, regenerates the command manifest (`npm run commands:manifest` — must happen before the dashboard build, since the build reads that JSON file), builds the dashboard, then starts the bot and the dashboard as two long-running child processes, forwarding SIGINT/SIGTERM to both on shutdown. Point your host's start command at `node start.js` instead of `npm start` if you need both running from a single launch command.

**Schema syncing runs automatically on every boot** via `npx prisma db push`, not `migrate dev`. This matters, not just a naming detail: `migrate dev` is hard-blocked by Prisma itself in any non-interactive environment — Pterodactyl's exec context has no TTY, so it refuses outright with "Prisma Migrate has detected that the environment is non-interactive, which is not supported" and exits nonzero. There's no flag that gets around this; it's a deliberate restriction Prisma enforces, not a bug. `db push` is the tool actually meant for this: it reads `prisma/schema.prisma` and directly makes the live database match it — creating missing tables/columns as needed — with no migration files and no interactive prompts required.

**The trade-off:** `db push` doesn't produce a `prisma/migrations/` history — no changelog of schema changes, no ability to roll back a specific step. For purely additive changes (new models, new optional fields — the overwhelming majority of day-to-day iteration), it just works, silently, every boot. If a change is genuinely destructive (dropping a column that has data in it, changing a type incompatibly), `db push` refuses and fails without `--accept-data-loss` — and `start.js` does **not** pass that flag automatically, on purpose. A failed setup step makes `start.js` exit before starting the bot/dashboard at all, rather than risk silently deleting real ticket/premium data because nobody was watching the boot log. If you ever see a `db push` step fail here, that's your signal to go look at what changed and decide by hand whether the data loss is acceptable, not something to route around by adding the flag into `start.js` permanently.

If you want real versioned migration history instead of relying on `db push` (useful once more than one person touches the schema, or you want rollback capability), that's still available — just not from `start.js` unattended: run `npm run prisma:migrate:new -- <description>` yourself, locally, where you have a real terminal, then deploy normally. The generated migration files under `prisma/migrations/` and `db push`'s direct schema sync aren't mutually exclusive, but mixing them on the same database inconsistently can confuse Prisma's own drift detection — pick one strategy for a given deployment and stay with it.

### Public website

The same Next.js app also serves the public-facing site — no separate project. Every page (public and dashboard) shares `src/app/layout.js`, which renders `SiteNav` (Home / Commands / Credits / Changelog, plus a Dashboard button and the bot's real Discord avatar) and the credit `Footer` around all of them. The whole site uses a cosmic theme — `src/components/CosmicBackground.js` renders a fixed, decorative twinkling starfield (pure CSS, defined in `src/app/globals.css`, disabled via the `prefers-reduced-motion` media query for anyone with that preference set). It used to also have a continuous stream of falling comets, removed after real usage — they looked good but were genuinely distracting while trying to read/use the site, which matters more than the visual. Cards/panels use a translucent glass look (`border-white/10 bg-white/5 backdrop-blur-sm`) with a pronounced hover lift (`-translate-y-2`, slight scale, violet glow shadow) instead of flat opaque panels so the background stays visible through the UI and every interactive surface reacts to the cursor. Accent color is violet throughout, not indigo. `src/lib/discord.js`'s `getBotProfile()` fetches the bot's live username/avatar from Discord (`GET /users/@me` with the bot token, revalidated every 5 minutes) — used in the nav and the homepage hero, so the site actually shows the real bot, not just its name as text.

- `/` — landing page. Shows "Sign in with Discord" if signed out, "Go to Dashboard" if signed in.
- `/commands` — every non-hidden command, grouped by category with a live search box (filters by name/description/usage/category, client-side). Sourced from `dashboard/content/commands.json` — see "Command manifest" below for how that file is generated and why it's not a live import of the bot's code.
- `/docs` — genuinely auto-discovering, unlike `/commands`: drop a `.md` file into `dashboard/content/docs/` with frontmatter (`title`, `description`, `order`) and it appears at `/docs` and `/docs/<filename-without-.md>` with zero code changes. `src/lib/docs.js` reads the directory with plain Node `fs` calls at request time (this is the standard, well-supported pattern for content directories in Next.js — different from the commands case above, which was about dynamically importing JS *modules*, not reading files). Markdown is parsed with `gray-matter` (frontmatter) and `marked` (HTML), and rendered with the Tailwind Typography plugin (`prose prose-invert`). Seeded with four starter docs: Getting Started, Panels & Tickets, Premium & No-Prefix, Dashboard.
- `/credits` — team credit, tech stack, support server link.
- `/changelog` — reads `src/lib/changelog.js`, a plain array you edit by hand as features ship (there's no ground truth for real dates, so entries are versioned rather than dated — add dates yourself if you want them).
- `/terms`, `/privacy` — Terms of Service and Privacy Policy, linked in the footer on every page. **These are starting templates, not legal advice** — they say so at the top of each page. Have them reviewed before you rely on them, especially the bracketed placeholders (governing law, payment terms). Discord requires a Privacy Policy and Terms of Service URL for verified/public bot applications, so these also serve that purpose once you fill them in and deploy.
