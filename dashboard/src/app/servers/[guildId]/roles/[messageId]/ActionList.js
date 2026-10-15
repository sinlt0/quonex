'use client';

import { ACTION_TYPES, ACTION_LABELS, MAX_ACTIONS, MAX_ROLES_PER_ACTION, MAX_DURATION_MINUTES, defaultAction } from '../../../../../lib/interactiveClient';

const inputClass = 'dash-input';

export function RoleChips({ ids, onChange, roles, placeholder }) {
  const nameFor = id => roles.find(role => role.id === id)?.name || id;
  const available = roles.filter(role => !ids.includes(role.id));

  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ids.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(ids.filter(item => item !== id))}
              className="rounded-full bg-[#171b2a] px-3 py-1 text-xs transition-colors hover:bg-red-500/20 hover:text-red-300"
            >
              {nameFor(id)} ×
            </button>
          ))}
        </div>
      )}
      <select
        value=""
        onChange={event => event.target.value && onChange([...ids, event.target.value])}
        className={`${inputClass} w-full`}
      >
        <option value="">{placeholder}</option>
        {available.map(role => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function rolesOf(action) {
  if (Array.isArray(action.roleIds)) return action.roleIds;
  return action.roleId ? [action.roleId] : [];
}

function DurationField({ action, onChange }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      Remove automatically after
      <input
        type="number"
        min={0}
        max={MAX_DURATION_MINUTES}
        value={action.durationMinutes || ''}
        onChange={event => onChange({ durationMinutes: event.target.value ? Number.parseInt(event.target.value, 10) : 0 })}
        placeholder="never"
        className="dash-input w-24"
      />
      minutes (leave empty for permanent)
    </label>
  );
}

function ActionFields({ action, onChange, roles, textChannels, messages }) {
  const roleIds = rolesOf(action);
  const setRoles = ids => onChange({ roleIds: ids.slice(0, MAX_ROLES_PER_ACTION), roleId: undefined });

  switch (action.type) {
    case 'swapRole':
      return (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">Roles to give:</p>
          <RoleChips ids={roleIds} onChange={setRoles} roles={roles} placeholder="Add a role to give..." />
          <p className="text-xs text-neutral-500">Roles to take away at the same time (for example the other choices in a group):</p>
          <RoleChips
            ids={action.removeRoleIds || []}
            onChange={removeRoleIds => onChange({ removeRoleIds })}
            roles={roles}
            placeholder="Add a role to remove..."
          />
          <DurationField action={action} onChange={onChange} />
        </div>
      );
    case 'reply':
    case 'dm':
      return (
        <textarea
          value={action.content}
          onChange={event => onChange({ content: event.target.value })}
          rows={2}
          placeholder="Message text (markdown and {user}, {user_name}, {server_name} work)"
          className={`${inputClass} w-full`}
        />
      );
    case 'sendMessage':
      return (
        <div className="space-y-2">
          <select value={action.channelId || ''} onChange={event => onChange({ channelId: event.target.value })} className={`${inputClass} w-full`}>
            <option value="">The channel where the button was clicked</option>
            {textChannels.map(channel => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
          <textarea
            value={action.content}
            onChange={event => onChange({ content: event.target.value })}
            rows={2}
            placeholder="Message text ({user} pings the member)"
            className={`${inputClass} w-full`}
          />
        </div>
      );
    case 'showMessage':
      return (
        <select value={action.messageId} onChange={event => onChange({ messageId: event.target.value })} className={`${inputClass} w-full`}>
          <option value="">Message to show...</option>
          {messages.map(message => (
            <option key={message.id} value={message.id}>
              {message.name}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <div className="space-y-2">
          <RoleChips
            ids={roleIds}
            onChange={setRoles}
            roles={roles}
            placeholder={action.type === 'removeRole' ? 'Add a role to remove...' : 'Add a role...'}
          />
          {action.type !== 'removeRole' && <DurationField action={action} onChange={onChange} />}
        </div>
      );
  }
}

export default function ActionList({ actions, onChange, roles, textChannels, messages }) {
  function update(index, patch) {
    onChange(actions.map((action, i) => (i === index ? { ...action, ...patch } : action)));
  }

  function changeType(index, type) {
    onChange(actions.map((action, i) => (i === index ? defaultAction(type) : action)));
  }

  return (
    <div className="space-y-2">
      <p className="dash-label">When clicked, do this</p>
      {actions.length === 0 && <p className="text-xs text-neutral-500">No actions yet. Nothing will happen when this is used.</p>}
      {actions.map((action, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-[#1c2030] bg-[#0b0d13] p-3">
          <div className="flex gap-2">
            <select value={action.type} onChange={event => changeType(index, event.target.value)} className={`${inputClass} flex-1`}>
              {ACTION_TYPES.map(type => (
                <option key={type} value={type}>
                  {ACTION_LABELS[type]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onChange(actions.filter((_, i) => i !== index))} className="dash-btn text-red-300">
              ×
            </button>
          </div>
          <ActionFields
            action={action}
            onChange={patch => update(index, patch)}
            roles={roles}
            textChannels={textChannels}
            messages={messages}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={actions.length >= MAX_ACTIONS}
        onClick={() => onChange([...actions, defaultAction('toggleRole')])}
        className="dash-btn"
      >
        + Add action ({actions.length}/{MAX_ACTIONS})
      </button>
    </div>
  );
}
