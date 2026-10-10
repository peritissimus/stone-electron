import type { DailyReviewSnapshot, Note, TodoItem, UUID, Workspace } from '@shared/types';

export type StressScenario =
  'demo' | 'worst' | 'empty' | 'one' | 'huge' | 'loading' | 'error' | 'denied';

/** The same shape returned by workspace:scan, with workspace-relative paths. */
export interface StressTreeNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: StressTreeNode[];
  noteId?: string;
}

export interface StressFixture {
  snapshot: DailyReviewSnapshot;
  notes: Note[];
  workspace: Workspace;
  tree: StressTreeNode[];
}

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const LONG_EMAIL = 'bartholomew.fitzgerald@northwind-industries-holdings.example.com';
const LONG_URL =
  'https://example.com/workspaces/northwind-industries-holdings/projects/international-customer-onboarding/docs/9f8e7d6c5b4a?tab=acceptance-criteria&filter=unresolved&revision=12';
// Exactly 255 characters: the create/rename limit. Read schemas also accept legacy titles.
const LIMIT_TITLE =
  'Q4 international customer onboarding and platform reliability review — Aleksandra Wiśniewska-Kowalczyk, Christopher Alexander Montgomery III, Northwind Industries Holdings — security, accessibility, procurement, and final acceptance notes (revision 12) v2';
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

function id(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function clockAt(now: Date, hour: number, minute = 0): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
}

function createNote(index: number, title: string | null, now: Date, filePath?: string): Note {
  return {
    id: id(100 + index),
    title,
    filePath: filePath ?? `${title || 'Untitled'}.md`,
    notebookId: null,
    workspaceId: WORKSPACE_ID,
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    embedding: null,
    createdAt: new Date(now.getTime() - MS_PER_DAY),
    updatedAt: new Date(now.getTime() - index * 7 * MS_PER_MINUTE),
  };
}

function task(
  index: number,
  note: Note,
  text: string,
  state: TodoItem['state'] = 'todo',
): TodoItem {
  return {
    id: id(1_000 + index),
    noteId: note.id as UUID,
    noteTitle: note.title,
    notePath: note.filePath,
    text,
    state,
    checked: false,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function treeForNotes(notes: Note[]): StressTreeNode[] {
  const root: StressTreeNode[] = [];
  for (const note of notes) {
    if (!note.filePath) continue;
    const parts = note.filePath.split('/');
    let children = root;
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index];
      const path = parts.slice(0, index + 1).join('/');
      const isFile = index === parts.length - 1;
      if (isFile) {
        children.push({ name, path, relativePath: path, type: 'file', noteId: note.id });
      } else {
        let folder = children.find((node) => node.type === 'folder' && node.path === path);
        if (!folder) {
          folder = { name, path, relativePath: path, type: 'folder', children: [] };
          children.push(folder);
        }
        children = folder.children!;
      }
    }
  }
  return root;
}

function baseFixture(now: Date, worst: boolean): StressFixture {
  const date = dateKey(now);
  const workspace: Workspace = {
    id: WORKSPACE_ID,
    name: worst
      ? 'Aleksandra Wiśniewska-Kowalczyk — Northwind Industries Holdings, International Customer Onboarding & Platform Reliability'
      : 'Studio notes',
    folderPath: '/stone-ui-preview',
    isActive: true,
    createdAt: new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()),
    lastAccessedAt: now,
  };
  const notes = worst
    ? [
        createNote(
          0,
          LIMIT_TITLE,
          now,
          'Q4 international customer onboarding — security and accessibility acceptance — revision 12.md',
        ),
        createNote(1, LONG_EMAIL, now),
        createNote(2, 'J', now),
        createNote(3, null, now, 'Imported capture.md'),
        createNote(4, 'نور الهدى عبد الرحمن — مراجعة إطلاق المنتج', now),
        createNote(5, 'Đặng Thị Ngọc Hân — บันทึกการประชุม — 王秀英', now),
        createNote(6, '👩🏽‍💻 Priya — accessibility acceptance notes', now),
        createNote(
          7,
          'Q4 international customer onboarding — security and accessibility acceptance — revision 13',
          now,
        ),
        createNote(8, 'Weekly review', now, 'Engineering/Weekly review.md'),
        createNote(9, 'Weekly review', now, 'Research/Weekly review.md'),
        createNote(10, 'Benachrichtigungseinstellungen', now),
        createNote(11, 'Customer feedback &amp; **open questions**', now),
        createNote(12, '   ', now, 'Imported note without a heading.md'),
        createNote(
          13,
          'Final customer acceptance and legal handoff',
          now,
          'Projects/Northwind/Platform/2026/Q4/Launch/Review/Approved/Legal/Final customer acceptance and legal handoff.md',
        ),
      ]
    : [
        createNote(0, 'Launch checklist', now),
        createNote(1, 'Research notes', now),
        createNote(2, 'Weekly review', now),
      ];
  if (worst) {
    // A second computer whose clock is five minutes ahead is a realistic sync input.
    notes[0].updatedAt = new Date(now.getTime() + 5 * MS_PER_MINUTE);
  }
  const journal = createNote(20, date, now, `Journal/${date}.md`);
  const history = Array.from({ length: worst ? 5 : 1 }, (_, index) => {
    const yearsAgo = index + 1;
    const historicalDate = new Date(
      now.getFullYear() - yearsAgo,
      now.getMonth(),
      now.getDate(),
      12,
    );
    const note = createNote(
      30 + index,
      worst
        ? [
            'Weekly review',
            null,
            '王秀英 — 年度回顾',
            'Jo',
            'Platform reliability: the decisions that lasted',
          ][index]
        : 'A year in review',
      now,
      `Archive/${historicalDate.getFullYear()}/Annual review.md`,
    );
    note.createdAt = historicalDate;
    note.updatedAt = historicalDate;
    return { yearsAgo, date: historicalDate, note };
  });
  const snapshot: DailyReviewSnapshot = {
    date,
    todayJournal: {
      date,
      exists: true,
      noteId: journal.id,
      // Mirror the real 240-character preview (+ ellipsis), never feed a full document.
      contentPreview: worst
        ? `${`${LONG_URL}\nConfirm the final handoff with Aleksandra Wiśniewska-Kowalczyk. Save the literal <b>priority</b> example for the importer review.`.slice(0, 240).trim()}…`
        : 'The research review clarified our next step. Finish the launch checklist and send the revised notes to Jo.',
    },
    todayMeetings: worst
      ? [
          {
            id: id(2_000),
            title:
              'Northwind Industries Holdings — international customer onboarding, procurement and accessibility acceptance review with Aleksandra Wiśniewska-Kowalczyk',
            status: 'ready',
            durationMs: (13 * 60 + 24) * MS_PER_MINUTE + 9_000,
            summary:
              '- The overnight incident bridge confirmed regional recovery; document the remaining follow-ups before the handoff.\n- Validate the final customer acceptance checklist.',
            createdAt: new Date(clockAt(now, 0, 5)),
            inJournal: true,
          },
          {
            id: id(2_001),
            title: 'Jo',
            status: 'recording',
            durationMs: 0,
            summary: null,
            createdAt: now,
            inJournal: false,
          },
          {
            id: id(2_002),
            title: '王秀英 — 产品评审',
            status: 'transcribing',
            durationMs: 59_000,
            summary: null,
            createdAt: now,
            inJournal: false,
          },
          {
            id: id(2_003),
            title: '👩🏽‍💻 Priya — incident handoff',
            status: 'summarizing',
            durationMs: MS_PER_MINUTE,
            summary: null,
            createdAt: now,
            inJournal: false,
          },
          {
            id: id(2_004),
            title: 'نور الهدى عبد الرحمن — مراجعة المشروع',
            status: 'failed',
            durationMs: 42 * MS_PER_MINUTE,
            summary: null,
            createdAt: now,
            inJournal: false,
          },
        ]
      : [
          {
            id: id(2_000),
            title: 'Research review',
            status: 'ready',
            durationMs: 25 * MS_PER_MINUTE,
            summary: '- Start with the smaller launch checklist.',
            createdAt: new Date(clockAt(now, 10)),
            inJournal: true,
          },
        ],
    openTasks: worst
      ? [
          task(0, notes[0], LONG_URL, 'doing'),
          task(
            1,
            notes[1],
            `Send the final procurement and security response to ${LONG_EMAIL}`,
            'waiting',
          ),
          task(2, notes[2], 'J', 'todo'),
          task(3, notes[3], 'Reconcile the imported capture with the final decision log', 'hold'),
          task(4, notes[4], 'مراجعة متطلبات الوصول وإرسال الملاحظات إلى الفريق', 'idea'),
          task(5, notes[5], 'Đặng Thị Ngọc Hân: ตรวจสอบข้อเสนอแนะก่อนส่งมอบ — 王秀英', 'doing'),
          task(
            6,
            notes[6],
            'Document why <b>priority</b>, &amp; and **urgent** appear in the importer examples',
            'todo',
          ),
          task(
            7,
            notes[7],
            'Compare the final acceptance notes: revision 12 versus revision 13',
            'waiting',
          ),
          task(8, notes[8], 'Capture the retrospective follow-up after the handoff', 'todo'),
        ]
      : [
          task(0, notes[0], 'Send the revised checklist', 'todo'),
          task(1, notes[1], 'Review the research notes', 'doing'),
        ],
    recentNotes: worst ? [...notes.slice(0, 7), notes[12]] : notes.slice(0, 8),
    onThisDay: history,
    calendarEvents: worst
      ? [
          {
            title:
              'International customer onboarding and platform reliability review — final acceptance and procurement handoff',
            start: clockAt(now, 9, 30),
            end: clockAt(now, 11),
            allDay: false,
            calendar: 'Northwind Industries Holdings — Customer Success & Platform Engineering',
            location:
              'Northwind Industries Holdings — International Customer Experience Centre, Building C, Floor 12, Alexander Montgomery Conference Suite',
          },
          {
            title: 'الاحتفال بإطلاق المنتج — نور الهدى عبد الرحمن',
            start: clockAt(now, 0),
            end: clockAt(now, 23, 59),
            allDay: true,
            calendar: 'Personal',
            location: null,
          },
          {
            title: 'Jo',
            start: clockAt(now, 12),
            end: clockAt(now, 12, 1),
            allDay: false,
            calendar: 'Work',
            location: '',
          },
          {
            title: 'Đặng Thị Ngọc Hân — retrospective',
            start: clockAt(now, 16),
            end: clockAt(now, 17),
            allDay: false,
            calendar: 'Work',
            location: LONG_URL,
          },
        ]
      : [
          {
            title: 'Team check-in',
            start: clockAt(now, 9, 30),
            end: clockAt(now, 10),
            allDay: false,
            calendar: 'Work',
            location: 'Studio',
          },
        ],
    mailUnreadCount: worst ? 1_284 : 3,
    mailMessages: worst
      ? [
          {
            subject:
              'Re: Revised security, accessibility and procurement acceptance criteria — approval requested before the international handoff',
            sender: LONG_EMAIL,
            receivedAt: clockAt(now, 8, 15),
          },
          { subject: 'Jo', sender: 'J <j@example.com>', receivedAt: clockAt(now, 8, 30) },
          {
            subject: '',
            sender: 'first.last+billing-notifications@example.com',
            receivedAt: clockAt(now, 8, 45),
          },
          {
            subject: 'نور الهدى عبد الرحمن — ملاحظات الاجتماع',
            sender: 'نور الهدى عبد الرحمن <noor@example.com>',
            receivedAt: clockAt(now, 9),
          },
        ]
      : [{ subject: 'Research notes are ready', sender: 'Jo', receivedAt: clockAt(now, 8, 30) }],
    linearIssues: worst
      ? [
          {
            identifier: 'PLATFORM-12840',
            title:
              'Make international customer onboarding resilient to partially completed procurement and accessibility reviews',
            state: 'Awaiting customer acceptance and security approval',
            priority: 1,
            url: 'https://example.com/issues/PLATFORM-12840',
            dueDate: date,
          },
          {
            identifier: 'OPS-1',
            title: 'Jo',
            state: 'Backlog',
            priority: 0,
            url: 'https://example.com/issues/OPS-1',
            dueDate: null,
          },
          {
            identifier: 'DESIGN-1284',
            title: 'Benachrichtigungseinstellungen — Paramètres de confidentialité et de sécurité',
            state: 'In Progress',
            priority: 2,
            url: 'https://example.com/issues/DESIGN-1284',
            dueDate: dateKey(new Date(now.getTime() - 12 * MS_PER_DAY)),
          },
        ]
      : [
          {
            identifier: 'DESIGN-12',
            title: 'Review the launch checklist',
            state: 'In progress',
            priority: 2,
            url: 'https://example.com/issues/DESIGN-12',
            dueDate: null,
          },
        ],
  };
  const allNotes = [...notes, journal, ...history.map((entry) => entry.note)];
  return { workspace, snapshot, notes: allNotes, tree: treeForNotes(allNotes) };
}

/** Fresh objects on every switch so interactions cannot contaminate another scenario. */
export function createStressFixture(scenario: StressScenario): StressFixture {
  const now = new Date();
  const fixture = baseFixture(now, scenario === 'worst' || scenario === 'huge');

  if (scenario === 'empty') {
    fixture.notes = [];
    fixture.snapshot = {
      date: fixture.snapshot.date,
      todayJournal: {
        date: fixture.snapshot.date,
        exists: false,
        noteId: null,
        contentPreview: null,
      },
      todayMeetings: [],
      openTasks: [],
      recentNotes: [],
      onThisDay: [],
      calendarEvents: [],
      mailUnreadCount: 0,
      mailMessages: [],
      linearIssues: [],
    };
  } else if (scenario === 'one') {
    const note = createNote(0, 'J', now);
    note.createdAt = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 12);
    fixture.notes = [note];
    fixture.snapshot.todayJournal = {
      date: fixture.snapshot.date,
      exists: false,
      noteId: null,
      contentPreview: null,
    };
    fixture.snapshot.openTasks = [task(0, note, 'Review J')];
    fixture.snapshot.recentNotes = [note];
    fixture.snapshot.onThisDay = [{ yearsAgo: 1, date: note.createdAt, note }];
    fixture.snapshot.mailUnreadCount = 1;
  } else if (scenario === 'denied') {
    fixture.snapshot.todayJournal.contentPreview = null;
    fixture.snapshot.calendarEvents = [];
    fixture.snapshot.mailMessages = [];
    fixture.snapshot.mailUnreadCount = 0;
    fixture.snapshot.linearIssues = [];
  } else if (scenario === 'huge') {
    const existing = fixture.notes;
    fixture.notes = Array.from({ length: 1_284 }, (_, index) => {
      if (index < existing.length) return existing[index];
      const number = String(index + 1).padStart(4, '0');
      return createNote(100 + index, `Customer onboarding research — interview ${number}`, now);
    });
  }

  fixture.tree = treeForNotes(fixture.notes);
  return fixture;
}
