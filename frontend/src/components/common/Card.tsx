import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  active?: boolean;
  glowColor?: 'violet' | 'blue' | 'mint' | 'amber' | 'coral';
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = true,
  active = false,
  glowColor = 'violet',
  className = '',
  ...props
}) => {
  const glowBorderMap = {
    violet: 'hover:border-[#7c5cff]/60 hover:shadow-[0_8px_20px_-10px_rgba(124,92,255,0.4)]',
    blue: 'hover:border-[#3b82f6]/60 hover:shadow-[0_8px_20px_-10px_rgba(59,130,246,0.4)]',
    mint: 'hover:border-[#34d399]/60 hover:shadow-[0_8px_20px_-10px_rgba(52,211,153,0.4)]',
    amber: 'hover:border-[#fbbf24]/60 hover:shadow-[0_8px_20px_-10px_rgba(251,191,36,0.4)]',
    coral: 'hover:border-[#fb7185]/60 hover:shadow-[0_8px_20px_-10px_rgba(251,113,133,0.4)]',
  };

  const activeStyles = active
    ? 'border-[#7c5cff] bg-[#20242c] shadow-[0_8px_24px_-8px_rgba(124,92,255,0.35)]'
    : 'border-[#24272f] bg-[#191c22]';

  const hoverStyles = hoverable
    ? `transition-all duration-250 ease-[cubic-bezier(0.22,0.9,0.3,1)] hover:-translate-y-[3px] hover:bg-[#20242c] ${glowBorderMap[glowColor]}`
    : '';

  return (
    <div
      className={`rounded-xl border p-5 ${activeStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
