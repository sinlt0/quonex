import { notFound } from 'next/navigation';
import { getGuildChannels, getGuildRoles } from '../../../../../lib/guildResources';
import { loadSecurityConfig, requireSecurity } from '../../../../../lib/securityServer';
import { sectionsFor, eventsFor, filtersFor } from '../../../../../../../src/config/securityGroups.js';
import ConfigForm from '../ConfigForm';
import ModuleToggleCard from '../ModuleToggleCard';
import ModuleActions from '../ModuleActions';

const PAGES = {
  antinuke: { module: 'antinuke', label: 'Anti-nuke', description: 'Punish and undo mass deleting, banning and permission abuse. Owners and trusted members are never touched.', toggle: true },
  antiraid: { module: 'antiraid', label: 'Anti-raid', description: 'Detect join floods, screen every join and score risky accounts.', toggle: true },
  automod: { module: 'automod', label: 'Auto-mod', description: 'Filter messages with a heat system and escalating strikes.', toggle: true },
  verification: { module: 'verification', label: 'Verification', description: 'Make members prove they are real before they get in.', toggle: true },
  moderation: { module: 'moderation', label: 'Moderation', description: 'Settings for /ban, /kick, /timeout, /warn, /purge and /nuke, and how they tie into anti-nuke.', toggle: false },
  lockdown: { module: 'lockdown', label: 'Lockdown', description: 'Lock channels or the whole server and restore exact permissions afterwards.', toggle: false },
  settings: { module: 'core', label: 'Settings', description: 'Logging, access, quarantine and backups.', toggle: false }
};

export default async function SecurityModulePage({ params }) {
  const { guildId, module: slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  const access = await requireSecurity(guildId, 'config');
  if (!access) return null;

  const [config, { textChannels }, roles] = await Promise.all([loadSecurityConfig(guildId), getGuildChannels(guildId), getGuildRoles(guildId)]);
  const sections = sectionsFor(page.module);
  const initial = { ...config[page.module] };
  delete initial.enabled;

  let groups = [];
  let groupKind = null;
  let groupsTitle = '';
  let groupsDescription = '';
  if (page.module === 'antinuke') {
    groups = eventsFor();
    groupKind = 'event';
    groupsTitle = 'Watched events';
    groupsDescription = 'Each event has its own limit, window and punishment. Open one to tune it.';
  } else if (page.module === 'automod') {
    groups = filtersFor();
    groupKind = 'filter';
    groupsTitle = 'Filters';
    groupsDescription = 'Turn filters on and tune how much heat each one adds. 100 heat punishes at once.';
  }

  return (
    <div className="space-y-4">
      {page.toggle && <ModuleToggleCard guildId={guildId} module={page.module} label={page.label} description={page.description} checked={Boolean(config[page.module].enabled)} />}
      {!page.toggle && <p className="text-sm text-neutral-400">{page.description}</p>}
      <ModuleActions guildId={guildId} module={page.module} channels={textChannels} config={config[page.module]} />
      <ConfigForm
        guildId={guildId}
        module={page.module}
        sections={sections}
        groups={groups}
        groupKind={groupKind}
        groupsTitle={groupsTitle}
        groupsDescription={groupsDescription}
        initial={initial}
        roles={roles}
        channels={textChannels}
      />
    </div>
  );
}
