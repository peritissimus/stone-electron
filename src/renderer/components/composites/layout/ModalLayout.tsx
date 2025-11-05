import React from 'react';
import { X } from 'phosphor-react';
import { Button } from '@renderer/components/base/ui/button';
import { Heading3 } from '@renderer/components/base/ui/text';

export interface ModalLayoutProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function ModalLayout({
  title,
  onClose,
  children,
  sidebar,
  className = '',
  maxWidth = 'max-w-3xl',
}: ModalLayoutProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-background rounded-lg shadow-xl ${maxWidth} w-full max-h-[90vh] overflow-hidden border border-border ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <Heading3>{title}</Heading3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </Button>
        </div>

        <div className="flex h-[600px]">
          {/* Optional Sidebar */}
          {sidebar && <div className="w-48 border-r border-border p-4">{sidebar}</div>}

          {/* Content */}
          <div className={`flex-1 p-6 overflow-y-auto ${sidebar ? '' : 'max-w-none'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
