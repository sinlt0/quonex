'use client';

import { useState, useTransition } from 'react';
import { useActionState } from 'react';
import { updateGreetToggleAction, updateGreetChannelAction, updateGreetBackgroundAction } from './actions';
import BlockEditor from './BlockEditor';

const cardClass = 'dash-card p-5';
const selectClass = 'rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500';
const initialBackgroundState = { ok: null, error: null };

function ToggleButton({ guildId, field, enabled, label, disabled, disabledHint }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function toggle() {
    if (disabled) return;
    const next = !isEnabled;
    startTransition(async () => {
      const result = await updateGreetToggleAction(guildId, field, next);
      if (result.ok) {
        setIsEnabled(next);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        className={
          isEnabled
            ? 'rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 disabled:opacity-50'
            : 'rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors duration-150 hover:bg-white/10 disabled:opacity-50'
        }
      >
        {label} — {isEnabled ? 'On' : 'Off'}
      </button>
      {disabled && disabledHint && <p className="mt-1 text-xs text-neutral-500">{disabledHint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ChannelSelect({ guildId, field, channelId, textChannels }) {
  const [value, setValue] = useState(channelId || '');
  const [pending, startTransition] = useTransition();

  function handleChange(event) {
    const next = event.target.value;
    setValue(next);
    startTransition(() => {
      updateGreetChannelAction(guildId, field, next);
    });
  }

  return (
    <select value={value} onChange={handleChange} disabled={pending} className={selectClass}>
      <option value="">No channel set</option>
      {textChannels.map(channel => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}

function BackgroundForm({ guildId, currentUrl, isPremium }) {
  const [state, formAction, pending] = useActionState(updateGreetBackgroundAction.bind(null, guildId), initialBackgroundState);

  if (!isPremium) return null;

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        name="url"
        defaultValue={currentUrl || ''}
        placeholder="Custom background image URL (optional)"
        className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-emerald-400">Background updated.</p>}
    </form>
  );
}

const TABS = [
  { id: 'join', label: 'Join' },
  { id: 'leave', label: 'Leave' },
  { id: 'ban', label: 'Ban' }
];

export default function GreetBuilderForm({ guildId, settings, textChannels, isPremium }) {
  const [tab, setTab] = useState('join');

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Placeholders</p>
        <p className="mt-1 text-sm text-neutral-300">
          Use these inside any text or section block: <code className="text-violet-300">{'{user}'}</code>,{' '}
          <code className="text-violet-300">{'{user_name}'}</code>, <code className="text-violet-300">{'{user_tag}'}</code>,{' '}
          <code className="text-violet-300">{'{user_id}'}</code>, <code className="text-violet-300">{'{server_name}'}</code>,{' '}
          <code className="text-violet-300">{'{member_count}'}</code>
          {' — and on ban messages only: '}
          <code className="text-violet-300">{'{reason}'}</code>, <code className="text-violet-300">{'{moderator}'}</code>.{' '}
          {'{user}'} and {'{moderator}'} ping the person — they get a real Discord notification, not just a highlighted name.
        </p>
      </div>

      <nav className="flex gap-2 border-b border-white/10 pb-2">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium'
                : 'rounded-lg px-4 py-1.5 text-sm text-neutral-400 transition-colors duration-150 hover:bg-white/10 hover:text-neutral-100'
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'join' && (
        <div className="space-y-4">
          <div className={cardClass}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Channel message</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ToggleButton guildId={guildId} field="joinEnabled" enabled={settings.joinEnabled} label="Welcome message" />
              <ChannelSelect guildId={guildId} field="joinChannelId" channelId={settings.joinChannelId} textChannels={textChannels} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <ToggleButton guildId={guildId} field="joinCardEnabled" enabled={settings.joinCardEnabled} label="Image welcome card" />
            </div>
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Card background</p>
              {isPremium ? (
                <BackgroundForm guildId={guildId} currentUrl={settings.joinCardBackground} isPremium={isPremium} />
              ) : (
                <p className="mt-1 text-xs text-neutral-500">
                  The card uses the default gradient. A custom background image is a premium feature — claim a key in Settings to unlock it.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <ToggleButton guildId={guildId} field="joinDmEnabled" enabled={settings.joinDmEnabled} label="DM the new member" />
            </div>
          </div>

          <BlockEditor
            guildId={guildId}
            field="joinBlocks"
            title="Welcome message (channel)"
            hint="Rendered as a Components V2 container when a member joins. If the image card is on, it's inserted above these blocks."
            initialBlocks={settings.joinBlocks}
          />

          {settings.joinDmEnabled && (
            <BlockEditor
              guildId={guildId}
              field="joinDmBlocks"
              title="Welcome DM"
              hint="Sent to the member directly. Silently skipped if their DMs are closed."
              initialBlocks={settings.joinDmBlocks}
            />
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-4">
          <div className={cardClass}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Channel message</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ToggleButton guildId={guildId} field="leaveEnabled" enabled={settings.leaveEnabled} label="Leave message" />
              <ChannelSelect guildId={guildId} field="leaveChannelId" channelId={settings.leaveChannelId} textChannels={textChannels} />
            </div>
            <p className="mt-2 text-xs text-neutral-500">No DM option here — a member who already left can't reliably be DMed.</p>
          </div>

          <BlockEditor
            guildId={guildId}
            field="leaveBlocks"
            title="Leave message"
            hint="Posted when a member leaves or is kicked."
            initialBlocks={settings.leaveBlocks}
          />
        </div>
      )}

      {tab === 'ban' && (
        <div className="space-y-4">
          <div className={cardClass}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Channel message</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ToggleButton guildId={guildId} field="banEnabled" enabled={settings.banEnabled} label="Ban message" />
              <ChannelSelect guildId={guildId} field="banChannelId" channelId={settings.banChannelId} textChannels={textChannels} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <ToggleButton guildId={guildId} field="banDmEnabled" enabled={settings.banDmEnabled} label="DM the banned user" />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {'{reason}'} and {'{moderator}'} come from the audit log and fall back to "No reason provided" / "Unknown" if unavailable.
            </p>
          </div>

          <BlockEditor
            guildId={guildId}
            field="banBlocks"
            title="Ban message (channel)"
            hint="Posted when a member is banned."
            initialBlocks={settings.banBlocks}
          />

          {settings.banDmEnabled && (
            <BlockEditor
              guildId={guildId}
              field="banDmBlocks"
              title="Ban DM"
              hint="Sent to the banned user, when deliverable. Silently skipped otherwise."
              initialBlocks={settings.banDmBlocks}
            />
          )}
        </div>
      )}
    </div>
  );
}
