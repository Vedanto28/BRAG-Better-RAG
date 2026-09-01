import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1 text-[11px] font-medium text-[#f5f7fa] bg-[#0f1115] border border-[#24272f] rounded-md shadow-lg whitespace-nowrap pointer-events-none transition-all ${
            position === 'top'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
