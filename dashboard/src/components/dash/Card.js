export default function Card({ title, description, action, children }) {
  return (
    <section className="dash-card overflow-hidden">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-neutral-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
