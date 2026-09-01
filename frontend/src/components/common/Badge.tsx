import React from 'react';

export interface BadgeProps {
  variant?: 'violet' | 'blue' | 'mint' | 'amber' | 'coral' | 'emerald' | 'muted';
  label: string;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'violet',
  label,
  dot = true,
  pulse = false,
  size = 'md',
}) => {
  const stylesMap = {
    violet: {
      bg: 'bg-[#7c5cff]/14 text-[#a18dff] border-[#7c5cff]/30',
      dot: 'bg-[#7c5cff]',
    },
    blue: {
      bg: 'bg-[#3b82f6]/14 text-[#60a5fa] border-[#3b82f6]/30',
      dot: 'bg-[#3b82f6]',
    },
    mint: {
      bg: 'bg-[#34d399]/14 text-[#34d399] border-[#34d399]/30',
      dot: 'bg-[#34d399]',
    },
    amber: {
      bg: 'bg-[#fbbf24]/14 text-[#fbbf24] border-[#fbbf24]/30',
      dot: 'bg-[#fbbf24]',
    },
    coral: {
      bg: 'bg-[#fb7185]/14 text-[#fb7185] border-[#fb7185]/30',
      dot: 'bg-[#fb7185]',
    },
    emerald: {
      bg: 'bg-[#10b981]/14 text-[#10b981] border-[#10b981]/30',
      dot: 'bg-[#10b981]',
    },
    muted: {
      bg: 'bg-[#191c22] text-[#a5adbb] border-[#24272f]',
      dot: 'bg-[#6c7280]',
    },
  };

  const current = stylesMap[variant];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${current.bg} ${sizeClasses} select-none`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${current.dot} ${
            pulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
