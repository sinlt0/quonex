import ModuleIcon from './ModuleIcon';
import ModuleTabs from './ModuleTabs';
import Switch from './Switch';
import { findModule } from '../../lib/modules';

export default function ModuleShell({ moduleId, toggle, callout, tabs, children }) {
  const module = findModule(moduleId);

  return (
    <div className="fade-in-up space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1c2030] bg-[#0f1219] text-[#8b7cf6]">
            <ModuleIcon name={module.icon} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{module.label}</h1>
            <p className="mt-1 text-sm text-neutral-400">{module.description}</p>
          </div>
        </div>
        {toggle && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">Enabled</span>
            <Switch checked={toggle.checked} onChange={toggle.onChange} label={`Enable ${module.label}`} />
          </div>
        )}
      </div>

      {callout && <div className="dash-callout text-sm text-neutral-300">{callout}</div>}

      {tabs && <ModuleTabs tabs={tabs} />}

      <div className="space-y-4">{children}</div>
    </div>
  );
}
