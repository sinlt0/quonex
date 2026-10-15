function xpNeededForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

function levelFromXp(totalXp) {
  let level = 0;
  let remaining = Math.max(0, totalXp || 0);

  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }

  return { level, xpIntoLevel: remaining, xpForNextLevel: xpNeededForLevel(level) };
}

module.exports = { xpNeededForLevel, levelFromXp };
