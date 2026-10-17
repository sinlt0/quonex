'use client';

import { useActionState, useState, useTransition } from 'react';
import Card from '../../../../../components/dash/Card';
import { addOwnerAction, removeOwnerAction, saveWhitelistAction, removeWhitelistAction } from '../actions';

const initialState = { ok: null, error: null };

function OwnersCard({ guildId, owners, canManage, max }) {
  const [state, formAction, pending] = useActionState(addOwnerAction.bind(null, guildId), initialState);
  const [removing, startTransition] = useTransition();

  return (
    <Card title="Extra owners" description={`Trusted admins (${owners.length}/${max}). They are ignored by every module and can change security settings. Only the server owner can add or remove them.`}>
      <div className="space-y-3 px-5 pb-5">
        {owners.length === 0 ? (
          <p className="text-sm text-neutral-400">No extra owners yet.</p>
        ) : (
          <ul className="space-y-2">
            {owners.map(owner => (
              <li key={owner.userId} className="flex items-center justify-between gap-3 rounded-lg border border-[#1c2030] bg-[#0c0f16] px-4 py-2 text-sm">
                <span>
                  {owner.name ? <strong>{owner.name}</strong> : 'Unknown user'} <code className="text-xs text-neutral-500">{owner.userId}</code>
                </span>
                {canManage && (
                  <button type="button" disabled={removing} onClick={() => startTransition(() => removeOwnerAction(guildId, owner.userId))} className="dash-btn">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-neutral-400">
              Discord user ID
              <input name="userId" inputMode="numeric" placeholder="123456789012345678" className="dash-input mt-1 block w-64" />
            </label>
            <button type="submit" disabled={pending || owners.length >= max} className="dash-btn dash-btn-primary">
              {pending ? 'Adding...' : 'Add extra owner'}
            </button>
            {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
            {state.ok && <p className="w-full text-xs text-emerald-400">Added.</p>}
          </form>
        ) : (
          <p className="text-xs text-neutral-500">Only the server owner can change this list.</p>
        )}
      </div>
    </Card>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'border-[#8b7cf6] bg-[#8b7cf6]/15 text-white' : 'border-[#1c2030] text-neutral-400 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function WhitelistCard({ guildId, whitelist, roles, channels, canManage, max, moduleOptions, events }) {
  const [kind, setKind] = useState('user');
  const [targetId, setTargetId] = useState('');
  const [modules, setModules] = useState(['all']);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  const nameOf = entry => {
    if (entry.kind === 'role') return `@${roles.find(role => role.id === entry.targetId)?.name || entry.targetId}`;
    if (entry.kind === 'channel') return `#${channels.find(channel => channel.id === entry.targetId)?.name || entry.targetId}`;
    return entry.name || entry.targetId;
  };

  function toggleModule(module) {
    setMessage(null);
    if (module === 'all') {
      setModules(['all']);
      return;
    }
    const without = modules.filter(item => item !== 'all');
    setModules(without.includes(module) ? without.filter(item => item !== module) : [...without, module]);
  }

  function edit(entry) {
    setKind(entry.kind);
    setTargetId(entry.targetId);
    setModules(entry.modules);
    setSelectedEvents(entry.events);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function save() {
    startTransition(async () => {
      const result = await saveWhitelistAction(guildId, { kind, targetId, modules, events: selectedEvents });
      setMessage(result.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: result.error });
      if (result.ok) setTargetId('');
    });
  }

  const showEvents = !modules.includes('all') && modules.includes('antinuke');

  return (
    <Card title="Global whitelist" description={`Users, roles and channels the security system ignores (${whitelist.length}/${max}). Pick everything for a global whitelist, or limit it to specific modules and anti-nuke events.`}>
      <div className="space-y-4 px-5 pb-5">
        {whitelist.length === 0 ? (
          <p className="text-sm text-neutral-400">The whitelist is empty. The owner and extra owners are always trusted.</p>
        ) : (
          <ul className="space-y-2">
            {whitelist.map(entry => (
              <li key={`${entry.kind}:${entry.targetId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1c2030] bg-[#0c0f16] px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="mr-2 rounded bg-[#171b2a] px-2 py-0.5 text-xs uppercase text-neutral-400">{entry.kind}</span>
                  <strong>{nameOf(entry)}</strong>
                  <span className="ml-2 text-xs text-neutral-400">
                    {entry.modules.includes('all') ? 'everything' : entry.modules.join(', ')}
                    {entry.events.length ? ` · ${entry.events.join(', ')}` : ''}
                  </span>
                </span>
                {canManage && (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => edit(entry)} className="dash-btn">
                      Edit
                    </button>
                    <button type="button" disabled={pending} onClick={() => startTransition(() => removeWhitelistAction(guildId, entry.kind, entry.targetId))} className="dash-btn">
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <div className="space-y-3 rounded-lg border border-[#1c2030] p-4">
            <p className="text-sm font-semibold">Add or update an entry</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-neutral-400">
                Type
                <select
                  value={kind}
                  onChange={event => {
                    setKind(event.target.value);
                    setTargetId('');
                  }}
                  className="dash-input mt-1 block w-32"
                >
                  <option value="user">User</option>
                  <option value="role">Role</option>
                  <option value="channel">Channel</option>
                </select>
              </label>
              <label className="text-xs text-neutral-400">
                Target
                {kind === 'user' && <input value={targetId} onChange={event => setTargetId(event.target.value)} inputMode="numeric" placeholder="User ID" className="dash-input mt-1 block w-64" />}
                {kind === 'role' && (
                  <select value={targetId} onChange={event => setTargetId(event.target.value)} className="dash-input mt-1 block w-64">
                    <option value="">Choose a role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
                {kind === 'channel' && (
                  <select value={targetId} onChange={event => setTargetId(event.target.value)} className="dash-input mt-1 block w-64">
                    <option value="">Choose a channel</option>
                    {channels.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs text-neutral-400">Applies to</p>
              <div className="flex flex-wrap gap-2">
                {moduleOptions.map(module => (
                  <Pill key={module} active={modules.includes(module)} onClick={() => toggleModule(module)}>
                    {module === 'all' ? 'Everything (global)' : module}
                  </Pill>
                ))}
              </div>
            </div>

            {showEvents && (
              <div>
                <p className="mb-2 text-xs text-neutral-400">Anti-nuke events (leave empty for all events)</p>
                <div className="flex flex-wrap gap-2">
                  {events.map(event => (
                    <Pill key={event.id} active={selectedEvents.includes(event.id)} onClick={() => setSelectedEvents(current => (current.includes(event.id) ? current.filter(item => item !== event.id) : [...current, event.id]))}>
                      {event.label}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="button" disabled={pending || !targetId || !modules.length} onClick={save} className="dash-btn dash-btn-primary">
                {pending ? 'Saving...' : 'Save entry'}
              </button>
              {message && <p className={message.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{message.text}</p>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Only the server owner and extra owners can change the whitelist.</p>
        )}
      </div>
    </Card>
  );
}

export default function TrustManager({ guildId, canManageOwners, canManageWhitelist, owners, whitelist, roles, channels, maxOwners, maxWhitelist, moduleOptions, events }) {
  return (
    <div className="space-y-4">
      <OwnersCard guildId={guildId} owners={owners} canManage={canManageOwners} max={maxOwners} />
      <WhitelistCard guildId={guildId} whitelist={whitelist} roles={roles} channels={channels} canManage={canManageWhitelist} max={maxWhitelist} moduleOptions={moduleOptions} events={events} />
    </div>
  );
}
