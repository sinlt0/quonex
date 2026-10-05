import { BOT_NAME, SUPPORT_SERVER } from '../../lib/branding';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="fade-in-up mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: check with your team for the current revision date.</p>
      <article className="prose prose-invert mt-8 max-w-none">
        <h2>1. Acceptance of Terms</h2>
        <p>
          These Terms of Service ("Terms") govern your access to and use of {BOT_NAME}, including the Discord bot, its
          slash and prefix commands, the web dashboard, and this website (together, the "Service"). By inviting{' '}
          {BOT_NAME} to a Discord server, running any of its commands, or signing in to the dashboard, you agree to be
          bound by these Terms. If you do not agree, do not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          {BOT_NAME} is a ticket management system for Discord servers. It lets server staff create ticket panels,
          assign staff roles, collect intake information through forms, and manage support tickets, with an optional
          web dashboard for viewing that data outside of Discord. Some features are gated behind premium access,
          described in Section 6. Features may be added, changed, or removed at any time, with or without notice.
        </p>

        <h2>3. Eligibility and Discord Compliance</h2>
        <p>
          Your use of {BOT_NAME} is conditioned on your compliance with Discord's own{' '}
          <a href="https://discord.com/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="https://discord.com/guidelines" target="_blank" rel="noreferrer">
            Community Guidelines
          </a>
          . You must meet Discord's minimum age requirement to hold a Discord account at all, and therefore to use{' '}
          {BOT_NAME}. A server administrator who adds {BOT_NAME} to a server is responsible for ensuring that server's
          use of the Service complies with these Terms.
        </p>

        <h2>4. Accounts and Access</h2>
        <p>
          {BOT_NAME} does not maintain its own passwords or accounts. Dashboard access is entirely through Discord's
          own sign-in (OAuth) — you are identified by your Discord account, and access to a given server's data is
          granted only to accounts that hold Manage Server permission (or ownership) on that server, and only while{' '}
          {BOT_NAME} remains a member of it. You are responsible for the security of your own Discord account;{' '}
          {BOT_NAME} has no ability to protect access if your Discord account itself is compromised.
        </p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Violate any applicable law, or Discord's Terms of Service or Community Guidelines</li>
          <li>Harass, threaten, defraud, or otherwise harm another person</li>
          <li>
            Attempt to exploit, disrupt, reverse engineer, or gain unauthorized access to the bot, the dashboard, or
            the systems behind either
          </li>
          <li>
            Circumvent any permission check, rate limit, or plan limit the Service enforces (staff-only commands,
            panel/ticket limits, no-prefix access controls, and similar)
          </li>
          <li>Use the Service to store or transmit malware, or content that is illegal in the jurisdiction you operate in</li>
        </ul>
        <p>
          We may investigate and take appropriate action against anyone who violates this section, including removing
          content, suspending or terminating access, and reporting conduct to Discord or relevant authorities where
          required.
        </p>

        <h2>6. Premium Features</h2>
        <p>
          Certain features (higher panel, ticket, staff-role, and intake-question limits, and similar) require premium
          access. Premium is granted for a fixed duration or permanently ("lifetime"), rather than as a recurring
          subscription tier, and is currently activated by an administrator or through a redeemable premium key —
          {BOT_NAME} does not itself process payments or store payment information; any purchase of a premium key
          happens through whatever channel the operator makes available outside of the bot and is subject to that
          channel's own terms. Premium time does not carry a refund guarantee unless required by applicable consumer
          law.
        </p>

        <h2>7. Content You Provide</h2>
        <p>
          Ticket channels, messages sent within them, and answers submitted through intake forms are content you and
          your server's members provide, not content {BOT_NAME} generates. You retain ownership of that content. By
          using the Service, you grant {BOT_NAME} the limited right to store, process, and display that content back
          to you and your server's staff solely to operate the ticketing features described in Section 2 — including
          generating and storing a transcript of a ticket when it is closed, if your server has configured a
          transcript channel.
        </p>

        <h2>8. Intellectual Property</h2>
        <p>
          The {BOT_NAME} name, branding, and the underlying software are the property of the {BOT_NAME} team (or its
          licensors) and are not transferred to you by these Terms. Nothing here grants you rights to use the{' '}
          {BOT_NAME} name or branding beyond referring to the bot by name within your own server.
        </p>

        <h2>9. Termination</h2>
        <p>
          We may suspend or terminate the Service's availability to any server or user that violates these Terms,
          with or without prior notice. A server administrator may remove {BOT_NAME} from their server at any time to
          stop using the Service; see the Privacy Policy for what happens to data at that point.
        </p>

        <h2>10. Disclaimer of Warranties</h2>
        <p>
          The Service is provided "as is" and "as available," without warranties of any kind, express or implied,
          including any implied warranty of merchantability, fitness for a particular purpose, or non-infringement. We
          do not guarantee the Service will be uninterrupted, secure, error-free, or available at all times — it
          depends in part on Discord's own platform and API availability, which is outside our control.
        </p>

        <h2>11. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, {BOT_NAME} and its developers are not liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of data, revenue, or
          goodwill, arising out of or related to your use of, or inability to use, the Service, even if advised of the
          possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain
          damages, so some of the above limitations may not apply to you.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless {BOT_NAME} and its developers from any claim, liability, damage,
          or expense (including reasonable legal fees) arising from your use of the Service in violation of these
          Terms or applicable law.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be reflected by updating the date at the
          top of this page. Continued use of the Service after changes take effect constitutes acceptance of the
          revised Terms.
        </p>

        <h2>14. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which the Service operator resides or is
          established, without regard to conflict-of-law principles, except where applicable local consumer
          protection law requires otherwise.
        </p>

        <h2>15. Severability</h2>
        <p>
          If any provision of these Terms is found unenforceable, the remaining provisions remain in full force and
          effect, and the unenforceable provision will be interpreted to reflect the original intent as closely as
          possible.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these Terms can be directed to our <a href={SUPPORT_SERVER}>support server</a>.
        </p>
      </article>
      <p className="mt-10 text-xs text-neutral-600">
        This document is a template, not legal advice, and hasn't been reviewed by a lawyer for your specific
        situation or jurisdiction — have it reviewed before relying on it in production.
      </p>
    </div>
  );
}
