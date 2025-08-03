import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/bin/orval.ts', 'src/index.ts'],
  target: "node12",
  sourcemap: true,
  clean: true,
})
