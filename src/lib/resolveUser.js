async function resolveTargetUser(message, args) {
  const mentioned = message.mentions.users.first();
  if (mentioned) return mentioned;

  const rawId = args.find(arg => /^\d{17,20}$/.test(arg));
  if (!rawId) return null;

  try {
    return await message.client.users.fetch(rawId);
  } catch {
    return null;
  }
}

module.exports = { resolveTargetUser };
