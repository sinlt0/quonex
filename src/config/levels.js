const LEVEL_ERROR_MESSAGES = {
  'invalid-role': "Provide a valid, assignable role (not managed by an integration, and below the bot's own top role).",
  'invalid-level': 'Level must be a whole number from 1 to 1000.',
  'duplicate-level': 'This server already has a role reward at that level.',
  'limit-reached': 'Role reward limit reached. Upgrade to premium for more.',
  'not-found': 'No role reward found at that level.',
  'invalid-range': 'Min XP must be 1 or higher and no greater than max XP.',
  'invalid-cooldown': 'Cooldown must be between 0 and 3600 seconds.',
  'limit-multipliers': 'Multiplier limit reached. Upgrade to premium for more.',
  'invalid-multiplier': 'Multiplier must be between 0.1 and 10.',
  'invalid-voice-xp': 'Voice XP per minute must be a whole number from 1 to 100.',
  'invalid-color': 'Use a hex color like #8b7cf6.',
  'message-too-long': 'That message is too long (max 500 characters).'
};

const PLACEHOLDER_GROUPS = [
  {
    label: 'Member',
    items: [
      { key: 'user', description: "The member's @mention" },
      { key: 'user_name', description: 'Username (without discriminator)' },
      { key: 'user_tag', description: 'Full username#tag or username' },
      { key: 'user_id', description: "The member's ID" },
      { key: 'level', description: 'The level just reached' },
      { key: 'rank', description: "The member's current leaderboard rank" }
    ]
  },
  {
    label: 'Server',
    items: [
      { key: 'server_name', description: 'The server name' },
      { key: 'member_count', description: 'Current member count' }
    ]
  }
];

const XP_MIN_DEFAULT = 15;
const XP_MAX_DEFAULT = 25;
const COOLDOWN_DEFAULT_SECONDS = 60;
const MAX_MESSAGE_LENGTH = 500;
const MAX_LEVEL_FOR_REWARDS = 1000;
const LEADERBOARD_PAGE_SIZE = 10;
const MULTIPLIER_MIN = 0.1;
const MULTIPLIER_MAX = 10;
const VOICE_XP_MAX = 100;

module.exports = {
  LEVEL_ERROR_MESSAGES,
  PLACEHOLDER_GROUPS,
  XP_MIN_DEFAULT,
  XP_MAX_DEFAULT,
  COOLDOWN_DEFAULT_SECONDS,
  MAX_MESSAGE_LENGTH,
  MAX_LEVEL_FOR_REWARDS,
  LEADERBOARD_PAGE_SIZE,
  MULTIPLIER_MIN,
  MULTIPLIER_MAX,
  VOICE_XP_MAX
};
