'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
('use strict');
var _chunkA6UXSBDOjs = require('./chunk-A6UXSBDO.js');
_chunkA6UXSBDOjs.b.call(void 0);
var _chalk = require('chalk');
var _chalk2 = _interopRequireDefault(_chalk);
_chunkA6UXSBDOjs.b.call(void 0);
var c = async (t, o = process.cwd(), e) => {
  if (!t || _chunkA6UXSBDOjs.c.call(void 0, t))
    return _chunkA6UXSBDOjs.M.call(void 0, t, e);
  let n = await _chunkA6UXSBDOjs.H.call(void 0, t, o, e);
  if (e != null && e.watch)
    _chunkA6UXSBDOjs.K.call(
      void 0,
      e == null ? void 0 : e.watch,
      async () => {
        try {
          await _chunkA6UXSBDOjs.L.call(void 0, o, n);
        } catch (a) {
          _chunkA6UXSBDOjs.d.call(
            void 0,
            _chalk2.default.red(
              `\u{1F6D1}  ${
                e != null && e.projectName
                  ? `${e == null ? void 0 : e.projectName} - `
                  : ''
              }${a}`,
            ),
          );
        }
      },
      n.input.target,
    );
  else
    try {
      return await _chunkA6UXSBDOjs.L.call(void 0, o, n);
    } catch (a) {
      _chunkA6UXSBDOjs.d.call(
        void 0,
        _chalk2.default.red(
          `\u{1F6D1}  ${
            e != null && e.projectName
              ? `${e == null ? void 0 : e.projectName} - `
              : ''
          }${a}`,
        ),
      );
    }
};
var te = c;
exports.URL_REGEX = _chunkA6UXSBDOjs.s;
exports.VERBS_WITH_BODY = _chunkA6UXSBDOjs.r;
exports.addDependency = _chunkA6UXSBDOjs.v;
exports.camel = _chunkA6UXSBDOjs.g;
exports.default = te;
exports.defineConfig = _chunkA6UXSBDOjs.G;
exports.escape = _chunkA6UXSBDOjs.o;
exports.generalJSTypes = _chunkA6UXSBDOjs.p;
exports.generalJSTypesWithArray = _chunkA6UXSBDOjs.q;
exports.generate = c;
exports.generateAxiosOptions = _chunkA6UXSBDOjs.z;
exports.generateBodyMutatorConfig = _chunkA6UXSBDOjs.B;
exports.generateBodyOptions = _chunkA6UXSBDOjs.y;
exports.generateDependencyImports = _chunkA6UXSBDOjs.w;
exports.generateFormDataAndUrlEncodedFunction = _chunkA6UXSBDOjs.F;
exports.generateImports = _chunkA6UXSBDOjs.t;
exports.generateMutatorConfig = _chunkA6UXSBDOjs.D;
exports.generateMutatorImports = _chunkA6UXSBDOjs.u;
exports.generateMutatorRequestOptions = _chunkA6UXSBDOjs.E;
exports.generateOptions = _chunkA6UXSBDOjs.A;
exports.generateQueryParamsAxiosConfig = _chunkA6UXSBDOjs.C;
exports.generateVerbImports = _chunkA6UXSBDOjs.x;
exports.getNumberWord = _chunkA6UXSBDOjs.n;
exports.isSyntheticDefaultImportsAllow = _chunkA6UXSBDOjs.J;
exports.kebab = _chunkA6UXSBDOjs.i;
exports.loadTsconfig = _chunkA6UXSBDOjs.I;
exports.pascal = _chunkA6UXSBDOjs.f;
exports.sanitize = _chunkA6UXSBDOjs.l;
exports.snake = _chunkA6UXSBDOjs.h;
exports.stringify = _chunkA6UXSBDOjs.k;
exports.toObjectString = _chunkA6UXSBDOjs.m;
exports.upper = _chunkA6UXSBDOjs.j;
