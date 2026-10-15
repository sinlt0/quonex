'use client';

import { useActionState } from 'react';
import { createInteractiveAction } from './actions';
import { PRESETS } from '../../../../lib/interactiveClient';

const initialState = { ok: null, error: null };

export default function CreateMessageForm({ guildId, used, limit }) {
  const [state, formAction, pending] = useActionState(createInteractiveAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="dash-card flex flex-wrap items-end gap-3 p-5">
      <label className="min-w-[14rem] flex-1 text-xs text-neutral-400">
        New message name
        <input name="name" required maxLength={60} placeholder="Personalization roles" className="dash-input mt-1 w-full" />
      </label>
      <label className="min-w-[14rem] text-xs text-neutral-400">
        Start from
        <select name="preset" defaultValue="blank" className="dash-input mt-1 w-full">
          {PRESETS.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.label} — {preset.description}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="dash-btn dash-btn-primary">
        {pending ? 'Creating...' : 'Create message'}
      </button>
      <p className="w-full text-xs text-neutral-500">
        {used}/{limit} used.
      </p>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
