import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/alert-bot.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  noExternal: [/^@profitflow\//],
});
