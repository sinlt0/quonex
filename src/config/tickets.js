const TICKET_CHANNEL_PREFIX = 'ticket';

const MODAL_PAGE_SIZE = 5;

const TRANSCRIPT_FETCH_BATCHES = 5;

const ERROR_MESSAGES = {
  'panel-missing': 'This panel no longer exists.',
  'already-open': 'You already have an open ticket for this panel.',
  limit: 'This server has reached its limit for its current plan.',
  'channel-create-failed': 'I could not create the ticket channel. Check my permissions and category access.',
  'not-ticket-channel': 'This command must be used inside a ticket channel.',
  'not-staff': 'You do not have permission to manage this ticket.',
  'already-claimed': 'This ticket is already claimed.',
  'not-claimed': 'This ticket is not currently claimed.',
  closed: 'This ticket is already closed.',
  'invalid-name': 'Provide a valid channel name.',
  'category-missing': 'Provide a valid ticket category.',
  'target-missing': 'Mention a user or provide a valid user ID.',
  'role-already-added': 'That role is already a staff role for this panel.',
  'role-not-found': 'That role is not a staff role for this panel.',
  'last-role': 'A panel must keep at least one staff role.',
  'question-missing': 'No question exists at that position.',
  'category-already-added': 'That category is already assigned to this panel.',
  'category-not-found': 'That category is not assigned to this panel.',
  'last-category': 'A panel must keep at least one ticket category.',
  'no-category-room': 'Every ticket category on this panel is full (Discord caps a category at 50 channels). Add another category.'
};

module.exports = { TICKET_CHANNEL_PREFIX, MODAL_PAGE_SIZE, TRANSCRIPT_FETCH_BATCHES, ERROR_MESSAGES };
