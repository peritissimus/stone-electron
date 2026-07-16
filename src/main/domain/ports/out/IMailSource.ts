import type { ExternalSourceResult } from './externalSourceResult';

/**
 * IMailSource — read-only access to the user's unread inbox.
 * Implemented on macOS via Mail.app (JXA); other platforms return [].
 */

export interface MailMessage {
  subject: string;
  sender: string;
  /** ISO 8601 received timestamp. */
  receivedAt: string;
}

export interface IMailSource {
  /** Up to `limit` most-recent unread messages plus an actionable access status. */
  getUnreadMessages(limit: number): Promise<ExternalSourceResult<MailMessage[]>>;
}
