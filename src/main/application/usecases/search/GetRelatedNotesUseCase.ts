/**
 * GetRelatedNotesUseCase — drives the "Related Notes" panel in the editor.
 *
 * Strategy (scoring lives in RelatedNotesScorer):
 *   1. Load all embedded chunks for the workspace and split them into the
 *      source note's chunks and everything else.
 *   2. Stage 1 — semantic shortlist: score candidate notes by chunk-to-chunk
 *      alignment with the source chunks (best pair + depth + breadth),
 *      calibrated to [0, 1].
 *   3. Stage 2 — structural re-rank: boost shortlisted notes by shared tags,
 *      wiki-link-graph neighborhood overlap, and same-notebook placement.
 *   4. Hydrate the top N with titles and the best chunk's heading path +
 *      excerpt so the UI can show *why* a note is related, not just that
 *      it is.
 *
 * The earlier centroid-vector + title-reranker approach is intentionally
 * gone: the note-mean vector blurred multi-topic notes into generic matches,
 * and cross-encoder scores keyed on the note title mixed incomparable score
 * scales into the displayed percentage.
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { ITagRepository } from '../../../domain/ports/out/ITagRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import { RelatedNotesScorer } from '../../../domain/services/RelatedNotesScorer';
import type {
  IGetRelatedNotesUseCase,
  GetRelatedNotesRequest,
  GetRelatedNotesResponse,
  RelatedNoteMatch,
} from '../../../domain/ports/in/ISearchUseCases';

const DEFAULT_LIMIT = 5;
/** Semantic shortlist is wider than the final cut so structure can re-rank. */
const SHORTLIST_MULTIPLIER = 3;
const SHORTLIST_MIN = 12;
/** Structure alone must not surface a semantically unrelated note. */
const MIN_SEMANTIC_SCORE = 0.3;
/** Final bar; the renderer applies its own display threshold above this. */
const MIN_FINAL_SCORE = 0.35;
const SNIPPET_CHARS = 240;

export class GetRelatedNotesUseCase implements IGetRelatedNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
    private readonly tagRepository: ITagRepository,
    private readonly noteLinkRepository: INoteLinkRepository,
  ) {}

  async execute(request: GetRelatedNotesRequest): Promise<GetRelatedNotesResponse> {
    const limit = request.limit ?? DEFAULT_LIMIT;
    if (limit <= 0) return { results: [] };

    const note = await this.noteRepository.findById(request.noteId);
    if (!note) return { results: [] };

    const workspaceId = request.workspaceId ?? note.workspaceId ?? undefined;
    if (!workspaceId) return { results: [] };

    const allChunks = await this.indexRepository.getChunksForWorkspace(workspaceId);
    const embedded = allChunks.filter((c) => c.embedding && c.embedding.length > 0);
    const sourceChunks = embedded.filter((c) => c.noteId === request.noteId);
    const candidateChunks = embedded.filter((c) => c.noteId !== request.noteId);
    if (sourceChunks.length === 0 || candidateChunks.length === 0) return { results: [] };

    const semantic = RelatedNotesScorer.scoreCandidates(sourceChunks, candidateChunks);
    const shortlist = semantic
      .filter((c) => c.semanticScore >= MIN_SEMANTIC_SCORE)
      .slice(0, Math.max(limit * SHORTLIST_MULTIPLIER, SHORTLIST_MIN));
    if (shortlist.length === 0) return { results: [] };

    const shortlistIds = shortlist.map((c) => c.noteId);
    const [tagsByNote, allLinks, candidateNotes] = await Promise.all([
      this.tagRepository.getTagsForNotes([request.noteId, ...shortlistIds]),
      this.noteLinkRepository.findAll(),
      Promise.all(shortlistIds.map((id) => this.noteRepository.findById(id))),
    ]);

    const noteById = new Map(
      candidateNotes.filter((n) => n !== null).map((n) => [n.id, n]),
    );

    // Link-graph adjacency, restricted to the notes we're scoring.
    const involved = new Set([request.noteId, ...shortlistIds]);
    const neighbors = new Map<string, Set<string>>();
    for (const link of allLinks) {
      if (involved.has(link.sourceNoteId)) {
        getOrCreate(neighbors, link.sourceNoteId).add(link.targetNoteId);
      }
      if (involved.has(link.targetNoteId)) {
        getOrCreate(neighbors, link.targetNoteId).add(link.sourceNoteId);
      }
    }
    const emptySet = new Set<string>();
    const sourceNeighbors = neighbors.get(request.noteId) ?? emptySet;
    const sourceTagIds = new Set((tagsByNote.get(request.noteId) ?? []).map((t) => t.id));

    const results: RelatedNoteMatch[] = shortlist
      .flatMap((candidate) => {
        const candidateNote = noteById.get(candidate.noteId);
        if (!candidateNote) return []; // deleted since indexing

        const candidateTagIds = new Set(
          (tagsByNote.get(candidate.noteId) ?? []).map((t) => t.id),
        );
        const candidateNeighbors = neighbors.get(candidate.noteId) ?? emptySet;
        const score = RelatedNotesScorer.finalScore(candidate.semanticScore, {
          tagJaccard: RelatedNotesScorer.tagJaccard(sourceTagIds, candidateTagIds),
          graphOverlap: RelatedNotesScorer.graphOverlap(
            sourceNeighbors,
            candidateNeighbors,
            sourceNeighbors.has(candidate.noteId) || candidateNeighbors.has(request.noteId),
          ),
          sameNotebook:
            note.notebookId !== null && note.notebookId === candidateNote.notebookId,
        });
        if (score < MIN_FINAL_SCORE) return [];

        return [
          {
            noteId: candidate.noteId,
            title: candidateNote.title || 'Untitled',
            similarity: score,
            matchedChunks: Math.max(1, candidate.strongChunks),
            bestChunk: {
              chunkId: candidate.bestChunk.id,
              headingPath: candidate.bestChunk.headingPath,
              excerpt: trimForSnippet(candidate.bestChunk.text),
            },
          },
        ];
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return { results };
  }
}

function getOrCreate(map: Map<string, Set<string>>, key: string): Set<string> {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

function trimForSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= SNIPPET_CHARS) return normalized;
  return `${normalized.slice(0, SNIPPET_CHARS).trim()}…`;
}
