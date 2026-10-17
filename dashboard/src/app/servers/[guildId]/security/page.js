import Link from 'next/link';
import { prisma } from '../../../../lib/db';
import Card from '../../../../components/dash/Card';
import { getGuildChannels } from '../../../../lib/guildResources';
import { loadSecurityConfig, requireSecurity, PRESETS } from '../../../../lib/securityServer';
import ModuleToggleCard from './ModuleToggleCard';
import ModuleActions from './ModuleActions';
import PresetPicker from './PresetPicker';
import { formatLog } from './logFormat';

export default async function SecurityOverviewPage({ params }) {
  const { guildId } = await params;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const [config, { textChannels }, recent, owners, whitelist, quarantined, backups] = await Promise.all([
    loadSecurityConfig(guildId),
    getGuildChannels(guildId),
    prisma.securityLog.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.securityOwner.count({ where: { guildId } }),
    prisma.securityWhitelist.count({ where: { guildId } }),
    prisma.quarantineEntry.count({ where: { guildId } }),
    prisma.securityBackup.count({ where: { guildId } })
  ]);

  const base = `/servers/${guildId}/security`;
  const warnings = [];
  if (!config.core.logChannelId) warnings.push({ text: 'No log channel is set. Security events are stored but not posted anywhere.', href: `${base}/settings` });
  if (!config.antinuke.enabled && !config.antiraid.enabled && !config.automod.enabled) warnings.push({ text: 'Every protection module is off. Apply a preset below to start.', href: null });
  if (config.verification.enabled && !config.verification.verifiedRoleId && !config.verification.unverifiedRoleId) warnings.push({ text: 'Verification is on but no verified or unverified role is set.', href: `${base}/verification` });

  const modules = [
    { id: 'antinuke', label: 'Anti-nuke', description: `Default punishment: ${config.antinuke.punishment}. Reverts damage: ${config.antinuke.revert ? 'yes' : 'no'}.` },
    { id: 'antiraid', label: 'Anti-raid', description: `${config.antiraid.joinThreshold} joins in ${config.antiraid.joinWindowSeconds}s starts raid mode.` },
    { id: 'automod', label: 'Auto-mod', description: `${Object.keys(config.automod).filter(key => key.endsWith('.enabled') && key !== 'enabled' && config.automod[key]).length} filters on.` },
    { id: 'verification', label: 'Verification', description: `Mode: ${config.verification.mode}.` }
  ];

  const presets = Object.entries(PRESETS).map(([name, preset]) => ({ name, description: preset.description }));

  return (
    <div className="space-y-4">
      {warnings.map(warning => (
        <div key={warning.text} className="dash-callout flex items-center justify-between gap-4 text-sm text-neutral-300">
          <span>{warning.text}</span>
          {warning.href && (
            <Link href={warning.href} className="dash-btn shrink-0">
              Fix
            </Link>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Extra owners', owners],
          ['Whitelist entries', whitelist],
          ['Quarantined', quarantined],
          ['Backups', backups]
        ].map(([label, value]) => (
          <div key={label} className="dash-card px-4 py-3">
            <p className="dash-label">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {modules.map(module => (
          <div key={module.id} className="space-y-2">
            <ModuleToggleCard guildId={guildId} module={module.id} label={module.label} description={module.description} checked={Boolean(config[module.id].enabled)} />
            <Link href={`${base}/${module.id}`} className="block px-1 text-xs text-[#8b7cf6] hover:underline">
              Configure {module.label}
            </Link>
          </div>
        ))}
      </div>

      <Card title="Presets" description="Start from a ready-made setup, then tune anything on the other tabs.">
        <PresetPicker guildId={guildId} presets={presets} />
      </Card>

      <ModuleActions guildId={guildId} module="lockdown" channels={textChannels} config={config.lockdown} />

      <Card title="Recent events" action={<Link href={`${base}/logs`} className="dash-btn">View all</Link>}>
        <div className="px-5 pb-4">
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing has happened yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map(row => (
                <li key={row.id} className="text-sm text-neutral-300">
                  {formatLog(row)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
