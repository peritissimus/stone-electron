import React from 'react';
import { ModalLayout } from '@renderer/components/Layout/ModalLayout';
import { Button } from '@renderer/components/ui/button';
import { Text } from '@renderer/components/ui/text';

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
        <Button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          variant={activeTab === tab.id ? 'secondary' : 'ghost'}
          className="w-full justify-start px-3 py-2 h-auto"
        >
          {tab.icon}
          <Text as="span" size="sm" className="ml-2">
            {tab.label}
          </Text>
        </Button>
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
