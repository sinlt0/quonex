import { prisma } from '../../../../lib/db';
import ModuleShell from '../../../../components/dash/ModuleShell';

export default async function RolesShell({ guildId, children }) {
  const [messageCount, reactionCount] = await Promise.all([
    prisma.interactiveMessage.count({ where: { guildId } }),
    prisma.reactionRole.count({ where: { guildId } })
  ]);

  const tabs = [
    { href: `/servers/${guildId}/roles`, label: 'Messages', count: messageCount },
    { href: `/servers/${guildId}/roles/reactions`, label: 'Reaction roles', count: reactionCount }
  ];

  return (
    <ModuleShell
      moduleId="roles"
      tabs={tabs}
      callout="Build messages with buttons and menus, and decide what each one does: give or remove roles, reply privately, post to a channel, or open another message. Post them with the button here or /rolemenu send."
    >
      {children}
    </ModuleShell>
  );
}
