/**
 * TodoList Component - Displays todos from all notes
 *
 * Implements: specs/components.ts#TodoListProps
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Square, ArrowRight } from 'phosphor-react';
import { TodoItem } from '@shared/types';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/lib/logger';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { ListItem } from '@renderer/components/composites';

interface TodoListProps {
  onTodoClick?: (noteId: string) => void;
}

const StateIcon: React.FC<{ state: string }> = ({ state }) => {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'done':
      case 'canceled':
        return 'text-muted-foreground/50';
      case 'doing':
        return 'text-foreground';
      case 'waiting':
      case 'hold':
        return 'text-muted-foreground';
      case 'idea':
        return 'text-muted-foreground/70';
      default:
        return 'text-foreground/80';
    }
  };

  const color = getStateColor(state);

  if (state === 'done' || state === 'canceled') {
    return <CheckSquare size={16} className={color} />;
  }

  return <Square size={16} className={color} />;
};

const StateLabel: React.FC<{ state: string }> = ({ state }) => {
  const getStateLabel = (state: string) => {
    switch (state) {
      case 'todo':
        return 'TODO';
      case 'doing':
        return 'DOING';
      case 'waiting':
        return 'WAITING';
      case 'hold':
        return 'HOLD';
      case 'done':
        return 'DONE';
      case 'canceled':
        return 'CAN';
      case 'idea':
        return 'IDEA';
      default:
        return state.toUpperCase();
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'done':
      case 'canceled':
        return 'bg-muted/50 text-muted-foreground border border-border/50';
      case 'doing':
        return 'bg-foreground/5 text-foreground border border-foreground/10';
      case 'waiting':
      case 'hold':
        return 'bg-muted text-muted-foreground border border-border';
      case 'idea':
        return 'bg-muted/70 text-muted-foreground border border-border/70';
      default:
        return 'bg-accent/50 text-accent-foreground border border-accent/20';
    }
  };

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getStateColor(state)}`}>
      {getStateLabel(state)}
    </span>
  );
};

export function TodoList({ onTodoClick }: TodoListProps) {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedFile, setActiveFolder } = useFileTree();
  const { getAllTodos } = useNoteAPI();

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      setLoading(true);
      const data = await getAllTodos();
      if (Array.isArray(data)) {
        // Filter out completed todos and sort by state priority
        const activeTodos = data.filter((todo) => !todo.checked);
        const sortedTodos = activeTodos.sort((a, b) => {
          const priority: Record<string, number> = {
            doing: 0,
            waiting: 1,
            todo: 2,
            hold: 3,
            idea: 4,
            done: 5,
            canceled: 6,
          };
          const aPriority = priority[a.state] ?? 7;
          const bPriority = priority[b.state] ?? 7;
          return aPriority - bPriority;
        });
        setTodos(sortedTodos.slice(0, 10)); // Show max 10 todos
      }
    } catch (error) {
      logger.error('[TodoList] Failed to load todos', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleTodoClick = (todo: TodoItem) => {
    logger.info('[TodoList] Todo clicked', { noteId: todo.noteId, todoId: todo.id });

    // Set the selected file and active folder
    if (todo.notePath) {
      const normalizedPath = todo.notePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
      setSelectedFile(normalizedPath);

      const lastSlash = normalizedPath.lastIndexOf('/');
      if (lastSlash > 0) {
        const folderPath = normalizedPath.substring(0, lastSlash);
        setActiveFolder(folderPath);
      }
    }

    // Navigate to note
    navigate(`/note/${todo.noteId}`);

    // Call the optional callback
    if (onTodoClick) {
      onTodoClick(todo.noteId);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
            <Skeleton className="w-4 h-4 rounded mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No active tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <ListItem
          key={todo.id}
          size="normal"
          onClick={() => handleTodoClick(todo)}
          className="rounded-lg border-none group"
          left={<StateIcon state={todo.state} />}
          right={
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        >
          <div className="flex items-center gap-2 mb-1">
            <StateLabel state={todo.state} />
            {todo.noteTitle && (
              <span className="text-xs text-muted-foreground truncate">{todo.noteTitle}</span>
            )}
          </div>
          <p className="text-sm line-clamp-2">{todo.text}</p>
        </ListItem>
      ))}
    </div>
  );
}
