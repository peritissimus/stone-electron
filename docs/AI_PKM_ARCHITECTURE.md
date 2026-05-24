# AI and Smart PKM Architecture

## Goal

Add LLM-assisted PKM features without making Stone depend on one cloud vendor or
weakening the existing hexagonal architecture.

The core rule is:

- Stone owns indexing, retrieval, persistence, privacy policy, and ranking rules.
- AI SDK providers are optional outbound adapters for generation, cloud embeddings,
  and reranking.
- Renderer code never calls AI providers directly.

## Current Gaps

Stone already has useful pieces:

- `IEmbedder` and a local `@xenova/transformers` worker.
- Search use cases for full-text, semantic, similar notes, and hybrid search.
- `SearchRanker` as a pure domain service.
- Topic classification and semantic search flows.

The gaps to close before a serious smart PKM layer:

- `HybridSearchUseCase` currently returns FTS-style results only.
- `SearchEngine.searchFullText()` is title matching, not real FTS-backed retrieval.
- `notes_fts` is referenced in code/docs but is not backed by a visible migration.
- Embeddings are stored as one note-level blob, which is too coarse for long notes.
- Embedding storage is mixed into `INoteRepository`.
- There is no provider-neutral text generation or reranking port.
- There is no chunk-level citation model for "ask my notes" answers.

## Target Package Use

Use the AI SDK packages in outbound adapters only.

Recommended packages:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/cohere
```

Optional provider packages can be added later:

```bash
pnpm add @ai-sdk/anthropic @ai-sdk/google @ai-sdk/mistral
```

Use cases:

- `ai` `generateText` / `streamText`: answer generation, summaries, outlines.
- `ai` `embed` / `embedMany`: optional cloud embedding provider.
- `ai` `rerank`: optional cloud reranking provider.
- AI SDK provider abstraction: switch providers without changing use cases.

## Backend File Layout

Add the following backend structure:

```text
src/main/
  domain/
    ports/
      in/
        IAIUseCases.ts
        IIndexUseCases.ts
      out/
        ITextGenerator.ts
        IReranker.ts
        IEmbeddingProvider.ts
        IIndexRepository.ts
    services/
      NoteChunker.ts
      SearchQueryPlanner.ts
      SearchRanker.ts

  application/
    dto/
      ai.ts
      index.ts
    usecases/
      ai/
        AskNotesUseCase.ts
        SummarizeNoteUseCase.ts
        SuggestLinksUseCase.ts
        GenerateOutlineUseCase.ts
        index.ts
      indexing/
        IndexNoteUseCase.ts
        RebuildNoteIndexUseCase.ts
        RemoveNoteFromIndexUseCase.ts
        GetIndexStatusUseCase.ts
        index.ts
      search/
        HybridSearchUseCase.ts

  adapters/
    in/
      ipc/
        AIIPC.ts
        IndexIPC.ts
    out/
      persistence/
        IndexRepository.ts
      integrations/
        LocalEmbeddingProvider.ts
        AISDKEmbeddingProvider.ts
        AISDKTextGenerator.ts
        AISDKReranker.ts

  infrastructure/
    workers/
      IndexingWorker.ts
    di/
      container.ts
```

Keep `IEmbedder` temporarily for compatibility, but move new indexing code toward
`IEmbeddingProvider` and `IIndexRepository`.

## Domain Ports

### `IEmbeddingProvider`

Provider-neutral embedding generation. The current local worker and optional AI
SDK cloud adapter both implement this.

```ts
export interface EmbeddingModelInfo {
  provider: 'local' | 'ai-sdk';
  model: string;
  dimensions: number;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: EmbeddingModelInfo;
  usage?: { tokens?: number };
}

export interface IEmbeddingProvider {
  embedMany(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  embedOne(text: string, model?: string): Promise<number[]>;
  getModelInfo(): Promise<EmbeddingModelInfo>;
}
```

### `IReranker`

Reranking is optional. If disabled, the app falls back to pure `SearchRanker`
scores.

```ts
export interface RerankDocument {
  id: string;
  noteId: string;
  title: string;
  headingPath?: string[];
  text: string;
  baseScore: number;
}

export interface RerankedDocument extends RerankDocument {
  rerankScore: number;
}

export interface IReranker {
  rerank(request: {
    query: string;
    documents: RerankDocument[];
    topN: number;
  }): Promise<RerankedDocument[]>;
}
```

### `ITextGenerator`

Generation is used after retrieval, never before retrieval.

```ts
export interface CitationSource {
  chunkId: string;
  noteId: string;
  title: string;
  headingPath?: string[];
  excerpt: string;
}

export interface GenerateAnswerRequest {
  query: string;
  sources: CitationSource[];
  model?: string;
  stream?: boolean;
}

export interface GenerateAnswerResponse {
  text: string;
  usedSources: CitationSource[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ITextGenerator {
  generateAnswer(request: GenerateAnswerRequest): Promise<GenerateAnswerResponse>;
}
```

### `IIndexRepository`

This separates search/index persistence from `INoteRepository`.

```ts
export interface NoteChunkRecord {
  id: string;
  noteId: string;
  workspaceId: string;
  chunkIndex: number;
  headingPath: string[];
  text: string;
  contentHash: string;
  tokenCount: number;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexedNoteStatus {
  noteId: string;
  workspaceId: string;
  contentHash: string;
  indexedAt: Date | null;
  model: string | null;
  dimensions: number | null;
  status: 'pending' | 'indexed' | 'failed';
  error: string | null;
}

export interface ChunkSearchResult {
  chunk: NoteChunkRecord;
  ftsScore?: number;
  semanticScore?: number;
  combinedScore: number;
}

export interface IIndexRepository {
  getStatus(noteId: string): Promise<IndexedNoteStatus | null>;
  upsertStatus(status: IndexedNoteStatus): Promise<void>;
  replaceChunks(noteId: string, chunks: NoteChunkRecord[]): Promise<void>;
  deleteByNoteId(noteId: string): Promise<void>;
  searchFullText(query: string, options: SearchIndexOptions): Promise<ChunkSearchResult[]>;
  searchVector(embedding: number[], options: SearchIndexOptions): Promise<ChunkSearchResult[]>;
}
```

## Domain Services

### `NoteChunker`

Pure domain service.

Responsibilities:

- Convert markdown/plain text into semantic chunks.
- Preserve heading path.
- Keep chunks below configured token/character budget.
- Prefer splitting at headings, paragraphs, tasks, and list boundaries.
- Produce deterministic chunk IDs from note ID plus chunk index or content hash.

Rules:

- No file reads.
- No markdown library imports.
- No AI SDK imports.

### `SearchQueryPlanner`

Pure domain service.

Responsibilities:

- Detect exact-match queries, broad semantic queries, tag filters, and date filters.
- Decide candidate counts, for example:
  - FTS top 80
  - vector top 80
  - rerank top 30
- Normalize search weights.

### `SearchRanker`

Improve current `SearchRanker` to rank chunk and note results:

```text
combined =
  semanticScore * semanticWeight +
  ftsScore * ftsWeight +
  titleBoost +
  headingBoost +
  recencyBoost +
  graphBoost +
  userSignalBoost
```

User signals:

- pinned
- favorite
- recently edited
- manually tagged topics

Graph signals:

- explicit backlinks
- shared topics
- semantic-neighbor strength

## Database Changes

Add a migration for chunk-level indexing.

```sql
CREATE TABLE note_index_records (
  note_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at INTEGER,
  model TEXT,
  dimensions INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE note_chunks (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  heading_path TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  embedding BLOB,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_note_chunks_note_id ON note_chunks(note_id);
CREATE INDEX idx_note_chunks_workspace_id ON note_chunks(workspace_id);
CREATE INDEX idx_note_chunks_hash ON note_chunks(content_hash);

CREATE VIRTUAL TABLE note_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  note_id UNINDEXED,
  workspace_id UNINDEXED,
  title,
  heading_path,
  text,
  tokenize='porter unicode61'
);
```

Keep `notes.embedding` temporarily for backward compatibility, then deprecate it
once topic and search use cases are moved to chunk indexing.

## App Config Changes

Add typed AI configuration to `AppConfig`.

Backend domain mirror:

```ts
export type AIProviderMode = 'local' | 'cloud' | 'disabled';

export interface AIModelConfig {
  textModel: string;
  embeddingModel: string;
  rerankModel: string;
}

export interface AIPrivacyConfig {
  allowCloudInference: boolean;
  allowSendingNoteContent: boolean;
  allowSendingMetadata: boolean;
}

export interface AIIndexingConfig {
  enabled: boolean;
  providerMode: AIProviderMode;
  chunkMaxCharacters: number;
  chunkOverlapCharacters: number;
  batchSize: number;
  autoIndexOnSave: boolean;
}

export interface AIConfig {
  indexing: AIIndexingConfig;
  models: AIModelConfig;
  privacy: AIPrivacyConfig;
}
```

Suggested defaults:

```ts
export const DEFAULT_AI_CONFIG: AIConfig = {
  indexing: {
    enabled: true,
    providerMode: 'local',
    chunkMaxCharacters: 1800,
    chunkOverlapCharacters: 180,
    batchSize: 16,
    autoIndexOnSave: true,
  },
  models: {
    textModel: 'openai/gpt-4.1-mini',
    embeddingModel: 'openai/text-embedding-3-small',
    rerankModel: 'cohere/rerank-v3.5',
  },
  privacy: {
    allowCloudInference: false,
    allowSendingNoteContent: false,
    allowSendingMetadata: false,
  },
};
```

Settings use cases to add:

- `getAI`
- `updateAI`
- `resetAI`

Settings event payload:

```ts
{ scope: 'ai' }
```

## Application Flows

### Index one note

`IndexNoteUseCase`

```text
find note metadata
read markdown from IFileStorage
extract plain text and structure using IMarkdownProcessor
chunk with NoteChunker
hash content
skip unchanged notes unless forced
embed chunks with IEmbeddingProvider
write chunks and FTS rows through IIndexRepository
publish progress event
```

### Rebuild all indexes

`RebuildNoteIndexUseCase`

```text
load workspace notes
clear stale index rows for missing/deleted notes
process notes in batches
emit progress
preserve app responsiveness
record failures per note
```

### Hybrid search

Update `HybridSearchUseCase`:

```text
build query plan
generate query embedding
run FTS and vector searches
merge chunk candidates
score with SearchRanker
optional IReranker if cloud reranking is enabled
aggregate chunks to note-level results
return snippets and citations
```

### Ask notes

`AskNotesUseCase`

```text
run hybrid retrieval
select top cited chunks
call ITextGenerator
return answer with source references
```

The answer should cite chunk/note IDs so the renderer can open the original note
at the relevant heading or text range.

## AI SDK Adapters

### `AISDKEmbeddingProvider`

Responsibilities:

- Use `embed` / `embedMany`.
- Enforce `AIPrivacyConfig`.
- Return model/dimension metadata.
- Capture token usage.
- Never persist API keys.

Sketch:

```ts
import { embedMany } from 'ai';

export class AISDKEmbeddingProvider implements IEmbeddingProvider {
  async embedMany(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.assertCloudContentAllowed();

    const result = await embedMany({
      model: request.model ?? this.config.models.embeddingModel,
      values: request.texts,
    });

    return {
      embeddings: result.embeddings,
      model: {
        provider: 'ai-sdk',
        model: request.model ?? this.config.models.embeddingModel,
        dimensions: result.embeddings[0]?.length ?? 0,
      },
      usage: result.usage,
    };
  }
}
```

### `AISDKReranker`

Responsibilities:

- Use AI SDK `rerank`.
- Only send candidate chunks after local retrieval.
- Cap candidate count.
- Return original IDs and scores.

### `AISDKTextGenerator`

Responsibilities:

- Use `generateText` for non-streaming answers.
- Use `streamText` later for chat-style IPC streaming.
- Require cited sources.
- Refuse to answer without retrieved context unless explicitly configured.

## IPC Changes

Add constants:

```ts
export const AI_CHANNELS = {
  ASK_NOTES: 'ai:askNotes',
  SUMMARIZE_NOTE: 'ai:summarizeNote',
  SUGGEST_LINKS: 'ai:suggestLinks',
} as const;

export const INDEX_CHANNELS = {
  GET_STATUS: 'index:getStatus',
  INDEX_NOTE: 'index:indexNote',
  REBUILD: 'index:rebuild',
} as const;
```

Events:

```ts
INDEX_PROGRESS: 'index:progress'
AI_STREAM_DELTA: 'ai:streamDelta'
AI_STREAM_DONE: 'ai:streamDone'
AI_STREAM_ERROR: 'ai:streamError'
```

## Renderer Changes

Follow the renderer dependency rule:

```text
components -> hooks -> stores -> api -> IPC
```

Add:

```text
src/renderer/
  api/
    aiAPI.ts
    indexAPI.ts
  stores/
    aiStore.ts
    indexStore.ts
  hooks/
    useAskNotes.ts
    useIndexStatus.ts
  components/
    features/
      AI/
        AskNotesPanel.tsx
        SourceCitationList.tsx
        SuggestedLinksPanel.tsx
      Settings/
        AISettings.tsx
```

Initial UI surfaces:

- Ask Notes panel.
- Related notes panel in editor.
- Index status indicator.
- AI settings panel with local/cloud privacy controls.

## Privacy and Safety Defaults

Default behavior must be local-first:

- Local embeddings enabled by default.
- Cloud inference disabled by default.
- Cloud rerank disabled by default.
- Cloud answer generation disabled until the user opts in.
- Show exactly what categories can leave the device:
  - note content
  - note titles
  - note paths
  - tags/topics

Store API keys outside `AppConfig` if possible. Prefer environment variables or
OS keychain integration via a future `ISecretStore` port.

## Migration Path

### Phase 1: Architecture and settings

- Add AI config to `AppConfig`.
- Add `IEmbeddingProvider`, `IReranker`, `ITextGenerator`, `IIndexRepository`.
- Add AI/index use case ports.
- Add IPC constants.

### Phase 2: Chunk index

- Add `note_index_records`, `note_chunks`, `note_chunks_fts`.
- Implement `IndexRepository`.
- Implement `NoteChunker`.
- Implement `IndexNoteUseCase` and `RebuildNoteIndexUseCase`.

### Phase 3: Search upgrade

- Replace title-only search with chunk FTS.
- Merge FTS and vector chunk candidates.
- Use `SearchRanker` to aggregate chunk scores to note scores.
- Return snippets and citations.

### Phase 4: AI SDK adapters

- Install `ai` and selected provider packages.
- Add AI SDK text, embedding, and rerank adapters.
- Wire adapters based on `AppConfig.ai`.

### Phase 5: Smart PKM

- Add Ask Notes panel.
- Add semantic related notes.
- Add smart backlink suggestions.
- Add saved semantic searches.
- Add "organize inbox" command for quick captures.

## Improvements Over Current Design

- Search becomes chunk-level instead of note-level.
- Semantic query quality improves because long notes are not collapsed into one vector.
- Reranking is explicit, swappable, and optional.
- Cloud AI cannot bypass privacy rules.
- AI SDK dependencies stay outside domain/application code.
- `INoteRepository` stops carrying search/vector responsibilities.
- The renderer remains pure: no direct provider calls, no API keys in UI.
- Search results become explainable through snippets and source citations.
- The same retrieval layer powers search, related notes, smart backlinks, and Ask Notes.

## Non-Goals

- Do not replace SQLite immediately.
- Do not make cloud AI SDK providers mandatory.
- Do not send the whole workspace to a model.
- Do not put AI provider configuration in the legacy DB settings table.
- Do not put LLM prompting or provider code in React components.
