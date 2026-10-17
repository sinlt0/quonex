'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Card from '../../../../components/dash/Card';
import { runBotSecurityAction } from './actions';

function ActionButton({ guildId, action, params, label, confirm, danger, onResult, disabled }) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await runBotSecurityAction(guildId, action, params);
      onResult(result, label);
    });
  }

  return (
    <button type="button" onClick={run} disabled={pending || disabled} className={danger ? 'dash-btn border-red-500/40 text-red-300' : 'dash-btn'}>
      {pending ? 'Working...' : label}
    </button>
  );
}

export default function ModuleActions({ guildId, module, channels = [], config = {} }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [channelId, setChannelId] = useState(config.panelChannelId || '');

  function onResult(result, label) {
    setMessage(result.ok ? { ok: true, text: `${label}: done.` } : { ok: false, text: result.error });
    router.refresh();
  }

  const common = { guildId, onResult };
  const minutesInput = (
    <label className="text-xs text-neutral-400">
      Minutes (optional)
      <input type="number" min={1} max={10080} value={minutes} onChange={event => setMinutes(event.target.value)} className="dash-input mt-1 block w-28" />
    </label>
  );

  let body = null;

  if (module === 'antinuke') {
    body = (
      <div className="flex flex-wrap items-end gap-3">
        {minutesInput}
        <ActionButton {...common} action="panic-start" params={{ minutes }} label="Start panic mode" danger confirm="Lock every channel now?" />
        <ActionButton {...common} action="panic-end" label="End panic mode" />
      </div>
    );
  } else if (module === 'antiraid') {
    body = (
      <div className="flex flex-wrap items-end gap-3">
        <ActionButton {...common} action="raid-start" label="Start raid mode" danger confirm="Start raid mode now? New joiners will be punished according to your settings." />
        <ActionButton {...common} action="raid-end" label="End raid mode" />
      </div>
    );
  } else if (module === 'lockdown') {
    body = (
      <div className="flex flex-wrap items-end gap-3">
        {minutesInput}
        <ActionButton {...common} action="lockdown-start" params={{ minutes }} label="Lock the server" danger confirm="Lock every channel now?" />
        <ActionButton {...common} action="lockdown-end" label="Unlock everything" />
      </div>
    );
  } else if (module === 'verification') {
    body = (
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-400">
          Panel channel
          <select value={channelId} onChange={event => setChannelId(event.target.value)} className="dash-input mt-1 block w-64">
            <option value="">Choose a channel</option>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </label>
        <ActionButton {...common} action="verification-panel" params={{ channelId }} label="Post or move panel" disabled={!channelId} />
      </div>
    );
  } else {
    return null;
  }

  return (
    <Card title="Quick actions" description="These take effect right away. Settings below need Save changes.">
      <div className="space-y-3 px-5 pb-5">
        {body}
        {message && <p className={message.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{message.text}</p>}
      </div>
    </Card>
  );
}
