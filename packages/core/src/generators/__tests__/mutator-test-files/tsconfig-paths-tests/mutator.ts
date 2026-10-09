// Resolved through tsconfig `paths` only. With `external: []` the bundle
// follows imports: if paths resolve the helper is inlined and its real arity
// (3) is measured; if they don't the re-export keeps its `source` and
// inspection falls back to the standard 1-arg contract.
export { default } from '@lib/helper';
