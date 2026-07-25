import { Effect, Layer } from 'effect';
import {
  AttachmentEntity,
  AttachmentRepositoryPort,
  AttachmentUseCasesPort,
  FileStoragePort,
  IdGeneratorPort,
  NoteRepositoryPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  type AttachmentProps,
  type IAttachmentUseCases,
} from '../../../domain';

interface AttachmentResult extends AttachmentProps {
  originalName: string;
  isImage: boolean;
  isPdf: boolean;
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

function result(
  attachment: AttachmentProps,
  originalName = attachment.filename,
): AttachmentResult {
  return {
    ...attachment,
    originalName,
    isImage: attachment.mimeType.startsWith('image/'),
    isPdf: attachment.mimeType === 'application/pdf',
  };
}

export const AttachmentUseCasesLive = Layer.effect(
  AttachmentUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const attachments = yield* AttachmentRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const ids = yield* IdGeneratorPort;
    const paths = yield* PathServicePort;
    const addAttachment = (
      noteId: string,
      filePath: string,
      filename?: string,
    ) =>
      Effect.gen(function* () {
        const note = yield* notes.findById(noteId);
        if (!note?.workspaceId) {
          return yield* Effect.fail(
            new Error(`Note not found: ${noteId}`),
          );
        }
        const workspace = yield* workspaces.findById(note.workspaceId);
        if (!workspace) {
          return yield* Effect.fail(
            new Error(`Workspace not found: ${note.workspaceId}`),
          );
        }
        const originalName =
          filename ?? (yield* paths.basename(filePath));
        const extension = yield* paths.extname(originalName);
        const uniqueFilename = `${yield* ids.generate()}${extension}`;
        const directory = yield* paths.join(
          workspace.folderPath,
          '.attachments',
          noteId,
        );
        yield* files.createDirectory(directory);
        const destination = yield* paths.join(
          directory,
          uniqueFilename,
        );
        yield* files.copy(filePath, destination);
        const info = yield* files.getFileInfo(destination);
        const relativePath = yield* paths.relative(
          workspace.folderPath,
          destination,
        );
        const entity = AttachmentEntity.create({
          id: yield* ids.generate(),
          noteId,
          filename: uniqueFilename,
          mimeType:
            MIME_TYPES[extension.toLowerCase()] ??
            'application/octet-stream',
          size: info?.size ?? 0,
          path: relativePath,
        });
        yield* attachments.save(entity);
        return result(entity.toPersistence(), originalName);
      });
    const service: IAttachmentUseCases = {
      addAttachment,
      deleteAttachment: (attachmentId, deleteFile = true) =>
        Effect.gen(function* () {
          const attachment = yield* attachments.findById(attachmentId);
          if (!attachment) {
            return yield* Effect.fail(
              new Error(`Attachment not found: ${attachmentId}`),
            );
          }
          if (deleteFile) {
            const note = yield* notes.findById(attachment.noteId);
            if (note?.workspaceId) {
              const workspace = yield* workspaces.findById(note.workspaceId);
              if (workspace) {
                const absolutePath = yield* paths.join(
                  workspace.folderPath,
                  attachment.path,
                );
                yield* files.delete(absolutePath);
              }
            }
          }
          yield* attachments.delete(attachmentId);
        }),
      getAttachments: (noteId) =>
        attachments.findByNoteId(noteId).pipe(
          Effect.map((items) => items.map((item) => result(item))),
        ),
      uploadImage: (noteId, imageData, filename) =>
        Effect.gen(function* () {
          const note = yield* notes.findById(noteId);
          if (!note?.workspaceId) {
            return yield* Effect.fail(
              new Error(`Note not found: ${noteId}`),
            );
          }
          const workspace = yield* workspaces.findById(note.workspaceId);
          if (!workspace) {
            return yield* Effect.fail(
              new Error(`Workspace not found: ${note.workspaceId}`),
            );
          }
          const extension =
            (yield* paths.extname(filename)) || '.png';
          const temporaryPath = yield* paths.join(
            workspace.folderPath,
            '.temp',
            `${yield* ids.generate()}${extension}`,
          );
          const directory = yield* paths.dirname(temporaryPath);
          yield* files.createDirectory(directory);
          const buffer =
            typeof imageData === 'string'
              ? Buffer.from(imageData, 'base64')
              : imageData;
          yield* files.write(temporaryPath, buffer.toString('base64'));
          return yield* addAttachment(
            noteId,
            temporaryPath,
            filename,
          ).pipe(
            Effect.map((attachment) => ({
              attachment,
              markdownLink: `![${attachment.originalName}](${attachment.path})`,
            })),
            Effect.ensuring(
              files
                .delete(temporaryPath)
                .pipe(Effect.catchAll(() => Effect.void)),
            ),
          );
        }),
    };
    return service;
  }),
);
