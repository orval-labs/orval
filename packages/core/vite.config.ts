import { definePackage } from '../vite.config.base';

export default definePackage({ exports: { inlinedDependencies: false } }, {}, [
  'packages/*/src/options.ts',
]);
