'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Card from '../../../../../components/dash/Card';
import { runBotSecurityAction, deleteBackupAction } from '../actions';

export default function BackupManager({ guildId, backups }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function report(result, text) {
    setMessage(result.ok ? { ok: true, text } : { ok: false, text: result.error });
    router.refresh();
  }

  function create() {
    startTransition(async () => {
      const result = await runBotSecurityAction(guildId, 'backup-create', { name });
      if (result.ok) setName('');
      report(result, 'Backup saved.');
    });
  }

  function restore(backup) {
    if (!window.confirm(`Recreate the roles and channels missing from "${backup.name}"? Existing ones are not changed.`)) return;
    startTransition(async () => {
      const result = await runBotSecurityAction(guildId, 'backup-restore', { backupId: backup.id });
      const summary = result.data?.summary;
      report(result, summary ? `Restored: ${summary.rolesCreated} roles and ${summary.channelsCreated} channels created, ${summary.skipped} already present, ${summary.failed} failed.` : 'Restored.');
    });
  }

  function remove(backup) {
    if (!window.confirm(`Delete "${backup.name}"?`)) return;
    startTransition(async () => {
      await deleteBackupAction(guildId, backup.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card title="Take a backup" description="Saves every role and channel with its permissions. Restoring only recreates what is missing.">
        <div className="flex flex-wrap items-end gap-3 px-5 pb-5">
          <label className="text-xs text-neutral-400">
            Name (optional)
            <input value={name} maxLength={60} onChange={event => setName(event.target.value)} className="dash-input mt-1 block w-64" />
          </label>
          <button type="button" disabled={pending} onClick={create} className="dash-btn dash-btn-primary">
            {pending ? 'Working...' : 'Back up now'}
          </button>
          {message && <p className={message.ok ? 'w-full text-xs text-emerald-400' : 'w-full text-xs text-red-400'}>{message.text}</p>}
        </div>
      </Card>

      <Card title="Saved backups" description={`${backups.length} saved. Turn on automatic backups under Settings.`}>
        <div className="space-y-2 px-5 pb-5">
          {backups.length === 0 && <p className="text-sm text-neutral-400">No backups yet.</p>}
          {backups.map(backup => (
            <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1c2030] bg-[#0c0f16] px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  {backup.name} {backup.auto && <span className="ml-1 rounded bg-[#171b2a] px-2 py-0.5 text-xs text-neutral-400">auto</span>}
                </p>
                <p className="text-xs text-neutral-400">
                  {new Date(backup.createdAt).toLocaleString()} · {backup.roles} roles · {backup.channels} channels
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => restore(backup)} className="dash-btn">
                  Restore
                </button>
                <button type="button" disabled={pending} onClick={() => remove(backup)} className="dash-btn">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
