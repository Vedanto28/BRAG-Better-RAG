import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height }) => {
  return (
    <div
      className={`animate-pulse bg-[#1b1e24] rounded-md ${className}`}
      style={{ width, height }}
    />
  );
};

export interface LoadingStateProps {
  label?: string;
  subtext?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading investigation telemetry...',
  subtext = 'Fetching evidence across internal repository & MCP providers',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#7c5cff]/14 border border-[#7c5cff]/30 flex items-center justify-center text-[#8a74ff]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[#f5f7fa]">{label}</h4>
        <p className="text-xs text-[#6c7280] max-w-sm">{subtext}</p>
      </div>
    </div>
  );
};
