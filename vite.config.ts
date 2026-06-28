import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isGitHubPagesBuild =
    command === 'build' &&
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(repoName);

  // Unique per deploy — the commit SHA in CI, a timestamp locally. Baked into the
  // app (__BUILD_ID__) AND published as /version.json so the running client can
  // detect when a newer build is live and reload itself (see src/updateCheck.ts).
  // GitHub Pages can't set Cache-Control, so this is how we avoid stale clients.
  const buildId = process.env.GITHUB_SHA?.slice(0, 8) ?? Date.now().toString(36);

  return {
    base: isGitHubPagesBuild && repoName ? `/${repoName}/` : '/',
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      {
        // Emit /version.json next to the bundle. Fetched no-store by the client so a
        // new deploy is detected within one launch/resume — no manual cache clearing.
        name: 'emit-version-json',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ build: buildId }),
          });
        },
      },
    ],
    test: {
      environment: 'node',
    },
  };
});
