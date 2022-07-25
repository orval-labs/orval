'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
var ki = Object.create;
var on = Object.defineProperty;
var Ii = Object.getOwnPropertyDescriptor;
var Gi = Object.getOwnPropertyNames;
var Di = Object.getPrototypeOf,
  qi = Object.prototype.hasOwnProperty;
var H = ((e) =>
  typeof require != 'undefined'
    ? require
    : typeof Proxy != 'undefined'
    ? new Proxy(e, {
        get: (t, r) => (typeof require != 'undefined' ? require : t)[r],
      })
    : e)(function (e) {
  if (typeof require != 'undefined') return require.apply(this, arguments);
  throw new Error('Dynamic require of "' + e + '" is not supported');
});
var Fi = (e, t) => () => (e && (t = e((e = 0))), t);
var E = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var Ni = (e, t, r, n) => {
  if ((t && typeof t == 'object') || typeof t == 'function')
    for (let o of Gi(t))
      !qi.call(e, o) &&
        o !== r &&
        on(e, o, {
          get: () => t[o],
          enumerable: !(n = Ii(t, o)) || n.enumerable,
        });
  return e;
};
var ue = (e, t, r) => (
  (r = e != null ? ki(Di(e)) : {}),
  Ni(
    t || !e || !e.__esModule
      ? on(r, 'default', { value: e, enumerable: !0 })
      : r,
    e,
  )
);
var m = Fi(() => {});
var sr = E((fO, Do) => {
  m();
  var Gp = Object.prototype;
  function Dp(e) {
    var t = e && e.constructor,
      r = (typeof t == 'function' && t.prototype) || Gp;
    return e === r;
  }
  Do.exports = Dp;
});
var Fo = E((dO, qo) => {
  m();
  function qp(e, t) {
    return function (r) {
      return e(t(r));
    };
  }
  qo.exports = qp;
});
var Bo = E((gO, No) => {
  m();
  var Fp = Fo(),
    Np = Fp(Object.keys, Object);
  No.exports = Np;
});
var Uo = E((yO, Vo) => {
  m();
  var Bp = sr(),
    Vp = Bo(),
    Up = Object.prototype,
    Wp = Up.hasOwnProperty;
  function Hp(e) {
    if (!Bp(e)) return Vp(e);
    var t = [];
    for (var r in Object(e)) Wp.call(e, r) && r != 'constructor' && t.push(r);
    return t;
  }
  Vo.exports = Hp;
});
var ir = E((hO, Wo) => {
  m();
  var Qp =
    typeof global == 'object' && global && global.Object === Object && global;
  Wo.exports = Qp;
});
var le = E((OO, Ho) => {
  m();
  var zp = ir(),
    _p = typeof self == 'object' && self && self.Object === Object && self,
    Kp = zp || _p || Function('return this')();
  Ho.exports = Kp;
});
var ar = E((bO, Qo) => {
  m();
  var Lp = le(),
    Yp = Lp.Symbol;
  Qo.exports = Yp;
});
var Lo = E(($O, Ko) => {
  m();
  var zo = ar(),
    _o = Object.prototype,
    Jp = _o.hasOwnProperty,
    Xp = _o.toString,
    Ze = zo ? zo.toStringTag : void 0;
  function Zp(e) {
    var t = Jp.call(e, Ze),
      r = e[Ze];
    try {
      e[Ze] = void 0;
      var n = !0;
    } catch (e2) {}
    var o = Xp.call(e);
    return n && (t ? (e[Ze] = r) : delete e[Ze]), o;
  }
  Ko.exports = Zp;
});
var Jo = E((xO, Yo) => {
  m();
  var ec = Object.prototype,
    tc = ec.toString;
  function rc(e) {
    return tc.call(e);
  }
  Yo.exports = rc;
});
var et = E((SO, es) => {
  m();
  var Xo = ar(),
    nc = Lo(),
    oc = Jo(),
    sc = '[object Null]',
    ic = '[object Undefined]',
    Zo = Xo ? Xo.toStringTag : void 0;
  function ac(e) {
    return e == null
      ? e === void 0
        ? ic
        : sc
      : Zo && Zo in Object(e)
      ? nc(e)
      : oc(e);
  }
  es.exports = ac;
});
var pr = E((wO, ts) => {
  m();
  function pc(e) {
    var t = typeof e;
    return e != null && (t == 'object' || t == 'function');
  }
  ts.exports = pc;
});
var cr = E((TO, rs) => {
  m();
  var cc = et(),
    mc = pr(),
    lc = '[object AsyncFunction]',
    uc = '[object Function]',
    fc = '[object GeneratorFunction]',
    dc = '[object Proxy]';
  function gc(e) {
    if (!mc(e)) return !1;
    var t = cc(e);
    return t == uc || t == fc || t == lc || t == dc;
  }
  rs.exports = gc;
});
var os = E((jO, ns) => {
  m();
  var yc = le(),
    hc = yc['__core-js_shared__'];
  ns.exports = hc;
});
var as = E((RO, is) => {
  m();
  var mr = os(),
    ss = (function () {
      var e = /[^.]+$/.exec((mr && mr.keys && mr.keys.IE_PROTO) || '');
      return e ? 'Symbol(src)_1.' + e : '';
    })();
  function Oc(e) {
    return !!ss && ss in e;
  }
  is.exports = Oc;
});
var lr = E((PO, ps) => {
  m();
  var bc = Function.prototype,
    $c = bc.toString;
  function xc(e) {
    if (e != null) {
      try {
        return $c.call(e);
      } catch (e3) {}
      try {
        return e + '';
      } catch (e4) {}
    }
    return '';
  }
  ps.exports = xc;
});
var ms = E((EO, cs) => {
  m();
  var Sc = cr(),
    wc = as(),
    Tc = pr(),
    jc = lr(),
    Rc = /[\\^$.*+?()[\]{}|]/g,
    Pc = /^\[object .+?Constructor\]$/,
    Ec = Function.prototype,
    vc = Object.prototype,
    Ac = Ec.toString,
    Cc = vc.hasOwnProperty,
    Mc = RegExp(
      '^' +
        Ac.call(Cc)
          .replace(Rc, '\\$&')
          .replace(
            /hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,
            '$1.*?',
          ) +
        '$',
    );
  function kc(e) {
    if (!Tc(e) || wc(e)) return !1;
    var t = Sc(e) ? Mc : Pc;
    return t.test(jc(e));
  }
  cs.exports = kc;
});
var us = E((vO, ls) => {
  m();
  function Ic(e, t) {
    return e == null ? void 0 : e[t];
  }
  ls.exports = Ic;
});
var Ne = E((AO, fs) => {
  m();
  var Gc = ms(),
    Dc = us();
  function qc(e, t) {
    var r = Dc(e, t);
    return Gc(r) ? r : void 0;
  }
  fs.exports = qc;
});
var gs = E((CO, ds) => {
  m();
  var Fc = Ne(),
    Nc = le(),
    Bc = Fc(Nc, 'DataView');
  ds.exports = Bc;
});
var hs = E((MO, ys) => {
  m();
  var Vc = Ne(),
    Uc = le(),
    Wc = Vc(Uc, 'Map');
  ys.exports = Wc;
});
var bs = E((kO, Os) => {
  m();
  var Hc = Ne(),
    Qc = le(),
    zc = Hc(Qc, 'Promise');
  Os.exports = zc;
});
var xs = E((IO, $s) => {
  m();
  var _c = Ne(),
    Kc = le(),
    Lc = _c(Kc, 'Set');
  $s.exports = Lc;
});
var ws = E((GO, Ss) => {
  m();
  var Yc = Ne(),
    Jc = le(),
    Xc = Yc(Jc, 'WeakMap');
  Ss.exports = Xc;
});
var Cs = E((DO, As) => {
  m();
  var ur = gs(),
    fr = hs(),
    dr = bs(),
    gr = xs(),
    yr = ws(),
    vs = et(),
    Be = lr(),
    Ts = '[object Map]',
    Zc = '[object Object]',
    js = '[object Promise]',
    Rs = '[object Set]',
    Ps = '[object WeakMap]',
    Es = '[object DataView]',
    em = Be(ur),
    tm = Be(fr),
    rm = Be(dr),
    nm = Be(gr),
    om = Be(yr),
    Ee = vs;
  ((ur && Ee(new ur(new ArrayBuffer(1))) != Es) ||
    (fr && Ee(new fr()) != Ts) ||
    (dr && Ee(dr.resolve()) != js) ||
    (gr && Ee(new gr()) != Rs) ||
    (yr && Ee(new yr()) != Ps)) &&
    (Ee = function (e) {
      var t = vs(e),
        r = t == Zc ? e.constructor : void 0,
        n = r ? Be(r) : '';
      if (n)
        switch (n) {
          case em:
            return Es;
          case tm:
            return Ts;
          case rm:
            return js;
          case nm:
            return Rs;
          case om:
            return Ps;
        }
      return t;
    });
  As.exports = Ee;
});
var Mt = E((qO, Ms) => {
  m();
  function sm(e) {
    return e != null && typeof e == 'object';
  }
  Ms.exports = sm;
});
var Is = E((FO, ks) => {
  m();
  var im = et(),
    am = Mt(),
    pm = '[object Arguments]';
  function cm(e) {
    return am(e) && im(e) == pm;
  }
  ks.exports = cm;
});
var Fs = E((NO, qs) => {
  m();
  var Gs = Is(),
    mm = Mt(),
    Ds = Object.prototype,
    lm = Ds.hasOwnProperty,
    um = Ds.propertyIsEnumerable,
    fm = Gs(
      (function () {
        return arguments;
      })(),
    )
      ? Gs
      : function (e) {
          return mm(e) && lm.call(e, 'callee') && !um.call(e, 'callee');
        };
  qs.exports = fm;
});
var Bs = E((BO, Ns) => {
  m();
  var dm = Array.isArray;
  Ns.exports = dm;
});
var hr = E((VO, Vs) => {
  m();
  var gm = 9007199254740991;
  function ym(e) {
    return typeof e == 'number' && e > -1 && e % 1 == 0 && e <= gm;
  }
  Vs.exports = ym;
});
var Ws = E((UO, Us) => {
  m();
  var hm = cr(),
    Om = hr();
  function bm(e) {
    return e != null && Om(e.length) && !hm(e);
  }
  Us.exports = bm;
});
var Qs = E((WO, Hs) => {
  m();
  function $m() {
    return !1;
  }
  Hs.exports = $m;
});
var Ls = E((tt, Ve) => {
  m();
  var xm = le(),
    Sm = Qs(),
    Ks = typeof tt == 'object' && tt && !tt.nodeType && tt,
    zs = Ks && typeof Ve == 'object' && Ve && !Ve.nodeType && Ve,
    wm = zs && zs.exports === Ks,
    _s = wm ? xm.Buffer : void 0,
    Tm = _s ? _s.isBuffer : void 0,
    jm = Tm || Sm;
  Ve.exports = jm;
});
var Js = E((HO, Ys) => {
  m();
  var Rm = et(),
    Pm = hr(),
    Em = Mt(),
    vm = '[object Arguments]',
    Am = '[object Array]',
    Cm = '[object Boolean]',
    Mm = '[object Date]',
    km = '[object Error]',
    Im = '[object Function]',
    Gm = '[object Map]',
    Dm = '[object Number]',
    qm = '[object Object]',
    Fm = '[object RegExp]',
    Nm = '[object Set]',
    Bm = '[object String]',
    Vm = '[object WeakMap]',
    Um = '[object ArrayBuffer]',
    Wm = '[object DataView]',
    Hm = '[object Float32Array]',
    Qm = '[object Float64Array]',
    zm = '[object Int8Array]',
    _m = '[object Int16Array]',
    Km = '[object Int32Array]',
    Lm = '[object Uint8Array]',
    Ym = '[object Uint8ClampedArray]',
    Jm = '[object Uint16Array]',
    Xm = '[object Uint32Array]',
    k = {};
  k[Hm] = k[Qm] = k[zm] = k[_m] = k[Km] = k[Lm] = k[Ym] = k[Jm] = k[Xm] = !0;
  k[vm] =
    k[Am] =
    k[Um] =
    k[Cm] =
    k[Wm] =
    k[Mm] =
    k[km] =
    k[Im] =
    k[Gm] =
    k[Dm] =
    k[qm] =
    k[Fm] =
    k[Nm] =
    k[Bm] =
    k[Vm] =
      !1;
  function Zm(e) {
    return Em(e) && Pm(e.length) && !!k[Rm(e)];
  }
  Ys.exports = Zm;
});
var Zs = E((QO, Xs) => {
  m();
  function el(e) {
    return function (t) {
      return e(t);
    };
  }
  Xs.exports = el;
});
var ti = E((rt, Ue) => {
  m();
  var tl = ir(),
    ei = typeof rt == 'object' && rt && !rt.nodeType && rt,
    nt = ei && typeof Ue == 'object' && Ue && !Ue.nodeType && Ue,
    rl = nt && nt.exports === ei,
    Or = rl && tl.process,
    nl = (function () {
      try {
        var e = nt && nt.require && nt.require('util').types;
        return e || (Or && Or.binding && Or.binding('util'));
      } catch (e5) {}
    })();
  Ue.exports = nl;
});
var si = E((zO, oi) => {
  m();
  var ol = Js(),
    sl = Zs(),
    ri = ti(),
    ni = ri && ri.isTypedArray,
    il = ni ? sl(ni) : ol;
  oi.exports = il;
});
var br = E((_O, ii) => {
  m();
  var al = Uo(),
    pl = Cs(),
    cl = Fs(),
    ml = Bs(),
    ll = Ws(),
    ul = Ls(),
    fl = sr(),
    dl = si(),
    gl = '[object Map]',
    yl = '[object Set]',
    hl = Object.prototype,
    Ol = hl.hasOwnProperty;
  function bl(e) {
    if (e == null) return !0;
    if (
      ll(e) &&
      (ml(e) ||
        typeof e == 'string' ||
        typeof e.splice == 'function' ||
        ul(e) ||
        dl(e) ||
        cl(e))
    )
      return !e.length;
    var t = pl(e);
    if (t == gl || t == yl) return !e.size;
    if (fl(e)) return !al(e).length;
    for (var r in e) if (Ol.call(e, r)) return !1;
    return !0;
  }
  ii.exports = bl;
});
var Gt = {
  name: 'orval',
  description: 'A swagger client generator for typescript',
  version: '6.9.100',
  license: 'MIT',
  files: ['dist'],
  bin: { orval: 'dist/bin/orval.js' },
  main: 'dist/index.js',
  keywords: [
    'rest',
    'client',
    'swagger',
    'open-api',
    'fetch',
    'data fetching',
    'code-generation',
    'angular',
    'react',
    'react-query',
    'svelte',
    'svelte-query',
    'vue',
    'vue-query',
    'msw',
    'mock',
    'axios',
    'vue-query',
    'vue',
    'swr',
  ],
  author: { name: 'Victor Bury', email: 'bury.victor@gmail.com' },
  repository: { type: 'git', url: 'https://github.com/anymaniax/orval' },
  scripts: {
    build:
      'tsup ./src/bin/orval.ts ./src/index.ts --minify --clean --dts --splitting',
    dev: "tsup ./src/bin/orval.ts ./src/index.ts --clean --watch src --onSuccess 'yarn generate-api'",
    lint: 'eslint src/**/*.ts',
    test: 'vitest --global test.ts',
    format: 'prettier --write .',
    'format:staged': 'pretty-quick --staged',
    prerelease: 'yarn build && cd ./tests && yarn generate && yarn build',
    release: 'dotenv release-it',
    postrelease: 'yarn build && yarn update-samples',
    'generate-api':
      'node ./dist/bin/orval.js --config ./samples/react-query/basic/orval.config.ts --watch',
    prepare: 'husky install && cd ./samples/react-query/basic && yarn',
    commitlint: 'commitlint',
    'update-samples': 'zx ./scripts/update-samples.mjs',
  },
  devDependencies: {
    '@commitlint/cli': '^17.0.2',
    '@commitlint/config-conventional': '^17.0.3',
    '@faker-js/faker': '^7.3.0',
    '@release-it/conventional-changelog': '^5.0.0',
    '@types/chalk': '^2.2.0',
    '@types/commander': '^2.12.2',
    '@types/fs-extra': '^9.0.12',
    '@types/inquirer': '^8.2.0',
    '@types/jest': '^28.1.6',
    '@types/js-yaml': '^4.0.5',
    '@types/lodash.get': '^4.4.6',
    '@types/lodash.omit': '^4.5.6',
    '@types/lodash.omitby': '^4.6.6',
    '@types/lodash.uniq': '^4.5.6',
    '@types/lodash.uniqby': '^4.7.6',
    '@types/lodash.uniqwith': '^4.5.6',
    '@types/micromatch': '^4.0.2',
    '@types/node': '^18.0.0',
    '@types/prettier': '^2.4.4',
    '@types/request': '^2.48.8',
    '@types/validator': '^13.7.1',
    '@typescript-eslint/eslint-plugin': '^5.14.0',
    '@typescript-eslint/parser': '^5.14.0',
    'dotenv-cli': '^5.1.0',
    eslint: '^8.10.0',
    'eslint-config-prettier': '^8.5.0',
    'eslint-plugin-prettier': '^4.0.0',
    husky: '^8.0.1',
    'lint-staged': '^13.0.3',
    'npm-run-all': '^4.1.5',
    prettier: '2.6.2',
    'pretty-quick': '^3.1.3',
    'release-it': '^15.1.0',
    rimraf: '^3.0.2',
    tsup: '^5.12.0',
    typescript: '^4.6.2',
    vitest: '^0.6.0',
    zx: '^7.0.2',
  },
  dependencies: {
    '@apidevtools/swagger-parser': '^10.1.0',
    acorn: '^8.7.0',
    cac: '^6.7.12',
    chalk: '^4.1.2',
    chokidar: '^3.5.3',
    'compare-versions': '^4.1.3',
    'core-js': '^3.23.5',
    cuid: '^2.1.8',
    debug: '^4.3.3',
    esbuild: '^0.14.25',
    esutils: '2.0.3',
    execa: '^5.1.1',
    'find-up': '5.0.0',
    'fs-extra': '^10.0.1',
    globby: '11.0.4',
    'ibm-openapi-validator': '^0.83.0',
    inquirer: '^8.2.0',
    'lodash.get': '^4.4.2',
    'lodash.omit': '^4.5.0',
    'lodash.omitby': '^4.6.0',
    'lodash.uniq': '^4.5.0',
    'lodash.uniqby': '^4.7.0',
    'lodash.uniqwith': '^4.5.0',
    micromatch: '^4.0.4',
    mobx: '^6.6.1',
    'openapi3-ts': '^2.0.2',
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    redoc: '^2.0.0-rc.72',
    'string-argv': '^0.3.1',
    'styled-components': '^5.3.5',
    swagger2openapi: '^7.0.8',
    tsconfck: '^2.0.1',
    upath: '^2.0.1',
    url: '^0.11.0',
    validator: '^13.7.0',
  },
};
m();
var Q = {
    ANGULAR: 'angular',
    AXIOS: 'axios',
    AXIOS_FUNCTIONS: 'axios-functions',
    REACT_QUERY: 'react-query',
    SVELTE_QUERY: 'svelte-query',
    VUE_QUERY: 'vue-query',
  },
  ce = {
    SINGLE: 'single',
    SPLIT: 'split',
    TAGS: 'tags',
    TAGS_SPLIT: 'tags-split',
  },
  ee = {
    POST: 'post',
    PUT: 'put',
    GET: 'get',
    PATCH: 'patch',
    DELETE: 'delete',
    HEAD: 'head',
  };
m();
var _upath = require('upath');
var I = (e) => Boolean(e.$ref),
  sn = (e) => !_upath.extname.call(void 0, e);
function N(e) {
  return Object.prototype.toString.call(e) === '[object Object]';
}
function G(e) {
  return typeof e == 'string';
}
function an(e) {
  return typeof e == 'number';
}
function J(e) {
  return typeof e == 'boolean';
}
function B(e) {
  return typeof e == 'function';
}
function we(e) {
  return typeof e > 'u';
}
function pn(e) {
  return typeof e === null;
}
var cn = (e) => Object.values(ee).includes(e);
m();
var _chalk = require('chalk');
var _chalk2 = _interopRequireDefault(_chalk);
var _readline = require('readline');
var _readline2 = _interopRequireDefault(_readline);
var q = console.log,
  iu = (exports.e = ({ name: e, version: t, description: r }) =>
    q(
      `\u{1F37B} Start ${_chalk2.default.cyan.bold(e)} ${_chalk2.default.green(
        `v${t}`,
      )}${r ? ` - ${r}` : ''}`,
    )),
  fn = (e) => q(_chalk2.default.red(e));
var dn = (e) =>
    q(
      `\u{1F389} ${
        e ? `${_chalk2.default.green(e)} - ` : ''
      }Your OpenAPI spec has been converted into ready to use orval!`,
    ),
  gn = (e) => {
    q(_chalk2.default.yellow('(!) Warnings')),
      e.forEach((t) =>
        q(
          _chalk2.default.yellow(`Message : ${t.message}
Path    : ${t.path}`),
        ),
      );
  },
  yn = (e) => {
    q(_chalk2.default.red('(!) Errors')),
      e.forEach((t) =>
        q(
          _chalk2.default.red(`Message : ${t.message}
Path    : ${t.path}`),
        ),
      );
  },
  Dt = { silent: 0, error: 1, warn: 2, info: 3 },
  ln,
  un,
  qt = 0;
function Ui() {
  let e = process.stdout.rows - 2,
    t =
      e > 0
        ? `
`.repeat(e)
        : '';
  console.log(t),
    _readline2.default.cursorTo(process.stdout, 0, 0),
    _readline2.default.clearScreenDown(process.stdout);
}
function X(e = 'info', t = {}) {
  let { prefix: r = '[vite]', allowClearScreen: n = !0 } = t,
    o = Dt[e],
    s = n && process.stdout.isTTY && !process.env.CI ? Ui : () => {};
  function i(u, c, l = {}) {
    if (o >= Dt[u]) {
      let d = u === 'info' ? 'log' : u,
        g = () => {
          if (l.timestamp) {
            let f =
              u === 'info'
                ? _chalk2.default.cyan.bold(r)
                : u === 'warn'
                ? _chalk2.default.yellow.bold(r)
                : _chalk2.default.red.bold(r);
            return `${_chalk2.default.dim(
              new Date().toLocaleTimeString(),
            )} ${f} ${c}`;
          } else return c;
        };
      u === ln && c === un
        ? (qt++, s(), console[d](g(), _chalk2.default.yellow(`(x${qt + 1})`)))
        : ((qt = 0), (un = c), (ln = u), l.clear && s(), console[d](g()));
    }
  }
  let a = new Set(),
    p = {
      hasWarned: !1,
      info(u, c) {
        i('info', u, c);
      },
      warn(u, c) {
        (p.hasWarned = !0), i('warn', u, c);
      },
      warnOnce(u, c) {
        a.has(u) || ((p.hasWarned = !0), i('warn', u, c), a.add(u));
      },
      error(u, c) {
        (p.hasWarned = !0), i('error', u, c);
      },
      clearScreen(u) {
        o >= Dt[u] && s();
      },
    };
  return p;
}
m();
var Ft = function (e, t) {
    return (
      (t = t || ''), e.replace(/(^|-)/g, '$1\\u' + t).replace(/,/g, '\\u' + t)
    );
  },
  at = Ft('20-26,28-2F,3A-40,5B-60,7B-7E,A0-BF,D7,F7', '00'),
  pt = 'a-z' + Ft('DF-F6,F8-FF', '00'),
  ze = 'A-Z' + Ft('C0-D6,D8-DE', '00'),
  Wi = 'A|An|And|As|At|But|By|En|For|If|In|Of|On|Or|The|To|Vs?\\.?|Via',
  fe = {
    capitalize: new RegExp('(^|[' + at + '])([' + pt + '])', 'g'),
    pascal: new RegExp('(^|[' + at + '])+([' + pt + ze + '])', 'g'),
    fill: new RegExp('[' + at + ']+(.|$)', 'g'),
    sentence: new RegExp(
      '(^\\s*|[\\?\\!\\.]+"?\\s+"?|,\\s+")([' + pt + '])',
      'g',
    ),
    improper: new RegExp('\\b(' + Wi + ')\\b', 'g'),
    relax: new RegExp(
      '([^' + ze + '])([' + ze + ']*)([' + ze + '])(?=[^' + ze + ']|$)',
      'g',
    ),
    upper: new RegExp('^[^' + pt + ']+$'),
    hole: /[^\s]\s[^\s]/,
    apostrophe: /'/g,
    room: new RegExp('[' + at + ']'),
  },
  Hi = (e) => e.replace(fe.apostrophe, ''),
  hn = String.prototype.toUpperCase,
  Nt = String.prototype.toLowerCase,
  ct = (e, t, r = !1) => (
    t != null &&
      (e = e.replace(fe.fill, function (n, o) {
        return o ? t + o : '';
      })),
    r && (e = Hi(e)),
    e
  ),
  Qi = (e) => Nt.call(e.charAt(0)) + e.slice(1),
  zi = (e, t, r, n) => t + ' ' + (r ? r + ' ' : '') + n,
  Bt = (e, t = !1, r = !1, n = !1) => {
    if (
      ((e = e == null ? '' : e + ''),
      !n && fe.upper.test(e) && (e = Nt.call(e)),
      !t && !fe.hole.test(e))
    ) {
      var o = ct(e, ' ');
      fe.hole.test(o) && (e = o);
    }
    return !r && !fe.room.test(e) && (e = e.replace(fe.relax, zi)), e;
  },
  On = (e, t, r) => ct(Nt.call(Bt(e, !!t)), t, r),
  b = (exports.f = (e) =>
    ct(
      Bt(e, !1, !0).replace(fe.pascal, (t, r, n) => hn.call(n)),
      '',
      !0,
    )),
  j = (exports.g = (e) => Qi(b(e))),
  pu = (exports.h = (e) => On(e, '_', !0)),
  Te = (exports.i = (e) => On(e, '-', !0)),
  cu = (exports.j = (e, t, r) => ct(hn.call(Bt(e, !!t, !1, !0)), t, r));
m();
var _esutils = require('esutils');
var _lodashget = require('lodash.get');
var _lodashget2 = _interopRequireDefault(_lodashget);
var K = (e) => {
    if (!(we(e) || pn(e)))
      return G(e)
        ? `'${e}'`
        : an(e) || J(e) || B(e)
        ? `${e}`
        : Array.isArray(e)
        ? `[${e.map(K).join(', ')}]`
        : Object.entries(e).reduce((t, [r, n], o, s) => {
            let i = K(n);
            return s.length === 1
              ? `{ ${r}: ${i}, }`
              : o
              ? s.length - 1 === o
                ? t + `${r}: ${i}, }`
                : t + `${r}: ${i}, `
              : `{ ${r}: ${i}, `;
          }, '');
  },
  V = (exports.l = (e, t) => {
    let {
        whitespace: r = '',
        underscore: n = '',
        dot: o = '',
        dash: s = '',
        es5keyword: i = !1,
      } = t != null ? t : {},
      a = e.replace(/[^\w\s.-]/g, '');
    return (
      r !== !0 && (a = a.replace(/[\s]/g, r)),
      n !== !0 && (a = a.replace(/['_']/g, n)),
      o !== !0 && (a = a.replace(/[.]/g, o)),
      s !== !0 && (a = a.replace(/[-]/g, s)),
      i && (a = _esutils.keyword.isKeywordES5(a, !0) ? `_${a}` : a),
      a
    );
  }),
  F = (exports.m = (e, t) =>
    e.length
      ? (t ? e.map((n) => _lodashget2.default.call(void 0, n, t)) : e).join(`,
    `) + ','
      : ''),
  Li = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
  },
  mt = (exports.n = (e) =>
    e
      .toString()
      .split('')
      .reduce((r, n) => r + Li[n], '')),
  lt = (exports.o = (e, t = "'") => e.replace(t, `\\${t}`));
m();
var Yi = ['number', 'string', 'null', 'unknown', 'undefined', 'object', 'blob'],
  Ae = (exports.q = Yi.reduce(
    (e, t) => (e.push(t, `Array<${t}>`, `${t}[]`), e),
    [],
  )),
  se = (exports.r = [ee.POST, ee.PUT, ee.PATCH, ee.DELETE]),
  yu = (exports.s =
    /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/);
m();
var _lodashuniq = require('lodash.uniq');
var _lodashuniq2 = _interopRequireDefault(_lodashuniq);
var _lodashuniqwith = require('lodash.uniqwith');
var _lodashuniqwith2 = _interopRequireDefault(_lodashuniqwith);
var Sn = ({ imports: e = [], target: t, isRootKey: r, specsName: n }) =>
    e.length
      ? _lodashuniqwith2.default
          .call(
            void 0,
            e,
            (o, s) =>
              o.name === s.name &&
              o.default === s.default &&
              o.specKey === s.specKey,
          )
          .sort()
          .map(({ specKey: o, name: s, values: i, alias: a }) => {
            if (o) {
              let p = o !== t ? n[o] : '';
              return !r && o
                ? `import ${i ? '' : 'type '}{ ${s}${
                    a ? ` as ${a}` : ''
                  } } from '../${_upath.join.call(void 0, p, j(s))}';`
                : `import ${i ? '' : 'type '}{ ${s}${
                    a ? ` as ${a}` : ''
                  } } from './${_upath.join.call(void 0, p, j(s))}';`;
            }
            return `import ${i ? '' : 'type '}{ ${s}${
              a ? ` as ${a}` : ''
            } } from './${j(s)}';`;
          }).join(`
`)
      : '',
  z = (exports.u = ({ mutators: e, implementation: t, oneMore: r }) => {
    let n = _lodashuniqwith2.default
      .call(void 0, e, (o, s) => o.name === s.name && o.default === s.default)
      .map((o) => {
        let s = `${r ? '../' : ''}${o.path}`,
          a = `import ${o.default ? o.name : `{ ${o.name} }`} from '${s}'`;
        if (t && (o.hasErrorType || o.bodyTypeName)) {
          let p = '';
          o.hasErrorType &&
            t.includes(o.errorTypeName) &&
            (p = o.default
              ? `ErrorType as ${o.errorTypeName}`
              : o.errorTypeName);
          let u = '';
          o.bodyTypeName &&
            t.includes(o.bodyTypeName) &&
            (u = o.default ? `BodyType as ${o.bodyTypeName}` : o.bodyTypeName),
            (u || p) &&
              ((a += `
`),
              (a += `import type { ${p}${
                p && u ? ', ' : ''
              }${u} } from '${s}'`));
        }
        return a;
      }).join(`
`);
    return n
      ? n +
          `
`
      : '';
  }),
  $n = ({
    deps: e,
    isAllowSyntheticDefaultImports: t,
    dependency: r,
    specsName: n,
    key: o,
    onlyTypes: s,
  }) => {
    let i = e.find((l) => l.default && (t || !l.syntheticDefaultImport)),
      a = t ? void 0 : e.find((l) => l.syntheticDefaultImport),
      p = _lodashuniq2.default.call(
        void 0,
        e
          .filter((l) => !l.default && !l.syntheticDefaultImport)
          .map(({ name: l, alias: d }) => (d ? `${l} as ${d}` : l)),
      ).join(`,
  `),
      u = '',
      c = a ? `import * as ${a.name} from '${r}';` : '';
    if (c) {
      if (e.length === 1) return c;
      u += `${c}
`;
    }
    return (
      (u += `import ${s ? 'type ' : ''}${i ? `${i.name}${p ? ',' : ''}` : ''}${
        p
          ? `{
  ${p}
}`
          : ''
      } from '${r}${o !== 'default' && n[o] ? `/${n[o]}` : ''}'`),
      u
    );
  },
  Xi = (exports.v = ({
    implementation: e,
    exports: t,
    dependency: r,
    specsName: n,
    hasSchemaDir: o,
    isAllowSyntheticDefaultImports: s,
  }) => {
    let i = t.filter((p) => e.includes(p.alias || p.name));
    if (!i.length) return;
    let a = i.reduce((p, u) => {
      var l, d, g, f;
      let c = o && u.specKey ? u.specKey : 'default';
      return u.values && (s || !u.syntheticDefaultImport)
        ? ((p[c] = {
            ...p[c],
            values: [
              ...((d = (l = p[c]) == null ? void 0 : l.values) != null
                ? d
                : []),
              u,
            ],
          }),
          p)
        : ((p[c] = {
            ...p[c],
            types: [
              ...((f = (g = p[c]) == null ? void 0 : g.types) != null ? f : []),
              u,
            ],
          }),
          p);
    }, {});
    return Object.entries(a).map(([p, { values: u, types: c }]) => {
      let l = '';
      return (
        u &&
          (l += $n({
            deps: u,
            isAllowSyntheticDefaultImports: s,
            dependency: r,
            specsName: n,
            key: p,
            onlyTypes: !1,
          })),
        c &&
          (u &&
            (l += `
`),
          (l += $n({
            deps: c,
            isAllowSyntheticDefaultImports: s,
            dependency: r,
            specsName: n,
            key: p,
            onlyTypes: !0,
          }))),
        l
      );
    }).join(`
`);
  }),
  ut = (exports.w = (e, t, r, n, o) => {
    let s = t
      .map((i) =>
        Xi({
          ...i,
          implementation: e,
          specsName: r,
          hasSchemaDir: n,
          isAllowSyntheticDefaultImports: o,
        }),
      )
      .filter(Boolean).join(`
`);
    return s
      ? s +
          `
`
      : '';
  }),
  de = (exports.x = ({
    response: e,
    body: t,
    queryParams: r,
    headers: n,
    params: o,
  }) => [
    ...e.imports,
    ...t.imports,
    ...(r ? [{ name: r.schema.name }] : []),
    ...(n ? [{ name: n.schema.name }] : []),
    ...o.flatMap(({ imports: s }) => s),
  ]);
m();
var Zi = (e, t, r) =>
    t && e.formData
      ? `
      formData,`
      : r && e.formUrlEncoded
      ? `
      formUrlEncoded,`
      : e.implementation
      ? `
      ${e.implementation},`
      : '',
  ea = (exports.z = ({
    response: e,
    isExactOptionalPropertyTypes: t,
    queryParams: r,
    headers: n,
    requestOptions: o,
    hasSignal: s,
  }) => {
    var p;
    let i = o !== !1;
    if (!r && !n && !e.isBlob)
      return i
        ? 'options'
        : s
        ? t
          ? '...(signal ? { signal } : {})'
          : 'signal'
        : '';
    let a = '';
    return (
      i ||
        (r &&
          (a += `
        params,`),
        n &&
          (a += `
        headers,`),
        s &&
          (a += t
            ? `
        ...(signal ? { signal } : {}),`
            : `
        signal,`)),
      e.isBlob &&
        (!N(o) || !o.hasOwnProperty('responseType')) &&
        (a += `
        responseType: 'blob',`),
      N(o) &&
        (a += `
 ${(p = K(o)) == null ? void 0 : p.slice(1, -1)}`),
      i &&
        ((a += `
    ...options,`),
        r &&
          (a += `
        params: {...params, ...options?.params},`),
        n &&
          (a += `
        headers: {...headers, ...options?.headers},`)),
      a
    );
  }),
  ge = (exports.A = ({
    route: e,
    body: t,
    headers: r,
    queryParams: n,
    response: o,
    verb: s,
    requestOptions: i,
    isFormData: a,
    isFormUrlEncoded: p,
    isAngular: u,
    isExactOptionalPropertyTypes: c,
    hasSignal: l,
  }) => {
    let d = se.includes(s),
      g = d ? Zi(t, a, p) : '',
      f = ea({
        response: o,
        queryParams: n == null ? void 0 : n.schema,
        headers: r == null ? void 0 : r.schema,
        requestOptions: i,
        isExactOptionalPropertyTypes: c,
        hasSignal: l,
      }),
      y = f ? `{${f}}` : '';
    return s === ee.DELETE
      ? g
        ? `
      \`${e}\`,{${u ? 'body' : 'data'}:${g} ${f === 'options' ? `...${f}` : f}}
    `
        : `
      \`${e}\`,${f === 'options' ? f : y}
    `
      : `
      \`${e}\`,${d ? g || 'undefined,' : ''}${f === 'options' ? f : y}
    `;
  }),
  ta = (exports.B = (e, t, r) =>
    t && e.formData
      ? `,
       data: formData`
      : r && e.formUrlEncoded
      ? `,
       data: formUrlEncoded`
      : e.implementation
      ? `,
      data: ${e.implementation}`
      : ''),
  ra = (exports.C = (e, t) => {
    if (!t && !e.isBlob) return '';
    let r = '';
    return (
      t &&
        (r += `,
        params`),
      e.isBlob &&
        (r += `,
        responseType: 'blob'`),
      r
    );
  }),
  ye = (exports.D = ({
    route: e,
    body: t,
    headers: r,
    queryParams: n,
    response: o,
    verb: s,
    isFormData: i,
    isFormUrlEncoded: a,
    isBodyVerb: p,
    hasSignal: u,
    isExactOptionalPropertyTypes: c,
  }) => {
    let l = p ? ta(t, i, a) : '',
      d = ra(o, n),
      g = t.contentType
        ? `,
      headers: {'Content-Type': '${t.contentType}', ${r ? '...headers' : ''}}`
        : r
        ? `,
      headers`
        : '';
    return `{url: \`${e}\`, method: '${s}'${g}${l}${d}${
      !p && u ? `, ${c ? '...(signal ? { signal }: {})' : 'signal'}` : ''
    }
    }`;
  }),
  he = (exports.E = (e, t) => {
    var r, n;
    return t
      ? N(e)
        ? `{${(n = K(e)) == null ? void 0 : n.slice(1, -1)} ...options}`
        : 'options'
      : N(e)
      ? (r = K(e)) == null
        ? void 0
        : r.slice(1, -1)
      : '';
  }),
  Oe = (exports.F = ({
    body: e,
    formData: t,
    formUrlEncoded: r,
    isFormData: n,
    isFormUrlEncoded: o,
  }) =>
    n && e.formData
      ? t
        ? `const formData = ${t.name}(${e.implementation})`
        : e.formData
      : o && e.formUrlEncoded
      ? r
        ? `const formUrlEncoded = ${r.name}(${e.implementation})`
        : e.formUrlEncoded
      : '');
m();
m();
var _url = require('url');
var _url2 = _interopRequireDefault(_url);
m();
var _esbuild = require('esbuild');
var _fs = require('fs');
var _fs2 = _interopRequireDefault(_fs);
var _globby = require('globby');
var _globby2 = _interopRequireDefault(_globby);
var _micromatch = require('micromatch');
var _micromatch2 = _interopRequireDefault(_micromatch);
var _path = require('path');
var _path2 = _interopRequireDefault(_path);
m();
var _debug = require('debug');
var _debug2 = _interopRequireDefault(_debug);
var wn = process.env.ORVAL_DEBUG_FILTER,
  Vt = process.env.DEBUG;
function Tn(e, t = {}) {
  let r = _debug2.default.call(void 0, e),
    { onlyWhenFocused: n } = t,
    o = typeof n == 'string' ? n : e;
  return (s, ...i) => {
    (wn && !s.includes(wn)) ||
      (n && !(Vt != null && Vt.includes(o))) ||
      r(s, ...i);
  };
}
var M = (
    e = '',
    { backupFilename: t = 'filename', extension: r = '.ts' } = {},
  ) => {
    let n = sn(e),
      o = n ? _upath.join.call(void 0, e, t + r) : e,
      s = o.replace(/\.[^/.]+$/, ''),
      i = _upath.dirname.call(void 0, o),
      a = _upath.basename.call(void 0, o, r[0] !== '.' ? `.${r}` : r);
    return {
      path: o,
      pathWithoutExtension: s,
      extension: r,
      isDirectory: n,
      dirname: i,
      filename: a,
    };
  },
  En = Tn('orval:file-load'),
  Wt = new Map();
async function ft(e, t) {
  let {
      root: r = process.cwd(),
      isDefault: n = !0,
      defaultFileName: o,
      logLevel: s,
      alias: i,
      tsconfig: a,
      load: p = !0,
    } = t != null ? t : {},
    u = Date.now(),
    c,
    l = !1,
    d = !1;
  if (e) (c = _path2.default.resolve(e)), (l = e.endsWith('.ts'));
  else if (o) {
    let y = _path2.default.resolve(r, `${o}.js`);
    if ((_fs2.default.existsSync(y) && (c = y), !c)) {
      let h = _path2.default.resolve(r, `${o}.mjs`);
      _fs2.default.existsSync(h) && ((c = h), (d = !0));
    }
    if (!c) {
      let h = _path2.default.resolve(r, `${o}.ts`);
      _fs2.default.existsSync(h) && ((c = h), (l = !0));
    }
  }
  c ||
    (e
      ? X(s).error(_chalk2.default.red(`File not found => ${e}`))
      : o
      ? X(s).error(_chalk2.default.red(`File not found => ${o}.{js,mjs,ts}`))
      : X(s).error(_chalk2.default.red('File not found')),
    process.exit(1));
  let g = _upath.normalizeSafe.call(void 0, c),
    f = Wt.get(c);
  if (f) return { path: g, ...f, cached: !0 };
  try {
    let y;
    if (!y && !l && !d)
      try {
        delete H.cache[H.resolve(c)],
          (y = H(c)),
          En(`cjs loaded in ${Date.now() - u}ms`);
      } catch (h) {
        if (
          !new RegExp(
            [
              'Cannot use import statement',
              'Must use import to load ES Module',
              'Unexpected token',
              'Unexpected identifier',
            ].join('|'),
          ).test(h.message)
        )
          throw h;
      }
    if (!y) {
      let { code: h } = await ca(
        c,
        d,
        r || _upath.dirname.call(void 0, g),
        i,
        a == null ? void 0 : a.compilerOptions,
      );
      p ? (y = await ma(c, h, n)) : (y = h),
        En(`bundled file loaded in ${Date.now() - u}ms`);
    }
    return Wt.set(c, { file: y }), { path: g, file: y };
  } catch (y) {
    return Wt.set(c, { error: y }), { path: g, error: y };
  }
}
async function ca(e, t = !1, r, n, o) {
  let s = await _esbuild.build.call(void 0, {
      absWorkingDir: process.cwd(),
      entryPoints: [e],
      outfile: 'out.js',
      write: !1,
      platform: 'node',
      bundle: !0,
      format: t ? 'esm' : 'cjs',
      sourcemap: 'inline',
      metafile: !0,
      target: 'es6',
      minifyWhitespace: !0,
      plugins: [
        ...(n || (o == null ? void 0 : o.paths)
          ? [
              {
                name: 'aliasing',
                setup(a) {
                  a.onResolve({ filter: /^[\w@][^:]/ }, async ({ path: p }) => {
                    if (n) {
                      let u = Object.keys(n),
                        c = u.find(
                          (l) =>
                            p.startsWith(l) ||
                            _micromatch2.default.isMatch(p, u),
                        );
                      if (c) {
                        let l = _micromatch2.default.scan(c),
                          d = _micromatch2.default.scan(n[c]),
                          g = _upath.resolve.call(void 0, r, d.base),
                          f = l.base
                            ? p.replace(l.base, g)
                            : _upath.joinSafe.call(void 0, g, p),
                          h = _upath.extname.call(void 0, f) ? f : `${f}.ts`;
                        return _fs2.default.existsSync(h)
                          ? { path: h }
                          : void 0;
                      }
                    }
                    if (o != null && o.paths) {
                      let u = Object.keys(o == null ? void 0 : o.paths),
                        c = u.find(
                          (l) =>
                            p.startsWith(l) ||
                            _micromatch2.default.isMatch(p, u),
                        );
                      if (c) {
                        let l = _micromatch2.default.scan(c),
                          d = _micromatch2.default.scan(
                            o == null ? void 0 : o.paths[c][0],
                          ),
                          g = _upath.resolve.call(void 0, r, d.base),
                          f = l.base
                            ? p.replace(l.base, g)
                            : _upath.joinSafe.call(void 0, g, p),
                          h = _upath.extname.call(void 0, f) ? f : `${f}.ts`;
                        return _fs2.default.existsSync(h)
                          ? { path: h }
                          : void 0;
                      }
                    }
                  });
                },
              },
            ]
          : []),
        {
          name: 'externalize-deps',
          setup(a) {
            a.onResolve({ filter: /.*/ }, (p) => {
              let u = p.path;
              if (u[0] !== '.' && !_path2.default.isAbsolute(u))
                return { external: !0 };
            });
          },
        },
        {
          name: 'replace-import-meta',
          setup(a) {
            a.onLoad({ filter: /\.[jt]s$/ }, async (p) => {
              let u = await _fs2.default.promises.readFile(p.path, 'utf8');
              return {
                loader: p.path.endsWith('.ts') ? 'ts' : 'js',
                contents: u
                  .replace(
                    /\bimport\.meta\.url\b/g,
                    JSON.stringify(`file://${p.path}`),
                  )
                  .replace(
                    /\b__dirname\b/g,
                    JSON.stringify(_path2.default.dirname(p.path)),
                  )
                  .replace(/\b__filename\b/g, JSON.stringify(p.path)),
              };
            });
          },
        },
      ],
    }),
    { text: i } = s.outputFiles[0];
  return {
    code: i,
    dependencies: s.metafile ? Object.keys(s.metafile.inputs) : [],
  };
}
async function ma(e, t, r) {
  let n = _path2.default.extname(e),
    o = H.extensions[n];
  (H.extensions[n] = (a, p) => {
    p === e ? a._compile(t, p) : o(a, p);
  }),
    delete H.cache[H.resolve(e)];
  let s = H(e),
    i = r && s.__esModule ? s.default : s;
  return (H.extensions[n] = o), i;
}
async function Ht(e, t) {
  let r = await _globby2.default.call(void 0, e, { cwd: t, absolute: !0 });
  await Promise.all(r.map((n) => _fs2.default.promises.unlink(n)));
}
m();
var _isURL = require('validator/lib/isURL');
var _isURL2 = _interopRequireDefault(_isURL);
var ua = /^https?:\/\/\w+(\.\w+)*(:[0-9]+)?(\/.*)?$/,
  be = (e) => _isURL2.default.call(void 0, e) || ua.test(e);
var _e = {
    schemas: '',
    responses: 'Response',
    parameters: 'Parameter',
    requestBodies: 'Body',
  },
  ya = new RegExp('~1', 'g'),
  Me = async (e, t) => {
    let [r, n] = e.split('#'),
      o = n
        .slice(1)
        .split('/')
        .map((p) => p.replace(ya, '/')),
      s = _lodashget2.default.call(
        void 0,
        t.override,
        [...o.slice(0, 2), 'suffix'],
        '',
      ),
      i = o[o.length - 1];
    if (!r) return { name: b(i) + s, originalName: i, refPaths: o };
    let a = be(t.specKey)
      ? _url2.default.resolve(t.specKey, r)
      : _upath.resolve.call(void 0, M(t.specKey).dirname, r);
    return { name: b(i) + s, originalName: i, specKey: a, refPaths: o };
  };
m();
var _fsextra = require('fs-extra');
var _inquirer = require('inquirer');
var _inquirer2 = _interopRequireDefault(_inquirer);
m();
var _https = require('https');
var _https2 = _interopRequireDefault(_https);
var An = (e, t) =>
  new Promise((r, n) => {
    let o = _https2.default.request(e, (s) => {
      let i = '';
      s.on('data', (a) => (i += a.toString())),
        s.on('error', n),
        s.on('end', () => {
          let a = {
            status: s.statusCode,
            headers: s.headers,
            body: JSON.parse(i),
          };
          s.statusCode && s.statusCode >= 200 && s.statusCode <= 299
            ? r(a)
            : n(a);
        });
    });
    o.on('error', n), t && o.write(t, 'binary'), o.end();
  });
var Sa = ({ accessToken: e, repo: t, owner: r, branch: n, path: o }) => {
    let s = JSON.stringify({
      query: `query {
      repository(name: "${t}", owner: "${r}") {
        object(expression: "${n}:${o}") {
          ... on Blob {
            text
          }
        }
      }
    }`,
    });
    return [
      {
        method: 'POST',
        hostname: 'api.github.com',
        path: '/graphql',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'orval-importer',
          authorization: `bearer ${e}`,
          'Content-Length': s.length,
        },
      },
      s,
    ];
  },
  wa = async (e) => {
    if (await _fsextra.pathExists.call(void 0, e))
      return _fsextra.readFile.call(void 0, e, 'utf-8');
    {
      let t = await _inquirer2.default.prompt([
        {
          type: 'input',
          name: 'githubToken',
          message:
            'Please provide a GitHub token with `repo` rules checked (https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)',
        },
        {
          type: 'confirm',
          name: 'saveToken',
          message:
            'Would you like to store your token for the next time? (stored in your node_modules)',
        },
      ]);
      return (
        t.saveToken &&
          (await _fsextra.outputFile.call(void 0, e, t.githubToken)),
        t.githubToken
      );
    }
  },
  Ta = async (e) => {
    var u, c, l, d;
    let t = _upath.join.call(void 0, __dirname, '.githubToken'),
      r = await wa(t),
      [n] = e.split('github.com/').slice(-1),
      [o, s, , i, ...a] = n.split('/'),
      p = a.join('/');
    try {
      let { body: g } = await An(
        ...Sa({ accessToken: r, repo: s, owner: o, branch: i, path: p }),
      );
      return (
        (u = g.errors) != null &&
          u.length &&
          ((c = g.errors) == null
            ? void 0
            : c.some((y) => (y == null ? void 0 : y.type) === 'NOT_FOUND')) &&
          (
            await _inquirer2.default.prompt([
              {
                type: 'confirm',
                name: 'removeToken',
                message:
                  "Your token doesn't have the correct permissions, should we remove it?",
              },
            ])
          ).removeToken &&
          (await _fsextra.unlink.call(void 0, t)),
        (d = (l = g.data) == null ? void 0 : l.repository) == null
          ? void 0
          : d.object.text
      );
    } catch (g) {
      throw g.body
        ? (g.body.message === 'Bad credentials' &&
            (
              await _inquirer2.default.prompt([
                {
                  type: 'confirm',
                  name: 'removeToken',
                  message:
                    "Your token doesn't have the correct permissions, should we remove it?",
                },
              ])
            ).removeToken &&
            (await _fsextra.unlink.call(void 0, t)),
          g.body.message || `Oups... \u{1F37B}. ${g}`)
        : `Oups... \u{1F37B}. ${g}`;
    }
  },
  Mn = {
    order: 199,
    canRead(e) {
      return e.url.includes('github.com');
    },
    read(e) {
      return Ta(e.url);
    },
  };
m();
var dt = (e) => e && typeof e == 'object';
function Pe(e, t) {
  return !dt(t) || !dt(e)
    ? e
    : Object.entries(t).reduce((r, [n, o]) => {
        let s = r[n];
        return (
          Array.isArray(s) && Array.isArray(o)
            ? (r[n] = [...s, ...o])
            : dt(s) && dt(o)
            ? (r[n] = Pe(s, o))
            : (r[n] = o),
          r
        );
      }, e);
}
m();
var kn = ({ title: e, description: t, version: r }) => [
  `Generated by ${Gt.name} v${Gt.version} \u{1F37A}`,
  'Do not edit manually.',
  ...(e ? [e] : []),
  ...(t ? [t] : []),
  ...(r ? [`OpenAPI spec version: ${r}`] : []),
];
m();
var _findup = require('find-up');
var _findup2 = _interopRequireDefault(_findup);
var In = async (e, t = process.cwd()) => {
  if (!e) {
    let n = await _findup2.default.call(void 0, ['package.json'], { cwd: t });
    return n ? await Promise.resolve().then(() => ue(H(n))) : void 0;
  }
  let r = ie(e, t);
  if (_fsextra.existsSync.call(void 0, r))
    return await Promise.resolve().then(() => ue(H(r)));
};
m();
var _tsconfck = require('tsconfck');
var Dn = async (e, t = process.cwd()) => {
    var r, n;
    if (we(e)) {
      let o = await _findup2.default.call(
        void 0,
        ['tsconfig.json', 'jsconfig.json'],
        { cwd: t },
      );
      return o ? (await _tsconfck.parse.call(void 0, o)).tsconfig : void 0;
    }
    if (G(e)) {
      let o = ie(e, t);
      if (_fsextra.existsSync.call(void 0, o)) {
        let s = await _tsconfck.parse.call(void 0, o);
        return (
          ((n =
            (r = s.referenced) == null
              ? void 0
              : r.find(({ tsconfigFile: a }) => a === o)) == null
            ? void 0
            : n.tsconfig) || s.tsconfig
        );
      }
      return;
    }
    if (N(e)) return e;
  },
  Z = (exports.J = (e) => {
    var t, r, n;
    return e
      ? !!((n =
          (t = e == null ? void 0 : e.compilerOptions) == null
            ? void 0
            : t.allowSyntheticDefaultImports) != null
          ? n
          : (r = e == null ? void 0 : e.compilerOptions) == null
          ? void 0
          : r.esModuleInterop)
      : !0;
  });
function Hf(e) {
  return e;
}
var Fn = async (e, t = process.cwd(), r = {}) => {
    var h,
      x,
      $,
      S,
      w,
      T,
      R,
      P,
      v,
      A,
      D,
      L,
      pe,
      ve,
      Y,
      oe,
      We,
      He,
      Qe,
      st,
      it,
      Rr,
      Pr,
      Er,
      vr,
      Ar,
      Cr,
      Mr,
      kr,
      Ir,
      Gr,
      Dr,
      qr,
      Fr,
      Nr,
      Br,
      Vr,
      Ur,
      Wr,
      Hr,
      Qr,
      zr,
      _r,
      Kr,
      Lr,
      Yr,
      Jr,
      Xr,
      Zr,
      en,
      tn,
      rn,
      nn;
    let n = await (B(e) ? e() : e);
    n.input ||
      (X().error(_chalk2.default.red('Config require an input')),
      process.exit(1)),
      n.output ||
        (X().error(_chalk2.default.red('Config require an output')),
        process.exit(1));
    let o = G(n.input) ? { target: n.input } : n.input,
      s = G(n.output) ? { target: n.output } : n.output,
      i = ie(s.workspace || '', t),
      { clean: a, prettier: p, client: u, mode: c, mock: l, tslint: d } = r,
      g = await Dn(s.tsconfig || r.tsconfig, t),
      f = await In(s.packageJson || r.packageJson, t),
      y = {
        input: {
          target: Aa(o.target, t),
          validation: o.validation || !1,
          override: {
            transformer: ie(
              (h = o.override) == null ? void 0 : h.transformer,
              t,
            ),
          },
          converterOptions: (x = o.converterOptions) != null ? x : {},
          parserOptions: Pe(va, ($ = o.parserOptions) != null ? $ : {}),
        },
        output: {
          target: ie(s.target, i),
          schemas: ie(s.schemas, i),
          workspace: s.workspace ? i : void 0,
          client:
            (w = (S = s.client) != null ? S : u) != null
              ? w
              : Q.AXIOS_FUNCTIONS,
          mode: Ca((T = s.mode) != null ? T : c),
          mock: (P = (R = s.mock) != null ? R : l) != null ? P : !1,
          clean: (A = (v = s.clean) != null ? v : a) != null ? A : !1,
          prettier: (L = (D = s.prettier) != null ? D : p) != null ? L : !1,
          tslint: (ve = (pe = s.tslint) != null ? pe : d) != null ? ve : !1,
          tsconfig: g,
          packageJson: f,
          headers: (Y = s.headers) != null ? Y : !1,
          override: {
            ...s.override,
            operations: qn(
              (We = (oe = s.override) == null ? void 0 : oe.operations) != null
                ? We
                : {},
              i,
            ),
            tags: qn(
              (Qe = (He = s.override) == null ? void 0 : He.tags) != null
                ? Qe
                : {},
              i,
            ),
            mutator: Ie(i, (st = s.override) == null ? void 0 : st.mutator),
            formData:
              (Er = J((it = s.override) == null ? void 0 : it.formData)
                ? (Pr = s.override) == null
                  ? void 0
                  : Pr.formData
                : Ie(i, (Rr = s.override) == null ? void 0 : Rr.formData)) !=
              null
                ? Er
                : !0,
            formUrlEncoded:
              (Mr = J((vr = s.override) == null ? void 0 : vr.formUrlEncoded)
                ? (Cr = s.override) == null
                  ? void 0
                  : Cr.formUrlEncoded
                : Ie(
                    i,
                    (Ar = s.override) == null ? void 0 : Ar.formUrlEncoded,
                  )) != null
                ? Mr
                : !0,
            header:
              ((kr = s.override) == null ? void 0 : kr.header) === !1
                ? !1
                : B((Ir = s.override) == null ? void 0 : Ir.header)
                ? (Gr = s.override) == null
                  ? void 0
                  : Gr.header
                : kn,
            requestOptions:
              (qr = (Dr = s.override) == null ? void 0 : Dr.requestOptions) !=
              null
                ? qr
                : !0,
            components: {
              schemas: {
                suffix: _e.schemas,
                ...((Br =
                  (Nr = (Fr = s.override) == null ? void 0 : Fr.components) ==
                  null
                    ? void 0
                    : Nr.schemas) != null
                  ? Br
                  : {}),
              },
              responses: {
                suffix: _e.responses,
                ...((Wr =
                  (Ur = (Vr = s.override) == null ? void 0 : Vr.components) ==
                  null
                    ? void 0
                    : Ur.responses) != null
                  ? Wr
                  : {}),
              },
              parameters: {
                suffix: _e.parameters,
                ...((zr =
                  (Qr = (Hr = s.override) == null ? void 0 : Hr.components) ==
                  null
                    ? void 0
                    : Qr.parameters) != null
                  ? zr
                  : {}),
              },
              requestBodies: {
                suffix: _e.requestBodies,
                ...((Lr =
                  (Kr = (_r = s.override) == null ? void 0 : _r.components) ==
                  null
                    ? void 0
                    : Kr.requestBodies) != null
                  ? Lr
                  : {}),
              },
            },
            query: {
              useQuery: !0,
              signal: !0,
              ...((Jr = (Yr = s.override) == null ? void 0 : Yr.query) != null
                ? Jr
                : {}),
            },
            swr: {
              ...((Zr = (Xr = s.override) == null ? void 0 : Xr.swr) != null
                ? Zr
                : {}),
            },
            angular: {
              provideIn:
                (rn =
                  (tn = (en = s.override) == null ? void 0 : en.angular) == null
                    ? void 0
                    : tn.provideIn) != null
                  ? rn
                  : 'root',
            },
            useDates: ((nn = s.override) == null ? void 0 : nn.useDates) || !1,
          },
        },
        hooks: n.hooks ? Ma(n.hooks) : {},
      };
    return (
      y.input.target ||
        (X().error(_chalk2.default.red('Config require an input target')),
        process.exit(1)),
      !y.output.target &&
        !y.output.schemas &&
        (X().error(
          _chalk2.default.red('Config require an output target or schemas'),
        ),
        process.exit(1)),
      y
    );
  },
  va = { validate: !0, resolve: { github: Mn } },
  Ie = (e, t) => {
    var r;
    return N(t)
      ? (t.path ||
          (X().error(_chalk2.default.red('Mutator need a path')),
          process.exit(1)),
        {
          ...t,
          path: _upath.resolve.call(void 0, e, t.path),
          default: (r = t.default || !t.name) != null ? r : !1,
        })
      : G(t)
      ? { path: _upath.resolve.call(void 0, e, t), default: !0 }
      : t;
  },
  Aa = (e, t) => (G(e) && !be(e) ? ie(e, t) : e),
  ie = (e, t) => (G(e) ? _upath.resolve.call(void 0, t, e) : e),
  qn = (e, t) =>
    Object.fromEntries(
      Object.entries(e).map(
        ([
          r,
          {
            transformer: n,
            mutator: o,
            formData: s,
            formUrlEncoded: i,
            requestOptions: a,
            ...p
          },
        ]) => [
          r,
          {
            ...p,
            ...(n ? { transformer: ie(n, t) } : {}),
            ...(o ? { mutator: Ie(t, o) } : {}),
            ...(s ? { formData: J(s) ? s : Ie(t, s) } : {}),
            ...(i ? { formUrlEncoded: J(i) ? i : Ie(t, i) } : {}),
          },
        ],
      ),
    ),
  Ca = (e) =>
    e
      ? Object.values(ce).includes(e)
        ? e
        : (X().warn(
            _chalk2.default.yellow(`Unknown the provided mode => ${e}`),
          ),
          ce.SINGLE)
      : ce.SINGLE,
  Ma = (e) =>
    Object.keys(e).reduce(
      (r, n) =>
        G(e[n])
          ? { ...r, [n]: [e[n]] }
          : Array.isArray(e[n])
          ? { ...r, [n]: e[n] }
          : B(e[n])
          ? { ...r, [n]: [e[n]] }
          : r,
      {},
    );
m();
var Nn = async (e, t, r = '.') => {
  if (!e) return;
  let { watch: n } = await Promise.resolve().then(() => ue(H('chokidar'))),
    o = ['**/{.git,node_modules}/**'],
    s =
      typeof e == 'boolean'
        ? r
        : Array.isArray(e)
        ? e.filter((a) => typeof a == 'string')
        : e;
  q(
    `Watching for changes in ${
      Array.isArray(s) ? s.map((a) => '"' + a + '"').join(' | ') : '"' + s + '"'
    }`,
  ),
    n(s, { ignorePermissionErrors: !0, ignored: o }).on('all', async (a, p) => {
      q(`Change detected: ${a} ${p}`);
      try {
        await t();
      } catch (u) {
        q(_chalk2.default.red(u));
      }
    });
};
m();
m();
var _swaggerparser = require('@apidevtools/swagger-parser');
var _swaggerparser2 = _interopRequireDefault(_swaggerparser);
var _console = require('console');
m();
var _lodashomit = require('lodash.omit');
var _lodashomit2 = _interopRequireDefault(_lodashomit);
m();
var C = (e, t, r) =>
  e.reduce(async (n, ...o) => t(await n, ...o), Promise.resolve(r));
m();
var _swagger2openapi = require('swagger2openapi');
var _swagger2openapi2 = _interopRequireDefault(_swagger2openapi);
var Bn = async (e, t = {}, r) => {
  try {
    return new Promise((n) => {
      !e.openapi && e.swagger === '2.0'
        ? _swagger2openapi2.default.convertObj(e, t, (o, s) => {
            o
              ? (q(
                  _chalk2.default.yellow(`${r}
=> ${o}`),
                ),
                n(e))
              : n(s.openapi);
          })
        : n(e);
    });
  } catch (n) {
    throw `Oups... \u{1F37B}.
Path: ${r}
Parsing Error: ${n}`;
  }
};
m();
var gt = async (e, t = process.cwd(), r = !0) => {
  if (!e) return e;
  try {
    if (G(e)) {
      let n = _upath.resolve.call(void 0, t, e),
        o = await Promise.resolve().then(() => ue(H(n)));
      return r && N(o) && o.default ? o.default : o;
    }
    return Promise.resolve(e);
  } catch (n) {
    throw `Oups... \u{1F37B}. Path: ${e} => ${n}`;
  }
};
m();
m();
var Vn = (e) => /[^{]*{[\w*_-]*}.*/.test(e),
  Un = (e) => {
    let t = e.match(/([^{]*){?([\w*_-]*)}?(.*)/);
    if (!(t != null && t.length)) return e;
    let r = t[1],
      n = V(j(t[2]), { es5keyword: !0, underscore: !0, dash: !0, dot: !0 }),
      o = Vn(t[3]) ? Un(t[3]) : t[3];
    return Vn(e) ? `${r}\${${n}}${o}` : `${r}${n}${o}`;
  },
  Wn = (e) =>
    e
      .split('/')
      .reduce(
        (r, n, o) =>
          !n && !o ? r : n.includes('{') ? `${r}/${Un(n)}` : `${r}/${n}`,
        '',
      );
m();
var U = async (e, t, r = []) => {
  var p;
  if ((p = e == null ? void 0 : e.schema) != null && p.$ref) {
    let u = await U(e == null ? void 0 : e.schema, t, r);
    return { schema: { ...e, schema: u.schema }, imports: r };
  }
  if (!I(e)) return { schema: e, imports: r };
  let {
      name: n,
      originalName: o,
      specKey: s,
      refPaths: i,
    } = await Me(e.$ref, t),
    a = _lodashget2.default.call(void 0, t.specs[s || t.specKey], i);
  if (!a) throw `Oups... \u{1F37B}. Ref not found: ${e.$ref}`;
  return U(a, { ...t, specKey: s || t.specKey }, [
    ...r,
    { name: n, specKey: s, schemaName: o },
  ]);
};
m();
m();
var Fa = [
    {
      exports: [
        { name: 'HttpClient', values: !0 },
        { name: 'HttpHeaders' },
        { name: 'HttpParams' },
        { name: 'HttpContext' },
      ],
      dependency: '@angular/common/http',
    },
    {
      exports: [{ name: 'Injectable', values: !0 }],
      dependency: '@angular/core',
    },
    { exports: [{ name: 'Observable', values: !0 }], dependency: 'rxjs' },
  ],
  _t = new Map(),
  Hn = () => Fa,
  Qn = (e) => {
    let t = V(e);
    return `${b(t)}Service`;
  },
  zn = ({
    title: e,
    isRequestOptions: t,
    isMutator: r,
    isGlobalMutator: n,
    provideIn: o,
  }) => `
${
  t && !n
    ? `type HttpClientOptions = {
  headers?: HttpHeaders | {
      [header: string]: string | string[];
  };
  context?: HttpContext;
  observe?: any;
  params?: HttpParams | {
    [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
  };
  reportProgress?: boolean;
  responseType?: any;
  withCredentials?: boolean;
};`
    : ''
}

${
  t && r
    ? `// eslint-disable-next-line
    type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`
    : ''
}

@Injectable(${o ? `{ providedIn: '${J(o) ? 'root' : o}' }` : ''})
export class ${e} {
  constructor(
    private http: HttpClient,
  ) {}`,
  _n = ({ operationNames: e }) => {
    let t = `};

`;
    return (
      e.forEach((r) => {
        _t.has(r) &&
          (t +=
            _t.get(r) +
            `
`);
      }),
      t
    );
  },
  Na = (
    {
      headers: e,
      queryParams: t,
      operationName: r,
      response: n,
      mutator: o,
      body: s,
      props: i,
      verb: a,
      override: p,
      formData: u,
      formUrlEncoded: c,
    },
    { route: l, context: d },
  ) => {
    var T, R;
    let g = (p == null ? void 0 : p.requestOptions) !== !1,
      f = (p == null ? void 0 : p.formData) !== !1,
      y = (p == null ? void 0 : p.formUrlEncoded) !== !1,
      h = !!(
        (R = (T = d.tsconfig) == null ? void 0 : T.compilerOptions) != null &&
        R.exactOptionalPropertyTypes
      ),
      x = se.includes(a),
      $ = Oe({
        formData: u,
        formUrlEncoded: c,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      }),
      S = n.definition.success || 'unknown';
    if ((_t.set(r, `export type ${b(r)}ClientResult = NonNullable<${S}>`), o)) {
      let P = ye({
          route: l,
          body: s,
          headers: e,
          queryParams: t,
          response: n,
          verb: a,
          isFormData: f,
          isFormUrlEncoded: y,
          hasSignal: !1,
          isBodyVerb: x,
          isExactOptionalPropertyTypes: h,
        }),
        v = g ? he(p == null ? void 0 : p.requestOptions, o.hasThirdArg) : '',
        A =
          o.bodyTypeName && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation');
      return ` ${r}<TData = ${S}>(
    ${A}
 ${
   g && o.hasThirdArg ? `options?: ThirdParameter<typeof ${o.name}>` : ''
 }) {${$}
      return ${o.name}<TData>(
      ${P},
      this.http,
      ${v});
    }
  `;
    }
    let w = ge({
      route: l,
      body: s,
      headers: e,
      queryParams: t,
      response: n,
      verb: a,
      requestOptions: p == null ? void 0 : p.requestOptions,
      isFormData: f,
      isFormUrlEncoded: y,
      isAngular: !0,
      isExactOptionalPropertyTypes: h,
      hasSignal: !1,
    });
    return ` ${r}<TData = ${S}>(
    ${F(i, 'implementation')} ${
      g
        ? `options?: HttpClientOptions
`
        : ''
    }  ): Observable<TData>  {${$}
    return this.http.${a}<TData>(${w});
  }
`;
  },
  Kn = (e, t) => {
    let r = de(e);
    return { implementation: Na(e, t), imports: r };
  };
m();
var Ba = [
    {
      exports: [
        { name: 'axios', default: !0, values: !0, syntheticDefaultImport: !0 },
        { name: 'AxiosRequestConfig' },
        { name: 'AxiosResponse' },
      ],
      dependency: 'axios',
    },
  ],
  yt = new Map(),
  Kt = (e) => [...(e ? [] : Ba)],
  Va = (
    {
      headers: e,
      queryParams: t,
      operationName: r,
      response: n,
      mutator: o,
      body: s,
      props: i,
      verb: a,
      override: p,
      formData: u,
      formUrlEncoded: c,
    },
    { route: l, context: d },
  ) => {
    var T, R;
    let g = (p == null ? void 0 : p.requestOptions) !== !1,
      f = (p == null ? void 0 : p.formData) !== !1,
      y = (p == null ? void 0 : p.formUrlEncoded) !== !1,
      h = !!(
        (R = (T = d.tsconfig) == null ? void 0 : T.compilerOptions) != null &&
        R.exactOptionalPropertyTypes
      ),
      x = Z(d.tsconfig),
      $ = Oe({
        formData: u,
        formUrlEncoded: c,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      }),
      S = se.includes(a);
    if (o) {
      let P = ye({
          route: l,
          body: s,
          headers: e,
          queryParams: t,
          response: n,
          verb: a,
          isFormData: f,
          isFormUrlEncoded: y,
          isBodyVerb: S,
          hasSignal: !1,
          isExactOptionalPropertyTypes: h,
        }),
        v = g ? he(p == null ? void 0 : p.requestOptions, o.hasSecondArg) : '';
      yt.set(
        r,
        (D) =>
          `export type ${b(r)}Result = NonNullable<Awaited<ReturnType<${
            D ? `ReturnType<typeof ${D}>['${r}']` : `typeof ${r}`
          }>>>`,
      );
      let A =
        o.bodyTypeName && s.definition
          ? F(i, 'implementation').replace(
              new RegExp(`(\\w*):\\s?${s.definition}`),
              `$1: ${o.bodyTypeName}<${s.definition}>`,
            )
          : F(i, 'implementation');
      return `const ${r} = (
    ${A}
 ${
   g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>,` : ''
 }) => {${$}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${P},
      ${v});
    }
  `;
    }
    let w = ge({
      route: l,
      body: s,
      headers: e,
      queryParams: t,
      response: n,
      verb: a,
      requestOptions: p == null ? void 0 : p.requestOptions,
      isFormData: f,
      isFormUrlEncoded: y,
      isExactOptionalPropertyTypes: h,
      hasSignal: !1,
    });
    return (
      yt.set(
        r,
        () =>
          `export type ${b(r)}Result = AxiosResponse<${
            n.definition.success || 'unknown'
          }>`,
      ),
      `const ${r} = <TData = AxiosResponse<${
        n.definition.success || 'unknown'
      }>>(
    ${F(i, 'implementation')} ${
        g
          ? `options?: AxiosRequestConfig
`
          : ''
      } ): Promise<TData> => {${$}
    return axios${x ? '' : '.default'}.${a}(${w});
  }
`
    );
  },
  Lt = (e) => {
    let t = V(e);
    return `get${b(t)}`;
  },
  Yt = ({ title: e, isRequestOptions: t, isMutator: r, noFunction: n }) => `
${
  t && r
    ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;

`
    : ''
}
  ${
    n
      ? ''
      : `export const ${e} = () => {
`
  }`,
  Jt = ({
    operationNames: e,
    title: t,
    noFunction: r,
    hasMutator: n,
    hasAwaitedType: o,
  }) => {
    let s = '';
    return (
      r ||
        (s += `return {${e.join(',')}}};
`),
      n &&
        !o &&
        (s += `
type AwaitedInput<T> = PromiseLike<T> | T;

    type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;

`),
      e.forEach((i) => {
        yt.has(i) &&
          (s +=
            yt.get(i)(r ? void 0 : t) +
            `
`);
      }),
      s
    );
  },
  Xt = (e, t) => {
    let r = de(e);
    return { implementation: Va(e, t), imports: r };
  },
  Ln = (e, t, r) => {
    let { implementation: n, imports: o } = Xt(e, t, r);
    return { implementation: 'export ' + n, imports: o };
  };
m();
m();
var Yn = (e) => /[^{]*{[\w*_-]*}.*/.test(e),
  Jn = (e) => {
    let t = e.match(/([^{]*){?([\w*_-]*)}?(.*)/);
    if (!(t != null && t.length)) return e;
    let r = t[1],
      n = V(j(t[2]), { es5keyword: !0, underscore: !0, dash: !0, dot: !0 }),
      o = Yn(t[3]) ? Jn(t[3]) : t[3];
    return Yn(e) ? `${r}:${n}${o}` : `${r}${n}${o}`;
  },
  Xn = (e, t = '*') =>
    e
      .split('/')
      .reduce(
        (n, o, s) =>
          !o && !s ? n : o.includes('{') ? `${n}/${Jn(o)}` : `${n}/${o}`,
        t,
      );
m();
m();
m();
var Zn = {
  email: 'faker.internet.email()',
  zipCode: 'faker.address.zipCode()',
  city: 'faker.address.city()',
  streetName: 'faker.address.streetName()',
  country: 'faker.address.country()',
  date: 'faker.date.recent()',
  iban: 'faker.finance.iban()',
  userName: 'faker.internet.userName()',
  firstName: 'faker.name.firstName()',
  lastName: 'faker.name.lastName()',
  jobTitle: 'faker.name.jobTitle()',
  gender: 'faker.name.gender()',
  phoneNumber: 'faker.phone.phoneNumber()',
  url: 'faker.internet.url()',
};
m();
m();
var eo = (e, t, r) => {
  var i, a, p, u;
  let n = Object.entries(
      (a = (i = t.specs[r].components) == null ? void 0 : i.schemas) != null
        ? a
        : [],
    ).reduce((c, [l, d]) => ((c[l] = d), c), {}),
    o = Object.entries(
      (u = (p = t.specs[r].components) == null ? void 0 : p.responses) != null
        ? u
        : [],
    ).reduce((c, [l, d]) => {
      var g, f;
      return (
        (c[l] = I(d)
          ? d
          : (f = (g = d.content) == null ? void 0 : g['application/json']) ==
            null
          ? void 0
          : f.schema),
        c
      );
    }, {});
  return { ...{ ...n, ...o }[e], specKey: r };
};
var Ua = (e) => e[0] === '/' && e[e.length - 1] === '/',
  ht = (e = {}, t) => {
    let r = Object.entries(e).find(
      ([n]) =>
        !!(
          (Ua(n) && new RegExp(n.slice(1, n.length - 1)).test(t.name)) ||
          `#.${n}` === (t.path ? t.path : `#.${t.name}`)
        ),
    );
    if (!!r)
      return {
        value: Le(r[1], t.nullable),
        imports: [],
        name: t.name,
        overrided: !0,
      };
  },
  Le = (e, t) => (t ? `faker.helpers.arrayElement([${e}, null])` : e),
  me = async ({
    schema: e,
    mockOptions: t,
    operationId: r,
    tags: n,
    combine: o,
    context: s,
    imports: i,
  }) => {
    if (I(e)) {
      let { name: p, specKey: u } = await Me(e.$ref, s),
        c = {
          ...eo(p, s, u || e.specKey || s.specKey),
          name: p,
          path: e.path,
          isRef: !0,
          specKey: u || e.specKey,
        };
      return {
        ...(await Ke({
          item: c,
          mockOptions: t,
          operationId: r,
          tags: n,
          combine: o,
          context: s,
          imports: i,
        })),
        type: c.type,
      };
    }
    return {
      ...(await Ke({
        item: e,
        mockOptions: t,
        operationId: r,
        tags: n,
        combine: o,
        context: s,
        imports: i,
      })),
      type: e.type,
    };
  };
m();
var _cuid = require('cuid');
var _cuid2 = _interopRequireDefault(_cuid);
m();
var to = (e = '', t) => {
  var r;
  return e ? ((r = e.match(new RegExp(t, 'g'))) != null ? r : []).length : 0;
};
m();
var ro = async ({
  item: e,
  separator: t,
  mockOptions: r,
  operationId: n,
  tags: o,
  combine: s,
  context: i,
  imports: a,
}) => {
  var d, g, f;
  let p = [],
    u = (
      (d = s == null ? void 0 : s.includedProperties) != null ? d : []
    ).slice(0),
    c = await me({
      schema: _lodashomit2.default.call(void 0, e, t),
      combine: { separator: 'allOf', includedProperties: [] },
      mockOptions: r,
      operationId: n,
      tags: o,
      context: i,
      imports: a,
    });
  return (
    u.push(...((g = c.includedProperties) != null ? g : [])),
    {
      value: await C(
        (f = e[t]) != null ? f : [],
        async (y, h, x, $) => {
          var T, R;
          let S = await me({
            schema: {
              ...h,
              name: e.name,
              path: e.path ? e.path : '#',
              specKey: e.specKey,
            },
            combine: {
              separator: t,
              includedProperties:
                t !== 'oneOf' ? u : (T = c.includedProperties) != null ? T : [],
            },
            mockOptions: r,
            operationId: n,
            tags: o,
            context: i,
            imports: a,
          });
          p.push(...S.imports),
            u.push(...((R = S.includedProperties) != null ? R : []));
          let w =
            c.value && t === 'oneOf'
              ? `${S.value.slice(0, -1)},${c.value}}`
              : S.value;
          return !x && !s
            ? S.enums || t === 'oneOf'
              ? $.length === 1
                ? `faker.helpers.arrayElement([${w}])`
                : `faker.helpers.arrayElement([${w},`
              : $.length === 1
              ? S.type !== 'object'
                ? `${w}`
                : `{${w}}`
              : `{${w},`
            : $.length - 1 === x
            ? S.enums || t === 'oneOf'
              ? `${y}${w}${s ? '' : '])'}`
              : `${y}${w}${c.value ? `,${c.value}` : ''}${s ? '' : '}'}`
            : w
            ? `${y}${w},`
            : y;
        },
        '',
      ),
      imports: p,
      name: e.name,
      includedProperties: u,
    }
  );
};
m();
var Ge = (e) => (_esutils.keyword.isIdentifierNameES5(e) ? e : `'${e}'`);
var no = async ({
  item: e,
  mockOptions: t,
  operationId: r,
  tags: n,
  combine: o,
  context: s,
  imports: i,
}) => {
  if (I(e))
    return me({
      schema: {
        ...e,
        name: e.name,
        path: e.path ? `${e.path}.${e.name}` : e.name,
        specKey: e.specKey,
      },
      mockOptions: t,
      operationId: r,
      tags: n,
      context: s,
      imports: i,
    });
  if (e.allOf || e.oneOf || e.anyOf) {
    let a = e.allOf ? 'allOf' : e.oneOf ? 'oneOf' : 'anyOf';
    return ro({
      item: e,
      separator: a,
      mockOptions: t,
      operationId: r,
      tags: n,
      combine: o,
      context: s,
      imports: i,
    });
  }
  if (e.properties) {
    let a = !o || (o == null ? void 0 : o.separator) === 'oneOf' ? '{' : '',
      p = [],
      u = [];
    return (
      (a += (
        await Promise.all(
          Object.entries(e.properties).map(async ([c, l]) => {
            if (o != null && o.includedProperties.includes(c)) return;
            let d =
              (t == null ? void 0 : t.required) ||
              (Array.isArray(e.required) ? e.required : []).includes(c);
            if (to(e.path, `\\.${c}\\.`) >= 1) return;
            let g = await me({
              schema: {
                ...l,
                name: c,
                path: e.path ? `${e.path}.${c}` : `#.${c}`,
                specKey: e.specKey,
              },
              mockOptions: t,
              operationId: r,
              tags: n,
              context: s,
              imports: p,
            });
            p.push(...g.imports), u.push(c);
            let f = Ge(c);
            return !d && !g.overrided
              ? `${f}: faker.helpers.arrayElement([${g.value}, undefined])`
              : `${f}: ${g.value}`;
          }),
        )
      )
        .filter(Boolean)
        .join(', ')),
      (a += !o || (o == null ? void 0 : o.separator) === 'oneOf' ? '}' : ''),
      { value: a, imports: p, name: e.name, includedProperties: u }
    );
  }
  if (e.additionalProperties) {
    if (J(e.additionalProperties))
      return { value: '{}', imports: [], name: e.name };
    let a = await me({
      schema: {
        ...e.additionalProperties,
        name: e.name,
        path: e.path ? `${e.path}.#` : '#',
        specKey: e.specKey,
      },
      mockOptions: t,
      operationId: r,
      tags: n,
      context: s,
      imports: i,
    });
    return {
      ...a,
      value: `{
        '${_cuid2.default.call(void 0)}': ${a.value}
      }`,
    };
  }
  return { value: '', imports: [], name: e.name };
};
var Ke = async ({
  item: e,
  imports: t,
  mockOptions: r,
  operationId: n,
  tags: o,
  combine: s,
  context: i,
}) => {
  var d, g, f, y;
  let a = ht(
    (g = (d = r == null ? void 0 : r.operations) == null ? void 0 : d[n]) ==
      null
      ? void 0
      : g.properties,
    e,
  );
  if (a) return a;
  let p = Object.entries(
      (f = r == null ? void 0 : r.tags) != null ? f : {},
    ).reduce((h, [x, $]) => (o.includes(x) ? Pe(h, $) : h), {}),
    u = ht(p == null ? void 0 : p.properties, e);
  if (u) return u;
  let c = ht(r == null ? void 0 : r.properties, e);
  if (c) return c;
  let l = { ...Zn, ...((y = r == null ? void 0 : r.format) != null ? y : {}) };
  if (e.format && l[e.format])
    return {
      value: Le(l[e.format], e.nullable),
      imports: [],
      name: e.name,
      overrided: !1,
    };
  switch (e.type) {
    case 'number':
    case 'integer':
      return {
        value: Le(
          `faker.datatype.number({min: ${e.minimum}, max: ${e.maximum}})`,
          e.nullable,
        ),
        imports: [],
        name: e.name,
      };
    case 'boolean':
      return { value: 'faker.datatype.boolean()', imports: [], name: e.name };
    case 'array': {
      if (!e.items) return { value: '[]', imports: [], name: e.name };
      let {
        value: h,
        enums: x,
        imports: $,
        name: S,
      } = await me({
        schema: {
          ...e.items,
          name: e.name,
          path: e.path ? `${e.path}.[]` : '#.[]',
          specKey: e.specKey,
        },
        combine: s,
        mockOptions: r,
        operationId: n,
        tags: o,
        context: i,
        imports: t,
      });
      if (x) {
        if (!I(e.items)) return { value: h, imports: $, name: e.name };
        let w = t.find((R) => S.replace('[]', '') === R.name);
        return {
          value: `faker.helpers.arrayElements(Object.values(${
            (w == null ? void 0 : w.name) || S
          }))`,
          imports: w ? [...$, { ...w, values: !0 }] : $,
          name: e.name,
        };
      }
      return {
        value: `Array.from({ length: faker.datatype.number({ min: 1, max: 10 }) }, (_, i) => i + 1).map(() => (${h}))`,
        imports: $,
        name: e.name,
      };
    }
    case 'string': {
      let h = 'faker.random.word()',
        x = [];
      if (e.enum) {
        let $ = "['" + e.enum.map((S) => lt(S)).join("','") + "']";
        e.isRef &&
          (($ = `Object.values(${e.name})`),
          (x = [{ name: e.name, values: !0 }])),
          (h = `faker.helpers.arrayElement(${$})`);
      }
      return {
        value: Le(h, e.nullable),
        enums: e.enum,
        name: e.name,
        imports: x,
      };
    }
    case 'object':
    default:
      return no({
        item: e,
        mockOptions: r,
        operationId: n,
        tags: o,
        combine: s,
        context: i,
        imports: t,
      });
  }
};
var Ot = (e, t) =>
    Object.entries(B(e) ? e(t) : e).reduce((r, [n, o]) => {
      let s = B(o) ? `(${o})()` : K(o);
      return (
        (r[n] =
          s == null
            ? void 0
            : s.replace(/import_faker.defaults|import_faker.faker/g, 'faker')),
        r
      );
    }, {}),
  za = (e, t) => {
    var r, n, o;
    return {
      required: (r = t == null ? void 0 : t.mock) == null ? void 0 : r.required,
      ...((n = t == null ? void 0 : t.mock) != null && n.properties
        ? { properties: Ot(t.mock.properties, e) }
        : {}),
      ...((o = t == null ? void 0 : t.mock) != null && o.format
        ? { format: Ot(t.mock.format, e) }
        : {}),
      ...(t != null && t.operations
        ? {
            operations: Object.entries(t.operations).reduce((s, [i, a]) => {
              var p;
              return (
                (p = a.mock) != null &&
                  p.properties &&
                  (s[i] = { properties: Ot(a.mock.properties, e) }),
                s
              );
            }, {}),
          }
        : {}),
      ...(t != null && t.tags
        ? {
            tags: Object.entries(t.tags).reduce((s, [i, a]) => {
              var p;
              return (
                (p = a.mock) != null &&
                  p.properties &&
                  (s[i] = { properties: Ot(a.mock.properties, e) }),
                s
              );
            }, {}),
          }
        : {}),
    };
  },
  _a = (e) => {
    let t = e.endsWith('[]');
    switch (t ? e.slice(0, -2) : e) {
      case 'number':
        return t
          ? 'Array.from({length: faker.datatype.number({min: 1, max: 10})}, () => faker.datatype.number())'
          : 'faker.datatype.number().toString()';
      case 'string':
        return t
          ? 'Array.from({length: faker.datatype.number({min: 1, max: 10})}, () => faker.random.word())'
          : 'faker.random.word()';
      default:
        return 'undefined';
    }
  },
  Ka = ({
    operationId: e,
    tags: t,
    response: r,
    mockOptionsWithoutFunc: n,
    transformer: o,
    context: s,
  }) =>
    C(
      r.types.success,
      async (i, { value: a, originalSchema: p, imports: u }) => {
        if (!a || Ae.includes(a)) {
          let d = _a(a);
          return i.definitions.push(o ? o(d, r.definition.success) : d), i;
        }
        if (!p) return i;
        let c = await U(p, s),
          l = await Ke({
            item: {
              name: a,
              ...c.schema,
              ...(r.imports.length ? { specKey: r.imports[0].specKey } : {}),
            },
            imports: u,
            mockOptions: n,
            operationId: e,
            tags: t,
            context: s,
          });
        return (
          i.imports.push(...l.imports),
          i.definitions.push(
            o ? o(l.value, r.definition.success) : l.value.toString(),
          ),
          i
        );
      },
      { definitions: [], imports: [] },
    ),
  oo = async ({
    operationId: e,
    tags: t,
    response: r,
    override: n,
    transformer: o,
    context: s,
  }) => {
    let i = za(s.specs[s.specKey], n),
      { definitions: a, imports: p } = await Ka({
        operationId: e,
        tags: t,
        response: r,
        mockOptionsWithoutFunc: i,
        transformer: o,
        context: s,
      });
    return { definition: '[' + a.join(', ') + ']', definitions: a, imports: p };
  },
  so = (e, t) => {
    var o, s, i;
    let r =
        (i =
          (s =
            (o = t == null ? void 0 : t.operations) == null ? void 0 : o[e]) ==
          null
            ? void 0
            : s.mock) == null
          ? void 0
          : i.data,
      n = B(r) ? `(${r})()` : K(r);
    return n == null
      ? void 0
      : n.replace(/import_faker.defaults|import_faker.faker/g, 'faker');
  };
var La = [
    { exports: [{ name: 'rest', values: !0 }], dependency: 'msw' },
    { exports: [{ name: 'faker', values: !0 }], dependency: '@faker-js/faker' },
  ],
  $e = (e, t, r, n, o) => ut(e, [...La, ...t], r, n, o),
  io = async (
    { operationId: e, response: t, verb: r, tags: n },
    { pathRoute: o, override: s, context: i },
  ) => {
    var f, y;
    let {
        definitions: a,
        definition: p,
        imports: u,
      } = await oo({
        operationId: e,
        tags: n,
        response: t,
        override: s,
        context: i,
      }),
      c = Xn(o, (f = s == null ? void 0 : s.mock) == null ? void 0 : f.baseUrl),
      l = so(e, s),
      d = '';
    l
      ? (d = l)
      : a.length > 1
      ? (d = `faker.helpers.arrayElement(${p})`)
      : a[0] && (d = a[0]);
    let g = t.contentTypes.includes('text/plain') ? 'text' : 'json';
    return {
      implementation: {
        function:
          d && d !== 'undefined'
            ? `export const get${b(e)}Mock = () => (${d})

`
            : '',
        handler: `rest.${r}('${c}', (_req, res, ctx) => {
        return res(
          ctx.delay(${
            ((y = s == null ? void 0 : s.mock) == null ? void 0 : y.delay) ||
            1e3
          }),
          ctx.status(200, 'Mocked status'),${
            d && d !== 'undefined'
              ? `
ctx.${g}(get${b(e)}Mock()),`
              : ''
          }
        )
      }),`,
      },
      imports: u,
    };
  };
m();
var _lodashomitby = require('lodash.omitby');
var _lodashomitby2 = _interopRequireDefault(_lodashomitby);
m();
var W = {
  PARAM: 'param',
  BODY: 'body',
  QUERY_PARAM: 'queryParam',
  HEADER: 'header',
};
var er = [
    {
      exports: [
        { name: 'axios', default: !0, values: !0, syntheticDefaultImport: !0 },
        { name: 'AxiosRequestConfig' },
        { name: 'AxiosResponse' },
        { name: 'AxiosError' },
      ],
      dependency: 'axios',
    },
  ],
  Ja = [
    {
      exports: [
        { name: 'useQuery', values: !0 },
        { name: 'useInfiniteQuery', values: !0 },
        { name: 'useMutation', values: !0 },
        { name: 'UseQueryOptions' },
        { name: 'UseInfiniteQueryOptions' },
        { name: 'UseMutationOptions' },
        { name: 'QueryFunction' },
        { name: 'MutationFunction' },
        { name: 'UseQueryStoreResult' },
        { name: 'UseInfiniteQueryStoreResult' },
        { name: 'QueryKey' },
      ],
      dependency: '@sveltestack/svelte-query',
    },
  ],
  ao = (e) => [...(e ? [] : er), ...Ja],
  Xa = [
    {
      exports: [
        { name: 'useQuery', values: !0 },
        { name: 'useInfiniteQuery', values: !0 },
        { name: 'useMutation', values: !0 },
        { name: 'UseQueryOptions' },
        { name: 'UseInfiniteQueryOptions' },
        { name: 'UseMutationOptions' },
        { name: 'QueryFunction' },
        { name: 'MutationFunction' },
        { name: 'UseQueryResult' },
        { name: 'UseInfiniteQueryResult' },
        { name: 'QueryKey' },
      ],
      dependency: 'react-query',
    },
  ],
  po = (e) => [...(e ? [] : er), ...Xa],
  Za = [
    {
      exports: [
        { name: 'useQuery', values: !0 },
        { name: 'useInfiniteQuery', values: !0 },
        { name: 'useMutation', values: !0 },
      ],
      dependency: 'vue-query',
    },
    {
      exports: [
        { name: 'UseQueryOptions' },
        { name: 'UseInfiniteQueryOptions' },
        { name: 'UseMutationOptions' },
        { name: 'QueryFunction' },
        { name: 'MutationFunction' },
        { name: 'UseQueryResult' },
        { name: 'UseInfiniteQueryResult' },
        { name: 'QueryKey' },
      ],
      dependency: 'vue-query/types',
    },
    {
      exports: [{ name: 'UseQueryReturnType' }],
      dependency: 'vue-query/lib/vue/useBaseQuery',
    },
  ],
  co = (e) => [...(e ? [] : er), ...Za],
  ep = ({ isRequestOptions: e, hasSignal: t }) =>
    e
      ? `options?: AxiosRequestConfig
`
      : t
      ? `signal?: AbortSignal
`
      : '',
  tp = (
    {
      headers: e,
      queryParams: t,
      operationName: r,
      response: n,
      mutator: o,
      body: s,
      props: i,
      verb: a,
      formData: p,
      formUrlEncoded: u,
      override: c,
    },
    { route: l, context: d },
  ) => {
    var P, v;
    let g = c.requestOptions !== !1,
      f = c.formData !== !1,
      y = c.formUrlEncoded !== !1,
      h = !!c.query.signal,
      x = Z(d.tsconfig),
      $ = !!(
        (v = (P = d.tsconfig) == null ? void 0 : P.compilerOptions) != null &&
        v.exactOptionalPropertyTypes
      ),
      S = se.includes(a),
      w = Oe({
        formData: p,
        formUrlEncoded: u,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      });
    if (o) {
      let A = ye({
          route: l,
          body: s,
          headers: e,
          queryParams: t,
          response: n,
          verb: a,
          isFormData: f,
          isFormUrlEncoded: y,
          isBodyVerb: S,
          hasSignal: h,
          isExactOptionalPropertyTypes: $,
        }),
        D =
          (o == null ? void 0 : o.bodyTypeName) && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation'),
        L = g ? he(c.requestOptions, o.hasSecondArg) : '';
      return o.isHook
        ? `export const use${b(r)}Hook = () => {
        const ${r} = ${o.name}<${n.definition.success || 'unknown'}>();

        return (
    ${D}
${
  !S && h
    ? `signal?: AbortSignal,
`
    : ''
} ${
            g && o.hasSecondArg
              ? `options?: SecondParameter<typeof ${o.name}>`
              : ''
          }) => {${w}
        return ${r}(
          ${A},
          ${L});
        }
      }
    `
        : `export const ${r} = (
    ${D}
 ${g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>,` : ''}${
            !S && h
              ? `signal?: AbortSignal
`
              : ''
          }) => {${w}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${A},
      ${L});
    }
  `;
    }
    let T = ge({
        route: l,
        body: s,
        headers: e,
        queryParams: t,
        response: n,
        verb: a,
        requestOptions: c == null ? void 0 : c.requestOptions,
        isFormData: f,
        isFormUrlEncoded: y,
        isExactOptionalPropertyTypes: $,
        hasSignal: h,
      }),
      R = ep({ isRequestOptions: g, hasSignal: h });
    return `export const ${r} = (
    ${F(i, 'implementation')} ${R} ): Promise<AxiosResponse<${
      n.definition.success || 'unknown'
    }>> => {${w}
    return axios${x ? '' : '.default'}.${a}(${T});
  }
`;
  },
  Zt = { INFINITE: 'infiniteQuery', QUERY: 'query' },
  rp = ['getNextPageParam', 'getPreviousPageParam'],
  np = ({ params: e, options: t, type: r }) => {
    var o;
    if (t === !1) return '';
    let n = N(t)
      ? ` ${
          (o = K(
            _lodashomitby2.default.call(
              void 0,
              t,
              (s, i) => !!(r !== Zt.INFINITE && rp.includes(i)),
            ),
          )) == null
            ? void 0
            : o.slice(1, -1)
        }`
      : '';
    return e.length
      ? `{${
          !N(t) || !t.hasOwnProperty('enabled')
            ? `enabled: !!(${e.map(({ name: s }) => s).join(' && ')}),`
            : ''
        }${n} ...queryOptions}`
      : t
      ? `{${n} ...queryOptions}`
      : 'queryOptions';
  },
  mo = ({
    operationName: e,
    definitions: t,
    mutator: r,
    isRequestOptions: n,
    type: o,
  }) => {
    let s = r == null ? void 0 : r.isHook,
      i = o
        ? `Use${b(o)}Options<Awaited<ReturnType<${
            s ? `ReturnType<typeof use${b(e)}Hook>` : `typeof ${e}`
          }>>, TError, TData>`
        : `UseMutationOptions<Awaited<ReturnType<${
            s ? `ReturnType<typeof use${b(e)}Hook>` : `typeof ${e}`
          }>>, TError,${t ? `{${t}}` : 'TVariables'}, TContext>`;
    return n
      ? `options?: { ${o ? 'query' : 'mutation'}?:${i}, ${
          r
            ? r != null && r.hasSecondArg
              ? `request?: SecondParameter<typeof ${r.name}>`
              : ''
            : 'axios?: AxiosRequestConfig'
        }}
`
      : `${o ? 'queryOptions' : 'mutationOptions'}?: ${i}`;
  },
  op = ({ outputClient: e, type: t, isMutatorHook: r, operationName: n }) => {
    switch (e) {
      case Q.SVELTE_QUERY:
        return `Use${b(t)}StoreResult<Awaited<ReturnType<${
          r ? `ReturnType<typeof use${b(n)}Hook>` : `typeof ${n}`
        }>>, TError, TData, QueryKey>`;
      case Q.VUE_QUERY:
        return ` UseQueryReturnType<TData, TError, Use${b(
          t,
        )}Result<TData, TError>>`;
      case Q.REACT_QUERY:
      default:
        return ` Use${b(t)}Result<TData, TError>`;
    }
  },
  sp = ({
    isRequestOptions: e,
    mutator: t,
    isExactOptionalPropertyTypes: r,
    hasSignal: n,
  }) =>
    !t && e
      ? n
        ? `{ ${
            r ? '...(signal ? { signal } : {})' : 'signal'
          }, ...axiosOptions }`
        : 'axiosOptions'
      : (t == null ? void 0 : t.hasSecondArg) && e
      ? n
        ? 'requestOptions, signal'
        : 'requestOptions'
      : n
      ? 'signal'
      : '',
  ip = ({ isRequestOptions: e, mutator: t }) => {
    if (!e) return '';
    let r = 'const {query: queryOptions';
    return (
      t || (r += ', axios: axiosOptions'),
      t != null && t.hasSecondArg && (r += ', request: requestOptions'),
      (r += '} = options ?? {}'),
      r
    );
  },
  ap = ({ hasQueryParam: e, hasSignal: t }) =>
    !e && !t
      ? ''
      : e
      ? t
        ? '{ signal, pageParam }'
        : '{ pageParam }'
      : '{ signal }',
  pp = ({
    queryOption: { name: e, queryParam: t, options: r, type: n },
    operationName: o,
    queryKeyFnName: s,
    queryProperties: i,
    queryKeyProperties: a,
    params: p,
    props: u,
    mutator: c,
    isRequestOptions: l,
    response: d,
    outputClient: g,
    isExactOptionalPropertyTypes: f,
    hasSignal: y,
  }) => {
    let h = F(u, 'implementation'),
      x = t
        ? u
            .map(({ name: A }) =>
              A === 'params' ? `{ ${t}: pageParam, ...params }` : A,
            )
            .join(',')
        : i,
      $ = op({
        outputClient: g,
        type: n,
        isMutatorHook: c == null ? void 0 : c.isHook,
        operationName: o,
      }),
      S = `AxiosError<${d.definition.errors || 'unknown'}>`;
    c &&
      (S = c.hasErrorType
        ? `${c.default ? b(o) : ''}ErrorType<${
            d.definition.errors || 'unknown'
          }>`
        : d.definition.errors || 'unknown');
    let w =
        c != null && c.isHook
          ? `ReturnType<typeof use${b(o)}Hook>`
          : `typeof ${o}`,
      T = mo({
        operationName: o,
        definitions: '',
        mutator: c,
        isRequestOptions: l,
        type: n,
      }),
      R = sp({
        isRequestOptions: l,
        isExactOptionalPropertyTypes: f,
        mutator: c,
        hasSignal: y,
      }),
      P = ip({ isRequestOptions: l, mutator: c }),
      v = ap({
        hasQueryParam: !!t && u.some(({ type: A }) => A === 'queryParam'),
        hasSignal: y,
      });
    return `
export type ${b(e)}QueryResult = NonNullable<Awaited<ReturnType<${w}>>>
export type ${b(e)}QueryError = ${S}

export const ${j(
      `use-${e}`,
    )} = <TData = Awaited<ReturnType<${w}>>, TError = ${S}>(
 ${h} ${T}
  ): ${$} & { queryKey: QueryKey } => {

  ${P}

  const queryKey = queryOptions?.queryKey ?? ${s}(${a});

  ${c != null && c.isHook ? `const ${o} =  use${b(o)}Hook()` : ''}

  const queryFn: QueryFunction<Awaited<ReturnType<${
    c != null && c.isHook ? `ReturnType<typeof use${b(o)}Hook>` : `typeof ${o}`
  }>>> = (${v}) => ${o}(${x}${x ? ', ' : ''}${R});

  const query = ${j(`use-${n}`)}<Awaited<ReturnType<${
      c != null && c.isHook
        ? `ReturnType<typeof use${b(o)}Hook>`
        : `typeof ${o}`
    }>>, TError, TData>(queryKey, queryFn, ${np({
      params: p,
      options: r,
      type: n,
    })}) as ${$} & { queryKey: QueryKey };

  query.queryKey = queryKey;

  return query;
}
`;
  },
  cp = (
    {
      queryParams: e,
      operationName: t,
      body: r,
      props: n,
      verb: o,
      params: s,
      override: i,
      mutator: a,
      response: p,
      operationId: u,
    },
    { route: c, override: { operations: l = {} }, context: d },
    g,
  ) => {
    var R, P, v;
    let f = i == null ? void 0 : i.query,
      y = (i == null ? void 0 : i.requestOptions) !== !1,
      h = (R = l[u]) == null ? void 0 : R.query,
      x = !!(
        (v = (P = d.tsconfig) == null ? void 0 : P.compilerOptions) != null &&
        v.exactOptionalPropertyTypes
      );
    if (
      o === ee.GET ||
      (h == null ? void 0 : h.useInfinite) ||
      (h == null ? void 0 : h.useQuery)
    ) {
      let A = n
          .map(({ name: Y, type: oe }) =>
            oe === W.BODY ? r.implementation : Y,
          )
          .join(','),
        D = n
          .filter((Y) => Y.type !== W.HEADER)
          .map(({ name: Y, type: oe }) =>
            oe === W.BODY ? r.implementation : Y,
          )
          .join(','),
        L = [
          ...(f != null && f.useInfinite
            ? [
                {
                  name: j(`${t}-infinite`),
                  options: f == null ? void 0 : f.options,
                  type: Zt.INFINITE,
                  queryParam: f == null ? void 0 : f.useInfiniteQueryParam,
                },
              ]
            : []),
          ...((!(f != null && f.useQuery) && !(f != null && f.useInfinite)) ||
          (f == null ? void 0 : f.useQuery)
            ? [
                {
                  name: t,
                  options: f == null ? void 0 : f.options,
                  type: Zt.QUERY,
                },
              ]
            : []),
        ],
        pe = j(`get-${t}-queryKey`),
        ve = F(
          n.filter((Y) => Y.type !== W.HEADER),
          'implementation',
        );
      return `export const ${pe} = (${ve}) => [\`${c}\`${
        e ? ', ...(params ? [params]: [])' : ''
      }${r.implementation ? `, ${r.implementation}` : ''}];

    ${L.reduce(
      (Y, oe) =>
        Y +
        pp({
          queryOption: oe,
          operationName: t,
          queryKeyFnName: pe,
          queryProperties: A,
          queryKeyProperties: D,
          params: s,
          props: n,
          mutator: a,
          isRequestOptions: y,
          response: p,
          outputClient: g,
          isExactOptionalPropertyTypes: x,
          hasSignal: !!f.signal,
        }),
      '',
    )}
`;
    }
    let $ = n
        .map(({ definition: A, type: D }) =>
          D === W.BODY
            ? a != null && a.bodyTypeName
              ? `data: ${a.bodyTypeName}<${r.definition}>`
              : `data: ${r.definition}`
            : A,
        )
        .join(';'),
      S = n
        .map(({ name: A, type: D }) => (D === W.BODY ? 'data' : A))
        .join(','),
      w = `AxiosError<${p.definition.errors || 'unknown'}>`;
    a &&
      (w = a.hasErrorType
        ? `${a.default ? b(t) : ''}ErrorType<${
            p.definition.errors || 'unknown'
          }>`
        : p.definition.errors || 'unknown');
    let T =
      a != null && a.isHook
        ? `ReturnType<typeof use${b(t)}Hook>`
        : `typeof ${t}`;
    return `
    export type ${b(t)}MutationResult = NonNullable<Awaited<ReturnType<${T}>>>
    ${
      r.definition
        ? `export type ${b(t)}MutationBody = ${
            a != null && a.bodyTypeName
              ? `${a.bodyTypeName}<${r.definition}>`
              : r.definition
          }`
        : ''
    }
    export type ${b(t)}MutationError = ${w}

    export const ${j(`use-${t}`)} = <TError = ${w},
    ${$ ? '' : 'TVariables = void,'}
    TContext = unknown>(${mo({
      operationName: t,
      definitions: $,
      mutator: a,
      isRequestOptions: y,
    })}) => {
      ${
        y
          ? `const {mutation: mutationOptions${
              a
                ? a != null && a.hasSecondArg
                  ? ', request: requestOptions'
                  : ''
                : ', axios: axiosOptions'
            }} = options ?? {}`
          : ''
      }

      ${a != null && a.isHook ? `const ${t} =  use${b(t)}Hook()` : ''}


      const mutationFn: MutationFunction<Awaited<ReturnType<${T}>>, ${
      $ ? `{${$}}` : 'TVariables'
    }> = (${S ? 'props' : ''}) => {
          ${S ? `const {${S}} = props ?? {}` : ''};

          return  ${t}(${S}${S ? ',' : ''}${
      y
        ? a
          ? a != null && a.hasSecondArg
            ? 'requestOptions'
            : ''
          : 'axiosOptions'
        : ''
    })
        }

      return useMutation<Awaited<ReturnType<typeof ${t}>>, TError, ${
      $ ? `{${$}}` : 'TVariables'
    }, TContext>(mutationFn, mutationOptions)
    }
    `;
  },
  bt = () => '',
  $t = ({ isRequestOptions: e, isMutator: t, hasAwaitedType: r }) => `${
    r
      ? ''
      : `type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;

`
  }
${
  e && t
    ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;

`
    : ''
}`,
  xt = () => '',
  St = (e, t, r) => {
    let n = de(e),
      o = tp(e, t),
      s = cp(e, t, r);
    return {
      implementation: `${o}

${s}`,
      imports: n,
    };
  };
m();
var mp = [
    {
      exports: [
        { name: 'axios', default: !0, values: !0, syntheticDefaultImport: !0 },
        { name: 'AxiosRequestConfig' },
        { name: 'AxiosResponse' },
        { name: 'AxiosError' },
      ],
      dependency: 'axios',
    },
  ],
  lp = [
    {
      exports: [
        { name: 'useSwr', values: !0, default: !0 },
        { name: 'SWRConfiguration' },
        { name: 'Key' },
      ],
      dependency: 'swr',
    },
  ],
  lo = (e) => [...(e ? [] : mp), ...lp],
  up = (
    {
      headers: e,
      queryParams: t,
      operationName: r,
      response: n,
      mutator: o,
      body: s,
      props: i,
      verb: a,
      formData: p,
      formUrlEncoded: u,
      override: c,
    },
    { route: l, context: d },
  ) => {
    var T, R;
    let g = (c == null ? void 0 : c.requestOptions) !== !1,
      f = (c == null ? void 0 : c.formData) !== !1,
      y = (c == null ? void 0 : c.formUrlEncoded) !== !1,
      h = !!(
        (R = (T = d.tsconfig) == null ? void 0 : T.compilerOptions) != null &&
        R.exactOptionalPropertyTypes
      ),
      x = se.includes(a),
      $ = Z(d.tsconfig),
      S = Oe({
        formData: p,
        formUrlEncoded: u,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      });
    if (o) {
      let P = ye({
          route: l,
          body: s,
          headers: e,
          queryParams: t,
          response: n,
          verb: a,
          isFormData: f,
          isFormUrlEncoded: y,
          hasSignal: !1,
          isBodyVerb: x,
          isExactOptionalPropertyTypes: h,
        }),
        v =
          (o == null ? void 0 : o.bodyTypeName) && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation'),
        A = g ? he(c == null ? void 0 : c.requestOptions, o.hasSecondArg) : '';
      return `export const ${r} = (
    ${v}
 ${
   g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>` : ''
 }) => {${S}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${P},
      ${A});
    }
  `;
    }
    let w = ge({
      route: l,
      body: s,
      headers: e,
      queryParams: t,
      response: n,
      verb: a,
      requestOptions: c == null ? void 0 : c.requestOptions,
      isFormData: f,
      isFormUrlEncoded: y,
      isExactOptionalPropertyTypes: h,
      hasSignal: !1,
    });
    return `export const ${r} = (
    ${F(i, 'implementation')} ${
      g
        ? `options?: AxiosRequestConfig
`
        : ''
    } ): Promise<AxiosResponse<${n.definition.success || 'unknown'}>> => {${S}
    return axios${$ ? '' : '.default'}.${a}(${w});
  }
`;
  },
  fp = ({ operationName: e, mutator: t, isRequestOptions: r }) => {
    let n = `SWRConfiguration<Awaited<ReturnType<typeof ${e}>>, TError> & { swrKey?: Key, enabled?: boolean }`;
    return r
      ? `options?: { swr?:${n}, ${
          t
            ? t != null && t.hasSecondArg
              ? `request?: SecondParameter<typeof ${t.name}>`
              : ''
            : 'axios?: AxiosRequestConfig'
        } }
`
      : `swrOptions?: ${n}`;
  },
  dp = ({
    operationName: e,
    swrKeyFnName: t,
    swrProperties: r,
    swrKeyProperties: n,
    params: o,
    mutator: s,
    isRequestOptions: i,
    response: a,
    swrOptions: p,
    props: u,
  }) => {
    var f;
    let c = F(u, 'implementation'),
      l = r,
      d = `const isEnabled = swrOptions?.enabled !== false${
        o.length ? ` && !!(${o.map(({ name: y }) => y).join(' && ')})` : ''
      }
    const swrKey = swrOptions?.swrKey ?? (() => isEnabled ? ${t}(${n}) : null);`,
      g = `AxiosError<${a.definition.errors || 'unknown'}>`;
    return (
      s &&
        (g = s.hasErrorType
          ? `ErrorType<${a.definition.errors || 'unknown'}>`
          : a.definition.errors || 'unknown'),
      `
export type ${b(e)}QueryResult = NonNullable<Awaited<ReturnType<typeof ${e}>>>
export type ${b(e)}QueryError = ${g}

export const ${j(`use-${e}`)} = <TError = ${g}>(
 ${c} ${fp({ operationName: e, mutator: s, isRequestOptions: i })}
  ) => {

  ${
    i
      ? `const {swr: swrOptions${
          s
            ? s != null && s.hasSecondArg
              ? ', request: requestOptions'
              : ''
            : ', axios: axiosOptions'
        }} = options ?? {}`
      : ''
  }

  ${d}
  const swrFn = () => ${e}(${l}${l ? ', ' : ''}${
        i
          ? s
            ? s != null && s.hasSecondArg
              ? 'requestOptions'
              : ''
            : 'axiosOptions'
          : ''
      });

  const query = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(swrKey, swrFn, ${
    p.options
      ? `{
    ${(f = K(p.options)) == null ? void 0 : f.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKey,
    ...query
  }
}
`
    );
  },
  gp = (
    {
      queryParams: e,
      operationName: t,
      body: r,
      props: n,
      verb: o,
      params: s,
      override: i,
      mutator: a,
      response: p,
    },
    { route: u },
  ) => {
    let c = (i == null ? void 0 : i.requestOptions) !== !1;
    if (o !== ee.GET) return '';
    let l = n
        .map(({ name: y, type: h }) => (h === W.BODY ? r.implementation : y))
        .join(','),
      d = n
        .filter((y) => y.type !== W.HEADER)
        .map(({ name: y, type: h }) => (h === W.BODY ? r.implementation : y))
        .join(','),
      g = j(`get-${t}-key`),
      f = F(
        n.filter((y) => y.type !== W.HEADER),
        'implementation',
      );
    return `export const ${g} = (${f}) => [\`${u}\`${
      e ? ', ...(params ? [params]: [])' : ''
    }${r.implementation ? `, ${r.implementation}` : ''}];

    ${dp({
      operationName: t,
      swrKeyFnName: g,
      swrProperties: l,
      swrKeyProperties: d,
      params: s,
      props: n,
      mutator: a,
      isRequestOptions: c,
      response: p,
      swrOptions: i.swr,
    })}
`;
  },
  uo = () => '',
  fo = ({ isRequestOptions: e, isMutator: t, hasAwaitedType: r }) => `
  ${
    r
      ? ''
      : `type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;

`
  }
  ${
    e && t
      ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;

`
      : ''
  }`,
  go = () => '',
  yo = (e, t) => {
    let r = de(e),
      n = up(e, t),
      o = gp(e, t);
    return {
      implementation: `${n}

${o}`,
      imports: r,
    };
  };
var Ye = Q.AXIOS,
  ho = {
    axios: { client: Xt, header: Yt, dependencies: Kt, footer: Jt, title: Lt },
    'axios-functions': {
      client: Ln,
      header: (e) => Yt({ ...e, noFunction: !0 }),
      dependencies: Kt,
      footer: (e) => Jt({ ...e, noFunction: !0 }),
      title: Lt,
    },
    angular: {
      client: Kn,
      header: zn,
      dependencies: Hn,
      footer: _n,
      title: Qn,
    },
    'react-query': {
      client: St,
      header: $t,
      dependencies: po,
      footer: xt,
      title: bt,
    },
    'svelte-query': {
      client: St,
      header: $t,
      dependencies: ao,
      footer: xt,
      title: bt,
    },
    'vue-query': {
      client: St,
      header: $t,
      dependencies: co,
      footer: xt,
      title: bt,
    },
    swr: { client: yo, header: fo, dependencies: lo, footer: go, title: uo },
  },
  Je = (e) => {
    let t = B(e) ? e(ho) : ho[e];
    if (!t) throw `Oups... \u{1F37B}. Client not found: ${e}`;
    return t;
  },
  xe = (e = Ye, t, r, n, o, s, i) => {
    let { dependencies: a } = Je(e);
    return ut(t, [...a(i), ...r], n, o, s);
  },
  wt = ({
    outputClient: e = Ye,
    isRequestOptions: t,
    isGlobalMutator: r,
    isMutator: n,
    provideIn: o,
    hasAwaitedType: s,
    titles: i,
  }) => {
    let { header: a } = Je(e);
    return {
      implementation: a({
        title: i.implementation,
        isRequestOptions: t,
        isGlobalMutator: r,
        isMutator: n,
        provideIn: o,
        hasAwaitedType: s,
      }),
      implementationMSW: `export const ${i.implementationMSW} = () => [
`,
    };
  },
  Tt = ({
    outputClient: e = Ye,
    operationNames: t,
    hasMutator: r,
    hasAwaitedType: n,
    titles: o,
  }) => {
    let { footer: s } = Je(e),
      i;
    try {
      B(e)
        ? ((i = s(t)),
          console.warn(
            '[WARN] Passing an array of strings for operations names to the footer function is deprecated and will be removed in a future major release. Please pass them in an object instead: { operationNames: string[] }.',
          ))
        : (i = s({
            operationNames: t,
            title: o.implementation,
            hasMutator: r,
            hasAwaitedType: n,
          }));
    } catch (e6) {
      i = s({
        operationNames: t,
        title: o.implementation,
        hasMutator: r,
        hasAwaitedType: n,
      });
    }
    return {
      implementation: i,
      implementationMSW: `]
`,
    };
  },
  jt = ({ outputClient: e = Ye, title: t, customTitleFunc: r }) => {
    let { title: n } = Je(e);
    if (r) {
      let o = r(t);
      return { implementation: n(o), implementationMSW: `get${b(o)}MSW` };
    }
    return { implementation: n(t), implementationMSW: `get${b(t)}MSW` };
  },
  yp = async (e, t) =>
    t.mock
      ? B(t.mock)
        ? t.mock(e, t)
        : io(e, t)
      : { implementation: { function: '', handler: '' }, imports: [] },
  Oo = (e = Ye, t, r) =>
    C(
      t,
      async (n, o) => {
        let { client: s } = Je(e),
          i = s(o, r, e),
          a = await yp(o, r);
        return (
          (n[o.operationId] = {
            implementation: o.doc + i.implementation,
            imports: i.imports,
            implementationMSW: a.implementation,
            importsMSW: a.imports,
            tags: o.tags,
            mutator: o.mutator,
            formData: o.formData,
            formUrlEncoded: o.formUrlEncoded,
            operationName: o.operationName,
            types: i.types,
          }),
          n
        );
      },
      {},
    );
m();
m();
var hp = '\\*/',
  tr = '*\\/',
  rr = new RegExp(hp, 'g');
function _({ description: e, deprecated: t, summary: r }, n = !1) {
  var u;
  let o = (
      Array.isArray(e)
        ? e.filter((c) => !c.includes('eslint-disable'))
        : [e || '']
    ).map((c) => c.replace(rr, tr)),
    s = [e, t, r].reduce((c, l) => (l ? c + 1 : c), 0);
  if (!s) return '';
  let i = s === 1 && n,
    a = Array.isArray(e)
      ? (u = e.find((c) => c.includes('eslint-disable'))) == null
        ? void 0
        : u.replace(rr, tr)
      : void 0,
    p = `${
      a
        ? `/* ${a} */
`
        : ''
    }/**`;
  return (
    e &&
      (i ||
        (p += `
${n ? '  ' : ''} *`),
      (p += ` ${o.join(`
 * `)}`)),
    t &&
      (i ||
        (p += `
${n ? '  ' : ''} *`),
      (p += ' @deprecated')),
    r &&
      (i ||
        (p += `
${n ? '  ' : ''} *`),
      (p += ` @summary ${r.replace(rr, tr)}`)),
    (p += i
      ? ' '
      : `
 ${n ? '  ' : ''}`),
    (p += `*/
`),
    p
  );
}
m();
m();
var _lodashuniqby = require('lodash.uniqby');
var _lodashuniqby2 = _interopRequireDefault(_lodashuniqby);
m();
var Xe = async (e, t, r, n) => {
  let { schema: o, imports: s } = await U(t, r),
    i = I(t) ? s[0].name : e,
    a = n ? 'formUrlEncoded' : 'formData',
    p = n
      ? `const ${a} = new URLSearchParams();
`
      : `const ${a} = new FormData();
`;
  if (o.type === 'object' && o.properties) {
    let u = await C(
      Object.entries(o.properties),
      async (c, [l, d]) => {
        var y;
        let { schema: g } = await U(d, r),
          f = '';
        return (
          g.type === 'object'
            ? (f = `${a}.append('${l}', JSON.stringify(${j(i)}${
                l.includes('-') ? `['${l}']` : `.${l}`
              }));
`)
            : g.type === 'array'
            ? (f = `${j(i)}${
                l.includes('-') ? `['${l}']` : `.${l}`
              }.forEach(value => ${a}.append('${l}', value));
`)
            : g.type === 'number' ||
              g.type === 'integer' ||
              g.type === 'boolean'
            ? (f = `${a}.append('${l}', ${j(i)}${
                l.includes('-') ? `['${l}']` : `.${l}`
              }.toString())
`)
            : (f = `${a}.append('${l}', ${j(i)}${
                l.includes('-') ? `['${l}']` : `.${l}`
              })
`),
          (y = o.required) != null && y.includes(l)
            ? c + f
            : c +
              `if(${j(i)}${
                l.includes('-') ? `['${l}']` : `.${l}`
              } !== undefined) {
 ${f} }
`
        );
      },
      '',
    );
    return `${p}${u}`;
  }
  return o.type === 'array'
    ? `${p}${j(i)}.forEach(value => ${a}.append('data', value))
`
    : o.type === 'number' || o.type === 'boolean'
    ? `${p}${a}.append('data', ${j(i)}.toString())
`
    : `${p}${a}.append('data', ${j(i)})
`;
};
m();
m();
var De = (e, t, r) => {
    let n = `export type ${r} = typeof ${r}[keyof typeof ${r}];
`,
      o = Rt(e, t);
    return (
      (n += `

`),
      (n += `// eslint-disable-next-line @typescript-eslint/no-redeclare
`),
      (n += `export const ${r} = {
${o}} as const;
`),
      n
    );
  },
  Rt = (e, t) =>
    [...new Set(e.split(' | '))].reduce((r, n) => {
      if (n === 'null') return r;
      let o = t === 'number',
        i =
          !Number.isNaN(Number(n.slice(1, -1))) || o
            ? bp(o ? n.toString() : n.slice(1, -1))
            : V(n, { underscore: '_', whitespace: '_', dash: '-' });
      return (
        r +
        `  ${_esutils.keyword.isIdentifierNameES5(i) ? i : `'${i}'`}: ${n},
`
      );
    }, ''),
  bp = (e) =>
    e[0] === '-'
      ? `NUMBER_MINUS_${e.slice(1)}`
      : e[0] === '+'
      ? `NUMBER_PLUS_${e.slice(1)}`
      : `NUMBER_${e}`;
m();
m();
m();
var bo = async ({ schema: e, name: t, context: r }) => {
  if (e.items) {
    let n = await ae({ schema: e.items, propName: t + 'Item', context: r });
    return {
      value: `${n.value}[]`,
      imports: n.imports,
      schemas: n.schemas,
      isEnum: !1,
      type: 'array',
      isRef: !1,
    };
  } else throw new Error('All arrays must have an `items` key define');
};
m();
m();
var xp = ({ resolvedData: e, resolvedValue: t, separator: r }) =>
    e.isEnum.every((o) => o)
      ? `${e.values.join(' | ')}${t ? ` | ${t.value}` : ''}`
      : r === 'allOf'
      ? `${e.values.join(' & ')}${t ? ` & ${t.value}` : ''}`
      : t
      ? `(${e.values.join(` & ${t.value}) | (`)} & ${t.value})`
      : e.values.join(' | '),
  $o = async ({
    name: e,
    schema: t,
    separator: r,
    context: n,
    nullable: o,
  }) => {
    var c;
    let s = (c = t[r]) != null ? c : [],
      i = await C(
        s,
        async (l, d) => {
          let g = e ? e + b(r) : void 0;
          g && l.schemas.length && (g = g + b(mt(l.schemas.length + 1)));
          let f = await ae({
            schema: d,
            propName: g,
            combined: !0,
            context: n,
          });
          return (
            l.values.push(f.value),
            l.imports.push(...f.imports),
            l.schemas.push(...f.schemas),
            l.isEnum.push(f.isEnum),
            l.types.push(f.type),
            l.isRef.push(f.isRef),
            l
          );
        },
        {
          values: [],
          imports: [],
          schemas: [],
          isEnum: [],
          isRef: [],
          types: [],
        },
      ),
      a = i.isEnum.every((l) => l),
      p;
    t.properties &&
      (p = await re({
        schema: _lodashomit2.default.call(void 0, t, r),
        context: n,
      }));
    let u = xp({ resolvedData: i, separator: r, resolvedValue: p });
    if (a && e && s.length > 1) {
      let l = `

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ${b(e)} = ${Sp(i, e)}`;
      return {
        value: `typeof ${b(e)}[keyof typeof ${b(e)}] ${o};` + l,
        imports: i.imports.map((d) => ({ ...d, values: !0 })),
        schemas: i.schemas,
        isEnum: !1,
        type: 'object',
        isRef: !1,
      };
    }
    return {
      value: u + o,
      imports: i.imports,
      schemas: i.schemas,
      isEnum: !1,
      type: 'object',
      isRef: !1,
    };
  },
  Sp = ({ values: e, isRef: t, types: r }, n) =>
    e.length === 1
      ? t[0]
        ? e[0]
        : `{${Rt(e[0], r[0])}} as const`
      : `{${e
          .map((s, i) => (t[i] ? `...${s},` : Rt(s, r[i])))
          .join('')}} as const`;
var xo = async ({ item: e, name: t, context: r, nullable: n }) => {
  var o, s;
  if (I(e)) {
    let { name: i, specKey: a } = await Me(e.$ref, r);
    return {
      value: i + n,
      imports: [{ name: i, specKey: a }],
      schemas: [],
      isEnum: !1,
      type: 'object',
      isRef: !0,
    };
  }
  if (e.allOf || e.oneOf || e.anyOf) {
    let i = e.allOf ? 'allOf' : e.oneOf ? 'oneOf' : 'anyOf';
    return $o({ schema: e, name: t, separator: i, context: r, nullable: n });
  }
  if (e.properties && Object.entries(e.properties).length > 0)
    return C(
      Object.entries(e.properties),
      async (i, [a, p], u, c) => {
        var x, $, S;
        let l = (Array.isArray(e.required) ? e.required : []).includes(a),
          d = t ? b(t) + b(a) : void 0;
        !!(
          (S =
            ($ = (x = r.specs[r.target]) == null ? void 0 : x.components) ==
            null
              ? void 0
              : $.schemas) != null && S[d || '']
        ) && (d = d + 'Property');
        let f = await ae({ schema: p, propName: d, context: r }),
          y = e.readOnly || p.readOnly;
        u || (i.value += '{');
        let h = _(p, !0);
        if (
          (i.imports.push(...f.imports),
          (i.value += `
  ${h ? `${h}  ` : ''}${y ? 'readonly ' : ''}${Ge(a)}${l ? '' : '?'}: ${
            f.value
          };`),
          i.schemas.push(...f.schemas),
          c.length - 1 === u)
        ) {
          if (e.additionalProperties)
            if (J(e.additionalProperties))
              i.value += `
  [key: string]: any;
 }`;
            else {
              let w = await re({
                schema: e.additionalProperties,
                name: t,
                context: r,
              });
              i.value += `
  [key: string]: ${w.value};
}`;
            }
          else
            i.value += `
}`;
          i.value += n;
        }
        return i;
      },
      {
        imports: [],
        schemas: [],
        value: '',
        isEnum: !1,
        type: 'object',
        isRef: !1,
        schema: {},
      },
    );
  if (e.additionalProperties) {
    if (J(e.additionalProperties))
      return {
        value: '{ [key: string]: any }' + n,
        imports: [],
        schemas: [],
        isEnum: !1,
        type: 'object',
        isRef: !1,
      };
    let i = await re({ schema: e.additionalProperties, name: t, context: r });
    return {
      value: `{[key: string]: ${i.value}}` + n,
      imports: (o = i.imports) != null ? o : [],
      schemas: (s = i.schemas) != null ? s : [],
      isEnum: !1,
      type: 'object',
      isRef: !1,
    };
  }
  return {
    value: e.type === 'object' ? '{ [key: string]: any }' : 'unknown' + n,
    imports: [],
    schemas: [],
    isEnum: !1,
    type: 'object',
    isRef: !1,
  };
};
var Pt = async ({ item: e, name: t, context: r }) => {
  let n = e.nullable ? ' | null' : '';
  switch ((!e.type && e.items && (e.type = 'array'), e.type)) {
    case 'number':
    case 'integer': {
      let o = 'number',
        s = !1;
      return (
        e.enum && ((o = e.enum.join(' | ')), (s = !0)),
        {
          value: o + n,
          isEnum: s,
          type: 'number',
          schemas: [],
          imports: [],
          isRef: !1,
        }
      );
    }
    case 'boolean':
      return {
        value: 'boolean' + n,
        type: 'boolean',
        isEnum: !1,
        schemas: [],
        imports: [],
        isRef: !1,
      };
    case 'array': {
      let { value: o, ...s } = await bo({ schema: e, name: t, context: r });
      return { value: o + n, ...s };
    }
    case 'string': {
      let o = 'string',
        s = !1;
      return (
        e.enum &&
          ((o = `'${e.enum
            .map((i) => (G(i) ? lt(i) : i))
            .filter(Boolean)
            .join("' | '")}'`),
          (s = !0)),
        e.format === 'binary' && (o = 'Blob'),
        r.override.useDates &&
          (e.format === 'date' || e.format === 'date-time') &&
          (o = 'Date'),
        {
          value: o + n,
          isEnum: s,
          type: 'string',
          imports: [],
          schemas: [],
          isRef: !1,
        }
      );
    }
    case 'object':
    default: {
      let { value: o, ...s } = await xo({
        item: e,
        name: t,
        context: r,
        nullable: n,
      });
      return { value: o, ...s };
    }
  }
};
var re = async ({ schema: e, name: t, context: r }) => {
  if (I(e)) {
    let { schema: o, imports: s } = await U(e, r),
      { name: i, specKey: a, schemaName: p } = s[0],
      u = a || (r.specKey !== r.target ? r.specKey : void 0);
    return {
      value: i,
      imports: [{ name: i, specKey: u, schemaName: p }],
      type: (o == null ? void 0 : o.type) || 'object',
      schemas: [],
      isEnum: !!(o != null && o.enum),
      originalSchema: o,
      isRef: !0,
    };
  }
  return {
    ...(await Pt({ item: e, name: t, context: r })),
    originalSchema: e,
    isRef: !1,
  };
};
var ae = async ({ schema: e, propName: t, combined: r = !1, context: n }) => {
  var i;
  let o = await re({ schema: e, name: t, context: n }),
    s = _((i = o.originalSchema) != null ? i : {});
  if (
    t &&
    !o.isEnum &&
    (o == null ? void 0 : o.type) === 'object' &&
    new RegExp(/{|&|\|/).test(o.value)
  )
    return {
      value: t,
      imports: [{ name: t }],
      schemas: [
        ...o.schemas,
        {
          name: t,
          model: `${s}export type ${t} = ${o.value};
`,
          imports: o.imports,
        },
      ],
      isEnum: !1,
      type: 'object',
      originalSchema: o.originalSchema,
      isRef: o.isRef,
    };
  if (t && o.isEnum && !r && !o.isRef) {
    let a = De(o.value, o.type, t);
    return {
      value: t,
      imports: [{ name: t }],
      schemas: [...o.schemas, { name: t, model: s + a, imports: o.imports }],
      isEnum: !1,
      type: 'enum',
      originalSchema: o.originalSchema,
      isRef: o.isRef,
    };
  }
  return o;
};
var _redoc = require('redoc');
m();
var qe = (e, t) => {
  let r = { ...t };
  return (
    r != null && r.allOf && (r = { ...r, ...e.mergeAllOf(r) }),
    r != null &&
      r.properties &&
      Object.keys(r == null ? void 0 : r.properties).forEach((n) => {
        var o;
        (o = r == null ? void 0 : r.properties) != null &&
          o[n] &&
          (r.properties[n] = { ...qe(e, r.properties[n]) });
      }),
    (r == null ? void 0 : r.items) &&
      typeof r.items == 'object' &&
      !Array.isArray(r.items) &&
      r.items &&
      (r.items = { ...qe(e, r.items) }),
    r
  );
};
var So = ['multipart/form-data'],
  wo = ['application/x-www-form-urlencoded'],
  jp = async ({ mediaType: e, propName: t, context: r }) => {
    if (!e.schema) return;
    let n = new (0, _redoc.OpenAPIParser)(r.specs[r.specKey]);
    return (
      (e.schema = qe(n, e.schema)),
      await ae({ schema: e.schema, propName: t, context: r })
    );
  },
  Fe = async (e, t, r, n = 'unknown') => {
    let o = await Promise.all(
      e
        .filter(([s, i]) => Boolean(i))
        .map(async ([s, i]) => {
          var a, p;
          if (I(i)) {
            let {
                schema: u,
                imports: [{ name: c, specKey: l, schemaName: d }],
              } = await U(i, r),
              [g, f] =
                (p = Object.entries((a = u.content) != null ? a : {})[0]) !=
                null
                  ? p
                  : [],
              y = So.includes(g),
              h = wo.includes(g);
            if ((!y && !h) || !(f != null && f.schema))
              return [
                {
                  value: c,
                  imports: [{ name: c, specKey: l, schemaName: d }],
                  schemas: [],
                  type: 'unknown',
                  isEnum: !1,
                  isRef: !0,
                  originalSchema: f == null ? void 0 : f.schema,
                  key: s,
                  contentType: g,
                },
              ];
            let x = y
                ? await Xe(c, f == null ? void 0 : f.schema, {
                    ...r,
                    specKey: l || r.specKey,
                  })
                : void 0,
              $ = h
                ? await Xe(
                    c,
                    f == null ? void 0 : f.schema,
                    { ...r, specKey: l || r.specKey },
                    !0,
                  )
                : void 0;
            return [
              {
                value: c,
                imports: [{ name: c, specKey: l, schemaName: d }],
                schemas: [],
                type: 'unknown',
                isEnum: !1,
                formData: x,
                formUrlEncoded: $,
                isRef: !0,
                originalSchema: f == null ? void 0 : f.schema,
                key: s,
                contentType: g,
              },
            ];
          }
          return i.content
            ? (
                await Promise.all(
                  Object.entries(i.content).map(async ([c, l], d, g) => {
                    let f = s ? b(t) + b(s) : void 0;
                    f && g.length > 1 && (f = f + b(mt(d + 1)));
                    let y = await jp({ mediaType: l, propName: f, context: r });
                    if (!y) return;
                    let h = So.includes(c),
                      x = wo.includes(c);
                    if ((!h && !x) || !f) return { ...y, contentType: c };
                    let $ = h ? await Xe(f, l.schema, r) : void 0,
                      S = x ? await Xe(f, l.schema, r, !0) : void 0;
                    return {
                      ...y,
                      formData: $,
                      formUrlEncoded: S,
                      contentType: c,
                    };
                  }),
                )
              )
                .filter((c) => c)
                .map((c) => ({ ...c, key: s }))
            : [
                {
                  value: n,
                  imports: [],
                  schemas: [],
                  type: n,
                  isEnum: !1,
                  key: s,
                  isRef: !1,
                  contentType: 'application/json',
                },
              ];
        }),
    );
    return _lodashuniqby2.default.call(
      void 0,
      o.flatMap((s) => s),
      'value',
    );
  };
var To = async ({
  requestBody: e,
  operationName: t,
  context: r,
  contentType: n,
}) => {
  let o = await Fe([[r.override.components.requestBodies.suffix, e]], t, r),
    s = n
      ? o.filter((c) => {
          let l = !0,
            d = !1;
          return (
            n.include && (l = n.include.includes(c.contentType)),
            n.exclude && (d = n.exclude.includes(c.contentType)),
            l && !d
          );
        })
      : o,
    i = s.flatMap(({ imports: c }) => c),
    a = s.flatMap(({ schemas: c }) => c),
    p = s.map(({ value: c }) => c).join(' | '),
    u =
      Ae.includes(p.toLowerCase()) || s.length > 1
        ? j(t) + r.override.components.requestBodies.suffix
        : j(p);
  return {
    definition: p,
    implementation: u,
    imports: i,
    schemas: a,
    ...(s.length === 1
      ? {
          formData: s[0].formData,
          formUrlEncoded: s[0].formUrlEncoded,
          contentType: s[0].contentType,
        }
      : { formData: '', formUrlEncoded: '', contentType: '' }),
  };
};
m();
var jo = (e, t, r) =>
  e.operationId
    ? e.operationId
    : b(
        [
          r,
          ...t
            .split('/')
            .map((n) =>
              V(n, { dash: !0, underscore: '-', dot: '-', whitespace: '-' }),
            ),
        ].join('-'),
      );
m();
var Ro = async ({ parameters: e = [], context: t }) =>
  C(
    e,
    async (r, n) => {
      if (I(n)) {
        let { schema: o, imports: s } = await U(n, t);
        (o.in === 'path' || o.in === 'query' || o.in === 'header') &&
          r[o.in].push({ parameter: o, imports: s });
      } else
        (n.in === 'query' || n.in === 'path' || n.in === 'header') &&
          r[n.in].push({ parameter: n, imports: [] });
      return r;
    },
    { path: [], query: [], header: [] },
  );
m();
var Rp = (e) => {
    let t,
      r = [],
      n = /\{(.*?)\}/g;
    for (; (t = n.exec(e)) !== null; ) r.push(t[1]);
    return r;
  },
  Po = ({ route: e, pathParams: t = [], operationId: r, context: n }) => {
    let o = Rp(e);
    return Promise.all(
      o.map(async (s) => {
        let i = t.find(
          ({ parameter: f }) =>
            V(j(f.name), { es5keyword: !0, underscore: !0, dash: !0 }) === s,
        );
        if (!i)
          throw new Error(
            `The path params ${s} can't be found in parameters (${r})`,
          );
        let { name: a, required: p = !1, schema: u } = i.parameter,
          c = V(j(a), { es5keyword: !0 });
        if (!u)
          return {
            name: c,
            definition: `${c}${p ? '' : '?'}: unknown`,
            implementation: `${c}${p ? '' : '?'}: unknown`,
            default: !1,
            required: p,
            imports: [],
          };
        let l = await re({
            schema: u,
            context: {
              ...n,
              ...(i.imports.length ? { specKey: i.imports[0].specKey } : {}),
            },
          }),
          d = `${c}${!p || l.originalSchema.default ? '?' : ''}: ${l.value}`,
          g = `${c}${!p && !l.originalSchema.default ? '?' : ''}${
            l.originalSchema.default
              ? `= ${K(l.originalSchema.default)}`
              : `: ${l.value}`
          }`;
        return {
          name: c,
          definition: d,
          implementation: g,
          default: l.originalSchema.default,
          required: p,
          imports: l.imports,
        };
      }),
    );
  };
m();
m();
var Eo = (e) =>
  e.sort((t, r) =>
    t.default
      ? 1
      : r.default
      ? -1
      : t.required && r.required
      ? 0
      : t.required
      ? -1
      : r.required
      ? 1
      : 0,
  );
var vo = ({ body: e, queryParams: t, params: r, headers: n }) => {
  let o = {
      name: e.implementation,
      definition: `${e.implementation}: ${e.definition}`,
      implementation: `${e.implementation}: ${e.definition}`,
      default: !1,
      required: !0,
      type: W.BODY,
    },
    s = {
      name: 'params',
      definition: `params${t != null && t.isOptional ? '?' : ''}: ${
        t == null ? void 0 : t.schema.name
      }`,
      implementation: `params${t != null && t.isOptional ? '?' : ''}: ${
        t == null ? void 0 : t.schema.name
      }`,
      default: !1,
      required: we(t == null ? void 0 : t.isOptional)
        ? !1
        : !(t != null && t.isOptional),
      type: W.QUERY_PARAM,
    },
    i = {
      name: 'headers',
      definition: `headers${n != null && n.isOptional ? '?' : ''}: ${
        n == null ? void 0 : n.schema.name
      }`,
      implementation: `headers${n != null && n.isOptional ? '?' : ''}: ${
        n == null ? void 0 : n.schema.name
      }`,
      default: !1,
      required: we(n == null ? void 0 : n.isOptional)
        ? !1
        : !(n != null && n.isOptional),
      type: W.HEADER,
    },
    a = [
      ...r.map((u) => ({ ...u, type: W.PARAM })),
      ...(e.definition ? [o] : []),
      ...(t ? [s] : []),
      ...(n ? [i] : []),
    ];
  return Eo(a);
};
m();
var Pp = (e, t, r) =>
    Promise.all(
      e.map(async ({ parameter: n, imports: o }) => {
        let { name: s, required: i, schema: a, content: p } = n,
          {
            value: u,
            imports: c,
            isEnum: l,
            type: d,
            schemas: g,
            isRef: f,
          } = await re({
            schema: a || p['application/json'].schema,
            context: r,
            name: b(t) + b(s),
          }),
          y = Ge(s);
        if (o.length)
          return {
            definition: `${y}${!i || a.default ? '?' : ''}: ${o[0].name}`,
            imports: o,
            schemas: [],
          };
        if (l && !f) {
          let x = b(t) + b(s),
            $ = De(u, d, x);
          return {
            definition: `${y}${!i || a.default ? '?' : ''}: ${x}`,
            imports: [{ name: x }],
            schemas: [...g, { name: x, model: $, imports: c }],
          };
        }
        return {
          definition: `${y}${!i || a.default ? '?' : ''}: ${u}`,
          imports: c,
          schemas: g,
        };
      }),
    ),
  nr = async ({
    queryParams: e = [],
    operationName: t,
    context: r,
    suffix: n = 'params',
  }) => {
    if (!e.length) return;
    let o = await Pp(e, t, r),
      s = o.flatMap(({ imports: l }) => l),
      i = o.flatMap(({ schemas: l }) => l),
      a = `${b(t)}${b(n)}`,
      p = o.map(({ definition: l }) => l).join('; '),
      u = e.every(({ parameter: l }) => !l.required);
    return {
      schema: {
        name: a,
        model: `export type ${a} = { ${p} };
`,
        imports: s,
      },
      deps: i,
      isOptional: u,
    };
  };
m();
var Ao = async ({
  responses: e,
  operationName: t,
  context: r,
  contentType: n,
}) => {
  if (!e)
    return {
      imports: [],
      definition: { success: '', errors: '' },
      isBlob: !1,
      types: { success: [], errors: [] },
      schemas: [],
      contentTypes: [],
    };
  let o = await Fe(Object.entries(e), t, r, 'void'),
    s = n
      ? o.filter((d) => {
          let g = !0,
            f = !1;
          return (
            n.include && (g = n.include.includes(d.contentType)),
            n.exclude && (f = n.exclude.includes(d.contentType)),
            g && !f
          );
        })
      : o,
    i = s.reduce(
      (d, g) => (
        g.key.startsWith('2') ? d.success.push(g) : d.errors.push(g), d
      ),
      { success: [], errors: [] },
    ),
    a = s.flatMap(({ imports: d }) => d),
    p = s.flatMap(({ schemas: d }) => d),
    u = [...new Set(s.map(({ contentType: d }) => d))],
    c = i.success
      .map(({ value: d, formData: g }) => (g ? 'Blob' : d))
      .join(' | '),
    l = i.errors.map(({ value: d }) => d).join(' | ');
  return {
    imports: a,
    definition: { success: c || 'unknown', errors: l || 'unknown' },
    isBlob: c === 'Blob',
    types: i,
    contentTypes: u,
    schemas: p,
  };
};
m();
var _acorn = require('acorn');
m();
m();
var or = (e) =>
  e.toLowerCase().includes('.yaml') || e.toLowerCase().includes('.yml')
    ? 'yaml'
    : 'json';
var ne = (e, t) => {
    let r = _upath.relative.call(void 0, e, t);
    return _upath.normalizeSafe.call(void 0, `.${_upath.sep}${r}`);
  },
  Et = (e, t) => {
    if (be(e)) {
      let r = new URL(t);
      return e
        .replace(r.origin, '')
        .replace(M(r.pathname).dirname, '')
        .replace(`.${or(e)}`, '');
    }
    return (
      '/' +
      _upath.normalize
        .call(void 0, _upath.relative.call(void 0, M(t).dirname, e))
        .split('../')
        .join('')
        .replace(`.${or(e)}`, '')
    );
  };
var vt = 'BodyType',
  ko = (e, t) => {
    let r = M(e),
      n = M(t.path),
      { pathWithoutExtension: o } = M(ne(r.dirname, n.path));
    return o;
  },
  Ct = async ({
    output: e,
    mutator: t,
    name: r,
    workspace: n,
    tsconfig: o,
  }) => {
    var y;
    if (!t || !e) return;
    let s = t.default,
      i = t.name ? t.name : `${r}Mutator`,
      a = t.path,
      p = await _fsextra.readFile.call(void 0, a, 'utf8'),
      u =
        p.includes('export type ErrorType') ||
        p.includes('export interface ErrorType'),
      c =
        p.includes(`export type ${vt}`) || p.includes(`export interface ${vt}`),
      l = t.default ? `${b(r)}ErrorType` : 'ErrorType',
      d = t.default ? `${b(r)}${vt}` : vt,
      { file: g, cached: f } = await ft(a, {
        isDefault: !1,
        root: n,
        alias: t.alias,
        tsconfig: o,
        load: !1,
      });
    if (g) {
      let h = s ? 'default' : t.name,
        x = kp(g, h);
      x ||
        (X().error(
          _chalk2.default.red(
            `Your mutator file doesn't have the ${h} exported function`,
          ),
        ),
        process.exit(1));
      let $ = ko(e, t);
      return {
        name: i,
        path: $,
        default: s,
        hasErrorType: u,
        errorTypeName: l,
        hasSecondArg: x.numberOfParams > 1,
        hasThirdArg: x.numberOfParams > 2,
        isHook:
          !!(
            (y = t == null ? void 0 : t.name) != null && y.startsWith('use')
          ) && !x.numberOfParams,
        ...(c ? { bodyTypeName: d } : {}),
      };
    } else {
      let h = ko(e, t);
      return (
        f ||
          X().warn(
            _chalk2.default.yellow('Failed to parse provided mutator function'),
          ),
        {
          name: i,
          path: h,
          default: s,
          hasSecondArg: !1,
          hasThirdArg: !1,
          isHook: !1,
          hasErrorType: u,
          errorTypeName: l,
          ...(c ? { bodyTypeName: d } : {}),
        }
      );
    }
  },
  kp = (e, t) => {
    var r, n;
    try {
      let o = _acorn.Parser.parse(e, { ecmaVersion: 6 }),
        s =
          (r = o == null ? void 0 : o.body) == null
            ? void 0
            : r.find((a) => {
                var p, u, c, l, d, g, f;
                if (a.type === 'ExpressionStatement')
                  return ((c =
                    (u =
                      (p = a.expression.arguments) == null ? void 0 : p[1]) ==
                    null
                      ? void 0
                      : u.properties) != null &&
                    c.some((y) => {
                      var h;
                      return ((h = y.key) == null ? void 0 : h.name) === t;
                    })) ||
                    ((d =
                      (l = a.expression.left) == null ? void 0 : l.property) ==
                    null
                      ? void 0
                      : d.name) === t
                    ? !0
                    : (f =
                        (g = a.expression.right) == null
                          ? void 0
                          : g.properties) == null
                    ? void 0
                    : f.some((y) => y.key.name === t);
              });
      if (!s) return;
      if (s.expression.type === 'AssignmentExpression') {
        if (
          s.expression.right.type === 'FunctionExpression' ||
          s.expression.right.type === 'ArrowFunctionExpression'
        )
          return { numberOfParams: s.expression.right.params.length };
        if (s.expression.right.name) return At(o, s.expression.right.name);
        let a =
          (n = s.expression.right) == null
            ? void 0
            : n.properties.find((p) => p.key.name === t);
        return a.value.name
          ? At(o, a.value.name)
          : a.value.type === 'FunctionExpression' ||
            a.value.type === 'ArrowFunctionExpression'
          ? { numberOfParams: a.value.params.length }
          : void 0;
      }
      let i = s.expression.arguments[1].properties.find((a) => {
        var p;
        return ((p = a.key) == null ? void 0 : p.name) === t;
      });
      return At(o, i.value.body.name);
    } catch (e7) {
      return;
    }
  },
  At = (e, t) => {
    var o;
    let r =
      (o = e == null ? void 0 : e.body) == null
        ? void 0
        : o.find((s) => {
            if (s.type === 'VariableDeclaration')
              return s.declarations.find((i) => i.id.name === t);
            if (s.type === 'FunctionDeclaration' && s.id.name === t) return s;
          });
    if (!r) return;
    if (r.type === 'FunctionDeclaration')
      return { numberOfParams: r.params.length };
    let n = r.declarations.find((s) => s.id.name === t);
    return n.init.name
      ? At(e, n.init.name)
      : { numberOfParams: n.init.params.length };
  };
var Ip = async ({
    verb: e,
    output: t,
    operation: r,
    route: n,
    verbParameters: o = [],
    context: s,
  }) => {
    var He;
    let {
        responses: i,
        requestBody: a,
        parameters: p,
        tags: u = [],
        deprecated: c,
        description: l,
        summary: d,
      } = r,
      g = jo(r, n, e),
      f = t.override.operations[r.operationId],
      y = Object.entries(t.override.tags).reduce(
        (Qe, [st, it]) => (u.includes(st) ? Pe(Qe, it) : Qe),
        {},
      ),
      h = { ...t.override, ...y, ...f },
      x =
        (f == null ? void 0 : f.operationName) ||
        ((He = t.override) == null ? void 0 : He.operationName),
      $ = x ? x(r, n, e) : j(g),
      S = V($, { es5keyword: !0 }),
      w = await Ao({
        responses: i,
        operationName: S,
        context: s,
        contentType: h.contentType,
      }),
      T = await To({
        requestBody: a,
        operationName: S,
        context: s,
        contentType: h.contentType,
      }),
      R = await Ro({ parameters: [...o, ...(p != null ? p : [])], context: s }),
      P = await nr({ queryParams: R.query, operationName: S, context: s }),
      v = t.headers
        ? await nr({
            queryParams: R.header,
            operationName: S,
            context: s,
            suffix: 'headers',
          })
        : void 0,
      A = await Po({
        route: n,
        pathParams: R.path,
        operationId: g,
        context: s,
      }),
      D = vo({ body: T, queryParams: P, params: A, headers: v }),
      L = await Ct({
        output: t.target,
        name: S,
        mutator: h == null ? void 0 : h.mutator,
        workspace: s.workspace,
        tsconfig: s.tsconfig,
      }),
      pe =
        G(h == null ? void 0 : h.formData) || N(h == null ? void 0 : h.formData)
          ? await Ct({
              output: t.target,
              name: S,
              mutator: h.formData,
              workspace: s.workspace,
              tsconfig: s.tsconfig,
            })
          : void 0,
      ve =
        G(h == null ? void 0 : h.formUrlEncoded) ||
        N(h == null ? void 0 : h.formUrlEncoded)
          ? await Ct({
              output: t.target,
              name: S,
              mutator: h.formUrlEncoded,
              workspace: s.workspace,
              tsconfig: s.tsconfig,
            })
          : void 0,
      Y = _({ description: l, deprecated: c, summary: d }),
      oe = {
        verb: e,
        tags: u,
        summary: r.summary,
        operationId: g,
        operationName: S,
        response: w,
        body: T,
        headers: v,
        queryParams: P,
        params: A,
        props: D,
        mutator: L,
        formData: pe,
        formUrlEncoded: ve,
        override: h,
        doc: Y,
      },
      We = await gt(h == null ? void 0 : h.transformer, s.workspace);
    return We ? We(oe) : oe;
  },
  Io = ({ verbs: e, output: t, route: r, context: n }) =>
    C(
      Object.entries(e),
      async (o, [s, i]) => {
        if (cn(s)) {
          let a = await Ip({
            verb: s,
            output: t,
            verbParameters: e.parameters,
            route: r,
            operation: i,
            context: n,
          });
          o.push(a);
        }
        return o;
      },
      [],
    );
var Go = async ({ output: e, context: t }) =>
  C(
    Object.entries(t.specs[t.specKey].paths),
    async (r, [n, o]) => {
      let s = Wn(n),
        i = o,
        a = t;
      if (I(o)) {
        let { schema: l, imports: d } = await U(o, t);
        (i = l), (a = { ...t, ...(d.length ? { specKey: d[0].specKey } : {}) });
      }
      let p = await Io({ verbs: i, output: e, route: s, context: a }),
        u = p.reduce(
          (l, { queryParams: d, headers: g, body: f, response: y }) => (
            d && l.push(d.schema, ...d.deps),
            g && l.push(g.schema, ...g.deps),
            l.push(...f.schemas),
            l.push(...y.schemas),
            l
          ),
          [],
        ),
        c = await Oo(e.client, p, {
          route: s,
          pathRoute: n,
          override: e.override,
          context: a,
          mock: !!e.mock,
        });
      return (
        r.schemas.push(...u), (r.operations = { ...r.operations, ...c }), r
      );
    },
    { operations: {}, schemas: [] },
  );
m();
var ai = ue(br());
var $r = (e = {}, t, r) =>
  (0, ai.default)(e)
    ? Promise.resolve([])
    : C(
        Object.entries(e),
        async (n, [o, s]) => {
          let i = await Fe([[r, s]], o, t, 'void'),
            a = i.flatMap(({ imports: g }) => g),
            p = i.flatMap(({ schemas: g }) => g),
            u = i.map(({ value: g }) => g).join(' | '),
            c = `${b(o)}${r}`,
            d = `${_(s)}export type ${c} = ${u || 'unknown'};
`;
          return (
            n.push(...p),
            c !== u && n.push({ name: c, model: d, imports: a }),
            n
          );
        },
        [],
      );
m();
var pi = (e = {}, t, r) =>
  C(
    Object.entries(e),
    async (n, [o, s]) => {
      let i = `${b(o)}${r}`,
        { schema: a, imports: p } = await U(s, t);
      if (a.in !== 'query') return n;
      if (!a.schema || p.length)
        return (
          n.push({
            name: i,
            imports: p.length
              ? [
                  {
                    name: p[0].name,
                    specKey: p[0].specKey,
                    schemaName: p[0].schemaName,
                  },
                ]
              : [],
            model: `export type ${i} = ${p.length ? p[0].name : 'unknown'};
`,
          }),
          n
        );
      let u = await ae({ schema: a.schema, propName: i, context: t }),
        l = `${_(s)}export type ${i} = ${u.value || 'unknown'};
`;
      return (
        n.push(...u.schemas),
        i !== u.value && n.push({ name: i, model: l, imports: u.imports }),
        n
      );
    },
    [],
  );
m();
var li = ue(br());
m();
var ci = (e) => {
  var r, n;
  let t = { ...e };
  for (let o of Object.values(t))
    if ((r = o.discriminator) != null && r.mapping) {
      let { mapping: s, propertyName: i } = o.discriminator;
      for (let a of Object.keys(s)) {
        let p = t[a];
        (p.properties = {
          ...p.properties,
          [i]: { type: 'string', enum: [a] },
        }),
          (p.required = [...((n = p.required) != null ? n : []), i]);
      }
    }
  return t;
};
m();
var mi = async ({ name: e, schema: t, context: r, suffix: n }) => {
  var p;
  let o = await Pt({ item: t, name: e, context: r }),
    s = o.value === '{}',
    i = '';
  (i += _(t)),
    s &&
      (r.tslint
        ? (i += `// tslint:disable-next-line:no-empty-interface
`)
        : (i += `// eslint-disable-next-line @typescript-eslint/no-empty-interface
`)),
    !Ae.includes(o.value) &&
    !((p = r == null ? void 0 : r.override) != null && p.useTypeOverInterfaces)
      ? (i += `export interface ${e} ${o.value}
`)
      : (i += `export type ${e} = ${o.value};
`);
  let a = o.imports.filter((u) => u.name !== e);
  return [...o.schemas, { name: e, model: i, imports: a }];
};
var ui = async (e = {}, t, r) => {
  if ((0, li.default)(e)) return [];
  let n = ci(e),
    o = new (0, _redoc.OpenAPIParser)(t.specs[t.specKey]);
  return (
    Object.keys(n).forEach((i) => {
      n[i] = qe(o, n[i]);
    }),
    C(
      Object.entries(n),
      async (i, [a, p]) => {
        let u = b(a) + r;
        if (
          (!p.type || p.type === 'object') &&
          !p.allOf &&
          !p.oneOf &&
          !p.anyOf &&
          !I(p) &&
          !p.nullable
        )
          return (
            i.push(
              ...(await mi({ name: u, schema: p, context: t, suffix: r })),
            ),
            i
          );
        {
          let c = await re({ schema: p, name: u, context: t }),
            l = '',
            d = c.imports;
          if (((l += _(p)), c.isEnum && !c.isRef)) l += De(c.value, c.type, u);
          else if (u === c.value && c.isRef) {
            let g = c.imports.find((f) => f.name === u);
            if (!g)
              l += `export type ${u} = ${c.value};
`;
            else {
              let f =
                g != null && g.specKey
                  ? `${b(Et(g.specKey, t.specKey))}${c.value}`
                  : `${c.value}Bis`;
              (l += `export type ${u} = ${f};
`),
                (d = d.map((y) => (y.name === u ? { ...y, alias: f } : y)));
            }
          } else
            l += `export type ${u} = ${c.value};
`;
          return i.push(...c.schemas, { name: u, model: l, imports: d }), i;
        }
      },
      [],
    )
  );
};
m();
var _ibmopenapivalidator = require('ibm-openapi-validator');
var _ibmopenapivalidator2 = _interopRequireDefault(_ibmopenapivalidator);
var fi = async (e) => {
  let { errors: t, warnings: r } = await _ibmopenapivalidator2.default.call(
    void 0,
    e,
  );
  r.length && gn(r), t.length && yn(t);
};
var wl = async ({ specs: e, input: t, workspace: r }) => {
    var o;
    let n =
      (o = t.override) != null && o.transformer
        ? await gt(t.override.transformer, r)
        : void 0;
    return C(
      Object.entries(e),
      async (s, [i, a]) => {
        let p = await Bn(a, t.converterOptions, i),
          u = n ? n(p) : p;
        return t.validation && (await fi(u)), (s[i] = u), s;
      },
      {},
    );
  },
  xr = async ({ data: e, input: t, output: r, target: n, workspace: o }) => {
    var p;
    let s = await wl({ specs: e, input: t, workspace: o }),
      i = await C(
        Object.entries(s),
        async (u, [c, l]) => {
          var $, S, w, T, R, P;
          let d = {
              specKey: c,
              target: n,
              workspace: o,
              specs: s,
              override: r.override,
              tslint: r.tslint,
              tsconfig: r.tsconfig,
              packageJson: r.packageJson,
            },
            g = await ui(
              l.openapi
                ? (w = l.components) == null
                  ? void 0
                  : w.schemas
                : {
                    ..._lodashomit2.default.call(void 0, l, [
                      'openapi',
                      'info',
                      'servers',
                      'paths',
                      'components',
                      'security',
                      'tags',
                      'externalDocs',
                    ]),
                    ...((S = ($ = l.components) == null ? void 0 : $.schemas) !=
                    null
                      ? S
                      : {}),
                  },
              d,
              r.override.components.schemas.suffix,
            ),
            f = await $r(
              (T = l.components) == null ? void 0 : T.responses,
              d,
              r.override.components.responses.suffix,
            ),
            y = await $r(
              (R = l.components) == null ? void 0 : R.requestBodies,
              d,
              r.override.components.requestBodies.suffix,
            ),
            h = await pi(
              (P = l.components) == null ? void 0 : P.parameters,
              d,
              r.override.components.parameters.suffix,
            ),
            x = [...g, ...f, ...y, ...h];
          return x.length && (u[c] = x), u;
        },
        {},
      ),
      a = await Go({
        output: r,
        context: {
          specKey: n,
          target: n,
          workspace: o,
          specs: s,
          override: r.override,
          tslint: r.tslint,
          tsconfig: r.tsconfig,
          packageJson: r.packageJson,
        },
      });
    return {
      ...a,
      schemas: { ...i, [n]: [...((p = i[n]) != null ? p : []), ...a.schemas] },
      target: n,
      info: s[n].info,
    };
  };
var Pl = async (e, { validate: t, ...r }, n) => {
    if (t)
      try {
        await _swaggerparser2.default.validate(e);
      } catch (s) {
        if ((s == null ? void 0 : s.name) === 'ParserError') throw s;
        _console.log.call(void 0, `\u26A0\uFE0F  ${_chalk2.default.yellow(s)}`);
      }
    let o = (await _swaggerparser2.default.resolve(e, r)).values();
    return n
      ? o
      : Object.fromEntries(
          Object.entries(o).map(([s, i]) => [
            _upath.resolve.call(void 0, s),
            i,
          ]),
        );
  },
  gi = async (e, t) => {
    let { input: r, output: n } = t;
    if (N(r.target))
      return xr({
        data: { [e]: r.target },
        input: r,
        output: n,
        target: e,
        workspace: e,
      });
    let o = be(r.target),
      s = await Pl(r.target, r.parserOptions, o);
    return xr({ data: s, input: r, output: n, target: r.target, workspace: e });
  };
m();
var _execa = require('execa');
var _execa2 = _interopRequireDefault(_execa);
m();
var _stringargv = require('string-argv');
var hi = async (e, t = [], r = []) => {
  q(_chalk2.default.white(`Running ${e} hook...`));
  for (let n of t)
    if (G(n)) {
      let [o, ...s] = [
        ..._stringargv.parseArgsStringToArgv.call(void 0, n),
        ...r,
      ];
      try {
        await _execa2.default.call(void 0, o, s);
      } catch (i) {
        q(_chalk2.default.red(`\u{1F6D1} Failed to run ${e} hook: ${i}`));
      }
    } else B(n) && (await n(r));
};
m();
var Il = ({
    schema: { imports: e, model: t },
    target: r,
    isRootKey: n,
    specsName: o,
    header: s,
  }) => {
    let i = s;
    return (
      (i += Sn({ imports: e, target: r, isRootKey: n, specsName: o })),
      (i += e.length
        ? `

`
        : `
`),
      (i += t),
      i
    );
  },
  Sr = (e, t) => _upath.join.call(void 0, e, `/${t}.ts`);
var Gl = async ({
    path: e,
    schema: t,
    target: r,
    isRootKey: n,
    specsName: o,
    header: s,
  }) => {
    let i = j(t.name);
    try {
      await _fsextra.outputFile.call(
        void 0,
        Sr(e, i),
        Il({ schema: t, target: r, isRootKey: n, specsName: o, header: s }),
      );
      let a = Sr(e, 'index'),
        u = (await _fsextra.readFile.call(void 0, a)).toString();
      !u.includes(`export * from './${i}'`) &&
        !u.includes(`export * from "./${i}"`) &&
        (await _fsextra.appendFile.call(
          void 0,
          Sr(e, 'index'),
          `export * from './${i}';
`,
        ));
    } catch (a) {
      throw `Oups... \u{1F37B}. An Error occurred while writing schema ${i} => ${a}`;
    }
  },
  bi = async ({
    schemaPath: e,
    schemas: t,
    target: r,
    isRootKey: n,
    specsName: o,
    header: s,
  }) => (
    await _fsextra.ensureFile.call(
      void 0,
      _upath.join.call(void 0, e, '/index.ts'),
    ),
    Promise.all(
      t.map((i) =>
        Gl({
          path: e,
          schema: i,
          target: r,
          isRootKey: n,
          specsName: o,
          header: s,
        }),
      ),
    )
  );
m();
m();
var Dl = (e, t) =>
    e +
    `${t}
`,
  Se = (e) =>
    Object.values(e)
      .flatMap((r) => r)
      .sort((r, n) => (r.imports.some((o) => o.name === n.name) ? 1 : -1))
      .reduce((r, { model: n }) => Dl(r, n), '');
m();
var _compareversions = require('compare-versions');
var kt = (e, t, r) => {
  let n = Object.values(e).map(({ operationName: a }) => a),
    o = (r == null ? void 0 : r.client) === Q.ANGULAR,
    s = jt({
      outputClient: r.client,
      title: b(t.title),
      customTitleFunc: r.override.title,
    }),
    i = Object.values(e).reduce(
      (a, p, u, c) => {
        var l, d, g;
        if (
          (a.imports.push(...p.imports),
          a.importsMSW.push(...p.importsMSW),
          (a.implementation +=
            p.implementation +
            `
`),
          (a.implementationMSW.function += p.implementationMSW.function),
          (a.implementationMSW.handler += p.implementationMSW.handler),
          p.mutator && a.mutators.push(p.mutator),
          p.formData && a.formData.push(p.formData),
          p.formUrlEncoded && a.formUrlEncoded.push(p.formUrlEncoded),
          u === c.length - 1)
        ) {
          let f = a.mutators.some((S) => (o ? S.hasThirdArg : S.hasSecondArg)),
            y =
              (g =
                (d = (l = r.packageJson) == null ? void 0 : l.dependencies) ==
                null
                  ? void 0
                  : d.typescript) != null
                ? g
                : '4.4.0',
            h = _compareversions.compare.call(void 0, y, '4.5.0', '>='),
            x = wt({
              outputClient: r.client,
              isRequestOptions: r.override.requestOptions !== !1,
              isMutator: f,
              isGlobalMutator: !!r.override.mutator,
              provideIn: r.override.angular.provideIn,
              hasAwaitedType: h,
              titles: s,
            });
          (a.implementation = x.implementation + a.implementation),
            (a.implementationMSW.handler =
              x.implementationMSW + a.implementationMSW.handler);
          let $ = Tt({
            outputClient: r == null ? void 0 : r.client,
            operationNames: n,
            hasMutator: !!a.mutators.length,
            hasAwaitedType: h,
            titles: s,
          });
          (a.implementation += $.implementation),
            (a.implementationMSW.handler += $.implementationMSW);
        }
        return a;
      },
      {
        imports: [],
        implementation: '',
        implementationMSW: { function: '', handler: '' },
        importsMSW: [],
        mutators: [],
        formData: [],
        formUrlEncoded: [],
      },
    );
  return {
    ...i,
    implementationMSW:
      i.implementationMSW.function + i.implementationMSW.handler,
  };
};
var $i = async ({
  operations: e,
  schemas: t,
  info: r,
  output: n,
  specsName: o,
  header: s,
}) => {
  try {
    let { path: i, dirname: a } = M(n.target, { backupFilename: j(r.title) }),
      {
        imports: p,
        importsMSW: u,
        implementation: c,
        implementationMSW: l,
        mutators: d,
        formData: g,
        formUrlEncoded: f,
      } = kt(e, r, n),
      y = s,
      h = n.schemas ? ne(a, M(n.schemas).dirname) : void 0,
      x = Z(n.tsconfig);
    return (
      (y += xe(
        n.client,
        c,
        h
          ? [
              {
                exports: p.filter(($) => !u.some((S) => $.name === S.name)),
                dependency: h,
              },
            ]
          : [],
        o,
        !!n.schemas,
        x,
        !!n.override.mutator,
      )),
      n.mock &&
        (y += $e(
          l,
          h ? [{ exports: u, dependency: h }] : [],
          o,
          !!n.schemas,
          x,
        )),
      d && (y += z({ mutators: d, implementation: c })),
      g && (y += z({ mutators: g })),
      f && (y += z({ mutators: f })),
      n.schemas || (y += Se(t)),
      (y += `

${c}`),
      n.mock &&
        ((y += `

`),
        (y += l)),
      await _fsextra.outputFile.call(void 0, i, y),
      [i]
    );
  } catch (i) {
    throw `Oups... \u{1F37B}. An Error occurred while writing file => ${i}`;
  }
};
m();
var xi = async ({
  operations: e,
  schemas: t,
  info: r,
  output: n,
  specsName: o,
  header: s,
}) => {
  try {
    let {
        filename: i,
        dirname: a,
        extension: p,
      } = M(n.target, { backupFilename: j(r.title) }),
      {
        imports: u,
        implementation: c,
        implementationMSW: l,
        importsMSW: d,
        mutators: g,
        formData: f,
        formUrlEncoded: y,
      } = kt(e, r, n),
      h = s,
      x = s,
      $ = n.schemas ? ne(a, M(n.schemas).dirname) : './' + i + '.schemas',
      S = Z(n.tsconfig);
    (h += xe(
      n.client,
      c,
      [{ exports: u, dependency: $ }],
      o,
      !!n.schemas,
      S,
      !!n.override.mutator,
    )),
      (x += $e(l, [{ exports: d, dependency: $ }], o, !!n.schemas, S));
    let w = n.schemas
      ? void 0
      : _upath.join.call(void 0, a, i + '.schemas' + p);
    if (w) {
      let v = s + Se(t);
      await _fsextra.outputFile.call(
        void 0,
        _upath.join.call(void 0, a, i + '.schemas' + p),
        v,
      );
    }
    g && (h += z({ mutators: g, implementation: c })),
      f && (h += z({ mutators: f })),
      y && (h += z({ mutators: y })),
      (h += `
${c}`),
      (x += `
${l}`);
    let T = i + (Q.ANGULAR === n.client ? '.service' : '') + p,
      R = _upath.join.call(void 0, a, T);
    await _fsextra.outputFile.call(void 0, _upath.join.call(void 0, a, T), h);
    let P = n.mock ? _upath.join.call(void 0, a, i + '.msw' + p) : void 0;
    return (
      P && (await _fsextra.outputFile.call(void 0, P, x)),
      [R, ...(w ? [w] : []), ...(P ? [P] : [])]
    );
  } catch (i) {
    throw `Oups... \u{1F37B}. An Error occurred while splitting => ${i}`;
  }
};
m();
m();
var Bl = (e) => ({ ...e, tags: e.tags.length ? e.tags : ['default'] }),
  Vl = (e, t) =>
    t.tags.reduce((r, n) => {
      var s, i, a;
      let o = r[n];
      return (
        (r[n] = o
          ? {
              implementation: o.implementation + t.implementation,
              imports: [...o.imports, ...t.imports],
              importsMSW: [...o.importsMSW, ...t.importsMSW],
              implementationMSW: {
                function:
                  o.implementationMSW.function + t.implementationMSW.function,
                handler:
                  o.implementationMSW.handler + t.implementationMSW.handler,
              },
              mutators: t.mutator
                ? [...((s = o.mutators) != null ? s : []), t.mutator]
                : o.mutators,
              formData: t.formData
                ? [...((i = o.formData) != null ? i : []), t.formData]
                : o.formData,
              formUrlEncoded: t.formUrlEncoded
                ? [
                    ...((a = o.formUrlEncoded) != null ? a : []),
                    t.formUrlEncoded,
                  ]
                : o.formUrlEncoded,
            }
          : {
              imports: t.imports,
              importsMSW: t.importsMSW,
              mutators: t.mutator ? [t.mutator] : [],
              formData: t.formData ? [t.formData] : [],
              formUrlEncoded: t.formUrlEncoded ? [t.formUrlEncoded] : [],
              implementation: t.implementation,
              implementationMSW: {
                function: t.implementationMSW.function,
                handler: t.implementationMSW.handler,
              },
            }),
        r
      );
    }, e),
  It = (e, t) => {
    let r = t.client === Q.ANGULAR,
      n = Object.values(e)
        .map(Bl)
        .reduce((o, s, i, a) => {
          let p = Vl(o, s);
          return i === a.length - 1
            ? Object.entries(p).reduce((u, [c, l]) => {
                var S, w, T, R, P;
                let d = !!(
                    (S = l.mutators) != null &&
                    S.some((v) => (r ? v.hasThirdArg : v.hasSecondArg))
                  ),
                  g = Object.values(e)
                    .filter(({ tags: v }) => v.includes(c))
                    .map(({ operationName: v }) => v),
                  f =
                    (R =
                      (T =
                        (w = t.packageJson) == null
                          ? void 0
                          : w.dependencies) == null
                        ? void 0
                        : T.typescript) != null
                      ? R
                      : '4.4.0',
                  y = _compareversions.compare.call(void 0, f, '4.5.0', '>='),
                  h = jt({
                    outputClient: t.client,
                    title: b(c),
                    customTitleFunc: t.override.title,
                  }),
                  x = Tt({
                    outputClient: t == null ? void 0 : t.client,
                    operationNames: g,
                    hasMutator: !!((P = l.mutators) != null && P.length),
                    hasAwaitedType: y,
                    titles: h,
                  }),
                  $ = wt({
                    outputClient: t.client,
                    isRequestOptions: t.override.requestOptions !== !1,
                    isMutator: d,
                    isGlobalMutator: !!t.override.mutator,
                    provideIn: t.override.angular.provideIn,
                    hasAwaitedType: y,
                    titles: h,
                  });
                return (
                  (u[c] = {
                    implementation:
                      $.implementation + l.implementation + x.implementation,
                    implementationMSW: {
                      function: l.implementationMSW.function,
                      handler:
                        $.implementationMSW +
                        l.implementationMSW.handler +
                        x.implementationMSW,
                    },
                    imports: l.imports,
                    importsMSW: l.importsMSW,
                    mutators: l.mutators,
                    formData: l.formData,
                    formUrlEncoded: l.formUrlEncoded,
                  }),
                  u
                );
              }, {})
            : p;
        }, {});
    return Object.entries(n).reduce(
      (o, [s, i]) => (
        (o[s] = {
          ...i,
          implementationMSW:
            i.implementationMSW.function + i.implementationMSW.handler,
        }),
        o
      ),
      {},
    );
  };
var Si = async ({
  operations: e,
  schemas: t,
  info: r,
  output: n,
  specsName: o,
  header: s,
}) => {
  let {
      filename: i,
      dirname: a,
      extension: p,
    } = M(n.target, { backupFilename: j(r.title) }),
    u = It(e, n),
    c = Z(n.tsconfig);
  return (
    await Promise.all(
      Object.entries(u).map(async ([d, g]) => {
        try {
          let {
              imports: f,
              implementation: y,
              implementationMSW: h,
              importsMSW: x,
              mutators: $,
              formData: S,
              formUrlEncoded: w,
            } = g,
            T = s,
            R = s,
            P = n.schemas
              ? '../' + ne(a, M(n.schemas).dirname)
              : '../' + i + '.schemas';
          (T += xe(
            n.client,
            y,
            [{ exports: f, dependency: P }],
            o,
            !!n.schemas,
            c,
            !!n.override.mutator,
          )),
            (R += $e(h, [{ exports: x, dependency: P }], o, !!n.schemas, c));
          let v = n.schemas
            ? void 0
            : _upath.join.call(void 0, a, i + '.schemas' + p);
          if (v) {
            let pe = s + Se(t);
            await _fsextra.outputFile.call(void 0, v, pe);
          }
          $ && (T += z({ mutators: $, implementation: y, oneMore: !0 })),
            S && (T += z({ mutators: S, oneMore: !0 })),
            w && (T += z({ mutators: w, oneMore: !0 })),
            (T += `
${y}`),
            (R += `
${h}`);
          let A = Te(d) + (Q.ANGULAR === n.client ? '.service' : '') + p,
            D = _upath.join.call(void 0, a, Te(d), A);
          await _fsextra.outputFile.call(void 0, D, T);
          let L = n.mock
            ? _upath.join.call(void 0, a, Te(d), Te(d) + '.msw' + p)
            : void 0;
          return (
            L && (await _fsextra.outputFile.call(void 0, L, R)),
            [D, ...(v ? [v] : []), ...(L ? [L] : [])]
          );
        } catch (f) {
          throw `Oups... \u{1F37B}. An Error occurred while splitting tag ${d} => ${f}`;
        }
      }),
    )
  ).flatMap((d) => d);
};
m();
var ji = async ({
  operations: e,
  schemas: t,
  info: r,
  output: n,
  specsName: o,
  header: s,
}) => {
  let {
      filename: i,
      dirname: a,
      extension: p,
    } = M(n.target, { backupFilename: j(r.title) }),
    u = It(e, n),
    c = Z(n.tsconfig);
  return (
    await Promise.all(
      Object.entries(u).map(async ([d, g]) => {
        try {
          let {
              imports: f,
              implementation: y,
              implementationMSW: h,
              importsMSW: x,
              mutators: $,
              formData: S,
              formUrlEncoded: w,
            } = g,
            T = s,
            R = n.schemas ? ne(a, M(n.schemas).dirname) : './' + i + '.schemas';
          (T += xe(
            n.client,
            y,
            [
              {
                exports: f.filter((A) => !x.some((D) => A.name === D.name)),
                dependency: R,
              },
            ],
            o,
            !!n.schemas,
            c,
            !!n.override.mutator,
          )),
            n.mock &&
              (T += $e(h, [{ exports: x, dependency: R }], o, !!n.schemas, c));
          let P = n.schemas
            ? void 0
            : _upath.join.call(void 0, a, i + '.schemas' + p);
          if (P) {
            let A = s + Se(t);
            await _fsextra.outputFile.call(void 0, P, A);
          }
          $ && (T += z({ mutators: $, implementation: y })),
            S && (T += z({ mutators: S })),
            w && (T += z({ mutators: w })),
            (T += `

`),
            (T += y),
            n.mock &&
              ((T += `

`),
              (T += h));
          let v = _upath.join.call(void 0, a, `${Te(d)}${p}`);
          return (
            await _fsextra.outputFile.call(void 0, v, T), [v, ...(P ? [P] : [])]
          );
        } catch (f) {
          throw `Oups... \u{1F37B}. An Error occurred while writing tag ${d} => ${f}`;
        }
      }),
    )
  ).flatMap((d) => d);
};
var Ll = (e, t) => {
    if (!e) return '';
    let r = e(t);
    return Array.isArray(r) ? _({ description: r }) : r;
  },
  Ei = async ({ operations: e, schemas: t, target: r, info: n }, o, s, i) => {
    let { output: a } = s,
      p = i || n.title,
      u = Object.keys(t).reduce((g, f) => {
        let h = Et(f, r).slice(1).split('/').join('-');
        return (g[f] = h), g;
      }, {}),
      c = Ll(a.override.header, n);
    if (a.schemas) {
      let g = a.schemas;
      await Promise.all(
        Object.entries(t).map(([f, y]) => {
          let h = r === f,
            x = h ? g : _upath.join.call(void 0, g, u[f]);
          return bi({
            schemaPath: x,
            schemas: y,
            target: r,
            specsName: u,
            isRootKey: h,
            header: c,
          });
        }),
      );
    }
    let l = [];
    if (a.target)
      switch (a.mode) {
        case ce.SPLIT:
          l = await xi({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
        case ce.TAGS:
          l = await ji({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
        case ce.TAGS_SPLIT:
          l = await Si({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
        case ce.SINGLE:
        default:
          l = await $i({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
      }
    if (a.workspace) {
      let g = a.workspace,
        f = l
          .filter((h) => !h.endsWith('.msw.ts'))
          .map((h) => ne(g, M(h).pathWithoutExtension));
      a.schemas && f.push(ne(g, M(a.schemas).dirname));
      let y = _upath.join.call(void 0, g, '/index.ts');
      if (await _fsextra.pathExists.call(void 0, y)) {
        let h = await _fsextra.readFile.call(void 0, y, 'utf8'),
          x = f.filter(($) => !h.includes($));
        await _fsextra.appendFile.call(
          void 0,
          y,
          _lodashuniq2.default
            .call(void 0, x)
            .map(($) => `export * from '${$}';`).join(`
`) +
            `
`,
        );
      } else
        await _fsextra.outputFile.call(
          void 0,
          y,
          _lodashuniq2.default
            .call(void 0, f)
            .map((h) => `export * from '${h}';`).join(`
`) +
            `
`,
        );
      l = [y, ...l];
    }
    let d = [...(a.schemas ? [M(a.schemas).dirname] : []), ...l];
    if (
      (s.hooks.afterAllFilesWrite &&
        (await hi('afterAllFilesWrite', s.hooks.afterAllFilesWrite, d)),
      a.prettier)
    )
      try {
        await _execa2.default.call(void 0, 'prettier', ['--write', ...d]);
      } catch (e8) {
        _console.log.call(
          void 0,
          _chalk2.default.yellow(
            `\u26A0\uFE0F  ${p ? `${p} - ` : ''}Prettier not found`,
          ),
        );
      }
    dn(p);
  };
m();
var vi = (e) => {
  fn(e), process.exit(1);
};
var Ci = async (e, t, r) => {
    if (t.output.clean) {
      let o = Array.isArray(t.output.clean) ? t.output.clean : [];
      t.output.target &&
        (await Ht(['**/*', '!**/*.d.ts', ...o], M(t.output.target).dirname)),
        t.output.schemas &&
          (await Ht(['**/*', '!**/*.d.ts', ...o], M(t.output.schemas).dirname)),
        q(`${r ? `${r}: ` : ''}Cleaning output folder`);
    }
    let n = await gi(e, t);
    await Ei(n, e, t, r);
  },
  Mi = async (e, t, r) => {
    if (r) {
      let n = e[r];
      if (n)
        try {
          await Ci(t, n, r);
        } catch (o) {
          q(_chalk2.default.red(`\u{1F6D1}  ${r ? `${r} - ` : ''}${o}`));
        }
      else vi('Project not found');
      return;
    }
    return C(
      Object.entries(e),
      async (n, [o, s]) => {
        try {
          n.push(await Ci(t, s, o));
        } catch (i) {
          q(_chalk2.default.red(`\u{1F6D1}  ${o ? `${o} - ` : ''}${i}`));
        }
        return n;
      },
      [],
    );
  },
  Bx = (exports.M = async (e, t) => {
    let {
      path: r,
      file: n,
      error: o,
    } = await ft(e, { defaultFileName: 'orval.config' });
    if (!n) throw `failed to load from ${r} => ${o}`;
    let s = _upath.dirname.call(void 0, r),
      i = await (B(n) ? n() : n),
      a = await C(
        Object.entries(i),
        async (u, [c, l]) => ((u[c] = await Fn(l, s, t)), u),
        {},
      ),
      p = Object.entries(a)
        .filter(
          ([u]) =>
            (t == null ? void 0 : t.projectName) === void 0 ||
            u === (t == null ? void 0 : t.projectName),
        )
        .map(([, { input: u }]) => u.target)
        .filter((u) => G(u));
    (t == null ? void 0 : t.watch) && p.length
      ? Nn(
          t == null ? void 0 : t.watch,
          () => Mi(a, s, t == null ? void 0 : t.projectName),
          p,
        )
      : await Mi(a, s, t == null ? void 0 : t.projectName);
  });
exports.a = Gt;
exports.b = m;
exports.c = G;
exports.d = q;
exports.e = iu;
exports.f = b;
exports.g = j;
exports.h = pu;
exports.i = Te;
exports.j = cu;
exports.k = K;
exports.l = V;
exports.m = F;
exports.n = mt;
exports.o = lt;
exports.p = Yi;
exports.q = Ae;
exports.r = se;
exports.s = yu;
exports.t = Sn;
exports.u = z;
exports.v = Xi;
exports.w = ut;
exports.x = de;
exports.y = Zi;
exports.z = ea;
exports.A = ge;
exports.B = ta;
exports.C = ra;
exports.D = ye;
exports.E = he;
exports.F = Oe;
exports.G = Hf;
exports.H = Fn;
exports.I = Dn;
exports.J = Z;
exports.K = Nn;
exports.L = Ci;
exports.M = Bx;
