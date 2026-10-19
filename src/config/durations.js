const DAY = 24 * 60 * 60 * 1000;

const PREMIUM_DURATIONS = [
  { id: '3d', label: '3 Days', ms: 3 * DAY },
  { id: '7d', label: '7 Days', ms: 7 * DAY },
  { id: '1w', label: '1 Week', ms: 7 * DAY },
  { id: '1mo', label: '1 Month', ms: 30 * DAY },
  { id: '1y', label: '1 Year', ms: 365 * DAY },
  { id: '2y', label: '2 Years', ms: 730 * DAY },
  { id: 'lifetime', label: 'Lifetime', ms: null }
];

module.exports = { PREMIUM_DURATIONS };
