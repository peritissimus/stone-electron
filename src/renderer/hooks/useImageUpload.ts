/**
 * Image Upload Hook - Handles paste and drag-drop image uploads
 */

import { useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { invokeIpc } from '@renderer/lib/ipc';
import { ATTACHMENT_CHANNELS } from '@shared/constants/ipcChannels';
import { logger } from '@renderer/utils/logger';

interface UseImageUploadOptions {
  editor: Editor | null;
  noteId: string | null;
  enabled?: boolean;
}

/**
 * Convert a File/Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is an image
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get images from clipboard data
 */
function getImagesFromClipboard(clipboardData: DataTransfer): File[] {
  const images: File[] = [];
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        images.push(file);
      }
    }
  }
  return images;
}

/**
 * Get images from drag-drop data
 */
function getImagesFromDrop(dataTransfer: DataTransfer): File[] {
  const images: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (isImageFile(file)) {
      images.push(file);
    }
  }
  return images;
}

export function useImageUpload({ editor, noteId, enabled = true }: UseImageUploadOptions) {
  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!noteId) {
        logger.warn('[useImageUpload] No noteId, cannot upload image');
        return null;
      }

      try {
        logger.info('[useImageUpload] Uploading image', {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        const base64Data = await fileToBase64(file);

        const response = await invokeIpc<{
          success: boolean;
          relativePath: string;
          absolutePath: string;
          filename: string;
        }>(ATTACHMENT_CHANNELS.UPLOAD_IMAGE, {
          noteId,
          imageData: base64Data,
          mimeType: file.type,
          filename: file.name !== 'image.png' ? file.name : undefined,
        });

        if (response.success && response.data) {
          logger.info('[useImageUpload] Image uploaded successfully', {
            relativePath: response.data.relativePath,
            absolutePath: response.data.absolutePath,
          });
          // Use absolute file:// URL for display in editor
          return `file://${response.data.absolutePath}`;
        } else {
          logger.error('[useImageUpload] Upload failed', response.error);
          return null;
        }
      } catch (error) {
        logger.error('[useImageUpload] Error uploading image', error);
        return null;
      }
    },
    [noteId],
  );

  const insertImage = useCallback(
    (src: string) => {
      if (!editor) return;

      editor.chain().focus().setImage({ src }).run();
    },
    [editor],
  );

  const handleImageFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const relativePath = await uploadImage(file);
        if (relativePath) {
          insertImage(relativePath);
        }
      }
    },
    [uploadImage, insertImage],
  );

  useEffect(() => {
    if (!editor || !enabled || !noteId) return;

    const editorElement = editor.view.dom;

    // Handle paste events
    const handlePaste = async (event: ClipboardEvent) => {
      if (!event.clipboardData) return;

      const images = getImagesFromClipboard(event.clipboardData);
      if (images.length > 0) {
        event.preventDefault();
        await handleImageFiles(images);
      }
    };

    // Handle drop events
    const handleDrop = async (event: DragEvent) => {
      if (!event.dataTransfer) return;

      const images = getImagesFromDrop(event.dataTransfer);
      if (images.length > 0) {
        event.preventDefault();
        await handleImageFiles(images);
      }
    };

    // Handle dragover to allow drop
    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer) return;

      // Check if dragging files that include images
      const hasImages = Array.from(event.dataTransfer.types).includes('Files');
      if (hasImages) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    editorElement.addEventListener('paste', handlePaste);
    editorElement.addEventListener('drop', handleDrop);
    editorElement.addEventListener('dragover', handleDragOver);

    return () => {
      editorElement.removeEventListener('paste', handlePaste);
      editorElement.removeEventListener('drop', handleDrop);
      editorElement.removeEventListener('dragover', handleDragOver);
    };
  }, [editor, noteId, enabled, handleImageFiles]);

  return { uploadImage, insertImage };
}
