/**
 * AppleMailSource — reads recent unread inbox messages from Mail.app via JXA.
 * macOS-only; returns [] on any other platform or when Automation permission
 * is denied. Triggers a one-time macOS Automation prompt on first use.
 */

import type { IMailSource, MailMessage } from '../../../domain/ports/out/IMailSource';
import { runJxa } from './osascriptJxa';

interface RawMessage {
  subject?: string;
  sender?: string;
  receivedAt?: string;
}

/** JXA: the most-recent `limit` unread messages across all inbox accounts. */
function script(limit: number): string {
  return `
    (() => {
      const Mail = Application('Mail');
      const out = [];
      let boxes;
      try {
        boxes = Mail.inbox.mailboxes();
      } catch (e) {
        boxes = [];
      }
      // Mail.app exposes a unified inbox; fall back to per-account inboxes.
      const inboxes = boxes.length ? boxes : [Mail.inbox];
      for (const box of inboxes) {
        let msgs;
        try {
          msgs = box.messages.whose({ readStatus: false })();
        } catch (e) {
          continue;
        }
        for (const msg of msgs) {
          out.push({
            subject: msg.subject(),
            sender: msg.sender(),
            receivedAt: msg.dateReceived().toISOString(),
          });
        }
      }
      out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      return JSON.stringify(out.slice(0, ${Math.max(1, Math.floor(limit))}));
    })();
  `;
}

export class AppleMailSource implements IMailSource {
  async getUnreadMessages(limit: number): Promise<MailMessage[]> {
    const raw = await runJxa<RawMessage[]>(script(limit), 12000);
    if (!raw) return [];
    return raw.map((m) => ({
      subject: String(m.subject ?? '(no subject)'),
      sender: String(m.sender ?? ''),
      receivedAt: String(m.receivedAt ?? ''),
    }));
  }
}
