'use client';

import { useActionState } from 'react';
import { createApplicationPanelAction } from './actions';

const initialState = { ok: null, error: null };

export default function CreateApplicationPanelForm({ guildId, roles, textChannels }) {
  const [state, formAction, pending] = useActionState(createApplicationPanelAction.bind(null, guildId), initialState);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:border-white/20"
    >
      <h2 className="font-medium">Create an application panel</h2>
      <input
        name="name"
        placeholder="Panel name"
        required
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-violet-500 focus:bg-white/10"
      />
      <select
        name="reviewChannelId"
        required
        defaultValue=""
        className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500"
      >
        <option value="" disabled>
          Review channel (submissions go here)...
        </option>
        {textChannels.map(channel => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
      <select
        name="channelId"
        required
        defaultValue=""
        className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500"
      >
        <option value="" disabled>
          Post the apply button in...
        </option>
        {textChannels.map(channel => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
      <select
        name="acceptRoleId"
        defaultValue=""
        className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500"
      >
        <option value="">No role granted on accept</option>
        {roles.map(role => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Application panel created.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      >
        {pending ? 'Creating...' : 'Create panel'}
      </button>
    </form>
  );
}
