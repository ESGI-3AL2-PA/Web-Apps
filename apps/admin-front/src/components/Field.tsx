import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}

// Label + control wrapper for modal forms.
export function Field({ label, children, hint, required }: FieldProps) {
  return (
    <div className="w-full">
      <label className="label-text mb-1 block">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-base-content/60 mt-1">{hint}</p>}
    </div>
  );
}
