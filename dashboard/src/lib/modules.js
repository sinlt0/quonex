export const MODULE_GROUPS = [
  { id: 'community', label: 'Community' },
  { id: 'support', label: 'Support' },
  { id: 'server', label: 'Server' }
];

export const MODULES = [
  {
    id: 'greet',
    label: 'Greetings',
    description: 'Welcome, leave and ban messages with a full Components V2 builder.',
    icon: 'greet',
    href: '/greet',
    matches: ['/greet'],
    group: 'community'
  },
  {
    id: 'levels',
    label: 'Leveling',
    description: 'XP per message, level-up announcements and role rewards.',
    icon: 'levels',
    href: '/levels',
    matches: ['/levels'],
    group: 'community'
  },
  {
    id: 'roles',
    label: 'Roles & Buttons',
    description: 'Button, menu and reaction role messages with a full Components V2 builder.',
    icon: 'roles',
    href: '/roles',
    matches: ['/roles'],
    group: 'community'
  },
  {
    id: 'applications',
    label: 'Applications',
    description: 'Application panels with intake forms and accept/deny review.',
    icon: 'applications',
    href: '/applications',
    matches: ['/applications'],
    group: 'community'
  },
  {
    id: 'tickets',
    label: 'Tickets',
    description: 'Private support tickets with panels, forms, claiming and transcripts.',
    icon: 'tickets',
    href: '/panels',
    matches: ['/panels', '/tickets'],
    group: 'support'
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Prefix, premium and no-prefix access for this server.',
    icon: 'settings',
    href: '/settings',
    matches: ['/settings'],
    group: 'server'
  }
];

export function findModule(id) {
  return MODULES.find(module => module.id === id);
}
