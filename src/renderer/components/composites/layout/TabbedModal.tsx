/**
 * TabbedModal Component - Modal with tabbed navigation
 *
 * Implements: specs/components.ts#TabbedModalProps
 */

import React from 'react';
import { ModalLayout } from './ModalLayout';
import { Text } from '@renderer/components/base/ui/text';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabbedModalProps {
  title: string;
  onClose: () => void;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function TabbedModal({
  title,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
  maxWidth,
}: TabbedModalProps) {
  const sidebar = (
    <div className="space-y-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors duration-150 active:scale-[0.98] ${
            activeTab === tab.id
              ? 'bg-accent/40 text-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
          }`}
        >
          {tab.icon}
          <Text as="span" size="sm">
            {tab.label}
          </Text>
        </button>
      ))}
    </div>
  );

  return (
    <ModalLayout
      title={title}
      onClose={onClose}
      sidebar={sidebar}
      className={className}
      maxWidth={maxWidth}
    >
      {children}
    </ModalLayout>
  );
}
