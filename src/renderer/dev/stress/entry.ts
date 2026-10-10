// This entry is deliberately absent from both production build inputs.
// Even if someone adds the HTML to a build, the fixture app is tree-shaken.
if (import.meta.env.DEV) {
  void import('./bootstrap').then(({ startStressPreview }) => startStressPreview());
} else {
  document.getElementById('root')!.textContent = 'This preview is available in development only.';
}

export {};
