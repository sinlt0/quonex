'use client';

import { useState, useTransition } from 'react';

export default function Switch({ checked, onChange, label, disabled }) {
  const [value, setValue] = useState(Boolean(checked));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function toggle() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const result = await onChange(next);
      if (result && result.ok === false) {
        setValue(!next);
        setError(result.error || 'Could not save.');
      } else {
        setError(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled || pending}
        onClick={toggle}
        className="dash-switch"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
