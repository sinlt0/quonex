export default function SettingRow({ title, description, children, stacked = false }) {
  return (
    <div className="dash-divider first:border-t-0 px-5 py-4">
      <div className={stacked ? 'space-y-3' : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6'}>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-sm text-neutral-400">{description}</p>}
        </div>
        {children && <div className={stacked ? '' : 'sm:shrink-0'}>{children}</div>}
      </div>
    </div>
  );
}
