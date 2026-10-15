function renderPlaceholders(template, context) {
  if (!template) return '';

  return template.replace(/\{([a-z_]+)\}/gi, (match, key) => {
    const value = context[key];
    return value === undefined || value === null ? match : String(value);
  });
}

function memberContext(member) {
  return {
    user: `<@${member.id}>`,
    user_name: member.user.username,
    user_tag: member.user.tag || member.user.username,
    user_id: member.id,
    server_name: member.guild.name,
    member_count: member.guild.memberCount
  };
}

function userContext(user, guild) {
  return {
    user: `<@${user.id}>`,
    user_name: user.username,
    user_tag: user.tag || user.username,
    user_id: user.id,
    server_name: guild.name,
    member_count: guild.memberCount
  };
}

module.exports = { renderPlaceholders, memberContext, userContext };
