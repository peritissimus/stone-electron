/**
 * Composite Components - Token-Based High-Level Components
 *
 * These components combine containers + styling patterns to eliminate inline classes.
 * All styling uses token-based sizing and spacing tokens.
 */

// Export tokens
export { type SizeVariant } from './tokens';
export {
  sizeTextClasses,
  sizePaddingClasses,
  sizeHeightClasses,
  gapClasses,
  spacerSizeClasses,
  justifyClasses,
} from './tokens';

// Export components
export { Header, type HeaderProps } from './Header';
export { ControlGroup, type ControlGroupProps } from './ControlGroup';
export { ListItem, type ListItemProps } from './ListItem';
export { ListContainer, type ListContainerProps } from './ListContainer';
export { CompactCard, type CompactCardProps } from './CompactCard';
export { Spacer, type SpacerProps } from './Spacer';
export { IconButton, type IconButtonProps } from './IconButton';
export { PanelFooter, type PanelFooterProps } from './PanelFooter';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { QuickLink, type QuickLinkProps } from './QuickLink';
export { TreeItem, type TreeItemProps } from './TreeItem';
export {
  ToolbarButton,
  ToolbarDivider,
  type ToolbarButtonProps,
  type ToolbarDividerProps,
} from './ToolbarButton';
export { InputModal, type InputModalProps } from './InputModal';
export { CommandMenuItem, type CommandMenuItemProps } from './CommandMenuItem';

// Layout components
export { LayoutContainer, type LayoutContainerProps } from './layout/LayoutContainer';
export { MainContentArea } from './layout/MainContentArea';
export { MainLayout } from './layout/MainLayout';
export { ModalLayout, type ModalLayoutProps } from './layout/ModalLayout';
export { NoteListPanel } from './layout/NoteListPanel';
export { ResizablePanel, type ResizablePanelProps } from './layout/ResizablePanel';
export { SidebarPanel } from './layout/SidebarPanel';
export { TabbedModal, type TabbedModalProps, type TabItem } from './layout/TabbedModal';
