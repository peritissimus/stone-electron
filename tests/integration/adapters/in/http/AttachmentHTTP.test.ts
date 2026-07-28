import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { AttachmentHTTP } from '../../../../../src/main/adapters/in/http/AttachmentHTTP';
import type { IAttachmentUseCases } from '../../../../../src/main/domain';

const now = new Date('2026-01-01T00:00:00.000Z');
const attachment = {
  id: 'attachment-1',
  noteId: 'note-1',
  filename: 'stored.png',
  originalName: 'pixel.png',
  mimeType: 'image/png',
  size: 8,
  path: '.attachments/note-1/stored.png',
  isImage: true,
  isPdf: false,
  createdAt: now,
};

function createApp() {
  const service = {
    getAttachments: () => Effect.succeed([attachment]),
    uploadImage: () =>
      Effect.succeed({
        attachment,
        markdownLink: '![pixel.png](stored.png)',
      }),
    getAttachmentContent: () =>
      Effect.succeed({
        bytes: new Uint8Array([137, 80, 78, 71]),
        mimeType: 'image/png',
        filename: 'stored.png',
      }),
    deleteAttachment: () => Effect.void,
  } as unknown as IAttachmentUseCases;
  const app = Fastify({ logger: false });
  new AttachmentHTTP({
    runAttachmentEffect: (use) => Effect.runPromise(use(service)),
  }).register(app);
  return app;
}

describe('AttachmentHTTP', () => {
  it('uploads an image and returns a browser-retrievable URL', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/notes/note-1/attachments/images',
      payload: {
        imageData: 'iVBORw==',
        filename: 'pixel.png',
        mimeType: 'image/png',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      attachment: { id: 'attachment-1', mimeType: 'image/png' },
      url: '/api/notes/note-1/attachments/attachment-1/content',
    });
    await app.close();
  });

  it('streams attachment bytes with the stored content type', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/notes/note-1/attachments/attachment-1/content',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.rawPayload).toEqual(Buffer.from([137, 80, 78, 71]));
    await app.close();
  });
});
