const { readdirSync } = require("fs");

/**
 * Rollup configuration to build correctly our scripts (nodejs scripts need to be cjs)
 */
module.exports = readdirSync("lib/bin")
  .filter(file => file.endsWith(".js"))
  .map(file => ({
    input: `lib/bin/${file}`,
    output: {
      file: `lib/bin/${file}`,
      format: "cjs",
      banner: "#!/usr/bin/env node",
    },
  }));
