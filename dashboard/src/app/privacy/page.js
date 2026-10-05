import { BOT_NAME, SUPPORT_SERVER } from '../../lib/branding';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="fade-in-up mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: check with your team for the current revision date.</p>
      <article className="prose prose-invert mt-8 max-w-none">
        <h2>1. Information We Collect</h2>
        <p>When you use {BOT_NAME} — the Discord bot, its commands, or the web dashboard — we collect:</p>
        <ul>
          <li>Your Discord user ID, username, and avatar, provided by Discord OAuth when you sign in to the dashboard</li>
          <li>
            The list of servers you belong to and your permission level in each, read at sign-in solely to determine
            which servers you're allowed to manage in the dashboard — this is not stored beyond the length of your
            session
          </li>
          <li>
            Server-level configuration staff set up: prefix, ticket panels, staff roles, intake question text,
            premium status and expiry, no-prefix access grants
          </li>
          <li>
            Ticket data: the channel created for each ticket, who opened it, who claimed it, its open/closed status,
            and answers submitted through any intake form
          </li>
          <li>
            Message content within a ticket channel, only at the moment the ticket is closed, if your server has
            configured a transcript channel — this becomes a transcript stored in that channel, not a separate
            database of message contents
          </li>
        </ul>
        <p>
          We do not collect your email address, phone number, password, or payment information. There is no
          password to collect — authentication is handled entirely by Discord, and we never see or store your
          Discord password.
        </p>

        <h2>2. How We Use Information</h2>
        <p>
          Collected information is used only to operate the features described in Section 1: creating and managing
          tickets, enforcing who can access what, generating transcripts, and displaying your server's data back to
          you in the dashboard. We do not sell personal information, and we do not use it for advertising.
        </p>

        <h2>3. Cookies and Sessions</h2>
        <p>
          The dashboard sets a single session cookie after you sign in with Discord, used only to keep you signed in
          between requests. We do not use tracking or advertising cookies, and no cookie data is shared with or sold
          to third parties.
        </p>

        <h2>4. Data Storage and Security</h2>
        <p>
          Data is stored in a PostgreSQL database. We use reasonable technical measures to protect it — access is
          restricted to the bot and dashboard's own server-side code, credentials are kept out of source control, and
          transport is encrypted — but no method of storage or transmission over the internet is completely secure,
          and we cannot guarantee absolute security.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          Server configuration and ticket records are retained for as long as {BOT_NAME} remains in your server, or
          until you request deletion under Section 7. If a panel is deleted through the bot's own commands, its
          associated ticket records are removed from our database at that time (the underlying Discord channels, if
          not already deleted, are unaffected — that's controlled by your server, not by us). Closed-ticket
          transcripts live as messages in whatever channel your server designated, subject to your own server's
          message retention and Discord's own retention practices, not ours.
        </p>

        <h2>6. Third-Party Services and Sub-processors</h2>
        <p>
          Operating {BOT_NAME} requires sharing limited data with the infrastructure providers that run it — this is
          normal for any hosted service and doesn't mean your data is sold or used for their own purposes:
        </p>
        <ul>
          <li>
            <strong>Discord</strong> — authentication, and every message/channel operation the bot performs. Your use
            of Discord itself is separately governed by{' '}
            <a href="https://discord.com/privacy" target="_blank" rel="noreferrer">
              Discord's Privacy Policy
            </a>
            .
          </li>
          <li>Our database hosting provider — stores the data described in Section 1, encrypted in transit.</li>
          <li>Whichever platform hosts the bot process and the dashboard — sees traffic metadata (not message content) as a normal part of running any server.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>
          You can request a copy of the data associated with your Discord account, or request its deletion, by
          contacting us through our <a href={SUPPORT_SERVER}>support server</a>. Depending on where you live, you may
          have additional rights over your personal data (for example, rights to access, correct, or restrict
          processing under regulations like GDPR or CCPA) — reach out via the same channel and we'll do our best to
          honor applicable requests. Server administrators can remove {BOT_NAME} from a server at any time, which
          stops any further data collection for that server going forward.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          {BOT_NAME} is not directed at children and is only available to Discord accounts that meet Discord's own
          minimum age requirement. We do not knowingly collect data from anyone below that age beyond what Discord
          itself already provides through normal account use.
        </p>

        <h2>9. Data Breach Notification</h2>
        <p>
          If we become aware of a security incident that compromises personal data covered by this policy, we will
          take reasonable steps to notify affected server administrators through our support server or another
          reasonable channel, consistent with applicable law.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by updating the date at
          the top of this page. Continued use of {BOT_NAME} after changes take effect constitutes acceptance of the
          updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this policy, or requests under Section 7, can be directed to our{' '}
          <a href={SUPPORT_SERVER}>support server</a>.
        </p>
      </article>
      <p className="mt-10 text-xs text-neutral-600">
        This document is a template, not legal advice, and hasn't been reviewed by a lawyer for your specific
        situation or the privacy laws that apply to your users — have it reviewed before relying on it in
        production.
      </p>
    </div>
  );
}
