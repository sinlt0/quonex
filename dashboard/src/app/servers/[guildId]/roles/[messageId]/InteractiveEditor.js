'use client';

import { useState } from 'react';
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  BUTTON_STYLES,
  MAX_BLOCKS,
  MAX_BUTTONS_PER_ROW,
  MAX_SELECT_OPTIONS,
  MAX_IMAGES_PER_BLOCK,
  MAX_COMPONENTS,
  MAX_INTERACTIVE_ROWS,
  defaultBlock,
  defaultButton,
  defaultOption,
  estimateComponents,
  interactiveRowCount
} from '../../../../../lib/interactiveClient';
import { saveInteractiveAction, publishInteractiveAction } from '../actions';
import ActionList, { RoleChips } from './ActionList';
import Preview from './Preview';
import Conditions from './Conditions';

const inputClass = 'dash-input w-full';
const smallButton = 'dash-btn disabled:opacity-30';

function Field({ label, children }) {
  return (
    <label className="block text-xs text-neutral-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ButtonEditor({ button, onChange, onRemove, canRemove, ctx }) {
  const [open, setOpen] = useState(false);
  const isLink = button.style === 'link';

  return (
    <div className="rounded-lg border border-[#1c2030] bg-[#0b0d13]">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left text-sm font-medium">
          {button.emoji ? `${button.emoji} ` : ''}
          {button.label || 'Untitled button'}
          <span className="ml-2 text-xs font-normal text-neutral-500">
            {isLink ? 'link' : `${(button.actions || []).length} action${(button.actions || []).length === 1 ? '' : 's'}`}
          </span>
        </button>
        <button type="button" onClick={() => setOpen(!open)} className={smallButton}>
          {open ? 'Close' : 'Edit'}
        </button>
        <button type="button" onClick={onRemove} disabled={!canRemove} className={`${smallButton} text-red-300`}>
          ×
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[#1c2030] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Label">
              <input value={button.label} maxLength={80} onChange={event => onChange({ label: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Emoji (optional)">
              <input value={button.emoji || ''} onChange={event => onChange({ emoji: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Color">
              <select value={button.style} onChange={event => onChange({ style: event.target.value })} className={inputClass}>
                {BUTTON_STYLES.map(style => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {isLink ? (
            <Field label="URL">
              <input value={button.url || ''} onChange={event => onChange({ url: event.target.value })} placeholder="https://..." className={inputClass} />
            </Field>
          ) : (
            <>
              <Conditions item={button} onChange={onChange} roles={ctx.roles} />
              <ActionList
                actions={button.actions || []}
                onChange={actions => onChange({ actions })}
                roles={ctx.roles}
                textChannels={ctx.textChannels}
                messages={ctx.messages}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OptionEditor({ option, onChange, onRemove, canRemove, ctx }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[#1c2030] bg-[#0b0d13]">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left text-sm font-medium">
          {option.emoji ? `${option.emoji} ` : ''}
          {option.label || 'Untitled option'}
          <span className="ml-2 text-xs font-normal text-neutral-500">
            {(option.actions || []).length} action{(option.actions || []).length === 1 ? '' : 's'}
          </span>
        </button>
        <button type="button" onClick={() => setOpen(!open)} className={smallButton}>
          {open ? 'Close' : 'Edit'}
        </button>
        <button type="button" onClick={onRemove} disabled={!canRemove} className={`${smallButton} text-red-300`}>
          ×
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[#1c2030] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Label">
              <input value={option.label} maxLength={80} onChange={event => onChange({ label: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Description (optional)">
              <input
                value={option.description || ''}
                maxLength={100}
                onChange={event => onChange({ description: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Emoji (optional)">
              <input value={option.emoji || ''} onChange={event => onChange({ emoji: event.target.value })} className={inputClass} />
            </Field>
          </div>
          <ActionList
            actions={option.actions || []}
            onChange={actions => onChange({ actions })}
            roles={ctx.roles}
            textChannels={ctx.textChannels}
            messages={ctx.messages}
          />
        </div>
      )}
    </div>
  );
}

export default function InteractiveEditor({ guildId, messageId, initialName, initialBlocks, initialAccent, initialLogChannelId, liveChannelId, textChannels, roles, messages }) {
  const [name, setName] = useState(initialName);
  const [blocks, setBlocks] = useState(initialBlocks.length ? initialBlocks : [defaultBlock('text')]);
  const [accent, setAccent] = useState(initialAccent);
  const [logChannelId, setLogChannelId] = useState(initialLogChannelId);
  const [addType, setAddType] = useState('text');
  const [status, setStatus] = useState({ saving: false, error: null, note: null });
  const [channelId, setChannelId] = useState(liveChannelId);
  const [live, setLive] = useState(liveChannelId);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState({ error: null, ok: false });

  const ctx = { roles, textChannels, messages };
  const components = estimateComponents(blocks);
  const rows = interactiveRowCount(blocks);

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

  function updateListItem(blockIndex, listKey, itemIndex, patch) {
    setBlocks(prev =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;
        return { ...block, [listKey]: block[listKey].map((item, ii) => (ii === itemIndex ? { ...item, ...patch } : item)) };
      })
    );
  }

  function addListItem(blockIndex, listKey, item) {
    setBlocks(prev => prev.map((block, i) => (i === blockIndex ? { ...block, [listKey]: [...block[listKey], item] } : block)));
  }

  function removeListItem(blockIndex, listKey, itemIndex) {
    setBlocks(prev =>
      prev.map((block, i) => (i === blockIndex ? { ...block, [listKey]: block[listKey].filter((_, ii) => ii !== itemIndex) } : block))
    );
  }

  function setImageUrl(blockIndex, urlIndex, value) {
    setBlocks(prev =>
      prev.map((block, i) => (i === blockIndex ? { ...block, urls: block.urls.map((url, ui) => (ui === urlIndex ? value : url)) } : block))
    );
  }

  async function handleSave() {
    setStatus({ saving: true, error: null, note: null });
    const result = await saveInteractiveAction(guildId, messageId, { name, blocks, accentColor: accent, logChannelId });
    if (!result.ok) {
      setStatus({ saving: false, error: result.error, note: null });
      return;
    }
    const note = result.warning ? result.warning : result.synced ? 'Saved and updated the live message.' : 'Saved.';
    setStatus({ saving: false, error: null, note });
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishStatus({ error: null, ok: false });
    const saved = await saveInteractiveAction(guildId, messageId, { name, blocks, accentColor: accent, logChannelId });
    if (!saved.ok) {
      setPublishing(false);
      setPublishStatus({ error: saved.error, ok: false });
      return;
    }
    const result = await publishInteractiveAction(guildId, messageId, channelId);
    setPublishing(false);
    if (result.ok) {
      setLive(channelId);
      setPublishStatus({ error: null, ok: true });
    } else {
      setPublishStatus({ error: result.error, ok: false });
    }
  }

  const liveName = textChannels.find(channel => channel.id === live)?.name;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="dash-card space-y-3 p-5">
          <Field label="Message name (used by /rolemenu send)">
            <input value={name} maxLength={60} onChange={event => setName(event.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Accent color (the stripe on the left, optional)">
              <div className="flex items-center gap-2">
                <input value={accent} onChange={event => setAccent(event.target.value)} placeholder="#6f5de0" maxLength={7} className={inputClass} />
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#6f5de0'}
                  onChange={event => setAccent(event.target.value)}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[#1c2030] bg-transparent"
                  aria-label="Pick accent color"
                />
              </div>
            </Field>
            <Field label="Log channel (posts who got or lost roles, optional)">
              <select value={logChannelId} onChange={event => setLogChannelId(event.target.value)} className={inputClass}>
                <option value="">No log</option>
                {textChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-neutral-500">
            {blocks.length}/{MAX_BLOCKS} blocks • {rows}/{MAX_INTERACTIVE_ROWS} button rows or menus • about {components}/{MAX_COMPONENTS} Discord components
          </p>
        </div>

        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={index} className="dash-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="dash-label">{BLOCK_LABELS[block.type]}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className={smallButton}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className={smallButton}>
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlocks(prev => prev.filter((_, i) => i !== index))}
                    className={`${smallButton} text-red-300`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {(block.type === 'text' || block.type === 'section') && (
                <div className="space-y-2">
                  <textarea
                    value={block.content}
                    onChange={event => updateBlock(index, { content: event.target.value })}
                    rows={3}
                    placeholder="Text. Markdown works, and so do role mentions like <@&roleId>."
                    className={inputClass}
                  />
                  {block.type === 'section' && (
                    <input
                      value={block.thumbnail || ''}
                      onChange={event => updateBlock(index, { thumbnail: event.target.value })}
                      placeholder="Thumbnail image URL"
                      className={inputClass}
                    />
                  )}
                </div>
              )}

              {block.type === 'footer' && (
                <textarea
                  value={block.content}
                  onChange={event => updateBlock(index, { content: event.target.value })}
                  rows={2}
                  placeholder="Small text shown below a divider"
                  className={inputClass}
                />
              )}

              {block.type === 'separator' && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={block.divider !== false} onChange={event => updateBlock(index, { divider: event.target.checked })} />
                    Show divider line
                  </label>
                  <label className="flex items-center gap-2">
                    Spacing
                    <select value={block.spacing || 'small'} onChange={event => updateBlock(index, { spacing: event.target.value })} className="dash-input">
                      <option value="small">Small</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
                </div>
              )}

              {block.type === 'image' && (
                <div className="space-y-2">
                  {block.urls.map((url, urlIndex) => (
                    <div key={urlIndex} className="flex gap-2">
                      <input value={url} onChange={event => setImageUrl(index, urlIndex, event.target.value)} placeholder="Direct image URL" className={inputClass} />
                      <button
                        type="button"
                        disabled={block.urls.length <= 1}
                        onClick={() => updateBlock(index, { urls: block.urls.filter((_, ui) => ui !== urlIndex) })}
                        className={`${smallButton} text-red-300`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={block.urls.length >= MAX_IMAGES_PER_BLOCK}
                    onClick={() => updateBlock(index, { urls: [...block.urls, ''] })}
                    className={smallButton}
                  >
                    + Add image ({block.urls.length}/{MAX_IMAGES_PER_BLOCK})
                  </button>
                </div>
              )}

              {block.type === 'buttons' && (
                <div className="space-y-2">
                  {block.buttons.map((button, buttonIndex) => (
                    <div key={buttonIndex} className="flex flex-wrap gap-2">
                      <input
                        value={button.label}
                        onChange={event => updateListItem(index, 'buttons', buttonIndex, { label: event.target.value })}
                        placeholder="Label"
                        className="dash-input min-w-[8rem] flex-1"
                      />
                      <input
                        value={button.url}
                        onChange={event => updateListItem(index, 'buttons', buttonIndex, { url: event.target.value })}
                        placeholder="https://..."
                        className="dash-input min-w-[10rem] flex-[2]"
                      />
                      <button type="button" onClick={() => removeListItem(index, 'buttons', buttonIndex)} className={`${smallButton} text-red-300`}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={block.buttons.length >= MAX_BUTTONS_PER_ROW}
                    onClick={() => addListItem(index, 'buttons', { label: '', url: '' })}
                    className={smallButton}
                  >
                    + Add link button
                  </button>
                </div>
              )}

              {block.type === 'actions' && (
                <div className="space-y-2">
                  {block.buttons.map((button, buttonIndex) => (
                    <ButtonEditor
                      key={button.id}
                      button={button}
                      ctx={ctx}
                      canRemove={block.buttons.length > 1}
                      onChange={patch => updateListItem(index, 'buttons', buttonIndex, patch)}
                      onRemove={() => removeListItem(index, 'buttons', buttonIndex)}
                    />
                  ))}
                  <button
                    type="button"
                    disabled={block.buttons.length >= MAX_BUTTONS_PER_ROW}
                    onClick={() => addListItem(index, 'buttons', defaultButton())}
                    className={smallButton}
                  >
                    + Add button ({block.buttons.length}/{MAX_BUTTONS_PER_ROW})
                  </button>
                </div>
              )}

              {block.type === 'select' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Placeholder">
                      <input
                        value={block.placeholder || ''}
                        maxLength={150}
                        onChange={event => updateBlock(index, { placeholder: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Min picks">
                        <input
                          type="number"
                          min={1}
                          max={block.options.length}
                          value={block.minValues || 1}
                          onChange={event => updateBlock(index, { minValues: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Max picks">
                        <input
                          type="number"
                          min={1}
                          max={block.options.length}
                          value={block.maxValues || (block.multi ? block.options.length : 1)}
                          onChange={event => updateBlock(index, { maxValues: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>
                  <Conditions item={block} onChange={patch => updateBlock(index, patch)} roles={roles} />
                  <div className="space-y-2">
                    {block.options.map((option, optionIndex) => (
                      <OptionEditor
                        key={option.id}
                        option={option}
                        ctx={ctx}
                        canRemove={block.options.length > 1}
                        onChange={patch => updateListItem(index, 'options', optionIndex, patch)}
                        onRemove={() => removeListItem(index, 'options', optionIndex)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={block.options.length >= MAX_SELECT_OPTIONS}
                    onClick={() => addListItem(index, 'options', defaultOption())}
                    className={smallButton}
                  >
                    + Add option ({block.options.length}/{MAX_SELECT_OPTIONS})
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="dash-card flex flex-wrap items-center gap-2 p-4">
          <select value={addType} onChange={event => setAddType(event.target.value)} className="dash-input">
            {BLOCK_TYPES.map(type => (
              <option key={type} value={type}>
                {BLOCK_LABELS[type]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={blocks.length >= MAX_BLOCKS}
            onClick={() => setBlocks(prev => [...prev, defaultBlock(addType)])}
            className="dash-btn"
          >
            + Add block
          </button>
          <div className="ml-auto flex items-center gap-3">
            {status.error && <span className="text-xs text-red-400">{status.error}</span>}
            {status.note && !status.error && <span className="text-xs text-emerald-400">{status.note}</span>}
            <button type="button" onClick={handleSave} disabled={status.saving} className="dash-btn dash-btn-primary">
              {status.saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="dash-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Publish</h2>
          <p className="text-sm text-neutral-400">
            {live ? `Live in #${liveName || live}. Saving updates it automatically.` : 'Not posted yet. Pick a channel and publish it.'}
          </p>
          <select value={channelId} onChange={event => setChannelId(event.target.value)} className={inputClass}>
            <option value="">Choose a channel...</option>
            {textChannels.map(channel => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handlePublish} disabled={publishing || !channelId} className="dash-btn dash-btn-primary w-full">
            {publishing ? 'Publishing...' : live && live === channelId ? 'Save and update' : live ? 'Move to this channel' : 'Publish'}
          </button>
          {publishStatus.error && <p className="text-xs text-red-400">{publishStatus.error}</p>}
          {publishStatus.ok && <p className="text-xs text-emerald-400">Posted.</p>}
        </div>

        <div className="space-y-2">
          <p className="dash-label">Preview</p>
          <Preview blocks={blocks} accent={accent} />
        </div>
      </aside>
    </div>
  );
}
