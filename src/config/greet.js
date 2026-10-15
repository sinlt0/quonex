const GREET_ERROR_MESSAGES = {
  'not-configured': 'Set a channel for this message first.',
  'channel-missing': 'Provide a valid text channel.',
  'message-too-long': 'That message is too long (max 1000 characters).',
  'premium-required': 'Custom card backgrounds are a premium feature. Use /premiumclaim or ask a bot dev for a key.',
  'card-fetch-failed': 'Could not load that image. Make sure the URL points directly to an image file.',
  'no-test-target': 'Could not find a member to preview this with.',
  'empty-blocks': 'Add at least one block before saving.',
  'too-many-blocks': 'Too many blocks (max 20).',
  'too-many-buttons': 'A button row can hold at most 5 buttons.',
  'too-many-images': 'An image block can hold at most 10 images.',
  'invalid-blocks': 'One of the blocks is incomplete or invalid.'
};

const BLOCK_TYPES = ['text', 'separator', 'image', 'section', 'footer', 'buttons'];
const MAX_BLOCKS = 20;
const MAX_BUTTONS_PER_BLOCK = 5;
const MAX_IMAGES_PER_BLOCK = 10;

const PLACEHOLDER_GROUPS = [
  {
    label: 'Member',
    items: [
      { key: 'user', description: "The new/leaving/banned member's @mention" },
      { key: 'user_name', description: 'Username (without discriminator)' },
      { key: 'user_tag', description: 'Full username#tag or username' },
      { key: 'user_id', description: "The member's ID" }
    ]
  },
  {
    label: 'Server',
    items: [
      { key: 'server_name', description: 'The server name' },
      { key: 'member_count', description: 'Current member count after this event' }
    ]
  },
  {
    label: 'Ban only',
    items: [
      { key: 'reason', description: 'The ban reason from the audit log, or "No reason provided"' },
      { key: 'moderator', description: 'The moderator who issued the ban, from the audit log' }
    ]
  }
];

const MAX_MESSAGE_LENGTH = 1000;

module.exports = {
  GREET_ERROR_MESSAGES,
  PLACEHOLDER_GROUPS,
  MAX_MESSAGE_LENGTH,
  BLOCK_TYPES,
  MAX_BLOCKS,
  MAX_BUTTONS_PER_BLOCK,
  MAX_IMAGES_PER_BLOCK
};
