import React from 'react';
import { ModalLayout } from './ModalLayout';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabbedModalProps {
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
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.icon}
          {tab.label}
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
