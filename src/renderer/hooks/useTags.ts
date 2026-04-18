import { useTagStore } from '@renderer/stores/tagStore';

export function useTags() {
  const tags = useTagStore((s) => s.tags);
  const selectedTagIds = useTagStore((s) => s.selectedTagIds);
  const toggleTag = useTagStore((s) => s.toggleTag);

  return {
    tags,
    selectedTagIds,
    toggleTag,
  };
}
