'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
('use strict');
var _chunkHZNVPLTOjs = require('./chunk-HZNVPLTO.js');
_chunkHZNVPLTOjs.b.call(void 0);
var _chalk = require('chalk');
var _chalk2 = _interopRequireDefault(_chalk);
_chunkHZNVPLTOjs.b.call(void 0);
var c = async (t, o = process.cwd(), e) => {
  if (!t || _chunkHZNVPLTOjs.c.call(void 0, t))
    return _chunkHZNVPLTOjs.M.call(void 0, t, e);
  let n = await _chunkHZNVPLTOjs.H.call(void 0, t, o, e);
  if (e != null && e.watch)
    _chunkHZNVPLTOjs.K.call(
      void 0,
      e == null ? void 0 : e.watch,
      async () => {
        try {
          await _chunkHZNVPLTOjs.L.call(void 0, o, n);
        } catch (a) {
          _chunkHZNVPLTOjs.d.call(
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
      return await _chunkHZNVPLTOjs.L.call(void 0, o, n);
    } catch (a) {
      _chunkHZNVPLTOjs.d.call(
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
exports.URL_REGEX = _chunkHZNVPLTOjs.s;
exports.VERBS_WITH_BODY = _chunkHZNVPLTOjs.r;
exports.addDependency = _chunkHZNVPLTOjs.v;
exports.camel = _chunkHZNVPLTOjs.g;
exports.default = te;
exports.defineConfig = _chunkHZNVPLTOjs.G;
exports.escape = _chunkHZNVPLTOjs.o;
exports.generalJSTypes = _chunkHZNVPLTOjs.p;
exports.generalJSTypesWithArray = _chunkHZNVPLTOjs.q;
exports.generate = c;
exports.generateAxiosOptions = _chunkHZNVPLTOjs.z;
exports.generateBodyMutatorConfig = _chunkHZNVPLTOjs.B;
exports.generateBodyOptions = _chunkHZNVPLTOjs.y;
exports.generateDependencyImports = _chunkHZNVPLTOjs.w;
exports.generateFormDataAndUrlEncodedFunction = _chunkHZNVPLTOjs.F;
exports.generateImports = _chunkHZNVPLTOjs.t;
exports.generateMutatorConfig = _chunkHZNVPLTOjs.D;
exports.generateMutatorImports = _chunkHZNVPLTOjs.u;
exports.generateMutatorRequestOptions = _chunkHZNVPLTOjs.E;
exports.generateOptions = _chunkHZNVPLTOjs.A;
exports.generateQueryParamsAxiosConfig = _chunkHZNVPLTOjs.C;
exports.generateVerbImports = _chunkHZNVPLTOjs.x;
exports.getNumberWord = _chunkHZNVPLTOjs.n;
exports.isSyntheticDefaultImportsAllow = _chunkHZNVPLTOjs.J;
exports.kebab = _chunkHZNVPLTOjs.i;
exports.loadTsconfig = _chunkHZNVPLTOjs.I;
exports.pascal = _chunkHZNVPLTOjs.f;
exports.sanitize = _chunkHZNVPLTOjs.l;
exports.snake = _chunkHZNVPLTOjs.h;
exports.stringify = _chunkHZNVPLTOjs.k;
exports.toObjectString = _chunkHZNVPLTOjs.m;
exports.upper = _chunkHZNVPLTOjs.j;
