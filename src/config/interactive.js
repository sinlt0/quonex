const ACTION_TYPES = ['addRole', 'removeRole', 'toggleRole', 'swapRole', 'reply', 'sendMessage', 'dm', 'showMessage'];
const BUTTON_STYLES = ['primary', 'secondary', 'success', 'danger', 'link'];
const BLOCK_TYPES = ['text', 'section', 'image', 'separator', 'footer', 'buttons', 'actions', 'select'];

const MAX_BLOCKS = 20;
const MAX_INTERACTIVE_ROWS = 5;
const MAX_BUTTONS_PER_ROW = 5;
const MAX_SELECT_OPTIONS = 25;
const MAX_ACTIONS = 8;
const MAX_TEXT_LENGTH = 2000;
const MAX_LABEL_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 100;
const MAX_IMAGES_PER_BLOCK = 10;
const MAX_COMPONENTS = 40;
const MAX_SWAP_ROLES = 20;
const MAX_REQUIRED_ROLES = 10;
const MAX_NAME_LENGTH = 60;
const MAX_ROLES_PER_ACTION = 10;
const MAX_DURATION_MINUTES = 43200;
const MAX_COOLDOWN_SECONDS = 86400;
const MAX_REQUIRED_LEVEL = 1000;

const DANGEROUS_PERMISSIONS = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'BanMembers',
  'KickMembers',
  'ModerateMembers'
];

const INTERACTIVE_ERROR_MESSAGES = {
  'invalid-blocks': 'One of the blocks is incomplete or invalid.',
  'empty-blocks': 'Add at least one block before saving.',
  'too-many-blocks': `Too many blocks (max ${MAX_BLOCKS}).`,
  'too-many-rows': `A message can hold at most ${MAX_INTERACTIVE_ROWS} button rows or menus.`,
  'too-many-components': `Discord allows at most ${MAX_COMPONENTS} components in one message. Remove a few blocks or buttons.`,
  'too-many-buttons': `A button row can hold at most ${MAX_BUTTONS_PER_ROW} buttons.`,
  'too-many-options': `A menu can hold at most ${MAX_SELECT_OPTIONS} options.`,
  'too-many-actions': `Each button or option can run at most ${MAX_ACTIONS} actions.`,
  'too-many-images': `An image block can hold at most ${MAX_IMAGES_PER_BLOCK} images.`,
  'message-too-long': `That text is too long (max ${MAX_TEXT_LENGTH} characters).`,
  'invalid-action': 'One of the actions is incomplete or invalid.',
  'duplicate-id': 'Two components share the same ID. Reload the editor and try again.',
  'limit-reached': 'Interactive message limit reached. Upgrade to premium for more.',
  'not-found': 'That message no longer exists.',
  'channel-missing': 'Pick a valid text channel.',
  'unreachable': 'Saved, but the bot could not be reached to update the live message.',
  'not-published': 'Publish this message to a channel first.',
  'invalid-color': 'Use a hex color like #6f5de0.',
  'invalid-log-channel': 'Pick a valid log channel.',
  'edit-failed': 'Discord rejected the update to the live message.',
  'guild-missing': 'The bot is not in that server.',
  'missing-permission': "The bot can't send messages in that channel."
};

module.exports = {
  ACTION_TYPES,
  BUTTON_STYLES,
  BLOCK_TYPES,
  MAX_BLOCKS,
  MAX_INTERACTIVE_ROWS,
  MAX_BUTTONS_PER_ROW,
  MAX_SELECT_OPTIONS,
  MAX_ACTIONS,
  MAX_TEXT_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES_PER_BLOCK,
  MAX_COMPONENTS,
  MAX_SWAP_ROLES,
  MAX_REQUIRED_ROLES,
  MAX_NAME_LENGTH,
  MAX_ROLES_PER_ACTION,
  MAX_DURATION_MINUTES,
  MAX_COOLDOWN_SECONDS,
  MAX_REQUIRED_LEVEL,
  DANGEROUS_PERMISSIONS,
  INTERACTIVE_ERROR_MESSAGES
};
