const COMMANDS_PER_PAGE = 5;

const HELP_HIDDEN_CATEGORIES = ['No-Prefix'];

const CATEGORY_DESCRIPTIONS = {
  Info: 'General bot information and utility commands.',
  Config: 'Server configuration such as the prefix.',
  Premium: 'Premium activation and management.',
  'No-Prefix': 'No-prefix command access management.',
  Tickets: 'Ticket panels and ticket management.',
  Applications: 'Application panels and reviewing submissions.'
};

module.exports = { COMMANDS_PER_PAGE, HELP_HIDDEN_CATEGORIES, CATEGORY_DESCRIPTIONS };
