import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 bg-[#191c22] border border-dashed border-[#24272f] rounded-xl my-4 animate-fadeIn">
      <div className="w-12 h-12 rounded-xl bg-[#7c5cff]/14 text-[#8a74ff] border border-[#7c5cff]/20 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#f5f7fa] mb-1">{title}</h3>
      <p className="text-xs text-[#6c7280] max-w-md leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
