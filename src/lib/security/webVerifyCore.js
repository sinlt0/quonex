const crypto = require('crypto');

const ORDER = ['allow', 'flag', 'quarantine', 'block'];
const PRIVATE_IP = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

function hashValue(value) {
  const secret = process.env.VERIFY_HASH_SECRET || process.env.INTERNAL_API_SECRET || 'quonex';
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function cleanIp(raw) {
  if (!raw) return null;
  let ip = String(raw).split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip || null;
}

function isPrivateIp(ip) {
  return !ip || PRIVATE_IP.test(ip);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupIp(ip, { hostingCounts = true } = {}) {
  const provider = (process.env.IP_INTEL_PROVIDER || 'ip-api').toLowerCase();
  const key = process.env.IP_INTEL_KEY || '';
  const unknown = { ok: false, vpn: false, kind: null, country: null, provider };

  if (provider === 'none' || isPrivateIp(ip)) return unknown;

  if (provider === 'proxycheck') {
    const data = await fetchJson(`https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1${key ? `&key=${encodeURIComponent(key)}` : ''}`);
    const row = data && data.status === 'ok' ? data[ip] : null;
    if (!row) return unknown;
    const type = String(row.type || '').toLowerCase();
    const flagged = String(row.proxy).toLowerCase() === 'yes';
    const kind = !flagged ? null : type.includes('tor') ? 'tor' : type.includes('vpn') ? 'vpn' : 'proxy';
    return { ok: true, vpn: flagged, kind, country: row.isocode ? String(row.isocode).toLowerCase() : null, provider };
  }

  if (provider === 'vpnapi') {
    if (!key) return unknown;
    const data = await fetchJson(`https://vpnapi.io/api/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}`);
    if (!data || !data.security) return unknown;
    const { vpn, proxy, tor, relay } = data.security;
    const kind = tor ? 'tor' : vpn ? 'vpn' : proxy ? 'proxy' : relay ? 'relay' : null;
    return { ok: true, vpn: Boolean(kind), kind, country: data.location && data.location.country_code ? String(data.location.country_code).toLowerCase() : null, provider };
  }

  const base = key ? 'https://pro.ip-api.com/json' : 'http://ip-api.com/json';
  const data = await fetchJson(`${base}/${encodeURIComponent(ip)}?fields=status,countryCode,proxy,hosting${key ? `&key=${encodeURIComponent(key)}` : ''}`);
  if (!data || data.status !== 'success') return unknown;
  const hosting = hostingCounts && Boolean(data.hosting);
  const kind = data.proxy ? 'vpn' : hosting ? 'hosting' : null;
  return { ok: true, vpn: Boolean(kind), kind, country: data.countryCode ? String(data.countryCode).toLowerCase() : null, provider };
}

function stricter(a, b) {
  return ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a;
}

function decide(config, { intel, country, alts }) {
  const reasons = [];
  let outcome = 'allow';

  if (intel && intel.vpn && config.webVpnAction !== 'allow') {
    reasons.push({ type: 'vpn', action: config.webVpnAction, detail: intel.kind || 'vpn' });
    outcome = stricter(outcome, config.webVpnAction);
  }

  if (country && config.webCountryAction !== 'allow') {
    const blocked = config.webBlockedCountries.includes(country);
    const notAllowed = config.webAllowedCountries.length > 0 && !config.webAllowedCountries.includes(country);
    if (blocked || notAllowed) {
      reasons.push({ type: 'country', action: config.webCountryAction, detail: country.toUpperCase() });
      outcome = stricter(outcome, config.webCountryAction);
    }
  }

  if (alts.length && config.webAltAction !== 'allow') {
    reasons.push({ type: 'alt', action: config.webAltAction, alts: alts.map(item => ({ userId: item.userId, by: item.by })) });
    outcome = stricter(outcome, config.webAltAction);
  }

  return { outcome: outcome === 'allow' ? 'grant' : outcome, reasons };
}

module.exports = { hashValue, cleanIp, isPrivateIp, lookupIp, decide, ORDER };
