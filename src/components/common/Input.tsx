import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorMessage, leftIcon, rightIcon, className = '', id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="block text-xs font-semibold text-slate-600">
              {label}
              {required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {!required && <span className="text-[11px] text-slate-400">Optional</span>}
          </div>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full bg-white/80 backdrop-blur-sm border rounded-xl py-2 text-xs text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:opacity-50 disabled:bg-slate-100/70 disabled:text-slate-400 shadow-sm ${leftIcon ? 'pl-9' : 'pl-3'
              } ${rightIcon ? 'pr-9' : 'pr-3'} ${errorMessage
                ? 'border-rose-400 focus:border-rose-400'
                : 'border-slate-300/80 hover:border-slate-400 focus:border-blue-500'
              } ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input';
