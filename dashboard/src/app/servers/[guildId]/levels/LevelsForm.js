'use client';

import { useActionState, useState, useTransition } from 'react';
import Card from '../../../../components/dash/Card';
import SettingRow from '../../../../components/dash/SettingRow';
import Switch from '../../../../components/dash/Switch';
import {
  updateLevelToggleAction,
  updateLevelUpChannelAction,
  updateXpSettingsAction,
  updateLevelUpMessageAction,
  addIgnoredChannelAction,
  removeIgnoredChannelAction,
  addRoleRewardAction,
  removeRoleRewardAction,
  updateVoiceXpAction,
  updateGlobalMultiplierAction,
  addMultiplierAction,
  removeMultiplierAction,
  addNoXpRoleAction,
  removeNoXpRoleAction,
  updateRankCardAction
} from './actions';

const inputClass = 'dash-input';
const primaryButtonClass = 'dash-btn dash-btn-primary';
const initialState = { ok: null, error: null };

function XpSettingsForm({ guildId, settings }) {
  const [state, formAction, pending] = useActionState(updateXpSettingsAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-400">
        Min XP
        <input name="xpMin" type="number" min={1} defaultValue={settings.xpMin} className={`${inputClass} mt-1 block w-24`} />
      </label>
      <label className="text-xs text-neutral-400">
        Max XP
        <input name="xpMax" type="number" min={1} defaultValue={settings.xpMax} className={`${inputClass} mt-1 block w-24`} />
      </label>
      <label className="text-xs text-neutral-400">
        Cooldown (seconds)
        <input
          name="cooldownSeconds"
          type="number"
          min={0}
          max={3600}
          defaultValue={settings.cooldownSeconds}
          className={`${inputClass} mt-1 block w-32`}
        />
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-emerald-400">Saved.</p>}
    </form>
  );
}

function LevelUpChannelSelect({ guildId, channelId, textChannels }) {
  const [value, setValue] = useState(channelId || '');
  const [pending, startTransition] = useTransition();

  function handleChange(event) {
    const next = event.target.value;
    setValue(next);
    startTransition(() => {
      updateLevelUpChannelAction(guildId, next);
    });
  }

  return (
    <select value={value} onChange={handleChange} disabled={pending} className={inputClass}>
      <option value="">Same channel as the message</option>
      {textChannels.map(channel => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}

function LevelUpMessageForm({ guildId, message }) {
  const [state, formAction, pending] = useActionState(updateLevelUpMessageAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <textarea name="levelUpMessage" defaultValue={message} rows={2} maxLength={500} className={`${inputClass} w-full`} />
      <p className="text-xs text-neutral-500">
        Placeholders: {'{user}'}, {'{user_name}'}, {'{user_tag}'}, {'{user_id}'}, {'{level}'}, {'{rank}'}, {'{server_name}'}, {'{member_count}'}
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Saving...' : 'Save message'}
        </button>
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        {state.ok && <p className="text-xs text-emerald-400">Saved.</p>}
      </div>
    </form>
  );
}

function IgnoredChannels({ guildId, ignoredChannelIds, textChannels }) {
  const [selected, setSelected] = useState('');
  const [pending, startTransition] = useTransition();
  const nameFor = id => textChannels.find(channel => channel.id === id)?.name || id;
  const available = textChannels.filter(channel => !ignoredChannelIds.includes(channel.id));

  function add() {
    if (!selected) return;
    startTransition(async () => {
      await addIgnoredChannelAction(guildId, selected);
      setSelected('');
    });
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {ignoredChannelIds.length === 0 && <p className="text-xs text-neutral-500">No channels ignored.</p>}
        {ignoredChannelIds.map(id => (
          <form key={id} action={removeIgnoredChannelAction.bind(null, guildId, id)}>
            <button
              type="submit"
              className="rounded-full bg-white/10 px-3 py-1 text-xs transition-colors duration-150 hover:bg-red-500/20 hover:text-red-300"
            >
              #{nameFor(id)} ×
            </button>
          </form>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <select value={selected} onChange={event => setSelected(event.target.value)} className={`${inputClass} flex-1`}>
          <option value="">Ignore a channel...</option>
          {available.map(channel => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={pending || !selected} className={primaryButtonClass}>
          Add
        </button>
      </div>
    </div>
  );
}

function RoleRewards({ guildId, roleRewards, roles, rewardLimit }) {
  const [state, formAction, pending] = useActionState(addRoleRewardAction.bind(null, guildId), initialState);
  const roleName = id => roles.find(role => role.id === id)?.name || id;

  return (
    <div className="mt-2">
      <p className="text-xs text-neutral-500">
        {roleRewards.length}/{rewardLimit} used. Roles are granted at each level and stack — members keep every reward they have earned.
      </p>
      <div className="mt-2 space-y-1">
        {roleRewards.length === 0 && <p className="text-xs text-neutral-500">No role rewards yet.</p>}
        {roleRewards.map(reward => (
          <form key={reward.id} action={removeRoleRewardAction.bind(null, guildId, reward.id)} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-neutral-400">Level {reward.level}</span>
            <span className="flex-1">{roleName(reward.roleId)}</span>
            <button
              type="submit"
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 transition-colors duration-150 hover:bg-red-500/20"
            >
              Remove
            </button>
          </form>
        ))}
      </div>
      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input name="level" type="number" min={1} max={1000} placeholder="Level" required className={`${inputClass} w-24`} />
        <select name="roleId" required defaultValue="" className={`${inputClass} min-w-[10rem] flex-1`}>
          <option value="" disabled>
            Role to grant...
          </option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Adding...' : 'Add reward'}
        </button>
        {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      </form>
    </div>
  );
}

function VoiceXpForm({ guildId, perMinute }) {
  const [state, formAction, pending] = useActionState(updateVoiceXpAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-400">
        XP per minute
        <input name="voiceXpPerMinute" type="number" min={1} max={100} defaultValue={perMinute} className={`${inputClass} mt-1 block w-28`} />
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-emerald-400">Saved.</p>}
    </form>
  );
}

function GlobalMultiplierForm({ guildId, value }) {
  const [state, formAction, pending] = useActionState(updateGlobalMultiplierAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-neutral-400">
        Multiplier
        <input
          name="globalMultiplier"
          type="number"
          step="0.05"
          min={0.1}
          max={10}
          defaultValue={value}
          className={`${inputClass} mt-1 block w-28`}
        />
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-emerald-400">Saved.</p>}
    </form>
  );
}

function Multipliers({ guildId, entries, roles, textChannels, voiceChannels, limit }) {
  const [state, formAction, pending] = useActionState(addMultiplierAction.bind(null, guildId), initialState);
  const [type, setType] = useState('role');
  const channels = [...textChannels, ...voiceChannels];
  const nameFor = entry =>
    entry.type === 'role'
      ? roles.find(role => role.id === entry.id)?.name || entry.id
      : `#${channels.find(channel => channel.id === entry.id)?.name || entry.id}`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        {entries.length}/{limit} used. A member's role multiplier (highest one wins) is combined with the channel multiplier and the server multiplier.
      </p>
      <div className="space-y-1">
        {entries.length === 0 && <p className="text-xs text-neutral-500">No multipliers yet.</p>}
        {entries.map(entry => (
          <form key={`${entry.type}-${entry.id}`} action={removeMultiplierAction.bind(null, guildId, entry.type, entry.id)} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-neutral-400 capitalize">{entry.type}</span>
            <span className="flex-1">{nameFor(entry)}</span>
            <span className="text-neutral-300">×{entry.multiplier}</span>
            <button type="submit" className="dash-btn text-red-300">
              Remove
            </button>
          </form>
        ))}
      </div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <select name="type" value={type} onChange={event => setType(event.target.value)} className={inputClass}>
          <option value="role">Role</option>
          <option value="channel">Channel</option>
        </select>
        <select name="targetId" required defaultValue="" key={type} className={`${inputClass} min-w-[10rem] flex-1`}>
          <option value="" disabled>
            {type === 'role' ? 'Pick a role...' : 'Pick a channel...'}
          </option>
          {type === 'role'
            ? roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))
            : channels.map(channel => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
        </select>
        <input name="multiplier" type="number" step="0.05" min={0.1} max={10} placeholder="×2" required className={`${inputClass} w-24`} />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Adding...' : 'Add'}
        </button>
        {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      </form>
    </div>
  );
}

function NoXpRoles({ guildId, roleIds, roles }) {
  const [selected, setSelected] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const nameFor = id => roles.find(role => role.id === id)?.name || id;
  const available = roles.filter(role => !roleIds.includes(role.id));

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addNoXpRoleAction(guildId, selected);
      setError(result.ok ? null : result.error);
      setSelected('');
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {roleIds.length === 0 && <p className="text-xs text-neutral-500">No roles blocked.</p>}
        {roleIds.map(id => (
          <form key={id} action={removeNoXpRoleAction.bind(null, guildId, id)}>
            <button type="submit" className="rounded-full bg-[#171b2a] px-3 py-1 text-xs transition-colors hover:bg-red-500/20 hover:text-red-300">
              {nameFor(id)} ×
            </button>
          </form>
        ))}
      </div>
      <div className="flex gap-2">
        <select value={selected} onChange={event => setSelected(event.target.value)} className={`${inputClass} flex-1`}>
          <option value="">Block a role...</option>
          {available.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={pending || !selected} className={primaryButtonClass}>
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function RankCardForm({ guildId, accent, background, isPremium }) {
  const [state, formAction, pending] = useActionState(updateRankCardAction.bind(null, guildId), initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-xs text-neutral-400">
        Accent color
        <div className="mt-1 flex items-center gap-2">
          <input name="rankCardAccent" defaultValue={accent} maxLength={7} className={`${inputClass} w-32`} />
          <span className="h-6 w-6 rounded-full border border-white/10" style={{ backgroundColor: accent }} />
        </div>
      </label>
      {isPremium ? (
        <label className="block text-xs text-neutral-400">
          Background image URL (premium)
          <input name="rankCardBackground" defaultValue={background} placeholder="https://..." className={`${inputClass} mt-1 w-full`} />
        </label>
      ) : (
        <p className="text-xs text-neutral-500">Custom backgrounds are a premium feature. The accent color is free.</p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Saving...' : 'Save'}
        </button>
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        {state.ok && <p className="text-xs text-emerald-400">Saved.</p>}
      </div>
    </form>
  );
}

export default function LevelsForm({ guildId, settings, textChannels, voiceChannels, roles, rewardLimit, multiplierLimit, isPremium, leaderboard }) {
  return (
    <div className="space-y-4">
      <Card title="XP per message" description="Each eligible message grants a random amount between min and max.">
        <SettingRow title="Range and cooldown" stacked>
          <XpSettingsForm guildId={guildId} settings={settings} />
        </SettingRow>
      </Card>

      <Card title="Level-up announcement">
        <SettingRow title="Announce level-ups" description="Send a message when a member reaches a new level.">
          <Switch
            checked={settings.levelUpEnabled}
            label="Announce level-ups"
            onChange={next => updateLevelToggleAction(guildId, 'levelUpEnabled', next)}
          />
        </SettingRow>
        <SettingRow title="Announcement channel" description="Where level-up messages are sent.">
          <LevelUpChannelSelect guildId={guildId} channelId={settings.levelUpChannelId} textChannels={textChannels} />
        </SettingRow>
        <SettingRow title="Message" stacked>
          <LevelUpMessageForm guildId={guildId} message={settings.levelUpMessage} />
        </SettingRow>
      </Card>

      <Card title="Voice XP" description="Members earn XP for every minute they spend in a voice channel.">
        <SettingRow title="Enable voice XP" description="Deafened members and the AFK channel never earn XP.">
          <Switch checked={settings.voiceXpEnabled} label="Enable voice XP" onChange={next => updateLevelToggleAction(guildId, 'voiceXpEnabled', next)} />
        </SettingRow>
        <SettingRow title="Require company" description="Only award XP when at least two people are in the channel.">
          <Switch
            checked={settings.voiceRequireOthers}
            label="Require company"
            onChange={next => updateLevelToggleAction(guildId, 'voiceRequireOthers', next)}
          />
        </SettingRow>
        <SettingRow title="XP per minute" stacked>
          <VoiceXpForm guildId={guildId} perMinute={settings.voiceXpPerMinute} />
        </SettingRow>
      </Card>

      <Card title="XP multipliers" description="Boost or reduce XP for the whole server, specific roles, or specific channels.">
        <SettingRow title="Server multiplier" description="Applies to every message and voice minute." stacked>
          <GlobalMultiplierForm guildId={guildId} value={settings.globalMultiplier} />
        </SettingRow>
        <SettingRow title="Role and channel multipliers" stacked>
          <Multipliers
            guildId={guildId}
            entries={settings.xpMultipliers}
            roles={roles}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            limit={multiplierLimit}
          />
        </SettingRow>
      </Card>

      <Card title="Blocked roles" description="Members with any of these roles never earn XP.">
        <SettingRow title="Roles" stacked>
          <NoXpRoles guildId={guildId} roleIds={settings.noXpRoleIds} roles={roles} />
        </SettingRow>
      </Card>

      <Card title="Rank card" description="The image shown by /rank.">
        <SettingRow title="Show rank card" description="Turn off to reply with plain text instead.">
          <Switch checked={settings.rankCardEnabled} label="Show rank card" onChange={next => updateLevelToggleAction(guildId, 'rankCardEnabled', next)} />
        </SettingRow>
        <SettingRow title="Appearance" stacked>
          <RankCardForm guildId={guildId} accent={settings.rankCardAccent} background={settings.rankCardBackground} isPremium={isPremium} />
        </SettingRow>
      </Card>

      <Card title="Ignored channels" description="Messages in these channels earn no XP.">
        <SettingRow title="Channels" stacked>
          <IgnoredChannels guildId={guildId} ignoredChannelIds={settings.ignoredChannelIds} textChannels={textChannels} />
        </SettingRow>
      </Card>

      <Card title="Role rewards">
        <SettingRow title="Rewards" stacked>
          <RoleRewards guildId={guildId} roleRewards={settings.roleRewards} roles={roles} rewardLimit={rewardLimit} />
        </SettingRow>
      </Card>

      <Card title="Top members">
        {leaderboard.length === 0 ? (
          <SettingRow title="No one has earned XP yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="px-5 py-2">#</th>
                  <th className="px-5 py-2">User ID</th>
                  <th className="px-5 py-2">Level</th>
                  <th className="px-5 py-2">XP</th>
                  <th className="px-5 py-2">Messages</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(entry => (
                  <tr key={entry.userId} className="border-t border-[#1c2030]">
                    <td className="px-5 py-2">{entry.rank}</td>
                    <td className="px-5 py-2">{entry.userId}</td>
                    <td className="px-5 py-2">{entry.level}</td>
                    <td className="px-5 py-2">{entry.xp.toLocaleString()}</td>
                    <td className="px-5 py-2">{entry.messages.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
