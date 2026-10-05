'use client';

import { useActionState } from 'react';
import {
  updatePrefixAction,
  resetPrefixAction,
  setNoPrefixModeAction,
  addNoPrefixUserAction,
  removeNoPrefixUserAction,
  claimPremiumAction
} from './actions';

const initialState = { ok: null, error: null };

export default function SettingsForm({ guildId, prefix, isPremium, noPrefixMode, noPrefixUsers }) {
  const [claimState, claimFormAction, claimPending] = useActionState(claimPremiumAction.bind(null, guildId), initialState);
  const [prefixState, prefixFormAction, prefixPending] = useActionState(updatePrefixAction.bind(null, guildId), initialState);
  const [userState, userFormAction, userPending] = useActionState(addNoPrefixUserAction.bind(null, guildId), initialState);

  const everyoneEnabled = noPrefixMode === 'all';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:border-white/20">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Claim Premium</p>
        <form action={claimFormAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            name="key"
            placeholder="Premium key"
            className="flex-1 min-w-[10rem] rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm uppercase outline-none transition-all duration-200 focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={claimPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50 disabled:hover:scale-100"
          >
            {claimPending ? 'Claiming...' : 'Claim'}
          </button>
        </form>
        {claimState.error && <p className="mt-1 text-xs text-red-400">{claimState.error}</p>}
        {claimState.ok && <p className="mt-1 text-xs text-emerald-400">Premium claimed ({claimState.label}).</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:border-white/20">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Prefix</p>
        <form action={prefixFormAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            name="prefix"
            defaultValue={prefix}
            maxLength={5}
            className="w-24 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={prefixPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 disabled:opacity-50 disabled:hover:scale-100"
          >
            {prefixPending ? 'Saving...' : 'Save'}
          </button>
          <button
            formAction={resetPrefixAction.bind(null, guildId)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors duration-150 hover:bg-white/10"
          >
            Reset to default
          </button>
        </form>
        {prefixState.error && <p className="mt-1 text-xs text-red-400">{prefixState.error}</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:border-white/20">
        <p className="text-xs uppercase tracking-wide text-neutral-500">No-Prefix</p>
        {!isPremium ? (
          <p className="mt-2 text-sm text-neutral-400">This server does not have premium — no-prefix access requires it.</p>
        ) : (
          <>
            <form action={setNoPrefixModeAction.bind(null, guildId, everyoneEnabled ? 'none' : 'all')} className="mt-2">
              <button
                type="submit"
                className={
                  everyoneEnabled
                    ? 'rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500'
                    : 'rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors duration-150 hover:bg-white/10'
                }
              >
                {everyoneEnabled ? 'Enabled for everyone' : 'Enable for everyone'}
              </button>
            </form>

            <p className="mt-4 text-xs uppercase tracking-wide text-neutral-500">Specific users with access</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {noPrefixUsers.length === 0 && <p className="text-xs text-neutral-500">None added.</p>}
              {noPrefixUsers.map(userId => (
                <form key={userId} action={removeNoPrefixUserAction.bind(null, guildId, userId)}>
                  <button
                    type="submit"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs transition-colors duration-150 hover:bg-red-500/20 hover:text-red-300"
                  >
                    {userId} ×
                  </button>
                </form>
              ))}
            </div>
            <form action={userFormAction} className="mt-2 flex gap-2">
              <input
                name="userId"
                placeholder="Discord user ID"
                className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs outline-none transition-all duration-200 focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={userPending}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-violet-500 disabled:opacity-50"
              >
                Add
              </button>
            </form>
            {userState.error && <p className="mt-1 text-xs text-red-400">{userState.error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
