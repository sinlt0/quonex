import { isGuildPremium } from '../../../src/lib/permissions.js';
import { LIMITS } from '../../../src/config/limits.js';

export { isGuildPremium };

export async function limitFor(guildId, key) {
  const premium = await isGuildPremium(guildId);
  return premium ? LIMITS.premium[key] : LIMITS.free[key];
}
