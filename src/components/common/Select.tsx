import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, errorMessage, options, children, className = '', id, required, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={selectId} className="block text-xs font-semibold text-slate-600">
              {label}
              {required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {!required && <span className="text-[11px] text-slate-400">Optional</span>}
          </div>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={`w-full appearance-none bg-white/80 backdrop-blur-sm border rounded-xl py-2 pl-3 pr-8 text-xs text-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer disabled:opacity-50 disabled:bg-slate-100/70 shadow-sm ${errorMessage
                ? 'border-rose-400 focus:border-rose-400'
                : 'border-slate-300/80 hover:border-slate-400 focus:border-blue-500'
              } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white text-slate-800">
                  {opt.label}
                </option>
              ))
              : children}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {errorMessage ? (
          <p className="text-[11px] text-rose-500 font-medium">{errorMessage}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
