/**
 * Templates shipped with Stone on first activation of a workspace.
 *
 * Targets the senior-IC user — meetings, decisions, weekly status,
 * postmortems are the most-asked artifacts in an IC's week. The
 * frontmatter `name:` + `description:` drive the picker UI; the body
 * uses `{{date}}`, `{{time}}`, `{{cursor}}`, and `{{prompt:question}}`
 * placeholders that the TemplateRenderer substitutes at render time.
 *
 * Stored inline as TS string literals (not as on-disk asset files) so
 * they're always available regardless of how the app is packaged. The
 * user can edit / delete / add to them once they land on disk; the
 * seeder is idempotent and won't overwrite once any user template
 * exists in the folder.
 */

export interface StarterTemplate {
  id: string;
  body: string;
}

const ONE_ON_ONE = `---
name: 1:1
description: Notes for a 1:1 meeting — agenda, discussion, follow-ups
---
# 1:1 with {{prompt:Who?}} — {{date}}

## Agenda
- {{cursor}}

## Discussion

## Follow-ups
- [ ]
`;

const DESIGN_REVIEW = `---
name: Design review
description: Notes captured during a design review — proposal, feedback, decisions
---
# {{prompt:What are we reviewing?}} — design review {{date}}

## Context
{{cursor}}

## Proposal

## Feedback
-

## Decisions
-

## Action items
- [ ]
`;

const AD_HOC_MEETING = `---
name: Ad-hoc meeting
description: Quick capture for an unscheduled discussion
---
# {{prompt:Topic?}} — {{date}} {{time}}

Attendees: {{prompt:Who? (comma-separated)}}

## Notes
{{cursor}}

## Follow-ups
- [ ]
`;

const RFC = `---
name: RFC
description: Request for comments — design proposal for review
---
# RFC: {{prompt:Title?}}

**Author**: {{prompt:Author?}}
**Date**: {{date}}
**Status**: Draft

## Problem
{{cursor}}

## Proposal

## Alternatives considered

## Trade-offs

## Open questions
-

## Decision
*(filled in after review)*
`;

const WEEKLY_STATUS = `---
name: Weekly status
description: Friday weekly status report — shipped, in progress, blockers
---
# Week of {{date}}

## Shipped
- {{cursor}}

## In progress
-

## Decisions made
-

## Blockers / asks
-

## Next week
-
`;

const POSTMORTEM = `---
name: Postmortem
description: Incident postmortem — what happened, why, what's next
---
# Postmortem: {{prompt:Incident name?}}

**Date of incident**: {{prompt:Incident date (YYYY-MM-DD)?}}
**Author**: {{prompt:Author?}}
**Status**: Draft

## Summary
{{cursor}}

## Impact
- Duration:
- Users affected:
- Severity:

## Timeline
- HH:MM —

## Root cause

## What went well
-

## What went wrong
-

## Action items
- [ ] *(owner)*
`;

export const TEMPLATE_STARTER_PACK: readonly StarterTemplate[] = Object.freeze([
  { id: '1-on-1', body: ONE_ON_ONE },
  { id: 'design-review', body: DESIGN_REVIEW },
  { id: 'ad-hoc-meeting', body: AD_HOC_MEETING },
  { id: 'rfc', body: RFC },
  { id: 'weekly-status', body: WEEKLY_STATUS },
  { id: 'postmortem', body: POSTMORTEM },
]);
