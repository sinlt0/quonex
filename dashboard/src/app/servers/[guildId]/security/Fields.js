'use client';

import { useState } from 'react';
import SettingRow from '../../../../components/dash/SettingRow';

const inputClass = 'dash-input';

export function LocalToggle({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="dash-switch" />;
}

function Chips({ items, render, onRemove }) {
  if (!items.length) return <p className="text-xs text-neutral-500">None yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <span key={item} className="inline-flex items-center gap-2 rounded-full bg-[#171b2a] px-3 py-1 text-xs text-neutral-200">
          {render(item)}
          <button type="button" onClick={() => onRemove(item)} aria-label="Remove" className="text-neutral-400 hover:text-white">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function TextListControl({ entry, value, onChange }) {
  const [draft, setDraft] = useState('');

  function add() {
    const text = draft.trim();
    if (!text) return;
    const next = entry.keepCase ? text : text.toLowerCase();
    if (!value.includes(next)) onChange([...value, next]);
    setDraft('');
  }

  return (
    <div className="w-full space-y-2 sm:w-96">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Type and press Enter"
          maxLength={100}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="button" onClick={add} className="dash-btn">
          Add
        </button>
      </div>
      <Chips items={value} render={item => <code>{item}</code>} onRemove={item => onChange(value.filter(entryItem => entryItem !== item))} />
    </div>
  );
}

function OptionListControl({ entry, value, onChange }) {
  return (
    <div className="flex max-w-xl flex-wrap gap-2">
      {entry.options.map(option => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(on ? value.filter(item => item !== option) : [...value, option])}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-[#8b7cf6] bg-[#8b7cf6]/15 text-white' : 'border-[#1c2030] text-neutral-400 hover:text-white'}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function RoleListControl({ value, onChange, roles }) {
  const available = roles.filter(role => !value.includes(role.id));
  const name = id => roles.find(role => role.id === id)?.name || id;
  return (
    <div className="w-full space-y-2 sm:w-96">
      <select value="" onChange={event => event.target.value && onChange([...value, event.target.value])} className={`${inputClass} w-full`}>
        <option value="">Add a role…</option>
        {available.map(role => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <Chips items={value} render={id => `@${name(id)}`} onRemove={id => onChange(value.filter(item => item !== id))} />
    </div>
  );
}

export function Field({ entry, value, onChange, roles, channels }) {
  let control = null;

  switch (entry.type) {
    case 'bool':
      control = <LocalToggle checked={Boolean(value)} onChange={onChange} label={entry.label} />;
      break;
    case 'int':
    case 'float':
      control = (
        <input
          type="number"
          value={value}
          min={entry.min}
          max={entry.max}
          step={entry.step || 1}
          onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          className={`${inputClass} w-32`}
        />
      );
      break;
    case 'enum':
      control = (
        <select value={value} onChange={event => onChange(event.target.value)} className={`${inputClass} w-48`}>
          {entry.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case 'string':
      control = <input value={value} maxLength={500} onChange={event => onChange(event.target.value)} className={`${inputClass} w-full sm:w-96`} />;
      break;
    case 'role':
      control = (
        <select value={value} onChange={event => onChange(event.target.value)} className={`${inputClass} w-64`}>
          <option value="">None</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      );
      break;
    case 'channel':
      control = (
        <select value={value} onChange={event => onChange(event.target.value)} className={`${inputClass} w-64`}>
          <option value="">None</option>
          {channels.map(channel => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>
      );
      break;
    case 'rolelist':
      control = <RoleListControl value={value} onChange={onChange} roles={roles} />;
      break;
    case 'list':
      control = entry.options ? <OptionListControl entry={entry} value={value} onChange={onChange} /> : <TextListControl entry={entry} value={value} onChange={onChange} />;
      break;
    default:
      control = <TextListControl entry={entry} value={value} onChange={onChange} />;
  }

  const stacked = entry.type === 'list' || entry.type === 'rolelist' || entry.type === 'userlist';
  return (
    <SettingRow title={entry.label} description={entry.key} stacked={stacked}>
      {control}
    </SettingRow>
  );
}
