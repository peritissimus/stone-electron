/**
 * GetRelatedNotesUseCase — drives the "Related Notes" panel in the editor.
 *
 * Strategy (scoring lives in RelatedNotesScorer):
 *   1. Load all embedded chunks for the workspace and split them into the
 *      source note's chunks and everything else.
 *   2. Stage 1 — semantic shortlist: score candidate notes by chunk-to-chunk
 *      alignment with the source chunks, calibrated against the workspace's
 *      own noise distribution.
 *   3. Lexical leg: the source note's most distinctive terms (TF-IDF) run
 *      through FTS5; lexical hits join the shortlist so notes sharing rare
 *      proper nouns or identifiers surface even when the embedding model
 *      misses them.
 *   4. Stage 2 — structural re-rank: boost by shared tags, Adamic-Adar
 *      link-graph overlap, lexical strength, and same-notebook placement;
 *      demote journal/daily notes.
 *   5. Hydrate the top N with titles and the best chunk's heading path +
 *      excerpt so the UI can show *why* a note is related, not just that
 *      it is.
 *
 * The earlier centroid-vector + title-reranker approach is intentionally
 * gone: the note-mean vector blurred multi-topic notes into generic matches,
 * and cross-encoder scores keyed on the note title mixed incomparable score
 * scales into the displayed percentage.
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type {
  IIndexRepository,
  NoteChunkRecord,
} from '../../../domain/ports/out/IIndexRepository';
import type { ITagRepository } from '../../../domain/ports/out/ITagRepository';
import type { INoteLinkRepository } from '../../../domain/ports/out/INoteLinkRepository';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
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
/**
 * Shortlist entry bar. Low on purpose: lexical/graph/tag boosts may carry a
 * borderline note over the final bar, but a note below this is semantic
 * noise that no amount of structure should resurrect.
 */
const MIN_SEMANTIC_SCORE = 0.15;
/** Final bar; the renderer applies its own display threshold above this. */
const MIN_FINAL_SCORE = 0.35;
const SNIPPET_CHARS = 240;

/** Lexical leg sizing. */
const DISTINCTIVE_TERMS = 12;
const LEXICAL_CHUNK_LIMIT = 60;
const LEXICAL_SHORTLIST = 5;

export class GetRelatedNotesUseCase implements IGetRelatedNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
    private readonly tagRepository: ITagRepository,
    private readonly noteLinkRepository: INoteLinkRepository,
    private readonly appConfigRepository: IAppConfigRepository,
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
    const semanticByNote = new Map(semantic.map((c) => [c.noteId, c]));

    const lexicalStrength = await this.lexicalStrengthByNote(
      request.noteId,
      sourceChunks,
      candidateChunks,
      workspaceId,
    );

    // Shortlist: top semantic candidates, plus the strongest lexical hits —
    // a rare term match can rescue a note the embeddings underrate.
    const shortlistIds = new Set(
      semantic
        .filter((c) => c.semanticScore >= MIN_SEMANTIC_SCORE)
        .slice(0, Math.max(limit * SHORTLIST_MULTIPLIER, SHORTLIST_MIN))
        .map((c) => c.noteId),
    );
    const lexicalRanked = [...lexicalStrength.entries()].sort((a, b) => b[1] - a[1]);
    for (const [noteId] of lexicalRanked.slice(0, LEXICAL_SHORTLIST)) {
      if (semanticByNote.has(noteId)) shortlistIds.add(noteId);
    }
    if (shortlistIds.size === 0) return { results: [] };
    const shortlist = [...shortlistIds].map((id) => semanticByNote.get(id)!);

    const [tagsByNote, allLinks, candidateNotes, appConfig] = await Promise.all([
      this.tagRepository.getTagsForNotes([request.noteId, ...shortlistIds]),
      this.noteLinkRepository.findAll(),
      Promise.all([...shortlistIds].map((id) => this.noteRepository.findById(id))),
      this.appConfigRepository.get(),
    ]);

    const noteById = new Map(
      candidateNotes.filter((n) => n !== null).map((n) => [n.id, n]),
    );
    const journalPrefix = `${appConfig.notes.locationPolicy.journalFolder}/`;

    // Full undirected adjacency — Adamic-Adar needs every note's degree,
    // not just the shortlist's, to weigh common neighbors.
    const neighbors = new Map<string, Set<string>>();
    for (const link of allLinks) {
      getOrCreate(neighbors, link.sourceNoteId).add(link.targetNoteId);
      getOrCreate(neighbors, link.targetNoteId).add(link.sourceNoteId);
    }
    const degreeOf = (id: string) => neighbors.get(id)?.size ?? 0;
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
            degreeOf,
            sourceNeighbors.has(candidate.noteId),
          ),
          lexicalStrength: lexicalStrength.get(candidate.noteId) ?? 0,
          sameNotebook:
            note.notebookId !== null && note.notebookId === candidateNote.notebookId,
          isJournal:
            candidateNote.filePath !== null &&
            candidateNote.filePath.startsWith(journalPrefix),
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

  /**
   * Lexical evidence per candidate note: the source note's most distinctive
   * terms (TF-IDF against the rest of the workspace) searched via FTS5,
   * strength derived from each note's best rank position in the results.
   */
  private async lexicalStrengthByNote(
    sourceNoteId: string,
    sourceChunks: NoteChunkRecord[],
    candidateChunks: NoteChunkRecord[],
    workspaceId: string,
  ): Promise<Map<string, number>> {
    const strength = new Map<string, number>();

    const corpusDocs = new Map<string, string[]>();
    for (const chunk of candidateChunks) {
      getOrCreateArray(corpusDocs, chunk.noteId).push(chunk.text);
    }
    const terms = RelatedNotesScorer.distinctiveTerms(
      sourceChunks.map((c) => c.text),
      [...corpusDocs.values()].map((texts) => texts.join(' ')),
      DISTINCTIVE_TERMS,
    );
    if (terms.length === 0) return strength;

    try {
      const hits = await this.indexRepository.searchFullText(terms.join(' '), {
        limit: LEXICAL_CHUNK_LIMIT,
        workspaceId,
      });
      // Note order of first appearance in the chunk ranking → linear decay.
      const noteOrder: string[] = [];
      for (const hit of hits) {
        const noteId = hit.chunk.noteId;
        if (noteId === sourceNoteId || noteOrder.includes(noteId)) continue;
        noteOrder.push(noteId);
      }
      noteOrder.forEach((noteId, idx) => {
        strength.set(noteId, 1 - idx / noteOrder.length);
      });
    } catch {
      // Lexical leg is best-effort; semantics carry the ranking without it.
    }
    return strength;
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

function getOrCreateArray(map: Map<string, string[]>, key: string): string[] {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  return arr;
}

function trimForSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= SNIPPET_CHARS) return normalized;
  return `${normalized.slice(0, SNIPPET_CHARS).trim()}…`;
}
