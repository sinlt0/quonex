'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Card from '../../../../components/dash/Card';
import { Field, LocalToggle } from './Fields';
import { saveConfigAction, resetModuleAction } from './actions';

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function summarise(kind, group, values) {
  if (kind === 'event') return `${values[`${group.id}.limit`]} per ${values[`${group.id}.seconds`]}s · ${values[`${group.id}.punishment`]}`;
  if (kind === 'filter') return `heat ${values[`${group.id}.heat`]}`;
  return '';
}

function GroupRow({ group, values, onChange, roles, channels, kind }) {
  const enabledEntry = group.entries.find(entry => entry.key.endsWith('.enabled'));
  const rest = group.entries.filter(entry => entry !== enabledEntry);

  return (
    <details className="dash-divider group first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{group.label}</p>
          {kind && <p className="mt-0.5 text-xs text-neutral-400">{summarise(kind, group, values)}</p>}
        </div>
        <div className="flex items-center gap-4" onClick={event => event.stopPropagation()}>
          {enabledEntry && <LocalToggle checked={Boolean(values[enabledEntry.key])} onChange={next => onChange(enabledEntry.key, next)} label={`${group.label} on or off`} />}
          <span aria-hidden="true" className="text-neutral-500 transition-transform group-open:rotate-90">
            ›
          </span>
        </div>
      </summary>
      <div className="border-t border-[#1c2030] bg-[#0c0f16]">
        {rest.map(entry => (
          <Field key={entry.key} entry={entry} value={values[entry.key]} onChange={next => onChange(entry.key, next)} roles={roles} channels={channels} />
        ))}
      </div>
    </details>
  );
}

export default function ConfigForm({ guildId, module, sections, groupsTitle, groupsDescription, groups = [], groupKind, initial, roles, channels }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = Object.keys(values).filter(key => !same(values[key], baseline[key]));

  function update(key, next) {
    setSaved(false);
    setValues(current => ({ ...current, [key]: next }));
  }

  function save() {
    const payload = Object.fromEntries(changed.map(key => [key, values[key]]));
    setError(null);
    startTransition(async () => {
      const result = await saveConfigAction(guildId, module, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBaseline(values);
      setSaved(true);
      router.refresh();
    });
  }

  function reset() {
    if (!window.confirm('Reset every setting on this page to its default?')) return;
    startTransition(async () => {
      const result = await resetModuleAction(guildId, module);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4 pb-24">
      {sections.map(section => (
        <Card key={section.id} title={section.title} description={section.description}>
          {section.entries.map(entry => (
            <Field key={entry.key} entry={entry} value={values[entry.key]} onChange={next => update(entry.key, next)} roles={roles} channels={channels} />
          ))}
        </Card>
      ))}

      {groups.length > 0 && (
        <Card title={groupsTitle} description={groupsDescription}>
          {groups.map(group => (
            <GroupRow key={group.id} group={group} values={values} onChange={update} roles={roles} channels={channels} kind={groupKind} />
          ))}
        </Card>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={reset} disabled={pending} className="dash-btn">
          Reset to defaults
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#1c2030] bg-[#0b0e15]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="text-sm text-neutral-400">
            {error ? <span className="text-red-400">{error}</span> : saved && changed.length === 0 ? <span className="text-emerald-400">Saved.</span> : changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'No changes'}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={!changed.length || pending} onClick={() => setValues(baseline)} className="dash-btn">
              Discard
            </button>
            <button type="button" disabled={!changed.length || pending} onClick={save} className="dash-btn dash-btn-primary">
              {pending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
