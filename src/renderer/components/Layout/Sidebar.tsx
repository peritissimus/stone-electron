/**
 * Sidebar Component - Navigation and organization
 */

import React from 'react'
import { useUIStore } from '../../stores/uiStore'
import { NotebookTree } from '../Notebook/NotebookTree'
import { TagList } from '../Tag/TagList'
import {
  BookOpen,
  Tag,
  Search,
  Settings,
  Star,
  Archive,
  Clock,
  Plus,
} from 'lucide-react'

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel, openSettings } = useUIStore()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stone</h1>
        <button
          onClick={openSettings}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Panel Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSidebarPanel('notebooks')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            sidebarPanel === 'notebooks'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <BookOpen size={16} />
          Notebooks
        </button>
        <button
          onClick={() => setSidebarPanel('tags')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            sidebarPanel === 'tags'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Tag size={16} />
          Tags
        </button>
      </div>

      {/* Quick Links */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <QuickLink icon={<Star size={16} />} label="Favorites" />
        <QuickLink icon={<Clock size={16} />} label="Recent" />
        <QuickLink icon={<Archive size={16} />} label="Archive" />
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {sidebarPanel === 'notebooks' && <NotebookTree />}
        {sidebarPanel === 'tags' && <TagList />}
      </div>

      {/* New Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
          <Plus size={18} />
          {sidebarPanel === 'notebooks' ? 'New Notebook' : 'New Tag'}
        </button>
      </div>
    </div>
  )
}

interface QuickLinkProps {
  icon: React.ReactNode
  label: string
}

function QuickLink({ icon, label }: QuickLinkProps) {
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
      {icon}
      <span>{label}</span>
    </button>
  )
}
