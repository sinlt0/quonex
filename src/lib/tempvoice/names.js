const MAX_NAME = 100;

function sanitizeName(input, allowInvites = false) {
  let text = String(input || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<@[!&]?\d+>|<#\d+>|@(everyone|here)/gi, '')
    .replace(/https?:\/\/\S+/gi, '');
  if (!allowInvites) text = text.replace(/(discord\.gg|discord(?:app)?\.com\/invite)\/?\S*/gi, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, MAX_NAME);
}

function renderName(template, member, counter, allowInvites) {
  const game = member.presence && member.presence.activities ? member.presence.activities.find(a => a.type === 0) : null;
  const filled = String(template)
    .replace(/\{username\}/gi, member.user.username)
    .replace(/\{display\}/gi, member.displayName)
    .replace(/\{tag\}/gi, member.user.tag)
    .replace(/\{count\}/gi, String(counter))
    .replace(/\{game\}/gi, game ? game.name : 'Chilling');
  const cleaned = sanitizeName(filled, allowInvites);
  return cleaned || sanitizeName(`${member.displayName}'s room`, allowInvites) || 'Voice room';
}

module.exports = { sanitizeName, renderName, MAX_NAME };
