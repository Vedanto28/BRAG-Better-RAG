import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  required,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-[#a5adbb] flex items-center gap-1 select-none">
          <span>{label}</span>
          {required && <span className="text-[#fb7185]">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-[#6c7280] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full bg-[#0f1115] border ${
            error ? 'border-[#fb7185]' : 'border-[#24272f] hover:border-[#3b82f6]/40'
          } rounded-lg ${leftIcon ? 'pl-9' : 'pl-3.5'} ${
            rightIcon ? 'pr-9' : 'pr-3.5'
          } py-2 text-sm text-[#f5f7fa] placeholder-[#6c7280] focus:outline-none focus:border-[#8a74ff] focus:ring-1 focus:ring-[#8a74ff] transition-all duration-150 font-mono ${className}`}
          {...props}
        />
        {rightIcon && <div className="absolute right-3 text-[#6c7280] flex items-center justify-center">{rightIcon}</div>}
      </div>
      {error && (
        <span id={errorId} className="text-xs text-[#fb7185] font-medium flex items-center gap-1 mt-0.5">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={helperId} className="text-xs text-[#6c7280] font-normal">
          {helperText}
        </span>
      )}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = '',
  id,
  required,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-[#a5adbb] select-none">
          {label} {required && <span className="text-[#fb7185]">*</span>}
        </label>
      )}
      <select
        id={selectId}
        required={required}
        className={`w-full bg-[#0f1115] border ${
          error ? 'border-[#fb7185]' : 'border-[#24272f]'
        } rounded-lg px-3.5 py-2 text-sm text-[#f5f7fa] focus:outline-none focus:border-[#8a74ff] focus:ring-1 focus:ring-[#8a74ff] transition-all duration-150 font-mono ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#191c22] text-[#f5f7fa]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-[#fb7185] font-medium">{error}</span>}
    </div>
  );
};
