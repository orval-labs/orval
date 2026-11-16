import { definePackage } from '../vite.config.base';

export default definePackage({
  deps: {
    dts: {
      alwaysBundle: ['@faker-js/faker', /^@modelcontextprotocol\//],
    },
  },
});
