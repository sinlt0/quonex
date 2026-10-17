import { prisma } from '../../../../../lib/db';
import { requireSecurity } from '../../../../../lib/securityServer';
import BackupManager from './BackupManager';

export default async function BackupsPage({ params }) {
  const { guildId } = await params;
  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const rows = await prisma.securityBackup.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, auto: true, createdAt: true, data: true } });
  const backups = rows.map(row => ({
    id: row.id,
    name: row.name,
    auto: row.auto,
    createdAt: row.createdAt.toISOString(),
    roles: Array.isArray(row.data?.roles) ? row.data.roles.length : 0,
    channels: Array.isArray(row.data?.channels) ? row.data.channels.length : 0
  }));

  return <BackupManager guildId={guildId} backups={backups} />;
}
