/**
 * InputModal Component - Token-based modal for text input
 *
 * Implements: specs/components.ts#InputModalProps
 * Replaces: Manual Dialog + Input + Button combinations with inline styling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/base/ui/dialog';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { SizeVariant, sizePaddingClasses } from './tokens';
import { cn } from '@renderer/lib/utils';

export interface InputModalProps {
  /** Modal open state */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Submit handler - receives trimmed input value */
  onSubmit: (value: string) => void;
  /** Size variant for spacing */
  size?: SizeVariant;
  /** Left content (title/header) */
  left?: React.ReactNode;
  /** Right content (additional header elements) */
  right?: React.ReactNode;
  /** Input placeholder */
  placeholder?: string;
  /** Default input value */
  defaultValue?: string;
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
}

/**
 * InputModal composite - consistent modal for text input with token-based sizing.
 *
 * @example
 * <InputModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   onSubmit={handleSubmit}
 *   left={<Heading3>Create New Tag</Heading3>}
 *   placeholder="Enter tag name"
 *   submitLabel="Create"
 * />
 */
export const InputModal = React.forwardRef<HTMLDivElement, InputModalProps>(
  (
    {
      isOpen,
      onClose,
      onSubmit,
      size = 'normal',
      left,
      right,
      placeholder = '',
      defaultValue = '',
      submitLabel = 'Create',
      cancelLabel = 'Cancel',
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset the input when the modal opens (or the default changes while open)
    const [prevReset, setPrevReset] = useState({ isOpen, defaultValue });
    if (isOpen !== prevReset.isOpen || defaultValue !== prevReset.defaultValue) {
      setPrevReset({ isOpen, defaultValue });
      if (isOpen) {
        setValue(defaultValue);
      }
    }

    // Focus input when modal opens
    useEffect(() => {
      if (!isOpen) return;
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedValue = value.trim();
      if (trimmedValue) {
        onSubmit(trimmedValue);
        setValue('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent ref={ref} className="sm:max-w-[425px]" {...props}>
          {(left || right) && (
            <DialogHeader>
              <div className="flex items-center justify-between">
                {left && <DialogTitle className="flex-1">{left}</DialogTitle>}
                {right && <div className="flex items-center gap-2">{right}</div>}
              </div>
            </DialogHeader>
          )}
          <form onSubmit={handleSubmit}>
            <div className={cn('py-4', sizePaddingClasses[size])}>
              <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={!value.trim()}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  },
);

InputModal.displayName = 'InputModal';
