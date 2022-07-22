#!/usr/bin/env node
'use strict';
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
('use strict');
var _chunkA6UXSBDOjs = require('../chunk-A6UXSBDO.js');
_chunkA6UXSBDOjs.b.call(void 0);
var _cac = require('cac');
var _chalk = require('chalk');
var _chalk2 = _interopRequireDefault(_chalk);
var o = _cac.cac.call(void 0, 'orval');
_chunkA6UXSBDOjs.e.call(void 0, {
  name: _chunkA6UXSBDOjs.a.name,
  version: _chunkA6UXSBDOjs.a.version,
  description: _chunkA6UXSBDOjs.a.description,
});
o.version(_chunkA6UXSBDOjs.a.version);
o.command(
  '[config]',
  'generate client with appropriate type-signatures from OpenAPI specs',
  { ignoreOptionDefaultValue: !0 },
)
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .option('-m, --mode <name>', 'default mode that will be used')
  .option('-c, --client <name>', 'default client that will be used')
  .option('--mock', 'activate the mock')
  .option(
    '-w, --watch [path]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .option('--clean [path]', 'Clean output directory')
  .option('--prettier [path]', 'Prettier generated files')
  .option('--tslint [path]', 'tslint generated files')
  .option('--tsconfig [path]', 'path to your tsconfig file')
  .action(async (m, t) => {
    if (
      _chunkA6UXSBDOjs.c.call(void 0, t.input) &&
      _chunkA6UXSBDOjs.c.call(void 0, t.output)
    ) {
      let i = await _chunkA6UXSBDOjs.H.call(void 0, {
        input: t.input,
        output: {
          target: t.output,
          clean: t.clean,
          prettier: t.prettier,
          tslint: t.tslint,
          mock: t.mock,
          client: t.client,
          mode: t.mode,
          tsconfig: t.tsconfig,
        },
      });
      if (t.watch)
        _chunkA6UXSBDOjs.K.call(
          void 0,
          t.watch,
          async () => {
            try {
              await _chunkA6UXSBDOjs.L.call(void 0, process.cwd(), i);
            } catch (n) {
              _chunkA6UXSBDOjs.d.call(
                void 0,
                _chalk2.default.red(`\u{1F6D1}  ${n}`),
              );
            }
          },
          i.input.target,
        );
      else
        try {
          await _chunkA6UXSBDOjs.L.call(void 0, process.cwd(), i);
        } catch (n) {
          _chunkA6UXSBDOjs.d.call(
            void 0,
            _chalk2.default.red(`\u{1F6D1}  ${n}`),
          );
        }
    } else
      await _chunkA6UXSBDOjs.M.call(void 0, t.config, {
        projectName: t.project,
        watch: t.watch,
        clean: t.clean,
        prettier: t.prettier,
        tslint: t.tslint,
        mock: t.mock,
        client: t.client,
        mode: t.mode,
        tsconfig: t.tsconfig,
      });
  });
o.help();
o.parse(process.argv);
