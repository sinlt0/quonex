function coerceStored(entry, value) {
  switch (entry.type) {
    case 'bool':
      return typeof value === 'boolean' ? value : entry.default;
    case 'int':
    case 'float':
      return typeof value === 'number' && Number.isFinite(value) ? value : entry.default;
    case 'list':
    case 'rolelist':
    case 'userlist':
      return Array.isArray(value) ? value : entry.default;
    default:
      return typeof value === 'string' ? value : entry.default;
  }
}

function parseBool(raw) {
  const value = String(raw).trim().toLowerCase();
  if (['true', 'on', 'yes', 'y', '1', 'enable', 'enabled'].includes(value)) return true;
  if (['false', 'off', 'no', 'n', '0', 'disable', 'disabled'].includes(value)) return false;
  return null;
}

function extractId(raw) {
  const match = String(raw).match(/\d{15,25}/);
  return match ? match[0] : null;
}

function parseValue(entry, raw) {
  const text = String(raw).trim();

  switch (entry.type) {
    case 'bool': {
      const value = parseBool(text);
      return value === null ? { ok: false } : { ok: true, value };
    }
    case 'int': {
      if (!/^-?\d+$/.test(text)) return { ok: false };
      const value = Number.parseInt(text, 10);
      if ((entry.min !== undefined && value < entry.min) || (entry.max !== undefined && value > entry.max)) return { ok: false, range: true };
      return { ok: true, value };
    }
    case 'float': {
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value)) return { ok: false };
      if ((entry.min !== undefined && value < entry.min) || (entry.max !== undefined && value > entry.max)) return { ok: false, range: true };
      return { ok: true, value: Math.round(value * 100) / 100 };
    }
    case 'enum': {
      const value = (entry.options || []).find(option => option.toLowerCase() === text.toLowerCase());
      return value ? { ok: true, value } : { ok: false };
    }
    case 'string':
      return text.length <= 500 ? { ok: true, value: text } : { ok: false };
    case 'role':
    case 'channel': {
      if (!text || ['none', 'off', 'clear'].includes(text.toLowerCase())) return { ok: true, value: '' };
      const id = extractId(text);
      return id ? { ok: true, value: id } : { ok: false };
    }
    default:
      return { ok: false };
  }
}

function parseListItem(entry, raw) {
  const text = String(raw).trim();
  if (!text) return { ok: false };

  if (entry.type === 'rolelist' || entry.type === 'userlist') {
    const id = extractId(text);
    return id ? { ok: true, value: id } : { ok: false };
  }

  if (entry.options) {
    const value = entry.options.find(option => option.toLowerCase() === text.toLowerCase());
    return value ? { ok: true, value } : { ok: false };
  }

  if (entry.pattern && !new RegExp(entry.pattern, 'i').test(text)) return { ok: false };
  return text.length <= 100 ? { ok: true, value: entry.keepCase ? text : text.toLowerCase() } : { ok: false };
}


function validateChange(entry, raw) {
  if (['list', 'rolelist', 'userlist'].includes(entry.type)) {
    if (!Array.isArray(raw)) return { ok: false };
    const parsed = raw.map(item => parseListItem(entry, item));
    if (parsed.some(item => !item.ok)) return { ok: false };
    return { ok: true, value: [...new Set(parsed.map(item => item.value))].slice(0, 100) };
  }
  return parseValue(entry, String(raw));
}

module.exports = { validateChange, coerceStored, parseBool, extractId, parseValue, parseListItem };
