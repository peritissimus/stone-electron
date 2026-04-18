import { useTopicCrud } from './useTopicCrud';
import { useTopicEmbedding } from './useTopicEmbedding';
import { useTopicSearch } from './useTopicSearch';

export function useTopicAPI() {
  const crud = useTopicCrud();
  const embedding = useTopicEmbedding({ reloadTopics: crud.loadTopics });
  const search = useTopicSearch();

  return {
    ...crud,
    ...embedding,
    ...search,
  };
}
