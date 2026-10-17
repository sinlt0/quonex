import ModuleShell from '../../../../components/dash/ModuleShell';
import { getSecurityAccess } from '../../../../lib/securityServer';

export default async function SecurityLayout({ children, params }) {
  const { guildId } = await params;
  const { tier } = await getSecurityAccess(guildId);

  const base = `/servers/${guildId}/security`;
  const tabs = [
    { href: base, label: 'Overview' },
    { href: `${base}/antinuke`, label: 'Anti-nuke' },
    { href: `${base}/antiraid`, label: 'Anti-raid' },
    { href: `${base}/automod`, label: 'Auto-mod' },
    { href: `${base}/verification`, label: 'Verification' },
    { href: `${base}/lockdown`, label: 'Lockdown' },
    { href: `${base}/trust`, label: 'Trust' },
    { href: `${base}/backups`, label: 'Backups' },
    { href: `${base}/logs`, label: 'Logs' },
    { href: `${base}/settings`, label: 'Settings' }
  ];

  if (!tier) {
    return (
      <ModuleShell moduleId="security">
        <div className="dash-card p-6">
          <p className="font-semibold">Security is locked to the server owner and extra owners</p>
          <p className="mt-2 text-sm text-neutral-400">
            Ask the server owner to add you with /security owners add, or on the Trust tab. If you are a trusted administrator and the owner has turned off strict access, make sure you have the Administrator permission.
          </p>
        </div>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell moduleId="security" tabs={tabs}>
      {children}
    </ModuleShell>
  );
}
