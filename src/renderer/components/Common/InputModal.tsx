/**
 * Input Modal Component - Reusable modal for text input
 */

import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface InputModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  submitLabel?: string
  cancelLabel?: string
}

export function InputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = '',
  defaultValue = '',
  submitLabel = 'Create',
  cancelLabel = 'Cancel',
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      // Focus input when modal opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, defaultValue])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = value.trim()
    if (trimmedValue) {
      onSubmit(trimmedValue)
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-lg shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
