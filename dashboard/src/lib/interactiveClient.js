export const BLOCK_TYPES = ['text', 'section', 'image', 'separator', 'footer', 'buttons', 'actions', 'select'];

export const BLOCK_LABELS = {
  text: 'Text',
  section: 'Section (text + thumbnail)',
  image: 'Image gallery',
  separator: 'Separator',
  footer: 'Footer (separator + small text)',
  buttons: 'Link buttons',
  actions: 'Action buttons',
  select: 'Select menu'
};

export const ACTION_TYPES = ['addRole', 'removeRole', 'toggleRole', 'swapRole', 'reply', 'sendMessage', 'dm', 'showMessage'];

export const ACTION_LABELS = {
  addRole: 'Give roles',
  removeRole: 'Remove roles',
  toggleRole: 'Toggle roles (give, or take if they have it)',
  swapRole: 'Set roles (give some, remove others)',
  reply: 'Reply privately (only they see it)',
  sendMessage: 'Send a message to a channel',
  dm: 'Send a direct message',
  showMessage: 'Show another message (private)'
};

export const PRESETS = [
  { id: 'blank', label: 'Blank', description: 'a title and a divider' },
  { id: 'buttons', label: 'Button roles', description: 'three toggle buttons' },
  { id: 'dropdown', label: 'Dropdown roles', description: 'a menu, pick up to three' },
  { id: 'exclusive', label: 'Pick one', description: 'choosing one replaces the others' },
  { id: 'verify', label: 'Verify button', description: 'one button gives a role' }
];

export const BUTTON_STYLES = [
  { value: 'primary', label: 'Blurple' },
  { value: 'secondary', label: 'Grey' },
  { value: 'success', label: 'Green' },
  { value: 'danger', label: 'Red' },
  { value: 'link', label: 'Link (opens a URL)' }
];

export const MAX_BLOCKS = 20;
export const MAX_INTERACTIVE_ROWS = 5;
export const MAX_BUTTONS_PER_ROW = 5;
export const MAX_SELECT_OPTIONS = 25;
export const MAX_ACTIONS = 8;
export const MAX_IMAGES_PER_BLOCK = 10;
export const MAX_COMPONENTS = 40;
export const MAX_ROLES_PER_ACTION = 10;
export const MAX_DURATION_MINUTES = 43200;

export function newId() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, 'x');
}

export function defaultAction(type) {
  switch (type) {
    case 'swapRole':
      return { type, roleIds: [], removeRoleIds: [] };
    case 'reply':
    case 'dm':
      return { type, content: '' };
    case 'sendMessage':
      return { type, channelId: '', content: '' };
    case 'showMessage':
      return { type, messageId: '' };
    default:
      return { type, roleIds: [] };
  }
}

export function defaultButton() {
  return { id: newId(), label: 'Button', emoji: '', style: 'secondary', requiredRoleIds: [], blockedRoleIds: [], cooldownSeconds: 0, requiredLevel: 0, actions: [{ type: 'toggleRole', roleIds: [] }] };
}

export function defaultOption() {
  return { id: newId(), label: 'Option', description: '', emoji: '', actions: [{ type: 'toggleRole', roleIds: [] }] };
}

export function defaultBlock(type) {
  switch (type) {
    case 'text':
      return { type, content: '' };
    case 'section':
      return { type, content: '', thumbnail: '' };
    case 'image':
      return { type, urls: [''] };
    case 'separator':
      return { type, divider: true, spacing: 'small' };
    case 'footer':
      return { type, content: '' };
    case 'buttons':
      return { type, buttons: [{ label: '', url: '' }] };
    case 'actions':
      return { type, buttons: [defaultButton()] };
    case 'select':
      return { type, id: newId(), placeholder: 'Choose an option', minValues: 1, maxValues: 1, requiredRoleIds: [], blockedRoleIds: [], cooldownSeconds: 0, requiredLevel: 0, options: [defaultOption()] };
    default:
      return { type: 'text', content: '' };
  }
}

export function estimateComponents(blocks) {
  let total = 3;
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'separator') total += 1;
    else if (block.type === 'footer') total += 2;
    else if (block.type === 'section') total += block.thumbnail ? 3 : 1;
    else if (block.type === 'image') total += 1 + block.urls.length;
    else if (block.type === 'buttons' || block.type === 'actions') total += 1 + block.buttons.length;
    else if (block.type === 'select') total += 2;
  }
  return total;
}

export function interactiveRowCount(blocks) {
  return blocks.filter(block => block.type === 'buttons' || block.type === 'actions' || block.type === 'select').length;
}
