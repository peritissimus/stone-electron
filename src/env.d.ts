/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Dev-only: when 'true', forces the first-launch onboarding screen to
   * render even if workspaces already exist. Lets you iterate on onboarding
   * with a normal `pnpm dev` instead of an isolated profile. Ignored in
   * production builds. Usage: `VITE_FORCE_ONBOARDING=true pnpm dev`.
   */
  readonly VITE_FORCE_ONBOARDING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?url' {
  const value: string;
  export default value;
}
