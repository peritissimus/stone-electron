import { createElement } from 'react';
import { House, BookOpen, CheckSquare, Graph, Brain } from 'phosphor-react';
import type { NavDescriptor } from './types';
import { toHome, toJournals, toTasks, toGraph, toTopics } from './routes';

const exactMatch = (path: string) => (pathname: string) =>
  pathname === path && !pathname.startsWith('/note/');

export const PRIMARY_DESTINATIONS: readonly NavDescriptor[] = Object.freeze([
  {
    id: 'home',
    path: toHome(),
    label: 'Home',
    icon: createElement(House, { size: 14 }),
    isActive: exactMatch(toHome()),
    section: 'primary',
  },
  {
    id: 'journals',
    path: toJournals(),
    label: 'Journals',
    icon: createElement(BookOpen, { size: 14 }),
    isActive: exactMatch(toJournals()),
    section: 'primary',
  },
  {
    id: 'tasks',
    path: toTasks(),
    label: 'Tasks',
    icon: createElement(CheckSquare, { size: 14 }),
    isActive: exactMatch(toTasks()),
    section: 'primary',
  },
  {
    id: 'graph',
    path: toGraph(),
    label: 'Graph',
    icon: createElement(Graph, { size: 14 }),
    isActive: exactMatch(toGraph()),
    section: 'primary',
  },
  {
    id: 'topics',
    path: toTopics(),
    label: 'Knowledge',
    icon: createElement(Brain, { size: 14 }),
    isActive: exactMatch(toTopics()),
    section: 'primary',
  },
]);
