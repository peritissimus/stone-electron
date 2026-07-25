/**
 * AppleMailSource — reads recent unread inbox messages from Mail.app via JXA.
 * macOS-only; returns [] on any other platform or when Automation permission
 * is denied. Triggers a one-time macOS Automation prompt on first use.
 */

import type { IMailSource } from '../../../domain/ports/out/IMailSource';
import type {
  ExternalSourceLoadContext,
  IExternalSource,
} from '../../../domain/ports/out/IExternalSource';
import { runJxa } from './osascriptJxa';

interface RawMailSummary {
  unreadCount?: number;
}

/** Mail can return the unified unread count quickly, while resolving message
 * objects may block for minutes on large or syncing inboxes. Provider-backed
 * adapters can add previews later without making Apple Mail block Today. */
function script(): string {
  return `
    (() => {
      const Mail = Application('Mail');
      return JSON.stringify({ unreadCount: Number(Mail.inbox.unreadCount()) });
    })();
  `;
}

export class AppleMailSource implements IMailSource, IExternalSource {
  readonly source = 'mail' as const;

  async getUnreadMessages(_limit: number, signal?: AbortSignal) {
    const result = await runJxa<RawMailSummary>(script(), {
      target: 'Mail',
      timeoutMs: 3000,
      signal,
    });
    if (!result.ok) {
      return {
        status: result.reason === 'timeout' ? ('error' as const) : result.reason,
        data: { unreadCount: 0, messages: [] },
        message: result.message,
      };
    }
    return {
      status: 'connected' as const,
      data: {
        unreadCount: Math.max(0, Number(result.data.unreadCount ?? 0)),
        messages: [],
      },
    };
  }

  async load(context: ExternalSourceLoadContext) {
    const result = await this.getUnreadMessages(context.mailLimit, context.signal);
    return {
      source: this.source,
      status: result.status,
      data: result.data,
      ...(result.message ? { message: result.message } : {}),
    };
  }
}
