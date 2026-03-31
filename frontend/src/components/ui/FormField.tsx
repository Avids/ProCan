import React from 'react';

interface BaseProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

type InputProps = BaseProps & React.InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type TextareaProps = BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };
type SelectProps = BaseProps & React.SelectHTMLAttributes<HTMLSelectElement> & {
  as: 'select';
  children: React.ReactNode;
};

type FormFieldProps = InputProps | TextareaProps | SelectProps;

const inputBase =
  'w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all';
const inputNormal =
  'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const inputError =
  'border-red-400 dark:border-red-600 focus:ring-2 focus:ring-red-400';

export default function FormField(props: FormFieldProps) {
  const { label, error, required, hint, as = 'input', ...rest } = props;
  const stateClass = error ? inputError : inputNormal;
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {as === 'textarea' ? (
        <textarea
          id={id}
          className={`${inputBase} ${stateClass} resize-none`}
          rows={3}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : as === 'select' ? (
        <select
          id={id}
          className={`${inputBase} ${stateClass}`}
          {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {(props as SelectProps).children}
        </select>
      ) : (
        <input
          id={id}
          className={`${inputBase} ${stateClass}`}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
