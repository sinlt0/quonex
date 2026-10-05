'use client';

import { useActionState } from 'react';
import { claimTicketAction, releaseTicketAction, closeTicketAction } from './actions';

const initialState = { ok: null, error: null };

export default function TicketActions({ guildId, ticket }) {
  const [claimState, claimAction, claimPending] = useActionState(
    claimTicketAction.bind(null, guildId, ticket.id),
    initialState
  );
  const [releaseState, releaseAction, releasePending] = useActionState(
    releaseTicketAction.bind(null, guildId, ticket.id),
    initialState
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeTicketAction.bind(null, guildId, ticket.id),
    initialState
  );

  const error = claimState.error || releaseState.error || closeState.error;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {ticket.claimedBy ? (
          <form action={releaseAction}>
            <button
              type="submit"
              disabled={releasePending}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs transition-colors duration-150 hover:bg-white/10 disabled:opacity-50"
            >
              {releasePending ? 'Releasing...' : 'Release'}
            </button>
          </form>
        ) : (
          <form action={claimAction}>
            <button
              type="submit"
              disabled={claimPending}
              className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium transition-all duration-150 ease-out hover:scale-105 hover:bg-violet-500 disabled:opacity-50 disabled:hover:scale-100"
            >
              {claimPending ? 'Claiming...' : 'Claim'}
            </button>
          </form>
        )}
        <form action={closeAction}>
          <button
            type="submit"
            disabled={closePending}
            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 transition-colors duration-150 hover:bg-red-500/20 disabled:opacity-50"
          >
            {closePending ? 'Closing...' : 'Close'}
          </button>
        </form>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
