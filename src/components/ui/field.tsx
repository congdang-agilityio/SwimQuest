import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import styles from "./ui.module.css";

type FieldShell = {
  id: string;
  label: ReactNode;
  /** Error text; sets aria-invalid and links it with aria-describedby. */
  error?: ReactNode;
  /** Help text under the control, linked with aria-describedby (`<id>-hint`). */
  hint?: ReactNode;
  /** Use on the dark page (auth screens); labels turn light. */
  onDark?: boolean;
  className?: string;
};

function Shell({
  id,
  label,
  error,
  hint,
  onDark,
  className,
  children,
}: FieldShell & { children: ReactNode }) {
  return (
    <p className={[styles.field, onDark && styles.onDark, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && (
        <small id={`${id}-hint`} className={styles.hint}>
          {hint}
        </small>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </p>
  );
}

function a11y(id: string, error: ReactNode, hint?: ReactNode) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

/** Label above a light-blue rounded input, as in the mockup's forms. */
export function Field({
  id,
  label,
  error,
  hint,
  onDark,
  className,
  ...input
}: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <Shell id={id} label={label} error={error} hint={hint} onDark={onDark} className={className}>
      <input className={styles.control} {...input} {...a11y(id, error, hint)} />
    </Shell>
  );
}

export function TextareaField({
  id,
  label,
  error,
  hint,
  onDark,
  className,
  ...input
}: FieldShell & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  return (
    <Shell id={id} label={label} error={error} hint={hint} onDark={onDark} className={className}>
      <textarea className={styles.control} {...input} {...a11y(id, error, hint)} />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  onDark,
  className,
  ...input
}: FieldShell & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Shell id={id} label={label} error={error} hint={hint} onDark={onDark} className={className}>
      <select className={styles.control} {...input} {...a11y(id, error, hint)} />
    </Shell>
  );
}

/** The bare styled control, for layouts that place the label themselves. */
export const controlClass = styles.control;
