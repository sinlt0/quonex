'use client';

import { useActionState } from 'react';
import { addReactionRoleAction } from '../actions';

const initialState = { ok: null, error: null };

export default function ReactionRoleForm({ guildId, textChannels, roles, used, limit }) {
  const [state, formAction, pending] = useActionState(addReactionRoleAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="dash-card space-y-3 p-5">
      <div>
        <h2 className="text-base font-semibold">Add a reaction role</h2>
        <p className="mt-0.5 text-sm text-neutral-400">
          The bot reacts to the message with your emoji. Members who click it get the role. {used}/{limit} used.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="channelId" required defaultValue="" className="dash-input">
          <option value="" disabled>
            Channel of the message...
          </option>
          {textChannels.map(channel => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>
        <input name="messageId" required placeholder="Message ID or message link" className="dash-input" />
        <input name="emoji" required placeholder="Emoji, e.g. 🎮 or a custom emoji" className="dash-input" />
        <select name="roleId" required defaultValue="" className="dash-input">
          <option value="" disabled>
            Role to give...
          </option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <select name="mode" defaultValue="toggle" className="dash-input sm:col-span-2">
          <option value="toggle">Toggle: removing the reaction removes the role</option>
          <option value="once">Once: removing the reaction keeps the role</option>
          <option value="unique">Unique: picking one removes the other reaction roles on that message</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="dash-btn dash-btn-primary">
          {pending ? 'Adding...' : 'Add reaction role'}
        </button>
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        {state.ok && <p className="text-xs text-emerald-400">Added.</p>}
      </div>
    </form>
  );
}
