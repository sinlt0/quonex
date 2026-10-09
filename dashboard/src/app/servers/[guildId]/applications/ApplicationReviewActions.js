'use client';

import { useActionState } from 'react';
import { decideApplicationAction } from './actions';

const initialState = { ok: null, error: null };

export default function ApplicationReviewActions({ guildId, applicationId }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    decideApplicationAction.bind(null, guildId, applicationId, true),
    initialState
  );
  const [denyState, denyAction, denyPending] = useActionState(
    decideApplicationAction.bind(null, guildId, applicationId, false),
    initialState
  );

  const error = acceptState.error || denyState.error;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <form action={acceptAction}>
          <button
            type="submit"
            disabled={acceptPending || denyPending}
            className="rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 transition-colors duration-150 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {acceptPending ? 'Accepting...' : 'Accept'}
          </button>
        </form>
        <form action={denyAction}>
          <button
            type="submit"
            disabled={acceptPending || denyPending}
            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 transition-colors duration-150 hover:bg-red-500/20 disabled:opacity-50"
          >
            {denyPending ? 'Denying...' : 'Deny'}
          </button>
        </form>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
