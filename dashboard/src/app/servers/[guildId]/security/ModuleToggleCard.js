'use client';

import Switch from '../../../../components/dash/Switch';
import { toggleModuleAction } from './actions';

export default function ModuleToggleCard({ guildId, module, label, checked, description }) {
  return (
    <section className="dash-card flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-base font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-neutral-400">{description}</p>
      </div>
      <Switch checked={checked} onChange={next => toggleModuleAction(guildId, module, next)} label={`Enable ${label}`} />
    </section>
  );
}
