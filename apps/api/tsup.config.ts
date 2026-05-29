import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // Workspace packages export TS source, so they must be bundled in (not externalized).
  noExternal: [/^@profitflow\//],
});
