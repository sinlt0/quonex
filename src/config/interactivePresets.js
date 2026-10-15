const PRESETS = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'A title and a divider. Build everything yourself.',
    blocks: [
      { type: 'text', content: '## Pick your roles\nUse the options below to choose what you want.' },
      { type: 'separator', divider: true, spacing: 'small' }
    ]
  },
  {
    id: 'buttons',
    label: 'Button roles',
    description: 'A row of three toggle buttons.',
    blocks: [
      { type: 'text', content: '## Choose your roles\nClick a button to get the role. Click again to remove it.' },
      { type: 'separator', divider: true, spacing: 'small' },
      {
        type: 'actions',
        buttons: [
          { id: 'btn001', label: 'Role one', style: 'primary', requiredRoleIds: [], blockedRoleIds: [], actions: [{ type: 'toggleRole', roleIds: [] }] },
          { id: 'btn002', label: 'Role two', style: 'success', requiredRoleIds: [], blockedRoleIds: [], actions: [{ type: 'toggleRole', roleIds: [] }] },
          { id: 'btn003', label: 'Role three', style: 'danger', requiredRoleIds: [], blockedRoleIds: [], actions: [{ type: 'toggleRole', roleIds: [] }] }
        ]
      }
    ]
  },
  {
    id: 'dropdown',
    label: 'Dropdown roles (pick several)',
    description: 'A menu where members can pick up to three roles at once.',
    blocks: [
      { type: 'text', content: '## Notifications\nPick the pings you want.' },
      { type: 'separator', divider: true, spacing: 'small' },
      {
        type: 'select',
        id: 'sel001',
        placeholder: 'Choose your notifications',
        minValues: 1,
        maxValues: 3,
        requiredRoleIds: [],
        blockedRoleIds: [],
        options: [
          { id: 'opt001', label: 'Announcements', description: '', emoji: '', actions: [{ type: 'toggleRole', roleIds: [] }] },
          { id: 'opt002', label: 'Events', description: '', emoji: '', actions: [{ type: 'toggleRole', roleIds: [] }] },
          { id: 'opt003', label: 'Giveaways', description: '', emoji: '', actions: [{ type: 'toggleRole', roleIds: [] }] }
        ]
      }
    ]
  },
  {
    id: 'exclusive',
    label: 'Pick one (exclusive)',
    description: 'Buttons where choosing one replaces the others.',
    blocks: [
      { type: 'text', content: '## Pick one\nChoosing a new option replaces your old one.' },
      { type: 'separator', divider: true, spacing: 'small' },
      {
        type: 'actions',
        buttons: [
          {
            id: 'btn001',
            label: 'Option A',
            style: 'primary',
            requiredRoleIds: [],
            blockedRoleIds: [],
            actions: [{ type: 'swapRole', roleIds: [], removeRoleIds: [] }, { type: 'reply', content: 'You picked Option A.' }]
          },
          {
            id: 'btn002',
            label: 'Option B',
            style: 'primary',
            requiredRoleIds: [],
            blockedRoleIds: [],
            actions: [{ type: 'swapRole', roleIds: [], removeRoleIds: [] }, { type: 'reply', content: 'You picked Option B.' }]
          }
        ]
      }
    ]
  },
  {
    id: 'verify',
    label: 'Verify button',
    description: 'One button that gives a member role and welcomes them.',
    blocks: [
      { type: 'text', content: '## Welcome to **{server_name}**\nPress the button below to verify and unlock the server.' },
      { type: 'separator', divider: true, spacing: 'small' },
      {
        type: 'actions',
        buttons: [
          {
            id: 'btn001',
            label: 'Verify',
            style: 'success',
            requiredRoleIds: [],
            blockedRoleIds: [],
            actions: [{ type: 'addRole', roleIds: [] }, { type: 'reply', content: 'Welcome in, {user}! You are verified.' }]
          }
        ]
      }
    ]
  }
];

function getPreset(id) {
  return PRESETS.find(preset => preset.id === id) || PRESETS[0];
}

module.exports = { PRESETS, getPreset };
