const {
  ACTION_TYPES,
  BUTTON_STYLES,
  BLOCK_TYPES,
  MAX_BLOCKS,
  MAX_INTERACTIVE_ROWS,
  MAX_BUTTONS_PER_ROW,
  MAX_SELECT_OPTIONS,
  MAX_ACTIONS,
  MAX_TEXT_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES_PER_BLOCK,
  MAX_COMPONENTS,
  MAX_SWAP_ROLES,
  MAX_REQUIRED_ROLES,
  MAX_ROLES_PER_ACTION,
  MAX_DURATION_MINUTES,
  MAX_COOLDOWN_SECONDS,
  MAX_REQUIRED_LEVEL
} = require('../config/interactive');

const SNOWFLAKE = /^\d{15,25}$/;
const URL_PATTERN = /^https?:\/\//;

function countComponents(blocks) {
  let total = 1 + 2;
  for (const block of blocks || []) {
    switch (block.type) {
      case 'text':
      case 'separator':
        total += 1;
        break;
      case 'footer':
        total += 2;
        break;
      case 'section':
        total += block.thumbnail ? 3 : 1;
        break;
      case 'image':
        total += 1 + (Array.isArray(block.urls) ? block.urls.length : 1);
        break;
      case 'buttons':
      case 'actions':
        total += 1 + (Array.isArray(block.buttons) ? block.buttons.length : 0);
        break;
      case 'select':
        total += 2;
        break;
      default:
        break;
    }
  }
  return total;
}

function rolesOf(action) {
  if (Array.isArray(action.roleIds)) return action.roleIds;
  return action.roleId ? [action.roleId] : [];
}

function validRoleList(ids, max) {
  return Array.isArray(ids) && ids.length >= 1 && ids.length <= max && ids.every(id => SNOWFLAKE.test(id));
}

function validDuration(value) {
  if (value === undefined || value === null || value === '' || value === 0) return true;
  return Number.isInteger(value) && value >= 1 && value <= MAX_DURATION_MINUTES;
}

function validateAction(action) {
  if (!action || typeof action !== 'object' || !ACTION_TYPES.includes(action.type)) return false;

  switch (action.type) {
    case 'removeRole':
      return validRoleList(rolesOf(action), MAX_ROLES_PER_ACTION);
    case 'addRole':
    case 'toggleRole':
      return validRoleList(rolesOf(action), MAX_ROLES_PER_ACTION) && validDuration(action.durationMinutes);
    case 'swapRole':
      if (!validRoleList(rolesOf(action), MAX_ROLES_PER_ACTION) || !validDuration(action.durationMinutes)) return false;
      if (action.removeRoleIds === undefined) return true;
      return (
        Array.isArray(action.removeRoleIds) &&
        action.removeRoleIds.length <= MAX_SWAP_ROLES &&
        action.removeRoleIds.every(id => SNOWFLAKE.test(id))
      );
    case 'reply':
    case 'dm':
      return typeof action.content === 'string' && action.content.trim().length > 0 && action.content.length <= MAX_TEXT_LENGTH;
    case 'sendMessage':
      return (
        (!action.channelId || SNOWFLAKE.test(action.channelId)) &&
        typeof action.content === 'string' &&
        action.content.trim().length > 0 &&
        action.content.length <= MAX_TEXT_LENGTH
      );
    case 'showMessage':
      return typeof action.messageId === 'string' && action.messageId.length > 0 && action.messageId.length <= 40;
    default:
      return false;
  }
}

function validateActions(actions) {
  if (!Array.isArray(actions)) return { ok: false, error: 'invalid-action' };
  if (actions.length > MAX_ACTIONS) return { ok: false, error: 'too-many-actions' };
  for (const action of actions) {
    if (!validateAction(action)) return { ok: false, error: 'invalid-action' };
  }
  return { ok: true };
}

function validateRequiredRoles(ids) {
  if (ids === undefined) return true;
  return Array.isArray(ids) && ids.length <= MAX_REQUIRED_ROLES && ids.every(id => SNOWFLAKE.test(id));
}

function validateConditions(item) {
  if (!validateRequiredRoles(item.requiredRoleIds) || !validateRequiredRoles(item.blockedRoleIds)) return false;
  const cooldown = item.cooldownSeconds;
  if (cooldown !== undefined && cooldown !== '' && !(Number.isInteger(cooldown) && cooldown >= 0 && cooldown <= MAX_COOLDOWN_SECONDS)) return false;
  const level = item.requiredLevel;
  if (level !== undefined && level !== '' && !(Number.isInteger(level) && level >= 0 && level <= MAX_REQUIRED_LEVEL)) return false;
  return true;
}

function validateInteractiveBlocks(blocks) {
  if (!Array.isArray(blocks)) return { ok: false, error: 'invalid-blocks' };
  if (blocks.length === 0) return { ok: false, error: 'empty-blocks' };
  if (blocks.length > MAX_BLOCKS) return { ok: false, error: 'too-many-blocks' };

  const ids = new Set();
  let rows = 0;

  for (const block of blocks) {
    if (!block || typeof block !== 'object' || !BLOCK_TYPES.includes(block.type)) return { ok: false, error: 'invalid-blocks' };

    if (block.type === 'text' || block.type === 'section') {
      if (typeof block.content !== 'string' || !block.content.trim()) return { ok: false, error: 'invalid-blocks' };
      if (block.content.length > MAX_TEXT_LENGTH) return { ok: false, error: 'message-too-long' };
      if (block.thumbnail && !URL_PATTERN.test(block.thumbnail)) return { ok: false, error: 'invalid-blocks' };
    } else if (block.type === 'footer') {
      if (block.content !== undefined && typeof block.content !== 'string') return { ok: false, error: 'invalid-blocks' };
      if (block.content && block.content.length > 200) return { ok: false, error: 'message-too-long' };
    } else if (block.type === 'image') {
      if (!Array.isArray(block.urls) || block.urls.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (block.urls.length > MAX_IMAGES_PER_BLOCK) return { ok: false, error: 'too-many-images' };
      if (!block.urls.every(url => typeof url === 'string' && URL_PATTERN.test(url))) return { ok: false, error: 'invalid-blocks' };
    } else if (block.type === 'buttons') {
      rows += 1;
      if (!Array.isArray(block.buttons) || block.buttons.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (block.buttons.length > MAX_BUTTONS_PER_ROW) return { ok: false, error: 'too-many-buttons' };
      for (const button of block.buttons) {
        if (!button || typeof button.label !== 'string' || !button.label.trim()) return { ok: false, error: 'invalid-blocks' };
        if (typeof button.url !== 'string' || !URL_PATTERN.test(button.url)) return { ok: false, error: 'invalid-blocks' };
      }
    } else if (block.type === 'actions') {
      rows += 1;
      if (!Array.isArray(block.buttons) || block.buttons.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (block.buttons.length > MAX_BUTTONS_PER_ROW) return { ok: false, error: 'too-many-buttons' };
      for (const button of block.buttons) {
        if (!button || typeof button.id !== 'string' || !/^[a-z0-9]{3,12}$/.test(button.id)) return { ok: false, error: 'invalid-blocks' };
        if (ids.has(button.id)) return { ok: false, error: 'duplicate-id' };
        ids.add(button.id);
        if (typeof button.label !== 'string' || !button.label.trim() || button.label.length > MAX_LABEL_LENGTH) {
          return { ok: false, error: 'invalid-blocks' };
        }
        if (!BUTTON_STYLES.includes(button.style || 'secondary')) return { ok: false, error: 'invalid-blocks' };
        if (button.style === 'link') {
          if (typeof button.url !== 'string' || !URL_PATTERN.test(button.url)) return { ok: false, error: 'invalid-blocks' };
        } else {
          const result = validateActions(button.actions || []);
          if (!result.ok) return result;
          if (!validateConditions(button)) return { ok: false, error: 'invalid-action' };
        }
      }
    } else if (block.type === 'select') {
      rows += 1;
      if (typeof block.id !== 'string' || !/^[a-z0-9]{3,12}$/.test(block.id)) return { ok: false, error: 'invalid-blocks' };
      if (ids.has(block.id)) return { ok: false, error: 'duplicate-id' };
      ids.add(block.id);
      if (!Array.isArray(block.options) || block.options.length === 0) return { ok: false, error: 'invalid-blocks' };
      if (block.options.length > MAX_SELECT_OPTIONS) return { ok: false, error: 'too-many-options' };
      if (block.placeholder !== undefined && (typeof block.placeholder !== 'string' || block.placeholder.length > 150)) {
        return { ok: false, error: 'invalid-blocks' };
      }
      if (!validateConditions(block)) return { ok: false, error: 'invalid-action' };
      const optionIds = new Set();
      for (const option of block.options) {
        if (!option || typeof option.id !== 'string' || !/^[a-z0-9]{3,12}$/.test(option.id) || optionIds.has(option.id)) {
          return { ok: false, error: 'invalid-blocks' };
        }
        optionIds.add(option.id);
        if (typeof option.label !== 'string' || !option.label.trim() || option.label.length > MAX_LABEL_LENGTH) {
          return { ok: false, error: 'invalid-blocks' };
        }
        if (option.description && option.description.length > MAX_DESCRIPTION_LENGTH) return { ok: false, error: 'invalid-blocks' };
        const result = validateActions(option.actions || []);
        if (!result.ok) return result;
      }
    }
  }

  if (rows > MAX_INTERACTIVE_ROWS) return { ok: false, error: 'too-many-rows' };
  if (countComponents(blocks) > MAX_COMPONENTS) return { ok: false, error: 'too-many-components' };

  return { ok: true };
}

function cleanActions(actions) {
  return (actions || []).map(action => {
    const clean = { type: action.type };
    if (['addRole', 'removeRole', 'toggleRole', 'swapRole'].includes(action.type)) clean.roleIds = [...new Set(rolesOf(action))];
    if (action.type === 'swapRole') clean.removeRoleIds = Array.isArray(action.removeRoleIds) ? action.removeRoleIds : [];
    if (['addRole', 'toggleRole', 'swapRole'].includes(action.type) && action.durationMinutes) clean.durationMinutes = action.durationMinutes;
    if (action.content !== undefined) clean.content = action.content;
    if (action.type === 'sendMessage') clean.channelId = action.channelId || '';
    if (action.type === 'showMessage') clean.messageId = action.messageId;
    return clean;
  });
}

function cleanConditions(item) {
  return {
    requiredRoleIds: item.requiredRoleIds || [],
    blockedRoleIds: item.blockedRoleIds || [],
    cooldownSeconds: Number.isInteger(item.cooldownSeconds) ? item.cooldownSeconds : 0,
    requiredLevel: Number.isInteger(item.requiredLevel) ? item.requiredLevel : 0
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeInteractiveBlocks(blocks) {
  return blocks.map(block => {
    if (block.type === 'actions') {
      return {
        type: 'actions',
        buttons: block.buttons.map(button => {
          const clean = {
            id: button.id,
            label: button.label.trim(),
            style: button.style || 'secondary'
          };
          if (button.emoji) clean.emoji = button.emoji.trim();
          if (clean.style === 'link') {
            clean.url = button.url;
          } else {
            clean.actions = cleanActions(button.actions);
            Object.assign(clean, cleanConditions(button));
          }
          return clean;
        })
      };
    }

    if (block.type === 'select') {
      const count = block.options.length;
      const minValues = clamp(Number.isInteger(block.minValues) ? block.minValues : 1, 1, count);
      const fallbackMax = block.multi ? count : 1;
      const maxValues = clamp(Number.isInteger(block.maxValues) ? block.maxValues : fallbackMax, minValues, count);
      return {
        type: 'select',
        id: block.id,
        placeholder: block.placeholder || '',
        minValues,
        maxValues,
        ...cleanConditions(block),
        options: block.options.map(option => ({
          id: option.id,
          label: option.label.trim(),
          description: option.description || '',
          emoji: option.emoji ? option.emoji.trim() : '',
          actions: cleanActions(option.actions)
        }))
      };
    }

    return block;
  });
}

module.exports = { validateInteractiveBlocks, sanitizeInteractiveBlocks, countComponents, validateActions, rolesOf };
