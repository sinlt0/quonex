export const BLOCK_TYPES = ['text', 'separator', 'image', 'section', 'footer', 'buttons'];
export const BLOCK_LABELS = {
  text: 'Text',
  separator: 'Separator',
  image: 'Image gallery',
  section: 'Section (text + thumbnail)',
  footer: 'Footer (separator + small text)',
  buttons: 'Link buttons'
};
export const MAX_BLOCKS = 20;
export const MAX_BUTTONS_PER_BLOCK = 5;
export const MAX_IMAGES_PER_BLOCK = 10;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_FOOTER_LENGTH = 200;

export const DEFAULT_BLOCKS = {
  joinBlocks: [{ type: 'text', content: "Welcome {user} to **{server_name}**! You're member #{member_count}." }],
  joinDmBlocks: [{ type: 'text', content: 'Welcome to **{server_name}**, {user_name}!' }],
  leaveBlocks: [{ type: 'text', content: '**{user_tag}** left the server. We now have {member_count} members.' }],
  banBlocks: [{ type: 'text', content: '**{user_tag}** was banned from the server.' }],
  banDmBlocks: [{ type: 'text', content: 'You have been banned from **{server_name}**.' }]
};

export function defaultBlock(type) {
  switch (type) {
    case 'text':
      return { type: 'text', content: '' };
    case 'separator':
      return { type: 'separator', divider: true, spacing: 'small' };
    case 'image':
      return { type: 'image', urls: [''] };
    case 'section':
      return { type: 'section', content: '', thumbnail: '' };
    case 'footer':
      return { type: 'footer', content: '' };
    case 'buttons':
      return { type: 'buttons', buttons: [{ label: '', url: '' }] };
    default:
      return { type: 'text', content: '' };
  }
}

export function validateBlocksClient(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, message: 'Add at least one block before saving.' };
  }
  if (blocks.length > MAX_BLOCKS) {
    return { ok: false, message: `Too many blocks (max ${MAX_BLOCKS}).` };
  }

  for (const block of blocks) {
    if (!block || !BLOCK_TYPES.includes(block.type)) {
      return { ok: false, message: 'One of the blocks is invalid.' };
    }
    if (block.type === 'text' || block.type === 'section') {
      if (!block.content || !block.content.trim()) return { ok: false, message: 'A text block is empty.' };
      if (block.content.length > MAX_TEXT_LENGTH) return { ok: false, message: 'A text block is too long.' };
    } else if (block.type === 'footer') {
      if (block.content && block.content.length > MAX_FOOTER_LENGTH) return { ok: false, message: 'The footer text is too long.' };
    } else if (block.type === 'image') {
      if (!Array.isArray(block.urls) || block.urls.length === 0) {
        return { ok: false, message: 'An image block needs at least one image URL.' };
      }
      if (block.urls.length > MAX_IMAGES_PER_BLOCK) {
        return { ok: false, message: `An image block can hold at most ${MAX_IMAGES_PER_BLOCK} images.` };
      }
      for (const url of block.urls) {
        if (!url || !/^https?:\/\//.test(url)) return { ok: false, message: 'Every image needs a valid URL (or remove the empty one).' };
      }
    } else if (block.type === 'buttons') {
      if (!Array.isArray(block.buttons) || block.buttons.length === 0) {
        return { ok: false, message: 'A button block needs at least one button.' };
      }
      if (block.buttons.length > MAX_BUTTONS_PER_BLOCK) {
        return { ok: false, message: `A button row can hold at most ${MAX_BUTTONS_PER_BLOCK} buttons.` };
      }
      for (const button of block.buttons) {
        if (!button.label || !button.label.trim()) return { ok: false, message: 'A button is missing a label.' };
        if (!button.url || !/^https?:\/\//.test(button.url)) return { ok: false, message: 'A button needs a valid URL.' };
      }
    }
  }

  return { ok: true };
}
