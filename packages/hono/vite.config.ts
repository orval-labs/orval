import { definePackage } from '../vite.config.base';

export default definePackage({
  copy: [{ from: 'src/zValidator.ts', to: 'dist' }],
});
