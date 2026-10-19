'use client';

import { useActionState, useState, useTransition } from 'react';
import Card from '../../../../components/dash/Card';
import SettingRow from '../../../../components/dash/SettingRow';
import Switch from '../../../../components/dash/Switch';
import { updateVoiceToggleAction, updateVoiceLogChannelAction, updateVoiceNumbersAction, addLobbyAction, updateLobbyAction, removeLobbyAction } from './actions';

const inputClass = 'dash-input';
const primaryButtonClass = 'dash-btn dash-btn-primary';
const initialState = { ok: null, error: null };

function Toggle({ guildId, field, checked, label }) {
  return <Switch checked={checked} label={label} onChange={next => updateVoiceToggleAction(guildId, field, next)} />;
}

function LogChannel({ guildId, value, textChannels }) {
  const [current, setCurrent] = useState(value || '');
  const [pending, startTransition] = useTransition();

  function change(event) {
    const next = event.target.value;
    setCurrent(next);
    startTransition(() => {
      updateVoiceLogChannelAction(guildId, next);
    });
  }

  return (
    <select value={current} onChange={change} disabled={pending} className={inputClass}>
      <option value="">No log channel</option>
      {textChannels.map(channel => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}

function Numbers({ guildId, settings }) {
  const [state, formAction, pending] = useActionState(updateVoiceNumbersAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-400">
        Hand-over delay (seconds)
        <input name="graceSeconds" type="number" min={0} max={600} defaultValue={settings.graceSeconds} className={`${inputClass} mt-1 block w-36`} />
      </label>
      <label className="text-xs text-neutral-400">
        Max rooms at once
        <input name="maxChannels" type="number" min={1} max={200} defaultValue={settings.maxChannels} className={`${inputClass} mt-1 block w-36`} />
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-emerald-400">Saved.</p>}
    </form>
  );
}

function AddLobby({ guildId, voiceChannels, categories, lobbies }) {
  const [state, formAction, pending] = useActionState(addLobbyAction.bind(null, guildId), initialState);
  const used = new Set(lobbies.map(lobby => lobby.channelId));
  const available = voiceChannels.filter(channel => !used.has(channel.id));

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 px-5 py-4">
      <select name="channelId" required defaultValue="" className={`${inputClass} min-w-[12rem] flex-1`}>
        <option value="" disabled>
          Voice channel to use as lobby...
        </option>
        {available.map(channel => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>
      <select name="categoryId" defaultValue="" className={`${inputClass} min-w-[10rem]`}>
        <option value="">Rooms in the lobby's category</option>
        {categories.map(category => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Adding...' : 'Add lobby'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

function Lobby({ guildId, lobby, voiceChannels, categories, roles }) {
  const [state, formAction, pending] = useActionState(updateLobbyAction.bind(null, guildId, lobby.id), initialState);
  const [removing, startTransition] = useTransition();
  const name = voiceChannels.find(channel => channel.id === lobby.channelId)?.name || lobby.channelId;

  return (
    <div className="dash-divider px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{name}</p>
        <button
          type="button"
          disabled={removing}
          onClick={() => startTransition(() => removeLobbyAction(guildId, lobby.id))}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 transition-colors duration-150 hover:bg-red-500/20"
        >
          Remove
        </button>
      </div>
      <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-400 sm:col-span-2">
          Room name template
          <input name="nameTemplate" defaultValue={lobby.nameTemplate} maxLength={100} className={`${inputClass} mt-1 block w-full`} />
          <span className="mt-1 block text-neutral-500">Placeholders: {'{username}'}, {'{display}'}, {'{tag}'}, {'{count}'}, {'{game}'}</span>
        </label>
        <label className="text-xs text-neutral-400">
          Default user limit (0 = none)
          <input name="userLimit" type="number" min={0} max={99} defaultValue={lobby.userLimit} className={`${inputClass} mt-1 block w-full`} />
        </label>
        <label className="text-xs text-neutral-400">
          Default bitrate in kbps (0 = server default)
          <input name="bitrate" type="number" min={0} max={384} defaultValue={lobby.bitrate} className={`${inputClass} mt-1 block w-full`} />
        </label>
        <label className="text-xs text-neutral-400">
          Cooldown between rooms (seconds)
          <input name="cooldownSeconds" type="number" min={0} max={3600} defaultValue={lobby.cooldownSeconds} className={`${inputClass} mt-1 block w-full`} />
        </label>
        <label className="text-xs text-neutral-400">
          Category for rooms
          <select name="categoryId" defaultValue={lobby.categoryId} className={`${inputClass} mt-1 block w-full`}>
            <option value="">Same as the lobby</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-400">
          Roles allowed to create (none = everyone)
          <select name="allowedRoleIds" multiple defaultValue={lobby.allowedRoleIds} className={`${inputClass} mt-1 block h-28 w-full`}>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-400">
          Roles blocked from creating
          <select name="blockedRoleIds" multiple defaultValue={lobby.blockedRoleIds} className={`${inputClass} mt-1 block h-28 w-full`}>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="ownerManaged" type="checkbox" defaultChecked={lobby.ownerManaged} />
          Owner managed (off makes public rooms with no owner controls)
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? 'Saving...' : 'Save lobby'}
          </button>
          {state.error && <p className="text-xs text-red-400">{state.error}</p>}
          {state.ok && <p className="text-xs text-emerald-400">Saved.</p>}
        </div>
      </form>
    </div>
  );
}

export default function VoiceForm({ guildId, settings, lobbies, activeRooms, lobbyLimit, textChannels, voiceChannels, categories, roles }) {
  return (
    <>
      <Card title="Lobbies" description={`${lobbies.length}/${lobbyLimit} used. ${activeRooms} temporary room${activeRooms === 1 ? '' : 's'} active right now.`}>
        {lobbies.length === 0 && <p className="dash-divider px-5 py-4 text-sm text-neutral-500">No lobbies yet. Add a voice channel below or run /tempvoice setup.</p>}
        {lobbies.map(lobby => (
          <Lobby key={lobby.id} guildId={guildId} lobby={lobby} voiceChannels={voiceChannels} categories={categories} roles={roles} />
        ))}
        <div className="dash-divider">
          <AddLobby guildId={guildId} voiceChannels={voiceChannels} categories={categories} lobbies={lobbies} />
        </div>
      </Card>

      <Card title="Room behavior">
        <SettingRow title="Control panel" description="Post the button panel in each new room's chat.">
          <Toggle guildId={guildId} field="panelEnabled" checked={settings.panelEnabled} label="Control panel" />
        </SettingRow>
        <SettingRow title="Remember owner settings" description="Name, limit, lock, hide, trusted and blocked members come back next time.">
          <Toggle guildId={guildId} field="saveProfiles" checked={settings.saveProfiles} label="Remember owner settings" />
        </SettingRow>
        <SettingRow title="Hand over ownership" description="When the owner leaves, give the room to someone still inside.">
          <Toggle guildId={guildId} field="autoTransfer" checked={settings.autoTransfer} label="Hand over ownership" />
        </SettingRow>
        <SettingRow title="Delay and limits" stacked>
          <Numbers guildId={guildId} settings={settings} />
        </SettingRow>
        <SettingRow title="Log channel" description="Room creation, deletion and ownership changes.">
          <LogChannel guildId={guildId} value={settings.logChannelId} textChannels={textChannels} />
        </SettingRow>
      </Card>

      <Card title="Security" description="Rooms follow the Quonex Shield trust and protection rules.">
        <SettingRow title="Pause creation during raids" description="No new rooms while raid mode or panic mode is active. Quarantined members can never create rooms.">
          <Toggle guildId={guildId} field="blockDuringRaid" checked={settings.blockDuringRaid} label="Pause creation during raids" />
        </SettingRow>
        <SettingRow title="Allow invite links in names" description="Off strips invites, links and mentions from room names.">
          <Toggle guildId={guildId} field="allowInvites" checked={settings.allowInvites} label="Allow invite links in names" />
        </SettingRow>
      </Card>
    </>
  );
}
