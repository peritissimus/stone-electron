import { createElement } from 'react';
import { House, CheckSquare, Graph, Tag } from 'phosphor-react';
import type { NavDescriptor } from './types';

const exactMatch = (path: string) => (pathname: string) =>
  pathname === path && !pathname.startsWith('/note/');

export const PRIMARY_DESTINATIONS: readonly NavDescriptor[] = Object.freeze([
  {
    id: 'home',
    path: '/home',
    label: 'Home',
    icon: createElement(House, { size: 14 }),
    isActive: exactMatch('/home'),
    section: 'primary',
  },
  {
    id: 'tasks',
    path: '/tasks',
    label: 'Tasks',
    icon: createElement(CheckSquare, { size: 14 }),
    isActive: exactMatch('/tasks'),
    section: 'primary',
  },
  {
    id: 'graph',
    path: '/graph',
    label: 'Graph',
    icon: createElement(Graph, { size: 14 }),
    isActive: exactMatch('/graph'),
    section: 'primary',
  },
  {
    id: 'topics',
    path: '/topics',
    label: 'Topics',
    icon: createElement(Tag, { size: 14 }),
    isActive: exactMatch('/topics'),
    section: 'primary',
  },
]);
