import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}

// Label + control wrapper for modal forms. Generates an id, links the <label> to it via
// htmlFor, and injects it onto the child control (respecting an id the caller already set).
export function Field({ label, children, hint, required }: FieldProps) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id: (children.props as { id?: string }).id ?? id,
      })
    : children;

  return (
    <div className="w-full">
      <label htmlFor={id} className="label-text mb-1 block">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {control}
      {hint && <p className="text-xs text-base-content/60 mt-1">{hint}</p>}
    </div>
  );
}
