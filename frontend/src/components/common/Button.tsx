import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'tactile';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c5cff] focus:ring-offset-2 focus:ring-offset-[#0a0b0d] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-[#7c5cff] to-[#8a74ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_20px_-10px_rgba(124,92,255,0.6)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_28px_-8px_rgba(124,92,255,0.8)] active:translate-y-[1px] active:scale-[0.98]',
    secondary:
      'bg-[#191c22] border border-[#24272f] text-[#a5adbb] hover:bg-[#20242c] hover:text-[#f5f7fa] hover:border-[#3b82f6]/40 active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa] active:scale-[0.98]',
    danger:
      'bg-[#fb7185]/10 border border-[#fb7185]/30 text-[#fb7185] hover:bg-[#fb7185]/20 hover:border-[#fb7185] active:scale-[0.98]',
    tactile:
      'bg-[#191c22] border border-[#7c5cff]/40 text-[#f5f7fa] hover:border-[#7c5cff] hover:bg-[#20242c] shadow-[0_4px_12px_rgba(124,92,255,0.15)]',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
