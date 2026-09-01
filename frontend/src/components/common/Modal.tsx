import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`w-full ${maxWidth} bg-[#191c22] border border-[#24272f] rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b1e24]">
          <div>
            <h3 id="modal-title" className="text-base font-semibold text-[#f5f7fa]">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-[#6c7280] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[#6c7280] hover:text-[#f5f7fa] p-1.5 rounded-lg hover:bg-[#20242c] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDanger = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {isDanger && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#fb7185]/10 border border-[#fb7185]/20 text-[#fb7185]">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-medium">This action cannot be undone.</span>
          </div>
        )}
        <p className="text-sm text-[#a5adbb] leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
