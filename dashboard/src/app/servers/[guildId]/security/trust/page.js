import { prisma } from '../../../../../lib/db';
import { getGuildChannels, getGuildRoles, getUserNames } from '../../../../../lib/guildResources';
import { requireSecurity, allows, MAX_EXTRA_OWNERS, MAX_WHITELIST_ENTRIES, WHITELIST_MODULES, NUKE_EVENTS } from '../../../../../lib/securityServer';
import TrustManager from './TrustManager';

export default async function TrustPage({ params }) {
  const { guildId } = await params;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const [owners, whitelist, { textChannels }, roles] = await Promise.all([
    prisma.securityOwner.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    prisma.securityWhitelist.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    getGuildChannels(guildId),
    getGuildRoles(guildId)
  ]);

  const names = await getUserNames([...owners.map(row => row.userId), ...whitelist.filter(row => row.kind === 'user').map(row => row.targetId)]);

  return (
    <TrustManager
      guildId={guildId}
      canManageOwners={allows(access.tier, 'owner')}
      canManageWhitelist={allows(access.tier, 'trusted')}
      owners={owners.map(row => ({ userId: row.userId, name: names[row.userId] || null }))}
      whitelist={whitelist.map(row => ({ kind: row.kind, targetId: row.targetId, modules: row.modules, events: row.events, name: row.kind === 'user' ? names[row.targetId] || null : null }))}
      roles={roles.map(role => ({ id: role.id, name: role.name }))}
      channels={textChannels.map(channel => ({ id: channel.id, name: channel.name }))}
      maxOwners={MAX_EXTRA_OWNERS}
      maxWhitelist={MAX_WHITELIST_ENTRIES}
      moduleOptions={WHITELIST_MODULES}
      events={NUKE_EVENTS.map(event => ({ id: event.id, label: event.label }))}
    />
  );
}
