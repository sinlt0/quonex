const UNITS = { m: 1, h: 60, d: 1440, w: 10080 };

function parseDuration(text) {
  if (!text) return null;
  const clean = String(text).trim().toLowerCase().replace(/\s+/g, '');
  const parts = clean.match(/(\d+)([mhdw])/g);
  if (!parts || parts.join('') !== clean) return null;
  let minutes = 0;
  for (const part of parts) {
    const match = part.match(/(\d+)([mhdw])/);
    minutes += Number(match[1]) * UNITS[match[2]];
  }
  return minutes > 0 ? minutes : null;
}

function formatDuration(minutes) {
  if (!minutes) return 'permanent';
  const weeks = Math.floor(minutes / 10080);
  const days = Math.floor((minutes % 10080) / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return [weeks && `${weeks}w`, days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(' ');
}

module.exports = { parseDuration, formatDuration };
