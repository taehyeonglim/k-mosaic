'use client';

export interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(v: string): void;
  id: string;
}

export function SelectField({ label, value, options, onChange, id }: SelectFieldProps) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium text-text" htmlFor={id}>
        {label}
      </label>
      <select
        className="min-h-10 w-full min-w-0 rounded-[var(--km-radius-md)] border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
