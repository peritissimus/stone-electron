/**
 * Browser-native scratch files (open/read/write a .md outside any workspace).
 *
 * The desktop app addresses these files by absolute path. A browser tab never
 * learns real paths — it gets an opaque handle from the file picker — so we
 * keep the handles here and hand the renderer a stable synthetic path that
 * round-trips through the existing path-shaped channel contract.
 */

interface FileSystemFileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  queryPermission?: (descriptor: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: string }) => Promise<PermissionState>;
}

const handles = new Map<string, FileSystemFileHandleLike>();

const SCRATCH_PREFIX = 'scratch://';

const showOpenFilePicker = () =>
  (
    globalThis as unknown as {
      showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandleLike[]>;
    }
  ).showOpenFilePicker;

export const isSupported = (): boolean => typeof showOpenFilePicker() === 'function';

const unsupported = () =>
  new Error('Opening files outside the workspace requires a Chromium-based browser.');

/** Distinct key per pick so two files with the same name don't collide. */
const registerHandle = (handle: FileSystemFileHandleLike): string => {
  let key = `${SCRATCH_PREFIX}${handle.name}`;
  let suffix = 2;
  while (handles.has(key) && handles.get(key) !== handle) {
    key = `${SCRATCH_PREFIX}${suffix}/${handle.name}`;
    suffix += 1;
  }
  handles.set(key, handle);
  return key;
};

const lookup = (path: string): FileSystemFileHandleLike => {
  const handle = handles.get(path);
  if (!handle) {
    throw new Error('That file is no longer open. Pick it again to continue.');
  }
  return handle;
};

export async function pick(): Promise<{ path: string | null }> {
  const picker = showOpenFilePicker();
  if (!picker) throw unsupported();

  try {
    const [handle] = await picker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }],
      multiple: false,
    });
    if (!handle) return { path: null };
    return { path: registerHandle(handle) };
  } catch (error) {
    // The picker throws AbortError when the person closes it without choosing.
    if (error instanceof DOMException && error.name === 'AbortError') return { path: null };
    throw error;
  }
}

export async function read(path: string): Promise<{ path: string; name: string; content: string }> {
  const handle = lookup(path);
  const file = await handle.getFile();
  return { path, name: handle.name, content: await file.text() };
}

export async function write(path: string, content: string): Promise<{ path: string }> {
  const handle = lookup(path);

  if (handle.queryPermission && handle.requestPermission) {
    const granted = await handle.queryPermission({ mode: 'readwrite' });
    if (granted !== 'granted') {
      const asked = await handle.requestPermission({ mode: 'readwrite' });
      if (asked !== 'granted') {
        throw new Error('Permission to save this file was declined.');
      }
    }
  }

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return { path };
}
