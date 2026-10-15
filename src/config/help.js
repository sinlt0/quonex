const COMMANDS_PER_PAGE = 5;

const HELP_HIDDEN_CATEGORIES = ['No-Prefix'];

const CATEGORY_DESCRIPTIONS = {
  Info: 'General bot information and utility commands.',
  Config: 'Server configuration such as the prefix.',
  Premium: 'Premium activation and management.',
  'No-Prefix': 'No-prefix command access management.',
  Tickets: 'Ticket panels and ticket management.',
  Applications: 'Application panels and reviewing submissions.',
  Utility: 'Small quality-of-life commands.',
  Levels: 'XP, ranks, and the server leaderboard.',
  Roles: 'Button, menu and reaction role messages.'
};

module.exports = { COMMANDS_PER_PAGE, HELP_HIDDEN_CATEGORIES, CATEGORY_DESCRIPTIONS };
