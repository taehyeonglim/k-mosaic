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
    <div className="form-label min-w-0 sm:w-32">
      <label htmlFor={id}>{label}</label>
      <select
        className="form-select w-full"
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
