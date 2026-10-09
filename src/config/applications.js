const APPLICATION_MODAL_PAGE_SIZE = 5;

const APPLICATION_ERROR_MESSAGES = {
  'panel-missing': 'This application panel no longer exists.',
  'already-pending': 'You already have a pending application for this panel.',
  limit: 'This server has reached its limit for its current plan.',
  'not-reviewer': 'You do not have permission to review applications for this panel.',
  'already-reviewed': 'This application has already been reviewed.',
  'application-missing': 'That application no longer exists.',
  'question-missing': 'No question exists at that position.',
  'channel-missing': 'Provide a valid text channel.',
  'role-already-added': 'That role is already a reviewer role for this panel.',
  'role-not-found': 'That role is not a reviewer role for this panel.'
};

module.exports = { APPLICATION_MODAL_PAGE_SIZE, APPLICATION_ERROR_MESSAGES };
