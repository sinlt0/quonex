'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyPresetAction } from './actions';

export default function PresetPicker({ guildId, presets }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function apply(name) {
    if (!window.confirm(`Apply the ${name} preset? It overwrites the settings it covers. Verification, quarantine and your whitelist are not touched.`)) return;
    startTransition(async () => {
      const result = await applyPresetAction(guildId, name);
      setMessage(result.ok ? { ok: true, text: `Applied ${name}.` } : { ok: false, text: result.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 px-5 pb-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {presets.map(preset => (
          <div key={preset.name} className="rounded-lg border border-[#1c2030] bg-[#0c0f16] p-4">
            <p className="font-semibold capitalize">{preset.name}</p>
            <p className="mt-1 min-h-[3rem] text-xs text-neutral-400">{preset.description}</p>
            <button type="button" disabled={pending} onClick={() => apply(preset.name)} className="dash-btn mt-3 w-full">
              Apply
            </button>
          </div>
        ))}
      </div>
      {message && <p className={message.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>{message.text}</p>}
    </div>
  );
}
