'use client';

import { RoleChips } from './ActionList';

function numberValue(value) {
  return value ? value : '';
}

export default function Conditions({ item, onChange, roles }) {
  return (
    <div className="space-y-3 rounded-lg border border-[#1c2030] bg-[#0b0d13] p-3">
      <p className="dash-label">Who can use this</p>
      <div className="space-y-1">
        <p className="text-xs text-neutral-500">Needs at least one of these roles (empty means everyone):</p>
        <RoleChips
          ids={item.requiredRoleIds || []}
          onChange={requiredRoleIds => onChange({ requiredRoleIds })}
          roles={roles}
          placeholder="Add a required role..."
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-neutral-500">Blocked if they have any of these roles:</p>
        <RoleChips
          ids={item.blockedRoleIds || []}
          onChange={blockedRoleIds => onChange({ blockedRoleIds })}
          roles={roles}
          placeholder="Add a blocked role..."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-400">
          Minimum level (needs Leveling on)
          <input
            type="number"
            min={0}
            max={1000}
            value={numberValue(item.requiredLevel)}
            onChange={event => onChange({ requiredLevel: event.target.value ? Number.parseInt(event.target.value, 10) : 0 })}
            placeholder="none"
            className="dash-input mt-1 w-full"
          />
        </label>
        <label className="text-xs text-neutral-400">
          Cooldown per member (seconds)
          <input
            type="number"
            min={0}
            max={86400}
            value={numberValue(item.cooldownSeconds)}
            onChange={event => onChange({ cooldownSeconds: event.target.value ? Number.parseInt(event.target.value, 10) : 0 })}
            placeholder="none"
            className="dash-input mt-1 w-full"
          />
        </label>
      </div>
    </div>
  );
}
