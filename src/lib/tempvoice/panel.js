const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits: P } = require('discord.js');
const { v2Message, SEPARATOR } = require('../components');
const { em } = require('../emojis');

function button(id, label, emoji, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji.component());
}

function stateOf(channel) {
  const everyone = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  return {
    locked: Boolean(everyone && everyone.deny.has(P.Connect)),
    hidden: Boolean(everyone && everyone.deny.has(P.ViewChannel)),
    limit: channel.userLimit,
    bitrate: Math.round(channel.bitrate / 1000)
  };
}

function summaryLines(channel, ownerId) {
  const s = stateOf(channel);
  return [
    `${em.tvOwner} **Owner:** <@${ownerId}>`,
    `${s.locked ? em.tvLock : em.tvUnlock} ${s.locked ? 'Locked' : 'Open'} · ${s.hidden ? em.tvHide : em.tvShow} ${s.hidden ? 'Hidden' : 'Visible'}`,
    `${em.tvLimit} Limit: ${s.limit ? s.limit : 'none'} · ${em.tvBitrate} ${s.bitrate} kbps · ${em.tvUsers} ${channel.members.size} in room`
  ];
}

async function buildPanel(channel, { ownerId }) {
  const rows = [
    new ActionRowBuilder().addComponents(
      button('tv:rename', 'Rename', em.tvRename),
      button('tv:limit', 'Limit', em.tvLimit),
      button('tv:lock', 'Lock', em.tvLock),
      button('tv:hide', 'Hide', em.tvHide),
      button('tv:bitrate', 'Bitrate', em.tvBitrate)
    ),
    new ActionRowBuilder().addComponents(
      button('tv:pick:permit', 'Permit', em.tvPermit, ButtonStyle.Success),
      button('tv:pick:reject', 'Reject', em.tvReject, ButtonStyle.Danger),
      button('tv:pick:kick', 'Kick', em.tvKick, ButtonStyle.Danger),
      button('tv:pick:trust', 'Trust', em.tvTrust),
      button('tv:pick:block', 'Block', em.tvBlock, ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      button('tv:pick:transfer', 'Transfer', em.tvTransfer),
      button('tv:claim', 'Claim', em.tvClaim),
      button('tv:pick:unblock', 'Unblock', em.tvUnlock),
      button('tv:info', 'Info', em.tvInfo),
      button('tv:delete', 'Delete', em.tvDelete, ButtonStyle.Danger)
    )
  ];
  return v2Message([`### ${em.tvVoice} Room controls`, ...summaryLines(channel, ownerId), SEPARATOR, '-# Owner controls. Claim works once the owner has left.'], {
    footer: false,
    extraComponents: rows,
    allowedMentions: { parse: [] }
  });
}

module.exports = { buildPanel, summaryLines, stateOf };
