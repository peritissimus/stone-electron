# Contributing to Stone

## Semantic Release & Commit Convention

This project uses [semantic-release](https://semantic-release.gitbook.io/) to automate version management and package publishing.

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Each commit message should be structured as follows:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

Must be one of the following:

- **feat**: A new feature (triggers a MINOR version bump)
- **fix**: A bug fix (triggers a PATCH version bump)
- **perf**: A performance improvement (triggers a PATCH version bump)
- **refactor**: A code change that neither fixes a bug nor adds a feature (triggers a PATCH version bump)
- **docs**: Documentation only changes (no release)
- **style**: Changes that do not affect the meaning of the code (no release)
- **test**: Adding missing tests or correcting existing tests (no release)
- **build**: Changes that affect the build system or external dependencies (no release)
- **ci**: Changes to our CI configuration files and scripts (no release)
- **chore**: Other changes that don't modify src or test files (no release)
- **revert**: Reverts a previous commit (triggers a PATCH version bump)

#### Breaking Changes

A commit that has a footer `BREAKING CHANGE:`, or appends a `!` after the type/scope, introduces a breaking API change (correlating with MAJOR in Semantic Versioning).

Example:
```
feat!: remove deprecated API endpoints

BREAKING CHANGE: The /api/v1/old endpoint has been removed. Use /api/v2/new instead.
```

### Examples

#### Feature (Minor Release)
```
feat(editor): add mermaid diagram support

Implement mermaid diagram rendering in code blocks with language detection
and toggle between code/diagram view.
```

#### Bug Fix (Patch Release)
```
fix(database): resolve migration path in packaged builds

Use process.resourcesPath when app is packaged to correctly locate
migration files.
```

#### Breaking Change (Major Release)
```
feat(api)!: restructure IPC channel naming

BREAKING CHANGE: All IPC channel names have been updated to use a
consistent namespace format. Update all ipcRenderer.invoke() calls.

Before: ipcRenderer.invoke('getNotes')
After: ipcRenderer.invoke('notes:get')
```

### Release Process

Semantic-release runs automatically on every push to the `main` branch:

1. **Build & Test** - Runs type checking, builds, and tests
2. **Analyze Commits** - Determines the next version based on commit messages
3. **Generate Release Notes** - Creates changelog from commit messages
4. **Build Application** - Packages the app for distribution
5. **Create GitHub Release** - Publishes release with binaries
6. **Update Version** - Commits updated package.json and CHANGELOG.md

### Manual Release (Local Testing)

```bash
# Dry run (see what would be released without actually releasing)
GH_TOKEN=your_token npx semantic-release --dry-run

# Actual release (only use for testing, CI handles real releases)
GH_TOKEN=your_token npx semantic-release
```

### Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Commit with conventional format: `git commit -m "feat(scope): description"`
4. Push and create a PR to `main`
5. Once merged, semantic-release will automatically:
   - Determine the version bump
   - Generate release notes
   - Build and package the app
   - Create a GitHub release with binaries

### Version Bumping Examples

Given current version: `1.2.3`

| Commits on main | New Version | Type |
|----------------|-------------|------|
| `fix: bug fix` | `1.2.4` | Patch |
| `feat: new feature` | `1.3.0` | Minor |
| `feat!: breaking change` | `2.0.0` | Major |
| `fix: bug`<br>`feat: feature` | `1.3.0` | Minor |
| `docs: update readme` | `1.2.3` | No release |

### Tips

- Write clear, descriptive commit messages
- Keep commits focused on a single change
- Use the scope to indicate which part of the codebase is affected
- Always include a body for breaking changes explaining the migration path
- Run `pnpm typecheck` and `pnpm build` locally before pushing

### Questions?

See the [semantic-release documentation](https://semantic-release.gitbook.io/) for more details.
