'use client';

import { useState } from 'react';
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  MAX_BLOCKS,
  MAX_BUTTONS_PER_BLOCK,
  MAX_IMAGES_PER_BLOCK,
  defaultBlock,
  validateBlocksClient
} from '../../../../lib/greetBlocks';
import { saveGreetBlocksAction } from './actions';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-violet-500';
const smallButtonClass =
  'rounded-lg border border-white/10 px-2 py-1 text-xs text-neutral-300 transition-colors duration-150 hover:bg-white/10 disabled:opacity-30';

export default function BlockEditor({ guildId, field, title, hint, initialBlocks }) {
  const [blocks, setBlocks] = useState(initialBlocks && initialBlocks.length ? initialBlocks : [defaultBlock('text')]);
  const [status, setStatus] = useState({ saving: false, error: null, savedAt: null });
  const [addType, setAddType] = useState('text');

  function updateBlock(index, patch) {
    setBlocks(prev => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function moveBlock(index, direction) {
    setBlocks(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeBlock(index) {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  }

  function addBlock() {
    if (blocks.length >= MAX_BLOCKS) return;
    setBlocks(prev => [...prev, defaultBlock(addType)]);
  }

  function updateButton(blockIndex, buttonIndex, patch) {
    setBlocks(prev =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;
        const buttons = block.buttons.map((button, bi) => (bi === buttonIndex ? { ...button, ...patch } : button));
        return { ...block, buttons };
      })
    );
  }

  function addButton(blockIndex) {
    setBlocks(prev =>
      prev.map((block, i) => {
        if (i !== blockIndex || block.buttons.length >= MAX_BUTTONS_PER_BLOCK) return block;
        return { ...block, buttons: [...block.buttons, { label: '', url: '' }] };
      })
    );
  }

  function removeButton(blockIndex, buttonIndex) {
    setBlocks(prev =>
      prev.map((block, i) => (i === blockIndex ? { ...block, buttons: block.buttons.filter((_, bi) => bi !== buttonIndex) } : block))
    );
  }

  function updateImageUrl(blockIndex, urlIndex, value) {
    setBlocks(prev =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;
        const urls = block.urls.map((url, ui) => (ui === urlIndex ? value : url));
        return { ...block, urls };
      })
    );
  }

  function addImageUrl(blockIndex) {
    setBlocks(prev =>
      prev.map((block, i) => {
        if (i !== blockIndex || block.urls.length >= MAX_IMAGES_PER_BLOCK) return block;
        return { ...block, urls: [...block.urls, ''] };
      })
    );
  }

  function removeImageUrl(blockIndex, urlIndex) {
    setBlocks(prev =>
      prev.map((block, i) => (i === blockIndex ? { ...block, urls: block.urls.filter((_, ui) => ui !== urlIndex) } : block))
    );
  }

  async function handleSave() {
    const validation = validateBlocksClient(blocks);
    if (!validation.ok) {
      setStatus({ saving: false, error: validation.message, savedAt: null });
      return;
    }

    setStatus({ saving: true, error: null, savedAt: null });
    const result = await saveGreetBlocksAction(guildId, field, blocks);
    if (result.ok) {
      setStatus({ saving: false, error: null, savedAt: Date.now() });
    } else {
      setStatus({ saving: false, error: result.error, savedAt: null });
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div key={index} className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-violet-300">{BLOCK_LABELS[block.type] || block.type}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className={smallButtonClass}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                  className={smallButtonClass}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(index)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 transition-colors duration-150 hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>
            </div>

            {block.type === 'text' && (
              <div>
                <textarea
                  value={block.content}
                  onChange={event => updateBlock(index, { content: event.target.value })}
                  rows={3}
                  placeholder="Text (supports {placeholders} and markdown)"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-neutral-500">{'{user}'} pings the member — they get a real notification, not just a mention.</p>
              </div>
            )}

            {block.type === 'section' && (
              <div className="space-y-2">
                <textarea
                  value={block.content}
                  onChange={event => updateBlock(index, { content: event.target.value })}
                  rows={3}
                  placeholder="Text (supports {placeholders} and markdown)"
                  className={inputClass}
                />
                <input
                  value={block.thumbnail || ''}
                  onChange={event => updateBlock(index, { thumbnail: event.target.value })}
                  placeholder="Thumbnail image URL"
                  className={inputClass}
                />
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-2">
                {block.urls.map((url, urlIndex) => (
                  <div key={urlIndex} className="flex gap-2">
                    <input
                      value={url}
                      onChange={event => updateImageUrl(index, urlIndex, event.target.value)}
                      placeholder="Direct image URL"
                      className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeImageUrl(index, urlIndex)}
                      disabled={block.urls.length <= 1}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 transition-colors duration-150 hover:bg-red-500/20 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addImageUrl(index)}
                  disabled={block.urls.length >= MAX_IMAGES_PER_BLOCK}
                  className={smallButtonClass}
                >
                  + Add image ({block.urls.length}/{MAX_IMAGES_PER_BLOCK})
                </button>
                <p className="text-xs text-neutral-500">One image shows full-width; two or more display as a gallery grid.</p>
              </div>
            )}

            {block.type === 'footer' && (
              <div>
                <textarea
                  value={block.content}
                  onChange={event => updateBlock(index, { content: event.target.value })}
                  rows={2}
                  placeholder="Small subtext shown below a divider, e.g. a custom credit line (supports {placeholders})"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-neutral-500">Renders as a divider followed by small text, like the bot's own footer.</p>
              </div>
            )}

            {block.type === 'separator' && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={block.divider !== false}
                    onChange={event => updateBlock(index, { divider: event.target.checked })}
                  />
                  Show divider line
                </label>
                <label className="flex items-center gap-1.5">
                  Spacing
                  <select
                    value={block.spacing || 'small'}
                    onChange={event => updateBlock(index, { spacing: event.target.value })}
                    className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1"
                  >
                    <option value="small">Small</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </div>
            )}

            {block.type === 'buttons' && (
              <div className="space-y-2">
                {block.buttons.map((button, buttonIndex) => (
                  <div key={buttonIndex} className="flex flex-wrap gap-2">
                    <input
                      value={button.label}
                      onChange={event => updateButton(index, buttonIndex, { label: event.target.value })}
                      placeholder="Button label"
                      className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-violet-500"
                    />
                    <input
                      value={button.url}
                      onChange={event => updateButton(index, buttonIndex, { url: event.target.value })}
                      placeholder="https://..."
                      className="min-w-[10rem] flex-[2] rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-violet-500"
                    />
                    <input
                      value={button.emoji || ''}
                      onChange={event => updateButton(index, buttonIndex, { emoji: event.target.value })}
                      placeholder="Emoji (optional)"
                      className="w-24 rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeButton(index, buttonIndex)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addButton(index)}
                  disabled={block.buttons.length >= MAX_BUTTONS_PER_BLOCK}
                  className={smallButtonClass}
                >
                  + Add button
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <select value={addType} onChange={event => setAddType(event.target.value)} className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-xs">
          {BLOCK_TYPES.map(type => (
            <option key={type} value={type}>
              {BLOCK_LABELS[type]}
            </option>
          ))}
        </select>
        <button type="button" onClick={addBlock} disabled={blocks.length >= MAX_BLOCKS} className={smallButtonClass}>
          + Add block
        </button>

        <div className="ml-auto flex items-center gap-2">
          {status.error && <span className="text-xs text-red-400">{status.error}</span>}
          {status.savedAt && !status.error && <span className="text-xs text-emerald-400">Saved.</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={status.saving}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 disabled:opacity-50 disabled:hover:scale-100"
          >
            {status.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
