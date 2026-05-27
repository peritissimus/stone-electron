# Stone Productivity Research — May 2026

A market study and strategic analysis of where Stone fits in the personal
knowledge management space, what knowledge workers actually struggle with,
and the highest-leverage features to ship next. Compiled May 28, 2026.

> **TL;DR**
> - Stone's chunk-FTS + vector + cross-encoder retrieval already beats most
>   AI-native PKMs on accuracy, but loses on **capture surface area**,
>   **resurfacing**, and **workflow opinionation**.
> - The 9.3-hour-per-week-lost-to-search stat dominates 2026 PKM
>   conversations. Whichever tool collapses that time fastest wins.
> - Stone should commit to **"local-first AI-native PKM with workflows
>   built in"** as its position — Path A (deepen AI + capture) plus the
>   two workflow features that have outsized behaviour-change impact
>   (templates + daily review). All other directions are distractions.

---

## 1. The market in 2026 — four camps, ten players

The PKM market in 2026 has stabilised into four distinct architectural
camps. Within each camp, 2–3 players have captured most of the mindshare.

### Camp 1: Local-first markdown
The "your-data-is-yours" tradition. Files on disk, full export, no lock-in.

| Player | Headline feature | Pricing | What they win on |
|---|---|---|---|
| **Obsidian** | Plugin ecosystem (~1500+ plugins) | Free / $50/yr commercial | Extensibility, longevity, community |
| **Logseq** | Outliner + journals | Free, OSS | Daily-notes + outline workflow |
| **Stone** (today) | Local AI + chunk-level retrieval | Free, OSS | Best-in-class retrieval out of the box |

This camp's strength is data sovereignty; its weakness is that AI is bolted
on (Obsidian) or absent (Logseq) — neither feels first-class. Stone is the
exception: it ships meaningful AI without plugins.

### Camp 2: AI-native
Built around AI from the start. Cloud-only by design; that's the trade.

| Player | Headline feature | Pricing | What they win on |
|---|---|---|---|
| **Reflect** | Daily notes + AI review | $10/mo | Speed, opinionated daily workflow, calendar sync |
| **Mem (2.0)** | Auto-linking, "AI thought partner" | $12/mo Pro | Background knowledge graph that just works |
| **Atlas** | Cited AI answers across vault + clips | $20/mo Pro | Treats web clips as first-class corpus members |

This camp's strength is AI depth; its weakness is the lock-in tax (your
notes live in their cloud, formats are proprietary). 2026 reviews
consistently put Reflect at #1 for AI quality + speed.

### Camp 3: Visual / canvas
Spatial thinking — cards on a 2D plane, connected with lines.

| Player | Headline feature | Pricing | What they win on |
|---|---|---|---|
| **Heptabase** | Card-on-whiteboard workflow | $14/mo | Research synthesis, learning |
| **Storyflow** | Canvas-aware AI | Freemium | Visual + AI combined |

Strength: thinking modes that text-only tools can't match. Weakness: high
capture friction (most users want to dump text fast, not arrange cards).

### Camp 4: Outliner + structured data
Block-based with typed nodes that act like databases.

| Player | Headline feature | Pricing | What they win on |
|---|---|---|---|
| **Tana** | Supertags (typed nodes, queries) | $14/mo | Systems thinkers, CRM-like workflows |
| **Notion** | Block + database + collaboration | $10/mo Plus | Team wikis, project management |

Strength: structure when you need it. Weakness: learning curve (Tana
especially), feature bloat (Notion).

---

## 2. What "productive" actually means in PKM (2026)

The single most-cited 2026 statistic in PKM coverage: **knowledge workers
lose 9.3 hours per week searching for information**. The next: **80%
report information overload**. Whichever tool collapses these wins.

Drilling into specific user complaints, there are six measurable jobs
that distinguish productive PKM users from frustrated ones:

| Job | What "good" looks like | Best in class |
|---|---|---|
| **Capture friction** | <3 sec from thought → captured | Tana, Reflect, Mem (all have voice + mobile + web) |
| **Retrieval certainty** | Any note findable in <60 sec | Atlas, Mem, **Stone** (chunk-FTS + vector + rerank) |
| **Resurfacing** | Old ideas re-encountered without effort | Reflect (daily notes), Obsidian + Spaced Rep plugin |
| **Connection** | Auto-discovered links between notes | Mem (best), **Stone** (Related Notes sidecar) |
| **Trust** | AI cites sources, never invents | Atlas, **Stone** (AskNotes cites chunks) |
| **Flow integration** | Fits daily rhythm without ceremony | Reflect (daily notes + AI review) |

Note: Stone already wins on three of these six (retrieval, connection,
trust) without anyone shipping a plugin or paying a subscription. That's
remarkable and under-marketed.

The three Stone loses on (capture, resurfacing, flow) are the ones that
*change user behaviour daily*. That's the gap to close.

---

## 3. Stone's honest competitive position

### Where Stone already beats the field

| Capability | Stone today | Closest competitor | Why Stone wins |
|---|---|---|---|
| Chunk-level semantic retrieval | ✅ | None in consumer PKM | RRF fusion of FTS + vector, no other PKM does both |
| Cross-encoder reranking | ✅ | None in consumer PKM | Top-30 rerank with ms-marco-MiniLM gives +20-40% precision lift |
| Local ML by default | ✅ Whisper + bge-small + ms-marco | Obsidian (with manual plugin setup) | Cloud opt-in, not opt-out |
| Cited AI answers | ✅ AskNotes | Atlas | Stone shows chunk source + heading path |
| Hexagonal architecture | ✅ | None | Swappable internals — change LLM provider or transcriber without touching domain |
| Single-user, no sync | ✅ (deliberate) | Logseq | A moat against feature bloat from collaboration |
| Markdown-on-disk + Git | ✅ | Obsidian, Logseq | True portability; meeting transcripts/summaries flow through journal |
| Meeting recorder | ✅ (just shipped) | Reflect (paid), Mem (paid) | Local Whisper, no cloud needed |

### Where Stone is meaningfully behind

| Gap | Severity | Notes |
|---|---|---|
| No capture surface beyond Stone itself | 🔴 critical | Every leader has web clipper + mobile + email-to-app |
| No resurfacing system | 🔴 critical | No spaced repetition, no "on this day", no review queue |
| No templates | 🟡 high | Meeting notes / weekly reviews / project briefs all reinvent structure |
| No structured data | 🟡 high | Tana's supertags solve real CRM-like use cases |
| No mobile companion | 🟡 high | Even read-only would 2× capture rate |
| No reading mode | 🟢 medium | Notes feel like documents to edit, not artifacts to read |
| No outlines / block refs | 🟢 medium | Logseq/Tana-style outliner is a specific user need |
| No calendar integration | 🟢 medium | Reflect's strongest workflow feature |
| No daily/weekly review | 🟢 medium | All raw data exists; no surface assembles it |

### Where Stone is appropriately ignoring the market

| Feature | Why it's correct to skip |
|---|---|
| Collaboration | Explicit non-goal per CLAUDE.md; killing it preserves the moat |
| Cloud sync | Same; Git is the sanctioned multi-device path |
| Public sharing | Would require a server; conflicts with local-first identity |
| Plugin ecosystem (yet) | Premature — Stone needs to be opinionated before being extensible |

---

## 4. Deep dive on each leader's winning feature

Knowing *exactly* how each competitor implements its strongest feature
informs what Stone should build (and avoid).

### Reflect: daily notes + AI review

The thing Reflect users repeat: **"snappiest note app I've used."** That's
the foundation; on top of it they layered:

- Every day auto-opens a new dated note. No template prompt — just a blank
  slate that auto-titles `2026-05-28`.
- A persistent "AI sidebar" answers questions across the whole vault.
- The **AI review** feature scans your last N days, finds commitments,
  surfaces priorities. Runs on demand and as a daily-notes section.
- `[[wiki-links]]` everywhere with auto-backlinks; click a name → see every
  reference.
- Calendar sync (Google Calendar) auto-creates meeting note stubs.

**What Stone can learn**: speed + a daily anchor + an AI surface that
reads across the corpus. Stone has all three primitives. What's missing
is the *assembled surface* that puts them in front of the user every day.

### Mem 2.0: AI thought partner with background auto-linking

Mem's headline since 2.0: **"AI Thought Partner."** What that actually
means:

- As you type, Mem runs background semantic similarity against the whole
  corpus and surfaces "Similar Mems" in a sidebar.
- Auto-creates **bidirectional links** between related notes without the
  user typing `[[`. The knowledge graph builds itself.
- Voice mode: hands-free capture; speech → searchable text + audio kept
  for replay.
- Smart Search: three tiers — typeahead, filtered, AI semantic.

**What Stone can learn**: Stone has the chunk vector index that would
power this; "Related Notes" panel is a step toward it but only triggers
when looking at an existing note. The win is *during writing* — surface
links as the user types, before they ask.

### Tana: supertags + queries

Tana's distinctive feature is the **supertag**:

- Tag any node with `#person` → it gains structured fields (`Company`,
  `Role`, `Last Contacted`) you defined for that tag.
- Queries: `#person where last_contacted < 30 days ago` returns a
  dynamic list. The vault becomes a queryable database without ever
  setting up tables.
- Live searches: saved query views that update as data changes.

**What Stone can learn**: this is mostly *not* for Stone — supertags
require an outliner backend and a query engine that's a significant
build. But the *idea* — "tag once, get a queryable view" — could be
prototyped as: extend the topic system so a note tagged with a topic
gains a small auto-populated metadata card in the editor.

### Heptabase: cards on a whiteboard

Heptabase's bet: text-only PKM hits a ceiling when ideas need spatial
arrangement. Cards live on infinite 2D boards. Arrows, groups, nested
boards. Used heavily for research synthesis, literature reviews, learning.

**What Stone can learn**: spatial thinking is a real need but a deep
build (canvas rendering, infinite pan/zoom, anchor logic, perf at 1000+
cards). Worth deferring; not in tier 1.

### Obsidian: plugin economy

The ~1500-plugin ecosystem is Obsidian's moat. The five most-installed
productivity plugins as of 2026:

1. **Tasks** — query language for `- [ ]` items across the vault
2. **Dataview** — vault as queryable database, custom views
3. **Templater** — JavaScript-powered dynamic templates
4. **Calendar** — sidebar calendar → daily notes
5. **QuickAdd** — keyboard shortcuts for repeated captures

**What Stone can learn**: don't build the plugin ecosystem yet, but
ship the *patterns* these plugins implement: Tasks → already on the
Tasks page; Dataview → query layer over notes (deferred); Templater →
templates (tier 1); Calendar → daily review (tier 1); QuickAdd → already
have Quick Capture + Command Center.

### Obsidian Web Clipper

Released by Obsidian themselves in 2024, now considered table-stakes:

- Browser extension; click → page becomes a markdown note in your vault
- Captures clean article body (Readability-style extraction), not just
  the URL
- **Interpreter**: an AI step that can reshape captured content via a
  user-defined prompt before saving (e.g., "summarise into 3 bullets")
- Detects YouTube → pulls transcript automatically
- Per-domain templates (capture Hacker News differently from Substack)

**What Stone can learn**: this is the single highest-impact capture
surface to add. The Interpreter pattern is especially clever — the same
AISDKTextGenerator Stone uses for AskNotes could reshape clipped content
on the way in.

### Atlas: cited AI from a heterogeneous corpus

Atlas treats your notes + uploaded PDFs + web clips as a single queryable
corpus. Every AI answer cites the specific notes/sources, with click-back
to the source.

**What Stone can learn**: Stone already does the citation half (AskNotes
shows chunks). Adding PDFs and web clips to the corpus would make
AskNotes much more useful. Index any markdown file in the workspace, plus
PDFs via text extraction.

---

## 5. User segments — who is Stone for?

Not all PKM users have the same needs. Stone's deliberate constraints
(local-first, single-user, no sync) eliminate some segments and concentrate
fit on others.

| Segment | Stone fit | Why |
|---|---|---|
| **Engineers / developers** | 🟢 Strong | Markdown + Git + local AI matches mental model |
| **Researchers / academics** | 🟢 Strong | Need citation, retrieval, longevity; Stone delivers |
| **Independent consultants** | 🟢 Strong | Single-user CRM-like + meeting notes + journaling |
| **Writers** | 🟡 Mixed | Need focus mode + version history (have it); lack mobile capture |
| **Knowledge workers in teams** | 🔴 Wrong fit | Need collaboration; Stone explicitly avoids |
| **Students** | 🟡 Mixed | Want mobile + spaced repetition; Stone lacks both |
| **Casual journalers** | 🔴 Wrong fit | Apple Notes is good enough; Stone is overkill |
| **Visual thinkers** | 🔴 Wrong fit | Use Heptabase / Excalidraw |

**The sweet spot**: senior individual contributors who think in text, own
their tools, value privacy. Engineers, researchers, consultants. Probably
30-60 active workspaces per user, 500-5000 notes, daily/weekly use.

Marketing implication: "the PKM for technical people who don't want their
notes in someone else's database."

---

## 6. The four productivity levers

All 24+ candidate features cluster under four levers. Pulling each lever
produces a different kind of impact.

### Lever A: Capture surface area
**More ways data gets in → more value across all downstream features.**

| Feature | Effort | Impact |
|---|---|---|
| Web clipper (browser ext) | 1 week | 🔴 critical |
| Voice quick-capture (5-sec memo) | 1-2 days | 🔴 critical |
| Templates | 2-3 days | 🔴 critical |
| Email → Stone (forward to local SMTP intake) | 1 week | 🟡 high |
| Mobile companion (capture-only PWA) | 2-3 weeks | 🟡 high |
| Drag-drop file ingest (PDFs etc) | 3-5 days | 🟢 medium |
| Screenshot → Stone with OCR | 1 week | 🟢 medium |

### Lever B: Resurfacing & review
**Old data brought back into view → compounding returns on past capture.**

| Feature | Effort | Impact |
|---|---|---|
| Daily review page | 2 days | 🔴 critical |
| Weekly review wizard | 2-3 days | 🔴 critical |
| "On this day" in journal | 1 day | 🟡 high |
| Spaced surfacing of old notes | 4-5 days | 🟡 high |
| Note reminders ("remind me in 3 days") | 2-3 days | 🟡 high |
| Smart inbox + triage flow | 3-5 days | 🟢 medium |

### Lever C: AI depth
**Existing data, smarter answers.**

| Feature | Effort | Impact |
|---|---|---|
| Smart link suggestions while typing | 3-4 days | 🔴 critical |
| Local LLM for AskNotes (Llama 3 / Qwen) | 1-2 weeks | 🟡 high |
| Per-topic auto-summaries | 2-3 days | 🟡 high |
| Long-meeting map-reduce summarisation (phase 2) | 1 week | 🟡 high |
| Auto-tagging review queue | 2-3 days | 🟢 medium |
| Interpreter-style AI step on captured content | 3-4 days | 🟢 medium |

### Lever D: Surface improvements
**Better access to existing data.**

| Feature | Effort | Impact |
|---|---|---|
| Reading mode | 1-2 days | 🟢 medium |
| Calendar / timeline view | 4-5 days | 🟢 medium |
| Better global search UI (filters, saved, previews) | 3-4 days | 🟡 high |
| Per-note settings (visibility, retention) | 2-3 days | 🟢 medium |
| Configurable per-prompt summarisation (phase 3) | 2-3 days | 🟡 high |
| Outliner mode for select notes | 1-2 weeks | 🟢 medium |

---

## 7. Detailed deep-dives on the top 5 candidates

### A. Templates (Lever A, 2-3 days)

**The problem**: every meeting reinvents structure. Every weekly review
starts blank. Cold-start anxiety kills capture.

**Proposed design**:
- New `<workspace>/.stone/templates/` folder with `.md` files
- Templates are markdown with simple Mustache-style placeholders:
  `{{date}}`, `{{time}}`, `{{cursor}}`, `{{prompt:Question?}}`
- Command Center entry "New from template…" → fuzzy picker → choose template → renders → opens
- Hotkey to apply template inline in the active note (replaces current selection or inserts at cursor)
- Per-template "destination policy": where the new note lands (root, today's journal, specific notebook)

**Reuse**: zero architecture changes. Templates are just markdown read
from disk, processed with placeholder substitution, written via existing
note creation flow.

**Behaviour change**: users start creating meeting notes / 1:1 notes /
weekly reviews from a consistent shape. This compounds into better
retrieval and AI answers downstream.

**Ship in**: 2-3 days, no migration.

### B. Daily Review page (Lever B, 2 days)

**The problem**: Stone has tasks, meetings, journal entries, captures,
suggested topics — but nothing puts them in one view. Users have to
remember to look at each surface.

**Proposed design**:
A new route `/today` that renders a dashboard with sections:

- **Today's journal** — preview + open button
- **Today's meetings** — recordings made today, summaries inlined
- **Open tasks** — `- [ ]` items across the workspace, sorted by recency
- **Captures (last 24h)** — every note touched, grouped by hour
- **Suggested topics** — anything the topic suggester surfaces today
- **Related to today** — notes from past with high relevance to today's text (uses Related Notes infra)

Optional: **Pinned focus** — user-set "what I'm working on this week"
that appears at the top.

**Reuse**: all data already in the index, repositories, and use cases.
Pure UI assembly. New `useDailyReview` hook + `DailyReviewPage`
component. No new ports, no migrations.

**Behaviour change**: users open Stone and see the system thinking
*with* them, not just storing things. This is Reflect's strongest single
feature.

**Ship in**: 2 days.

### C. Smart link suggestions while typing (Lever C, 3-4 days)

**The problem**: users forget what they wrote before. They write a new
note that duplicates concepts already covered. Backlinks only fire when
they type `[[`.

**Proposed design**:
- Debounced (500ms) semantic similarity query as user types
- Triggered when user pauses on a paragraph break
- Query: take the current paragraph → embed → search chunk vector index
- Surface top 3 matches in a subtle floating panel (lower-right of the
  editor)
- One-click insert as `[[link]]` at cursor, or dismiss
- Setting: enable/disable per-workspace, sensitivity threshold

**Reuse**: chunk vector index, embedding worker. Need: debounce hook,
floating panel component, click-to-link.

**Risks**: noisy if threshold is wrong; needs user testing to calibrate.
Mitigation: ship behind a feature flag, default off, opt-in.

**Behaviour change**: knowledge graph builds itself. Most under-utilised
feature in PKM made automatic.

**Ship in**: 3-4 days.

### D. Web clipper (Lever A, 1 week)

**The problem**: Stone has no way to capture web content. The biggest
unfair advantage Obsidian has right now is its official web clipper.

**Proposed design**:
- Browser extension (Chrome + Firefox + Safari) using a shared
  WebExtension manifest
- Extension UI: select text or capture page → markdown extract →
  optional AI interpret → save
- Communicates with Stone via:
  - **Option A**: local HTTP server in main process (port 31731) that
    accepts POST + auth token. Extension stores token after pairing.
  - **Option B**: shared file in `~/Library/Application Support/stone/clipboard/`
    that Stone watches via file watcher.
- Option A is cleaner; ~1 day for the server adapter; uses existing
  Hono package already in deps.
- Per-domain templates (apply different processing to HN / arXiv /
  Substack / generic).
- Optional "Interpreter" step (mirrors Obsidian): apply a user prompt
  via the existing `ITextGenerator.generateMarkdown` before saving.

**Reuse**: ITextGenerator, file storage, note creation use case. New:
WebExtension boilerplate (~500 lines), HTTP intake adapter.

**Behaviour change**: massive. The read-later queue Stone doesn't yet
handle gets a first-class home. Every article you save becomes
searchable via AskNotes.

**Ship in**: 1 week including extension boilerplate.

### E. Voice quick-capture (Lever A, 1-2 days)

**The problem**: meetings work great. But the 5-second "remember this
thought" voice memo doesn't have a path. Mem and Reflect both have this
and users love it.

**Proposed design**:
- Reuse 95% of the meeting recorder pipeline
- Floating button / global shortcut → mic captures until released or
  60-sec timeout
- Sends through the same Whisper pipeline
- Skips the summarisation step (memo is already short)
- Appends transcript directly to today's journal as a timestamped entry
- No DB row needed; behaves like Quick Capture but with voice input

**Reuse**: nearly everything from the meeting recorder. New: hold-to-talk
UI affordance, a `meetings:transcribeOnly` IPC channel that skips the
summarisation/persistence path.

**Behaviour change**: capture latency drops from "open app, find dock,
click Stop" to "press shortcut, talk for 5s, release." Adds a fourth
capture surface (alongside typing, journal, meeting).

**Ship in**: 1-2 days.

---

## 8. Risk analysis — what could undermine this strategy

| Risk | Severity | Mitigation |
|---|---|---|
| **OpenAI / Anthropic ship "chat-with-files" as a native feature** | 🟡 Real but slow | Stone's local-first identity is a permanent moat against this — many users explicitly *don't* want to send notes to OpenAI |
| **Obsidian closes the AI gap via official AI features** | 🔴 Likely in 12-18 months | Stone needs to deepen the differentiation (local LLM, smarter retrieval, opinionated workflows) before that lands |
| **Apple Notes adds vector search** | 🟢 Possible but limited | Apple Notes ≠ a power user PKM; different segment |
| **Notion AI improves dramatically** | 🟡 Mid-risk | Notion is a different shape (databases + collaboration); not Stone's segment |
| **Reflect / Mem add local model support** | 🟢 Unlikely | Their architecture is cloud-first; retrofit is hard |
| **Tana opens up + lowers learning curve** | 🟡 Real | Most likely competitor to take Stone's segment; Stone must lean into "simpler than Tana, more capable than Obsidian" |
| **User abandons Stone for [X]** | 🔴 Always present | Reduce by: better onboarding, daily-review habit, no-data-export friction |

The single biggest medium-term risk is **Obsidian shipping a great
AI experience**. Stone's window is ~12-18 months to establish a "local-AI
PKM that just works" reputation before that's no longer a differentiator.

---

## 9. Three candidate roadmaps

### Roadmap A — "Four weeks of leverage" (recommended starter)

Ships the highest-ROI features from each lever. Total: 4 weeks of focused
work, ~12 commits, 0 architectural changes.

**Week 1** — workflow opinionation
- Templates (Lever A, 3 days)
- Daily Review page (Lever B, 2 days)

**Week 2** — capture expansion
- Voice quick-capture (Lever A, 2 days)
- Smart link suggestions while typing (Lever C, 3 days)

**Week 3** — capture expansion continued
- Web clipper extension v1 (Lever A, 1 week)

**Week 4** — resurfacing
- "On this day" widget in Daily Review (Lever B, 1 day)
- Note reminders (Lever B, 2 days)
- Long-meeting map-reduce summarisation (Lever C, 2 days — finishes
  phase 2 of the meeting recorder)

At end of week 4: Stone has templates, daily review, web clipper, voice
quick-capture, smart links, and reminders. The product feels
qualitatively different from where it is today.

### Roadmap B — "AI-native deepening" (highest moat)

Same starter foundations but pivots into AI depth in weeks 3-6.

**Week 1-2**: templates + daily review + voice quick-capture (5 days)
**Week 3-4**: local LLM for AskNotes (Llama 3.1 8B Q4 quantized, ~5GB)
**Week 5**: smart link suggestions + per-topic auto-summaries
**Week 6**: web clipper with Interpreter step

End state: Stone is the only PKM where the entire AI stack
(transcription, embedding, reranking, generation) runs locally. Pitch
to security-conscious users + airgapped environments. Lock in a niche
that no competitor can touch.

### Roadmap C — "Capture-first" (broadest user reach)

Optimises for the segment that doesn't yet use a PKM at all but
considers one. Capture is the cold-start.

**Week 1**: templates + Quick Capture redesign (lower keystroke count)
**Week 2**: voice quick-capture + browser web clipper
**Week 3**: mobile companion (capture-only PWA: voice → Stone via HTTP
intake)
**Week 4**: drag-drop PDF ingest with text extraction + indexing
**Week 5**: email → Stone (local SMTP intake or "forward to inbox" via
a small relay)
**Week 6**: daily review (which now shows ALL the new capture sources)

End state: Stone collects information from anywhere. Becomes a "central
nervous system" for a knowledge worker's inputs.

---

## 10. The recommendation

**Ship Roadmap A** — it's the safest, broadest-impact, and lays
foundation for either B or C later.

Within Roadmap A, the absolute first 5 days of work I'd ship:

1. **Day 1-2**: Templates — biggest immediate productivity unlock, zero
   risk
2. **Day 3-4**: Daily Review page — gives every existing feature a daily
   home
3. **Day 5**: Voice quick-capture — pulls double-duty (reuses meeting
   recorder infra, expands capture surface)

After that week, evaluate: did templates + daily review actually change
your behaviour? If yes, continue into web clipper. If they didn't, the
problem might be capture latency rather than retrieval, in which case
flip to Roadmap C.

---

## 11. Open questions for the user

1. **Target user**: confirm the "senior IC who thinks in text" segment is
   right, or push toward different segments (writers? researchers?
   non-technical consultants?). Marketing language changes a lot based
   on this.

2. **Web clipper architecture**: HTTP server in main process (cleaner)
   vs file-watcher inbox (simpler)? Both work; preference?

3. **Local LLM**: appetite for shipping a 5GB model download to make
   AskNotes fully offline? Differentiator vs cost.

4. **Mobile companion**: any short-term plan, or treat as 2027+ work?
   Affects how aggressively we invest in capture parity on desktop.

5. **Plugin ecosystem**: ignore for now (recommended), or start
   designing the plugin API so user-built features can compound? My
   vote: ignore until 2027 — Stone needs more opinionation first.

6. **Distribution**: how do you intend to get this in front of users?
   Affects which features matter most (e.g., if launching on Product
   Hunt, web clipper + voice quick-capture are demo gold).

---

## Sources

- [Best PKM Apps in 2026 — Toolfinder](https://toolfinder.com/best/pkm-apps)
- [Personal Knowledge Management 2026: The Honest Guide — Atlas](https://www.atlasworkspace.ai/blog/personal-knowledge-management)
- [Best Second Brain Apps 2026 — Atlas](https://www.atlasworkspace.ai/blog/best-second-brain-apps)
- [Best Heptabase Alternatives 2026 — Storyflow](https://storyflow.so/blog/best-heptabase-alternatives-2026)
- [The Best PKM Stack for Knowledge Workers in 2026 — Arivu](https://arivu.app/blog/best-pkm-stack-knowledge-workers-2026/)
- [Knowledge Management in 2026 — Glukhov](https://www.glukhov.org/knowledge-management/)
- [AI Second Brain Software Compared — Teknalyze](https://www.teknalyze.com/software/ai-second-brain-software-tested-compared-and-explained/)
- [6 AI Note-Taking Apps Tested in 2026 — Alfred](https://get-alfred.ai/blog/best-ai-note-taking-apps)
- [Best Obsidian Alternatives 2026 — Storyflow](https://storyflow.so/blog/best-obsidian-alternatives-2026)
- [Tana Review 2026 — VisionStack](https://www.visionsparksolutions.com/reviews/tana/)
- [Mem.ai Review & Guide 2026 — Productivity Stack](https://productivitystack.io/guides/mem-ai-guide/)
- [Reflect Notes — Product Hunt 2026 reviews](https://www.producthunt.com/products/reflect-notes/reviews)
- [Top Obsidian Plugins 2026 — Obsibrain](https://www.obsibrain.com/blog/top-obsidian-plugins-in-2026-the-essential-list-for-power-users)
- [Obsidian Web Clipper — official](https://github.com/obsidianmd/obsidian-clipper)
- [Obsidian Spaced Repetition Plugins — Hub](https://publish.obsidian.md/hub/02+-+Community+Expansions/02.01+Plugins+by+Category/Spaced+Repetition+Plugins)
