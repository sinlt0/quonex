'use server';

import { headers } from 'next/headers';
import { auth } from '../../../auth';
import { prisma } from '../../../lib/db';
import { notifySecurityAction } from '../../../lib/botApi';
import { loadSecurityConfig } from '../../../lib/securityServer';
import { hashValue, cleanIp, lookupIp, decide } from '../../../../../src/lib/security/webVerifyCore.js';

const DAY = 24 * 60 * 60 * 1000;

const MESSAGES = {
  grant: { ok: true, title: 'You are verified', text: 'Head back to Discord. Your access is unlocked.' },
  flag: { ok: true, title: 'You are verified', text: 'Head back to Discord. Your access is unlocked.' },
  quarantine: { ok: false, title: 'Verification needs a review', text: 'Your account was held for review by the moderators. Please contact them in the server.' },
  block: { ok: false, title: 'Could not verify', text: 'Verification was denied for this connection.' }
};

function clientIp(list) {
  return cleanIp(list.get('cf-connecting-ip') || list.get('x-forwarded-for') || list.get('x-real-ip'));
}

export async function completeWebVerificationAction(token, fingerprint) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, title: 'Sign in first', text: 'Sign in with Discord to continue.' };

  const row = token ? await prisma.webVerifySession.findUnique({ where: { token: String(token) } }) : null;
  if (!row || row.userId !== session.user.id || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false, title: 'This link does not work', text: 'It may have expired, been used, or belong to another account. Press the verify button in Discord again to get a new one.' };
  }

  const config = (await loadSecurityConfig(row.guildId)).verification;
  if (!config.enabled || config.mode !== 'web') {
    return { ok: false, title: 'Web verification is off', text: 'This server is not using web verification right now.' };
  }
  if (row.attempts >= config.webMaxAttempts) {
    return { ok: false, title: 'Too many tries', text: 'Press the verify button in Discord to get a fresh link.' };
  }
  await prisma.webVerifySession.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });

  const ip = clientIp(await headers());
  const intel = await lookupIp(ip, { hostingCounts: config.webHostingCounts });
  const fp = typeof fingerprint === 'string' && /^[a-f0-9]{16,128}$/i.test(fingerprint) ? fingerprint.toLowerCase() : null;
  const ipHash = ip && !intel.vpn ? hashValue(`ip:${ip}`) : '';
  const fpHash = fp ? hashValue(`fp:${fp}`) : null;

  const since = new Date(Date.now() - config.webRetentionDays * DAY);
  const or = [];
  if (config.webAltMatchIp && ipHash) or.push({ ipHash });
  if (config.webAltMatchFingerprint && fpHash) or.push({ fpHash });
  const matches = or.length
    ? await prisma.verifiedIdentity.findMany({ where: { guildId: row.guildId, userId: { not: row.userId }, updatedAt: { gte: since }, OR: or }, take: 10 })
    : [];
  const alts = matches.map(item => ({ userId: item.userId, by: ipHash && item.ipHash === ipHash ? (fpHash && item.fpHash === fpHash ? 'ip+device' : 'ip') : 'device' }));

  const result = decide(config, { intel, country: intel.country, alts });
  const response = await notifySecurityAction({
    guildId: row.guildId,
    action: 'web-verify',
    userId: row.userId,
    outcome: result.outcome,
    reasons: result.reasons,
    country: intel.country
  });

  if (!response.ok) {
    const code = response.data?.error;
    if (code === 'member-missing') return { ok: false, title: 'You are not in the server', text: 'Join the server first, then verify.' };
    return { ok: false, title: 'Try again in a moment', text: 'The bot did not respond. Your link is still valid.' };
  }

  const final = response.data?.final || result.outcome;
  if (final !== 'block') {
    await prisma.webVerifySession.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await prisma.verifiedIdentity.upsert({
      where: { guildId_userId: { guildId: row.guildId, userId: row.userId } },
      update: { ipHash, fpHash, vpn: Boolean(intel.vpn), vpnKind: intel.kind, country: intel.country, verdict: final },
      create: { guildId: row.guildId, userId: row.userId, ipHash, fpHash, vpn: Boolean(intel.vpn), vpnKind: intel.kind, country: intel.country, verdict: final }
    });
  }

  const message = { ...MESSAGES[final] };
  if (final === 'block' && result.reasons.some(item => item.type === 'vpn')) {
    message.text = 'A VPN, proxy or hosting connection was detected. Turn it off and try again.';
  } else if (final === 'block' && result.reasons.some(item => item.type === 'country')) {
    message.text = 'Verification is not available from your location.';
  }
  return message;
}
