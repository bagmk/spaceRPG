import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isGitHubPagesBuild =
    command === 'build' &&
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(repoName);

  return {
    base: isGitHubPagesBuild && repoName ? `/${repoName}/` : '/',
    plugins: [react()],
    test: {
      environment: 'node',
    },
  };
});
