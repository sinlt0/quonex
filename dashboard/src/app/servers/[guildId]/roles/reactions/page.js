import { prisma } from '../../../../../lib/db';
import { limitFor } from '../../../../../lib/panelLimits';
import { getGuildChannels, getGuildRoles } from '../../../../../lib/guildResources';
import RolesShell from '../RolesShell';
import ReactionRoleForm from './ReactionRoleForm';
import { removeReactionRoleAction } from '../actions';

export default async function ReactionRolesPage({ params }) {
  const { guildId } = await params;

  const [rows, limit, { textChannels }, roles] = await Promise.all([
    prisma.reactionRole.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    limitFor(guildId, 'reactionRoles'),
    getGuildChannels(guildId),
    getGuildRoles(guildId)
  ]);

  const roleName = id => roles.find(role => role.id === id)?.name || id;
  const channelName = id => textChannels.find(channel => channel.id === id)?.name || id;
  const emojiLabel = emoji => (/^\d+$/.test(emoji) ? `custom (${emoji})` : emoji);

  return (
    <RolesShell guildId={guildId}>
      <ReactionRoleForm guildId={guildId} textChannels={textChannels} roles={roles} used={rows.length} limit={limit} />

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">No reaction roles yet.</p>
      ) : (
        <div className="dash-card overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="px-5 py-2">Emoji</th>
                <th className="px-5 py-2">Role</th>
                <th className="px-5 py-2">Message</th>
                <th className="px-5 py-2">Mode</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-[#1c2030]">
                  <td className="px-5 py-2">{emojiLabel(row.emoji)}</td>
                  <td className="px-5 py-2">{roleName(row.roleId)}</td>
                  <td className="px-5 py-2">
                    <a
                      className="text-[#8b7cf6] hover:underline"
                      href={`https://discord.com/channels/${guildId}/${row.channelId}/${row.messageId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{channelName(row.channelId)}
                    </a>
                  </td>
                  <td className="px-5 py-2">{row.mode === 'once' ? 'Once' : row.mode === 'unique' ? 'Unique' : 'Toggle'}</td>
                  <td className="px-5 py-2 text-right">
                    <form action={removeReactionRoleAction.bind(null, guildId, row.id)}>
                      <button type="submit" className="dash-btn text-red-300">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RolesShell>
  );
}
