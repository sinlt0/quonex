const SESSION_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();

function sessionKey(userId, panelId) {
  return `${userId}:${panelId}`;
}

function startSession(userId, panelId) {
  clearSession(userId, panelId);
  const key = sessionKey(userId, panelId);
  const timeout = setTimeout(() => sessions.delete(key), SESSION_TTL_MS);
  sessions.set(key, { answers: [], timeout });
}

function recordAnswers(userId, panelId, entries) {
  const key = sessionKey(userId, panelId);
  const session = sessions.get(key);
  if (!session) return false;

  for (const entry of entries) {
    session.answers[entry.index] = { question: entry.question, answer: entry.answer };
  }

  return true;
}

function getAnswers(userId, panelId) {
  const session = sessions.get(sessionKey(userId, panelId));
  return session ? session.answers.filter(Boolean) : [];
}

function clearSession(userId, panelId) {
  const key = sessionKey(userId, panelId);
  const existing = sessions.get(key);
  if (existing) clearTimeout(existing.timeout);
  sessions.delete(key);
}

module.exports = { startSession, recordAnswers, getAnswers, clearSession };
