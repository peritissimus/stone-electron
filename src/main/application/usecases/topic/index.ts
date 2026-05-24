import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { IIndexNoteUseCase } from '../../../domain/ports/in/IIndexUseCases';
import type { ITopicUseCases } from '../../../domain/ports/in/ITopicUseCases';
import { InitializeTopicsUseCase } from './InitializeTopicsUseCase';
import { GetAllTopicsUseCase } from './GetAllTopicsUseCase';
import { GetTopicByIdUseCase } from './GetTopicByIdUseCase';
import { CreateTopicUseCase } from './CreateTopicUseCase';
import { UpdateTopicUseCase } from './UpdateTopicUseCase';
import { DeleteTopicUseCase } from './DeleteTopicUseCase';
import { ClassifyNoteUseCase } from './ClassifyNoteUseCase';
import { ClassifyAllNotesUseCase } from './ClassifyAllNotesUseCase';
import { AssignTopicToNoteUseCase } from './AssignTopicToNoteUseCase';
import { RemoveTopicFromNoteUseCase } from './RemoveTopicFromNoteUseCase';
import { GetTopicSimilarNotesUseCase } from './GetTopicSimilarNotesUseCase';
import { TopicSemanticSearchUseCase } from './TopicSemanticSearchUseCase';
import { RecomputeCentroidsUseCase } from './RecomputeCentroidsUseCase';
import { GetEmbeddingStatusUseCase } from './GetEmbeddingStatusUseCase';
import { GetNotesForTopicUseCase } from './GetNotesForTopicUseCase';
import { GetTopicsForNoteUseCase } from './GetTopicsForNoteUseCase';
import { SuggestTopicsUseCase } from './SuggestTopicsUseCase';
import { AdoptSuggestedTopicUseCase } from './AdoptSuggestedTopicUseCase';

export { InitializeTopicsUseCase } from './InitializeTopicsUseCase';
export { GetAllTopicsUseCase } from './GetAllTopicsUseCase';
export { GetTopicByIdUseCase } from './GetTopicByIdUseCase';
export { CreateTopicUseCase } from './CreateTopicUseCase';
export { UpdateTopicUseCase } from './UpdateTopicUseCase';
export { DeleteTopicUseCase } from './DeleteTopicUseCase';
export { ClassifyNoteUseCase } from './ClassifyNoteUseCase';
export { ClassifyAllNotesUseCase } from './ClassifyAllNotesUseCase';
export { AssignTopicToNoteUseCase } from './AssignTopicToNoteUseCase';
export { RemoveTopicFromNoteUseCase } from './RemoveTopicFromNoteUseCase';
export { GetTopicSimilarNotesUseCase } from './GetTopicSimilarNotesUseCase';
export { TopicSemanticSearchUseCase } from './TopicSemanticSearchUseCase';
export { RecomputeCentroidsUseCase } from './RecomputeCentroidsUseCase';
export { GetEmbeddingStatusUseCase } from './GetEmbeddingStatusUseCase';
export { GetNotesForTopicUseCase } from './GetNotesForTopicUseCase';
export { GetTopicsForNoteUseCase } from './GetTopicsForNoteUseCase';
export { SuggestTopicsUseCase } from './SuggestTopicsUseCase';
export { AdoptSuggestedTopicUseCase } from './AdoptSuggestedTopicUseCase';

export interface TopicUseCasesDeps {
  noteRepository: INoteRepository;
  topicRepository: ITopicRepository;
  workspaceRepository: IWorkspaceRepository;
  appConfigRepository: IAppConfigRepository;
  fileStorage: IFileStorage;
  embedder: IEmbedder;
  markdownProcessor: IMarkdownProcessor;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  indexRepository: IIndexRepository;
  indexNote: IIndexNoteUseCase;
  eventPublisher?: IEventPublisher;
}

export function createTopicUseCases(deps: TopicUseCasesDeps): ITopicUseCases {
  const {
    noteRepository,
    topicRepository,
    workspaceRepository,
    appConfigRepository,
    embedder,
    idGenerator,
    indexRepository,
    indexNote,
    eventPublisher,
  } = deps;

  const classifyNote = new ClassifyNoteUseCase(
    noteRepository,
    topicRepository,
    indexRepository,
    indexNote,
    eventPublisher,
  );

  const createTopic = new CreateTopicUseCase(topicRepository, idGenerator, eventPublisher);
  const assignTopicToNote = new AssignTopicToNoteUseCase(topicRepository, eventPublisher);
  const recomputeCentroids = new RecomputeCentroidsUseCase(topicRepository, indexRepository);

  return {
    initialize: new InitializeTopicsUseCase(embedder, topicRepository),
    getAllTopics: new GetAllTopicsUseCase(topicRepository),
    getTopicById: new GetTopicByIdUseCase(topicRepository),
    createTopic,
    updateTopic: new UpdateTopicUseCase(topicRepository, eventPublisher),
    deleteTopic: new DeleteTopicUseCase(topicRepository, eventPublisher),
    classifyNote,
    classifyAllNotes: new ClassifyAllNotesUseCase(
      noteRepository,
      topicRepository,
      workspaceRepository,
      appConfigRepository,
      classifyNote,
      eventPublisher,
    ),
    assignTopicToNote,
    removeTopicFromNote: new RemoveTopicFromNoteUseCase(topicRepository, eventPublisher),
    getSimilarNotes: new GetTopicSimilarNotesUseCase(noteRepository, indexRepository),
    semanticSearch: new TopicSemanticSearchUseCase(workspaceRepository, embedder, indexRepository),
    recomputeCentroids,
    getEmbeddingStatus: new GetEmbeddingStatusUseCase(workspaceRepository, embedder, indexRepository),
    getNotesForTopic: new GetNotesForTopicUseCase(topicRepository, noteRepository),
    getTopicsForNote: new GetTopicsForNoteUseCase(topicRepository),
    suggestTopics: new SuggestTopicsUseCase(indexRepository, workspaceRepository, noteRepository),
    adoptSuggestedTopic: new AdoptSuggestedTopicUseCase(
      createTopic,
      assignTopicToNote,
      recomputeCentroids,
    ),
  };
}
