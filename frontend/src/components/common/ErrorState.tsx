import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  error?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load telemetry',
  error = 'An unexpected connection or API failure occurred.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-[#fb7185]/10 border border-[#fb7185]/30 rounded-xl my-4 text-center">
      <div className="w-10 h-10 rounded-full bg-[#fb7185]/20 text-[#fb7185] flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-[#f5f7fa]">{title}</h4>
      <p className="text-xs text-[#fb7185] font-mono mt-1 mb-4 max-w-md">{error}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={onRetry}>
          Retry Operation
        </Button>
      )}
    </div>
  );
};
