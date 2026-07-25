import type { ExternalSourceResult } from './externalSourceResult';

/**
 * IMailSource — read-only access to the user's unread inbox.
 * Implemented on macOS via a bounded Mail.app summary call.
 */

export interface MailMessage {
  subject: string;
  sender: string;
  /** ISO 8601 received timestamp. */
  receivedAt: string;
}

export interface MailSnapshot {
  unreadCount: number;
  /** Message previews are populated only by providers that can fetch them reliably. */
  messages: MailMessage[];
}

export interface IMailSource {
  /** Unread summary plus any previews supplied by the active provider. */
  getUnreadMessages(
    limit: number,
    signal?: AbortSignal,
  ): Promise<ExternalSourceResult<MailSnapshot>>;
}
