# Main-screen stress preview

Run `pnpm dev:stress`, then use the **Demo data / Worst case** toolbar. This renders the real Stone app with a development-only, in-memory transport; no Electron backend is needed.

The toolbar also covers empty, one-item, 1,284-note, loading, error, and denied-access states. Switching a dataset resets preview edits and navigation. Reloading keeps the selected dataset in the URL.

Useful preview URLs (append `#/today`):

- `/stress-test.html?data=worst`
- `/stress-test.html?data=worst&sidebar=200&expand=all`
- `/stress-test.html?data=worst&text=200`
- `/stress-test.html?data=worst&theme=dark`
- `/stress-test.html?data=worst&sidebar=collapsed&dir=rtl`

`sidebar` accepts 200–400 or `collapsed`. The native window minimum is 800 × 600; narrower browser widths and RTL are extra probes, not statements of platform support.

Fixtures include long names, a 255-character note title, legacy blank/null titles, URLs, email addresses, multiple scripts and emoji, deep folders, all meeting/task states, future timestamps, and hour-long recordings. Mail previews exercise the wire contract; the current Apple Mail adapter supplies unread counts without message previews.

The bootstrap replaces local/session storage and installs the preview bridge **before** importing renderer state. Supported edits are in memory. Unknown or external operations fail with `STRESS_PREVIEW_ONLY`; fixtures never seed the real database or filesystem. The entry is guarded by `import.meta.env.DEV` and is absent from production renderer/web entry points. Keep it out of those build inputs.
