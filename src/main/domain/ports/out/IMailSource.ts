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
  /** Up to `limit` most-recent unread messages. Returns [] when unavailable
   *  (unsupported platform, permission denied, no mail app). */
  getUnreadMessages(limit: number): Promise<MailMessage[]>;
}
