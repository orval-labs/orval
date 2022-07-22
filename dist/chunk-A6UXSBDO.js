'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
var Ii = Object.create;
var on = Object.defineProperty;
var Di = Object.getOwnPropertyDescriptor;
var Gi = Object.getOwnPropertyNames;
var qi = Object.getPrototypeOf,
  Fi = Object.prototype.hasOwnProperty;
var W = ((e) =>
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
var Ni = (e, t) => () => (e && (t = e((e = 0))), t);
var E = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var Bi = (e, t, r, n) => {
  if ((t && typeof t == 'object') || typeof t == 'function')
    for (let o of Gi(t))
      !Fi.call(e, o) &&
        o !== r &&
        on(e, o, {
          get: () => t[o],
          enumerable: !(n = Di(t, o)) || n.enumerable,
        });
  return e;
};
var ue = (e, t, r) => (
  (r = e != null ? Ii(qi(e)) : {}),
  Bi(
    t || !e || !e.__esModule
      ? on(r, 'default', { value: e, enumerable: !0 })
      : r,
    e,
  )
);
var m = Ni(() => {});
var sr = E((cO, qo) => {
  m();
  var qp = Object.prototype;
  function Fp(e) {
    var t = e && e.constructor,
      r = (typeof t == 'function' && t.prototype) || qp;
    return e === r;
  }
  qo.exports = Fp;
});
var No = E((mO, Fo) => {
  m();
  function Np(e, t) {
    return function (r) {
      return e(t(r));
    };
  }
  Fo.exports = Np;
});
var Uo = E((lO, Bo) => {
  m();
  var Bp = No(),
    Up = Bp(Object.keys, Object);
  Bo.exports = Up;
});
var Wo = E((uO, Vo) => {
  m();
  var Vp = sr(),
    Wp = Uo(),
    Qp = Object.prototype,
    Hp = Qp.hasOwnProperty;
  function zp(e) {
    if (!Vp(e)) return Wp(e);
    var t = [];
    for (var r in Object(e)) Hp.call(e, r) && r != 'constructor' && t.push(r);
    return t;
  }
  Vo.exports = zp;
});
var ir = E((fO, Qo) => {
  m();
  var _p =
    typeof global == 'object' && global && global.Object === Object && global;
  Qo.exports = _p;
});
var le = E((dO, Ho) => {
  m();
  var Kp = ir(),
    Lp = typeof self == 'object' && self && self.Object === Object && self,
    Yp = Kp || Lp || Function('return this')();
  Ho.exports = Yp;
});
var ar = E((gO, zo) => {
  m();
  var Jp = le(),
    Xp = Jp.Symbol;
  zo.exports = Xp;
});
var Yo = E((yO, Lo) => {
  m();
  var _o = ar(),
    Ko = Object.prototype,
    Zp = Ko.hasOwnProperty,
    ec = Ko.toString,
    Ze = _o ? _o.toStringTag : void 0;
  function tc(e) {
    var t = Zp.call(e, Ze),
      r = e[Ze];
    try {
      e[Ze] = void 0;
      var n = !0;
    } catch (e2) {}
    var o = ec.call(e);
    return n && (t ? (e[Ze] = r) : delete e[Ze]), o;
  }
  Lo.exports = tc;
});
var Xo = E((hO, Jo) => {
  m();
  var rc = Object.prototype,
    nc = rc.toString;
  function oc(e) {
    return nc.call(e);
  }
  Jo.exports = oc;
});
var et = E((OO, ts) => {
  m();
  var Zo = ar(),
    sc = Yo(),
    ic = Xo(),
    ac = '[object Null]',
    pc = '[object Undefined]',
    es = Zo ? Zo.toStringTag : void 0;
  function cc(e) {
    return e == null
      ? e === void 0
        ? pc
        : ac
      : es && es in Object(e)
      ? sc(e)
      : ic(e);
  }
  ts.exports = cc;
});
var pr = E((bO, rs) => {
  m();
  function mc(e) {
    var t = typeof e;
    return e != null && (t == 'object' || t == 'function');
  }
  rs.exports = mc;
});
var cr = E(($O, ns) => {
  m();
  var lc = et(),
    uc = pr(),
    fc = '[object AsyncFunction]',
    dc = '[object Function]',
    gc = '[object GeneratorFunction]',
    yc = '[object Proxy]';
  function hc(e) {
    if (!uc(e)) return !1;
    var t = lc(e);
    return t == dc || t == gc || t == fc || t == yc;
  }
  ns.exports = hc;
});
var ss = E((xO, os) => {
  m();
  var Oc = le(),
    bc = Oc['__core-js_shared__'];
  os.exports = bc;
});
var ps = E((SO, as) => {
  m();
  var mr = ss(),
    is = (function () {
      var e = /[^.]+$/.exec((mr && mr.keys && mr.keys.IE_PROTO) || '');
      return e ? 'Symbol(src)_1.' + e : '';
    })();
  function $c(e) {
    return !!is && is in e;
  }
  as.exports = $c;
});
var lr = E((TO, cs) => {
  m();
  var xc = Function.prototype,
    Sc = xc.toString;
  function Tc(e) {
    if (e != null) {
      try {
        return Sc.call(e);
      } catch (e3) {}
      try {
        return e + '';
      } catch (e4) {}
    }
    return '';
  }
  cs.exports = Tc;
});
var ls = E((wO, ms) => {
  m();
  var wc = cr(),
    jc = ps(),
    Rc = pr(),
    Pc = lr(),
    Ec = /[\\^$.*+?()[\]{}|]/g,
    vc = /^\[object .+?Constructor\]$/,
    Cc = Function.prototype,
    Ac = Object.prototype,
    Mc = Cc.toString,
    kc = Ac.hasOwnProperty,
    Ic = RegExp(
      '^' +
        Mc.call(kc)
          .replace(Ec, '\\$&')
          .replace(
            /hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,
            '$1.*?',
          ) +
        '$',
    );
  function Dc(e) {
    if (!Rc(e) || jc(e)) return !1;
    var t = wc(e) ? Ic : vc;
    return t.test(Pc(e));
  }
  ms.exports = Dc;
});
var fs = E((jO, us) => {
  m();
  function Gc(e, t) {
    return e == null ? void 0 : e[t];
  }
  us.exports = Gc;
});
var Ne = E((RO, ds) => {
  m();
  var qc = ls(),
    Fc = fs();
  function Nc(e, t) {
    var r = Fc(e, t);
    return qc(r) ? r : void 0;
  }
  ds.exports = Nc;
});
var ys = E((PO, gs) => {
  m();
  var Bc = Ne(),
    Uc = le(),
    Vc = Bc(Uc, 'DataView');
  gs.exports = Vc;
});
var Os = E((EO, hs) => {
  m();
  var Wc = Ne(),
    Qc = le(),
    Hc = Wc(Qc, 'Map');
  hs.exports = Hc;
});
var $s = E((vO, bs) => {
  m();
  var zc = Ne(),
    _c = le(),
    Kc = zc(_c, 'Promise');
  bs.exports = Kc;
});
var Ss = E((CO, xs) => {
  m();
  var Lc = Ne(),
    Yc = le(),
    Jc = Lc(Yc, 'Set');
  xs.exports = Jc;
});
var ws = E((AO, Ts) => {
  m();
  var Xc = Ne(),
    Zc = le(),
    em = Xc(Zc, 'WeakMap');
  Ts.exports = em;
});
var Ms = E((MO, As) => {
  m();
  var ur = ys(),
    fr = Os(),
    dr = $s(),
    gr = Ss(),
    yr = ws(),
    Cs = et(),
    Be = lr(),
    js = '[object Map]',
    tm = '[object Object]',
    Rs = '[object Promise]',
    Ps = '[object Set]',
    Es = '[object WeakMap]',
    vs = '[object DataView]',
    rm = Be(ur),
    nm = Be(fr),
    om = Be(dr),
    sm = Be(gr),
    im = Be(yr),
    ve = Cs;
  ((ur && ve(new ur(new ArrayBuffer(1))) != vs) ||
    (fr && ve(new fr()) != js) ||
    (dr && ve(dr.resolve()) != Rs) ||
    (gr && ve(new gr()) != Ps) ||
    (yr && ve(new yr()) != Es)) &&
    (ve = function (e) {
      var t = Cs(e),
        r = t == tm ? e.constructor : void 0,
        n = r ? Be(r) : '';
      if (n)
        switch (n) {
          case rm:
            return vs;
          case nm:
            return js;
          case om:
            return Rs;
          case sm:
            return Ps;
          case im:
            return Es;
        }
      return t;
    });
  As.exports = ve;
});
var Mt = E((kO, ks) => {
  m();
  function am(e) {
    return e != null && typeof e == 'object';
  }
  ks.exports = am;
});
var Ds = E((IO, Is) => {
  m();
  var pm = et(),
    cm = Mt(),
    mm = '[object Arguments]';
  function lm(e) {
    return cm(e) && pm(e) == mm;
  }
  Is.exports = lm;
});
var Ns = E((DO, Fs) => {
  m();
  var Gs = Ds(),
    um = Mt(),
    qs = Object.prototype,
    fm = qs.hasOwnProperty,
    dm = qs.propertyIsEnumerable,
    gm = Gs(
      (function () {
        return arguments;
      })(),
    )
      ? Gs
      : function (e) {
          return um(e) && fm.call(e, 'callee') && !dm.call(e, 'callee');
        };
  Fs.exports = gm;
});
var Us = E((GO, Bs) => {
  m();
  var ym = Array.isArray;
  Bs.exports = ym;
});
var hr = E((qO, Vs) => {
  m();
  var hm = 9007199254740991;
  function Om(e) {
    return typeof e == 'number' && e > -1 && e % 1 == 0 && e <= hm;
  }
  Vs.exports = Om;
});
var Qs = E((FO, Ws) => {
  m();
  var bm = cr(),
    $m = hr();
  function xm(e) {
    return e != null && $m(e.length) && !bm(e);
  }
  Ws.exports = xm;
});
var zs = E((NO, Hs) => {
  m();
  function Sm() {
    return !1;
  }
  Hs.exports = Sm;
});
var Ys = E((tt, Ue) => {
  m();
  var Tm = le(),
    wm = zs(),
    Ls = typeof tt == 'object' && tt && !tt.nodeType && tt,
    _s = Ls && typeof Ue == 'object' && Ue && !Ue.nodeType && Ue,
    jm = _s && _s.exports === Ls,
    Ks = jm ? Tm.Buffer : void 0,
    Rm = Ks ? Ks.isBuffer : void 0,
    Pm = Rm || wm;
  Ue.exports = Pm;
});
var Xs = E((BO, Js) => {
  m();
  var Em = et(),
    vm = hr(),
    Cm = Mt(),
    Am = '[object Arguments]',
    Mm = '[object Array]',
    km = '[object Boolean]',
    Im = '[object Date]',
    Dm = '[object Error]',
    Gm = '[object Function]',
    qm = '[object Map]',
    Fm = '[object Number]',
    Nm = '[object Object]',
    Bm = '[object RegExp]',
    Um = '[object Set]',
    Vm = '[object String]',
    Wm = '[object WeakMap]',
    Qm = '[object ArrayBuffer]',
    Hm = '[object DataView]',
    zm = '[object Float32Array]',
    _m = '[object Float64Array]',
    Km = '[object Int8Array]',
    Lm = '[object Int16Array]',
    Ym = '[object Int32Array]',
    Jm = '[object Uint8Array]',
    Xm = '[object Uint8ClampedArray]',
    Zm = '[object Uint16Array]',
    el = '[object Uint32Array]',
    k = {};
  k[zm] = k[_m] = k[Km] = k[Lm] = k[Ym] = k[Jm] = k[Xm] = k[Zm] = k[el] = !0;
  k[Am] =
    k[Mm] =
    k[Qm] =
    k[km] =
    k[Hm] =
    k[Im] =
    k[Dm] =
    k[Gm] =
    k[qm] =
    k[Fm] =
    k[Nm] =
    k[Bm] =
    k[Um] =
    k[Vm] =
    k[Wm] =
      !1;
  function tl(e) {
    return Cm(e) && vm(e.length) && !!k[Em(e)];
  }
  Js.exports = tl;
});
var ei = E((UO, Zs) => {
  m();
  function rl(e) {
    return function (t) {
      return e(t);
    };
  }
  Zs.exports = rl;
});
var ri = E((rt, Ve) => {
  m();
  var nl = ir(),
    ti = typeof rt == 'object' && rt && !rt.nodeType && rt,
    nt = ti && typeof Ve == 'object' && Ve && !Ve.nodeType && Ve,
    ol = nt && nt.exports === ti,
    Or = ol && nl.process,
    sl = (function () {
      try {
        var e = nt && nt.require && nt.require('util').types;
        return e || (Or && Or.binding && Or.binding('util'));
      } catch (e5) {}
    })();
  Ve.exports = sl;
});
var ii = E((VO, si) => {
  m();
  var il = Xs(),
    al = ei(),
    ni = ri(),
    oi = ni && ni.isTypedArray,
    pl = oi ? al(oi) : il;
  si.exports = pl;
});
var br = E((WO, ai) => {
  m();
  var cl = Wo(),
    ml = Ms(),
    ll = Ns(),
    ul = Us(),
    fl = Qs(),
    dl = Ys(),
    gl = sr(),
    yl = ii(),
    hl = '[object Map]',
    Ol = '[object Set]',
    bl = Object.prototype,
    $l = bl.hasOwnProperty;
  function xl(e) {
    if (e == null) return !0;
    if (
      fl(e) &&
      (ul(e) ||
        typeof e == 'string' ||
        typeof e.splice == 'function' ||
        dl(e) ||
        yl(e) ||
        ll(e))
    )
      return !e.length;
    var t = ml(e);
    if (t == hl || t == Ol) return !e.size;
    if (gl(e)) return !cl(e).length;
    for (var r in e) if ($l.call(e, r)) return !1;
    return !0;
  }
  ai.exports = xl;
});
var Dt = {
  name: 'orval',
  description: 'A swagger client generator for typescript',
  version: '6.9.1',
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
  pe = {
    SINGLE: 'single',
    SPLIT: 'split',
    TAGS: 'tags',
    TAGS_SPLIT: 'tags-split',
  },
  Z = {
    POST: 'post',
    PUT: 'put',
    GET: 'get',
    PATCH: 'patch',
    DELETE: 'delete',
    HEAD: 'head',
  };
m();
var _upath = require('upath');
var M = (e) => Boolean(e.$ref),
  sn = (e) => !_upath.extname.call(void 0, e);
function N(e) {
  return Object.prototype.toString.call(e) === '[object Object]';
}
function D(e) {
  return typeof e == 'string';
}
function an(e) {
  return typeof e == 'number';
}
function Y(e) {
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
var cn = (e) => Object.values(Z).includes(e);
m();
var _chalk = require('chalk');
var _chalk2 = _interopRequireDefault(_chalk);
var _readline = require('readline');
var _readline2 = _interopRequireDefault(_readline);
var q = console.log,
  pu = (exports.e = ({ name: e, version: t, description: r }) =>
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
  Gt = { silent: 0, error: 1, warn: 2, info: 3 },
  ln,
  un,
  qt = 0;
function Wi() {
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
function J(e = 'info', t = {}) {
  let { prefix: r = '[vite]', allowClearScreen: n = !0 } = t,
    o = Gt[e],
    s = n && process.stdout.isTTY && !process.env.CI ? Wi : () => {};
  function i(u, c, l = {}) {
    if (o >= Gt[u]) {
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
        o >= Gt[u] && s();
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
  Qi = 'A|An|And|As|At|But|By|En|For|If|In|Of|On|Or|The|To|Vs?\\.?|Via',
  fe = {
    capitalize: new RegExp('(^|[' + at + '])([' + pt + '])', 'g'),
    pascal: new RegExp('(^|[' + at + '])+([' + pt + ze + '])', 'g'),
    fill: new RegExp('[' + at + ']+(.|$)', 'g'),
    sentence: new RegExp(
      '(^\\s*|[\\?\\!\\.]+"?\\s+"?|,\\s+")([' + pt + '])',
      'g',
    ),
    improper: new RegExp('\\b(' + Qi + ')\\b', 'g'),
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
  zi = (e) => Nt.call(e.charAt(0)) + e.slice(1),
  _i = (e, t, r, n) => t + ' ' + (r ? r + ' ' : '') + n,
  Bt = (e, t = !1, r = !1, n = !1) => {
    if (
      ((e = e == null ? '' : e + ''),
      !n && fe.upper.test(e) && (e = Nt.call(e)),
      !t && !fe.hole.test(e))
    ) {
      var o = ct(e, ' ');
      fe.hole.test(o) && (e = o);
    }
    return !r && !fe.room.test(e) && (e = e.replace(fe.relax, _i)), e;
  },
  On = (e, t, r) => ct(Nt.call(Bt(e, !!t)), t, r),
  b = (exports.f = (e) =>
    ct(
      Bt(e, !1, !0).replace(fe.pascal, (t, r, n) => hn.call(n)),
      '',
      !0,
    )),
  R = (exports.g = (e) => zi(b(e))),
  mu = (exports.h = (e) => On(e, '_', !0)),
  je = (exports.i = (e) => On(e, '-', !0)),
  lu = (exports.j = (e, t, r) => ct(hn.call(Bt(e, !!t, !1, !0)), t, r));
m();
var _esutils = require('esutils');
var _lodashget = require('lodash.get');
var _lodashget2 = _interopRequireDefault(_lodashget);
var _ = (e) => {
    if (!(we(e) || pn(e)))
      return D(e)
        ? `'${e}'`
        : an(e) || Y(e) || B(e)
        ? `${e}`
        : Array.isArray(e)
        ? `[${e.map(_).join(', ')}]`
        : Object.entries(e).reduce((t, [r, n], o, s) => {
            let i = _(n);
            return s.length === 1
              ? `{ ${r}: ${i}, }`
              : o
              ? s.length - 1 === o
                ? t + `${r}: ${i}, }`
                : t + `${r}: ${i}, `
              : `{ ${r}: ${i}, `;
          }, '');
  },
  K = (exports.l = (e, t) => {
    let {
        whitespace: r = '',
        underscore: n = '',
        dot: o = '',
        dash: s = '',
        es5keyword: i = !1,
        special: a = !1,
      } = t != null ? t : {},
      p = e;
    return (
      a !== !0 && (p = p.replace(/[^\w\s.-]/g, '')),
      r !== !0 && (p = p.replace(/[\s]/g, r)),
      n !== !0 && (p = p.replace(/['_']/g, n)),
      o !== !0 && (p = p.replace(/[.]/g, o)),
      s !== !0 && (p = p.replace(/[-]/g, s)),
      i && (p = _esutils.keyword.isKeywordES5(p, !0) ? `_${p}` : p),
      p
    );
  }),
  F = (exports.m = (e, t) =>
    e.length
      ? (t ? e.map((n) => _lodashget2.default.call(void 0, n, t)) : e).join(`,
    `) + ','
      : ''),
  Yi = {
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
      .reduce((r, n) => r + Yi[n], '')),
  lt = (exports.o = (e, t = "'") => e.replace(t, `\\${t}`));
m();
var Ji = ['number', 'string', 'null', 'unknown', 'undefined', 'object', 'blob'],
  Ae = (exports.q = Ji.reduce(
    (e, t) => (e.push(t, `Array<${t}>`, `${t}[]`), e),
    [],
  )),
  oe = (exports.r = [Z.POST, Z.PUT, Z.PATCH, Z.DELETE]),
  Ou = (exports.s =
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
                  } } from '../${_upath.join.call(void 0, p, R(s))}';`
                : `import ${i ? '' : 'type '}{ ${s}${
                    a ? ` as ${a}` : ''
                  } } from './${_upath.join.call(void 0, p, R(s))}';`;
            }
            return `import ${i ? '' : 'type '}{ ${s}${
              a ? ` as ${a}` : ''
            } } from './${R(s)}';`;
          }).join(`
`)
      : '',
  H = (exports.u = ({ mutators: e, implementation: t, oneMore: r }) => {
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
  Zi = (exports.v = ({
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
        Zi({
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
var ea = (e, t, r) =>
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
  ta = (exports.z = ({
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
 ${(p = _(o)) == null ? void 0 : p.slice(1, -1)}`),
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
    let d = oe.includes(s),
      g = d ? ea(t, a, p) : '',
      f = ta({
        response: o,
        queryParams: n == null ? void 0 : n.schema,
        headers: r == null ? void 0 : r.schema,
        requestOptions: i,
        isExactOptionalPropertyTypes: c,
        hasSignal: l,
      }),
      y = f ? `{${f}}` : '';
    return s === Z.DELETE
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
  ra = (exports.B = (e, t, r) =>
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
  na = (exports.C = (e, t) => {
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
    let l = p ? ra(t, i, a) : '',
      d = na(o, n),
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
        ? `{${(n = _(e)) == null ? void 0 : n.slice(1, -1)} ...options}`
        : 'options'
      : N(e)
      ? (r = _(e)) == null
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
var Tn = process.env.ORVAL_DEBUG_FILTER,
  Ut = process.env.DEBUG;
function wn(e, t = {}) {
  let r = _debug2.default.call(void 0, e),
    { onlyWhenFocused: n } = t,
    o = typeof n == 'string' ? n : e;
  return (s, ...i) => {
    (Tn && !s.includes(Tn)) ||
      (n && !(Ut != null && Ut.includes(o))) ||
      r(s, ...i);
  };
}
var A = (
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
  En = wn('orval:file-load'),
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
      ? J(s).error(_chalk2.default.red(`File not found => ${e}`))
      : o
      ? J(s).error(_chalk2.default.red(`File not found => ${o}.{js,mjs,ts}`))
      : J(s).error(_chalk2.default.red('File not found')),
    process.exit(1));
  let g = _upath.normalizeSafe.call(void 0, c),
    f = Wt.get(c);
  if (f) return { path: g, ...f, cached: !0 };
  try {
    let y;
    if (!y && !l && !d)
      try {
        delete W.cache[W.resolve(c)],
          (y = W(c)),
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
      let { code: h } = await ma(
        c,
        d,
        r || _upath.dirname.call(void 0, g),
        i,
        a == null ? void 0 : a.compilerOptions,
      );
      p ? (y = await la(c, h, n)) : (y = h),
        En(`bundled file loaded in ${Date.now() - u}ms`);
    }
    return Wt.set(c, { file: y }), { path: g, file: y };
  } catch (y) {
    return Wt.set(c, { error: y }), { path: g, error: y };
  }
}
async function ma(e, t = !1, r, n, o) {
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
async function la(e, t, r) {
  let n = _path2.default.extname(e),
    o = W.extensions[n];
  (W.extensions[n] = (a, p) => {
    p === e ? a._compile(t, p) : o(a, p);
  }),
    delete W.cache[W.resolve(e)];
  let s = W(e),
    i = r && s.__esModule ? s.default : s;
  return (W.extensions[n] = o), i;
}
async function Qt(e, t) {
  let r = await _globby2.default.call(void 0, e, { cwd: t, absolute: !0 });
  await Promise.all(r.map((n) => _fs2.default.promises.unlink(n)));
}
m();
var _isURL = require('validator/lib/isURL');
var _isURL2 = _interopRequireDefault(_isURL);
var fa = /^https?:\/\/\w+(\.\w+)*(:[0-9]+)?(\/.*)?$/,
  be = (e) => _isURL2.default.call(void 0, e) || fa.test(e);
var _e = {
    schemas: '',
    responses: 'Response',
    parameters: 'Parameter',
    requestBodies: 'Body',
  },
  ha = new RegExp('~1', 'g'),
  $e = (e, t) => {
    let [r, n] = e.split('#'),
      o = n
        .slice(1)
        .split('/')
        .map((p) => p.replace(ha, '/')),
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
      : _upath.resolve.call(void 0, A(t.specKey).dirname, r);
    return { name: b(i) + s, originalName: i, specKey: a, refPaths: o };
  };
m();
var _fsextra = require('fs-extra');
var _inquirer = require('inquirer');
var _inquirer2 = _interopRequireDefault(_inquirer);
m();
var _https = require('https');
var _https2 = _interopRequireDefault(_https);
var Cn = (e, t) =>
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
var Ta = ({ accessToken: e, repo: t, owner: r, branch: n, path: o }) => {
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
  ja = async (e) => {
    var u, c, l, d;
    let t = _upath.join.call(void 0, __dirname, '.githubToken'),
      r = await wa(t),
      [n] = e.split('github.com/').slice(-1),
      [o, s, , i, ...a] = n.split('/'),
      p = a.join('/');
    try {
      let { body: g } = await Cn(
        ...Ta({ accessToken: r, repo: s, owner: o, branch: i, path: p }),
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
      return ja(e.url);
    },
  };
m();
var dt = (e) => e && typeof e == 'object';
function Ee(e, t) {
  return !dt(t) || !dt(e)
    ? e
    : Object.entries(t).reduce((r, [n, o]) => {
        let s = r[n];
        return (
          Array.isArray(s) && Array.isArray(o)
            ? (r[n] = [...s, ...o])
            : dt(s) && dt(o)
            ? (r[n] = Ee(s, o))
            : (r[n] = o),
          r
        );
      }, e);
}
m();
var kn = ({ title: e, description: t, version: r }) => [
  `Generated by ${Dt.name} v${Dt.version} \u{1F37A}`,
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
    return n ? await Promise.resolve().then(() => ue(W(n))) : void 0;
  }
  let r = se(e, t);
  if (_fsextra.existsSync.call(void 0, r))
    return await Promise.resolve().then(() => ue(W(r)));
};
m();
var _tsconfck = require('tsconfck');
var Gn = async (e, t = process.cwd()) => {
    var r, n;
    if (we(e)) {
      let o = await _findup2.default.call(
        void 0,
        ['tsconfig.json', 'jsconfig.json'],
        { cwd: t },
      );
      return o ? (await _tsconfck.parse.call(void 0, o)).tsconfig : void 0;
    }
    if (D(e)) {
      let o = se(e, t);
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
  X = (exports.J = (e) => {
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
function zf(e) {
  return e;
}
var Fn = async (e, t = process.cwd(), r = {}) => {
    var h,
      S,
      $,
      x,
      T,
      w,
      j,
      P,
      C,
      v,
      I,
      G,
      ae,
      Ce,
      L,
      ne,
      We,
      Qe,
      He,
      st,
      it,
      Rr,
      Pr,
      Er,
      vr,
      Cr,
      Ar,
      Mr,
      kr,
      Ir,
      Dr,
      Gr,
      qr,
      Fr,
      Nr,
      Br,
      Ur,
      Vr,
      Wr,
      Qr,
      Hr,
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
      (J().error(_chalk2.default.red('Config require an input')),
      process.exit(1)),
      n.output ||
        (J().error(_chalk2.default.red('Config require an output')),
        process.exit(1));
    let o = D(n.input) ? { target: n.input } : n.input,
      s = D(n.output) ? { target: n.output } : n.output,
      i = se(s.workspace || '', t),
      { clean: a, prettier: p, client: u, mode: c, mock: l, tslint: d } = r,
      g = await Gn(s.tsconfig || r.tsconfig, t),
      f = await In(s.packageJson || r.packageJson, t),
      y = {
        input: {
          target: Aa(o.target, t),
          validation: o.validation || !1,
          override: {
            transformer: se(
              (h = o.override) == null ? void 0 : h.transformer,
              t,
            ),
          },
          converterOptions: (S = o.converterOptions) != null ? S : {},
          parserOptions: Ee(Ca, ($ = o.parserOptions) != null ? $ : {}),
        },
        output: {
          target: se(s.target, i),
          schemas: se(s.schemas, i),
          workspace: s.workspace ? i : void 0,
          client:
            (T = (x = s.client) != null ? x : u) != null
              ? T
              : Q.AXIOS_FUNCTIONS,
          mode: Ma((w = s.mode) != null ? w : c),
          mock: (P = (j = s.mock) != null ? j : l) != null ? P : !1,
          clean: (v = (C = s.clean) != null ? C : a) != null ? v : !1,
          prettier: (G = (I = s.prettier) != null ? I : p) != null ? G : !1,
          tslint: (Ce = (ae = s.tslint) != null ? ae : d) != null ? Ce : !1,
          tsconfig: g,
          packageJson: f,
          headers: (L = s.headers) != null ? L : !1,
          override: {
            ...s.override,
            operations: qn(
              (We = (ne = s.override) == null ? void 0 : ne.operations) != null
                ? We
                : {},
              i,
            ),
            tags: qn(
              (He = (Qe = s.override) == null ? void 0 : Qe.tags) != null
                ? He
                : {},
              i,
            ),
            mutator: Ie(i, (st = s.override) == null ? void 0 : st.mutator),
            formData:
              (Er = Y((it = s.override) == null ? void 0 : it.formData)
                ? (Pr = s.override) == null
                  ? void 0
                  : Pr.formData
                : Ie(i, (Rr = s.override) == null ? void 0 : Rr.formData)) !=
              null
                ? Er
                : !0,
            formUrlEncoded:
              (Mr = Y((vr = s.override) == null ? void 0 : vr.formUrlEncoded)
                ? (Ar = s.override) == null
                  ? void 0
                  : Ar.formUrlEncoded
                : Ie(
                    i,
                    (Cr = s.override) == null ? void 0 : Cr.formUrlEncoded,
                  )) != null
                ? Mr
                : !0,
            header:
              ((kr = s.override) == null ? void 0 : kr.header) === !1
                ? !1
                : B((Ir = s.override) == null ? void 0 : Ir.header)
                ? (Dr = s.override) == null
                  ? void 0
                  : Dr.header
                : kn,
            requestOptions:
              (qr = (Gr = s.override) == null ? void 0 : Gr.requestOptions) !=
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
                  (Vr = (Ur = s.override) == null ? void 0 : Ur.components) ==
                  null
                    ? void 0
                    : Vr.responses) != null
                  ? Wr
                  : {}),
              },
              parameters: {
                suffix: _e.parameters,
                ...((zr =
                  (Hr = (Qr = s.override) == null ? void 0 : Qr.components) ==
                  null
                    ? void 0
                    : Hr.parameters) != null
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
        hooks: n.hooks ? ka(n.hooks) : {},
      };
    return (
      y.input.target ||
        (J().error(_chalk2.default.red('Config require an input target')),
        process.exit(1)),
      !y.output.target &&
        !y.output.schemas &&
        (J().error(
          _chalk2.default.red('Config require an output target or schemas'),
        ),
        process.exit(1)),
      y
    );
  },
  Ca = { validate: !0, resolve: { github: Mn } },
  Ie = (e, t) => {
    var r;
    return N(t)
      ? (t.path ||
          (J().error(_chalk2.default.red('Mutator need a path')),
          process.exit(1)),
        {
          ...t,
          path: _upath.resolve.call(void 0, e, t.path),
          default: (r = t.default || !t.name) != null ? r : !1,
        })
      : D(t)
      ? { path: _upath.resolve.call(void 0, e, t), default: !0 }
      : t;
  },
  Aa = (e, t) => (D(e) && !be(e) ? se(e, t) : e),
  se = (e, t) => (D(e) ? _upath.resolve.call(void 0, t, e) : e),
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
            ...(n ? { transformer: se(n, t) } : {}),
            ...(o ? { mutator: Ie(t, o) } : {}),
            ...(s ? { formData: Y(s) ? s : Ie(t, s) } : {}),
            ...(i ? { formUrlEncoded: Y(i) ? i : Ie(t, i) } : {}),
          },
        ],
      ),
    ),
  Ma = (e) =>
    e
      ? Object.values(pe).includes(e)
        ? e
        : (J().warn(
            _chalk2.default.yellow(`Unknown the provided mode => ${e}`),
          ),
          pe.SINGLE)
      : pe.SINGLE,
  ka = (e) =>
    Object.keys(e).reduce(
      (r, n) =>
        D(e[n])
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
  let { watch: n } = await Promise.resolve().then(() => ue(W('chokidar'))),
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
var ce = (e, t, r) =>
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
    if (D(e)) {
      let n = _upath.resolve.call(void 0, t, e),
        o = await Promise.resolve().then(() => ue(W(n)));
      return r && N(o) && o.default ? o.default : o;
    }
    return Promise.resolve(e);
  } catch (n) {
    throw `Oups... \u{1F37B}. Path: ${e} => ${n}`;
  }
};
m();
m();
var Un = (e) => /[^{]*{[\w*_-]*}.*/.test(e),
  Vn = (e) => {
    let t = e.match(/([^{]*){?([\w*_-]*)}?(.*)/);
    if (!(t != null && t.length)) return e;
    let r = t[1],
      n = K(R(t[2]), { es5keyword: !0, underscore: !0, dash: !0, dot: !0 }),
      o = Un(t[3]) ? Vn(t[3]) : t[3];
    return Un(e) ? `${r}\${${n}}${o}` : `${r}${n}${o}`;
  },
  Wn = (e) =>
    e
      .split('/')
      .reduce(
        (r, n, o) =>
          !n && !o ? r : n.includes('{') ? `${r}/${Vn(n)}` : `${r}/${n}`,
        '',
      );
m();
var U = (e, t, r = []) => {
  var p;
  if ((p = e == null ? void 0 : e.schema) != null && p.$ref) {
    let u = U(e == null ? void 0 : e.schema, t, r);
    return { schema: { ...e, schema: u.schema }, imports: r };
  }
  if (!M(e)) return { schema: e, imports: r };
  let { name: n, originalName: o, specKey: s, refPaths: i } = $e(e.$ref, t),
    a = _lodashget2.default.call(void 0, t.specs[s || t.specKey], i);
  if (!a) throw `Oups... \u{1F37B}. Ref not found: ${e.$ref}`;
  return U(a, { ...t, specKey: s || t.specKey }, [
    ...r,
    { name: n, specKey: s, schemaName: o },
  ]);
};
m();
m();
var Na = [
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
  Qn = () => Na,
  Hn = (e) => {
    let t = K(e);
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

@Injectable(${o ? `{ providedIn: '${Y(o) ? 'root' : o}' }` : ''})
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
  Ba = (
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
    var w, j;
    let g = (p == null ? void 0 : p.requestOptions) !== !1,
      f = (p == null ? void 0 : p.formData) !== !1,
      y = (p == null ? void 0 : p.formUrlEncoded) !== !1,
      h = !!(
        (j = (w = d.tsconfig) == null ? void 0 : w.compilerOptions) != null &&
        j.exactOptionalPropertyTypes
      ),
      S = oe.includes(a),
      $ = Oe({
        formData: u,
        formUrlEncoded: c,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      }),
      x = n.definition.success || 'unknown';
    if ((_t.set(r, `export type ${b(r)}ClientResult = NonNullable<${x}>`), o)) {
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
          isBodyVerb: S,
          isExactOptionalPropertyTypes: h,
        }),
        C = g ? he(p == null ? void 0 : p.requestOptions, o.hasThirdArg) : '',
        v =
          o.bodyTypeName && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation');
      return ` ${r}<TData = ${x}>(
    ${v}
 ${
   g && o.hasThirdArg ? `options?: ThirdParameter<typeof ${o.name}>` : ''
 }) {${$}
      return ${o.name}<TData>(
      ${P},
      this.http,
      ${C});
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
      requestOptions: p == null ? void 0 : p.requestOptions,
      isFormData: f,
      isFormUrlEncoded: y,
      isAngular: !0,
      isExactOptionalPropertyTypes: h,
      hasSignal: !1,
    });
    return ` ${r}<TData = ${x}>(
    ${F(i, 'implementation')} ${
      g
        ? `options?: HttpClientOptions
`
        : ''
    }  ): Observable<TData>  {${$}
    return this.http.${a}<TData>(${T});
  }
`;
  },
  Kn = (e, t) => {
    let r = de(e);
    return { implementation: Ba(e, t), imports: r };
  };
m();
var Ua = [
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
  Kt = (e) => [...(e ? [] : Ua)],
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
    var w, j;
    let g = (p == null ? void 0 : p.requestOptions) !== !1,
      f = (p == null ? void 0 : p.formData) !== !1,
      y = (p == null ? void 0 : p.formUrlEncoded) !== !1,
      h = !!(
        (j = (w = d.tsconfig) == null ? void 0 : w.compilerOptions) != null &&
        j.exactOptionalPropertyTypes
      ),
      S = X(d.tsconfig),
      $ = Oe({
        formData: u,
        formUrlEncoded: c,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      }),
      x = oe.includes(a);
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
          isBodyVerb: x,
          hasSignal: !1,
          isExactOptionalPropertyTypes: h,
        }),
        C = g ? he(p == null ? void 0 : p.requestOptions, o.hasSecondArg) : '';
      yt.set(
        r,
        (I) =>
          `export type ${b(r)}Result = NonNullable<Awaited<ReturnType<${
            I ? `ReturnType<typeof ${I}>['${r}']` : `typeof ${r}`
          }>>>`,
      );
      let v =
        o.bodyTypeName && s.definition
          ? F(i, 'implementation').replace(
              new RegExp(`(\\w*):\\s?${s.definition}`),
              `$1: ${o.bodyTypeName}<${s.definition}>`,
            )
          : F(i, 'implementation');
      return `const ${r} = (
    ${v}
 ${
   g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>,` : ''
 }) => {${$}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${P},
      ${C});
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
    return axios${S ? '' : '.default'}.${a}(${T});
  }
`
    );
  },
  Lt = (e) => {
    let t = K(e);
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
      n = K(R(t[2]), { es5keyword: !0, underscore: !0, dash: !0, dot: !0 }),
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
        (c[l] = M(d)
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
var Wa = (e) => e[0] === '/' && e[e.length - 1] === '/',
  ht = (e = {}, t) => {
    let r = Object.entries(e).find(
      ([n]) =>
        !!(
          (Wa(n) && new RegExp(n.slice(1, n.length - 1)).test(t.name)) ||
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
  me = ({
    schema: e,
    mockOptions: t,
    operationId: r,
    tags: n,
    combine: o,
    context: s,
    imports: i,
  }) => {
    if (M(e)) {
      let { name: p, specKey: u } = $e(e.$ref, s),
        c = {
          ...eo(p, s, u || e.specKey || s.specKey),
          name: p,
          path: e.path,
          isRef: !0,
          specKey: u || e.specKey,
        };
      return {
        ...Ke({
          item: c,
          mockOptions: t,
          operationId: r,
          tags: n,
          combine: o,
          context: s,
          imports: i,
        }),
        type: c.type,
      };
    }
    return {
      ...Ke({
        item: e,
        mockOptions: t,
        operationId: r,
        tags: n,
        combine: o,
        context: s,
        imports: i,
      }),
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
var ro = ({
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
    c =
      M(e) || e.properties
        ? me({
            schema: _lodashomit2.default.call(void 0, e, t),
            combine: { separator: 'allOf', includedProperties: [] },
            mockOptions: r,
            operationId: n,
            tags: o,
            context: i,
            imports: a,
          })
        : void 0;
  return (
    u.push(
      ...((g = c == null ? void 0 : c.includedProperties) != null ? g : []),
    ),
    {
      value: ((f = e[t]) != null ? f : []).reduce((y, h, S, $) => {
        var w, j;
        let x = me({
          schema: {
            ...h,
            name: e.name,
            path: e.path ? e.path : '#',
            specKey: e.specKey,
          },
          combine: {
            separator: t,
            includedProperties:
              t !== 'oneOf'
                ? u
                : (w = c == null ? void 0 : c.includedProperties) != null
                ? w
                : [],
          },
          mockOptions: r,
          operationId: n,
          tags: o,
          context: i,
          imports: a,
        });
        p.push(...x.imports),
          u.push(...((j = x.includedProperties) != null ? j : []));
        let T =
          (c == null ? void 0 : c.value) && t === 'oneOf'
            ? `${x.value.slice(0, -1)},${c.value}}`
            : x.value;
        return !S && !s
          ? x.enums || t === 'oneOf'
            ? $.length === 1
              ? `faker.helpers.arrayElement([${T}])`
              : `faker.helpers.arrayElement([${T},`
            : $.length === 1
            ? x.type !== 'object'
              ? `${T}`
              : `{${T}}`
            : `{${T},`
          : $.length - 1 === S
          ? x.enums || t === 'oneOf'
            ? `${y}${T}${s ? '' : '])'}`
            : `${y}${T}${c != null && c.value ? `,${c.value}` : ''}${
                s ? '' : '}'
              }`
          : T
          ? `${y}${T},`
          : y;
      }, ''),
      imports: p,
      name: e.name,
      includedProperties: u,
    }
  );
};
m();
var De = (e) => (_esutils.keyword.isIdentifierNameES5(e) ? e : `'${e}'`);
var no = ({
  item: e,
  mockOptions: t,
  operationId: r,
  tags: n,
  combine: o,
  context: s,
  imports: i,
}) => {
  if (M(e))
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
      (a += Object.entries(e.properties)
        .map(([c, l]) => {
          if (o != null && o.includedProperties.includes(c)) return;
          let d =
            (t == null ? void 0 : t.required) ||
            (Array.isArray(e.required) ? e.required : []).includes(c);
          if (to(e.path, `\\.${c}\\.`) >= 1) return;
          let g = me({
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
          let f = De(c);
          return !d && !g.overrided
            ? `${f}: faker.helpers.arrayElement([${g.value}, undefined])`
            : `${f}: ${g.value}`;
        })
        .filter(Boolean)
        .join(', ')),
      (a += !o || (o == null ? void 0 : o.separator) === 'oneOf' ? '}' : ''),
      { value: a, imports: p, name: e.name, includedProperties: u }
    );
  }
  if (e.additionalProperties) {
    if (Y(e.additionalProperties))
      return { value: '{}', imports: [], name: e.name };
    let a = me({
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
  return { value: '{}', imports: [], name: e.name };
};
var Ke = ({
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
    ).reduce((h, [S, $]) => (o.includes(S) ? Ee(h, $) : h), {}),
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
        enums: S,
        imports: $,
        name: x,
      } = me({
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
      if (S) {
        if (!M(e.items)) return { value: h, imports: $, name: e.name };
        let T = t.find((j) => x.replace('[]', '') === j.name);
        return {
          value: `faker.helpers.arrayElements(Object.values(${
            (T == null ? void 0 : T.name) || x
          }))`,
          imports: T ? [...$, { ...T, values: !0 }] : $,
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
        S = [];
      if (e.enum) {
        let $ = "['" + e.enum.map((x) => lt(x)).join("','") + "']";
        e.isRef &&
          (($ = `Object.values(${e.name})`),
          (S = [{ name: e.name, values: !0 }])),
          (h = `faker.helpers.arrayElement(${$})`);
      }
      return {
        value: Le(h, e.nullable),
        enums: e.enum,
        name: e.name,
        imports: S,
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
      let s = B(o) ? `(${o})()` : _(o);
      return (
        (r[n] =
          s == null
            ? void 0
            : s.replace(/import_faker.defaults|import_faker.faker/g, 'faker')),
        r
      );
    }, {}),
  _a = (e, t) => {
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
  Ka = (e) => {
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
  La = ({
    operationId: e,
    tags: t,
    response: r,
    mockOptionsWithoutFunc: n,
    transformer: o,
    context: s,
  }) =>
    r.types.success.reduce(
      (i, { value: a, originalSchema: p, imports: u }) => {
        if (!a || Ae.includes(a)) {
          let d = Ka(a);
          return i.definitions.push(o ? o(d, r.definition.success) : d), i;
        }
        if (!p) return i;
        let c = U(p, s),
          l = Ke({
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
  oo = ({
    operationId: e,
    tags: t,
    response: r,
    override: n,
    transformer: o,
    context: s,
  }) => {
    let i = _a(s.specs[s.specKey], n),
      { definitions: a, imports: p } = La({
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
      n = B(r) ? `(${r})()` : _(r);
    return n == null
      ? void 0
      : n.replace(/import_faker.defaults|import_faker.faker/g, 'faker');
  };
var Ya = [
    { exports: [{ name: 'rest', values: !0 }], dependency: 'msw' },
    { exports: [{ name: 'faker', values: !0 }], dependency: '@faker-js/faker' },
  ],
  xe = ({
    implementation: e,
    imports: t,
    specsName: r,
    hasSchemaDir: n,
    isAllowSyntheticDefaultImports: o,
  }) => ut(e, [...Ya, ...t], r, n, o),
  io = (
    { operationId: e, response: t, verb: r, tags: n },
    { pathRoute: o, override: s, context: i },
  ) => {
    var f, y;
    let {
        definitions: a,
        definition: p,
        imports: u,
      } = oo({ operationId: e, tags: n, response: t, override: s, context: i }),
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
var V = {
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
        { name: 'UseQueryStoreResult' },
        { name: 'UseInfiniteQueryStoreResult' },
        { name: 'QueryKey' },
      ],
      dependency: '@sveltestack/svelte-query',
    },
  ],
  ao = (e) => [...(e ? [] : er), ...Xa],
  Za = [
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
  ep = [
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
      dependency: '@tanstack/react-query',
    },
  ],
  po = (e, t) => {
    var o, s, i, a, p, u;
    let r =
        (i =
          (o = t == null ? void 0 : t.dependencies) == null
            ? void 0
            : o['react-query']) != null
          ? i
          : (s = t == null ? void 0 : t.devDependencies) == null
          ? void 0
          : s['react-query'],
      n =
        (u =
          (a = t == null ? void 0 : t.dependencies) == null
            ? void 0
            : a['@tanstack/react-query']) != null
          ? u
          : (p = t == null ? void 0 : t.devDependencies) == null
          ? void 0
          : p['@tanstack/react-query'];
    return [...(e ? [] : er), ...(r && !n ? Za : ep)];
  },
  tp = [
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
  co = (e) => [...(e ? [] : er), ...tp],
  rp = ({ isRequestOptions: e, hasSignal: t }) =>
    e
      ? `options?: AxiosRequestConfig
`
      : t
      ? `signal?: AbortSignal
`
      : '',
  np = (
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
    var P, C;
    let g = c.requestOptions !== !1,
      f = c.formData !== !1,
      y = c.formUrlEncoded !== !1,
      h = !!c.query.signal,
      S = X(d.tsconfig),
      $ = !!(
        (C = (P = d.tsconfig) == null ? void 0 : P.compilerOptions) != null &&
        C.exactOptionalPropertyTypes
      ),
      x = oe.includes(a),
      T = Oe({
        formData: p,
        formUrlEncoded: u,
        body: s,
        isFormData: f,
        isFormUrlEncoded: y,
      });
    if (o) {
      let v = ye({
          route: l,
          body: s,
          headers: e,
          queryParams: t,
          response: n,
          verb: a,
          isFormData: f,
          isFormUrlEncoded: y,
          isBodyVerb: x,
          hasSignal: h,
          isExactOptionalPropertyTypes: $,
        }),
        I =
          (o == null ? void 0 : o.bodyTypeName) && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation'),
        G = g ? he(c.requestOptions, o.hasSecondArg) : '';
      return o.isHook
        ? `export const use${b(r)}Hook = () => {
        const ${r} = ${o.name}<${n.definition.success || 'unknown'}>();

        return (
    ${I}
${
  !x && h
    ? `signal?: AbortSignal,
`
    : ''
} ${
            g && o.hasSecondArg
              ? `options?: SecondParameter<typeof ${o.name}>`
              : ''
          }) => {${T}
        return ${r}(
          ${v},
          ${G});
        }
      }
    `
        : `export const ${r} = (
    ${I}
 ${g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>,` : ''}${
            !x && h
              ? `signal?: AbortSignal
`
              : ''
          }) => {${T}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${v},
      ${G});
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
        isExactOptionalPropertyTypes: $,
        hasSignal: h,
      }),
      j = rp({ isRequestOptions: g, hasSignal: h });
    return `export const ${r} = (
    ${F(i, 'implementation')} ${j} ): Promise<AxiosResponse<${
      n.definition.success || 'unknown'
    }>> => {${T}
    return axios${S ? '' : '.default'}.${a}(${w});
  }
`;
  },
  Zt = { INFINITE: 'infiniteQuery', QUERY: 'query' },
  op = ['getNextPageParam', 'getPreviousPageParam'],
  sp = ({ params: e, options: t, type: r }) => {
    var o;
    if (t === !1) return '';
    let n = N(t)
      ? ` ${
          (o = _(
            _lodashomitby2.default.call(
              void 0,
              t,
              (s, i) => !!(r !== Zt.INFINITE && op.includes(i)),
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
  ip = ({ outputClient: e, type: t, isMutatorHook: r, operationName: n }) => {
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
  ap = ({
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
  pp = ({ isRequestOptions: e, mutator: t }) => {
    if (!e) return '';
    let r = 'const {query: queryOptions';
    return (
      t || (r += ', axios: axiosOptions'),
      t != null && t.hasSecondArg && (r += ', request: requestOptions'),
      (r += '} = options ?? {}'),
      r
    );
  },
  cp = ({ hasQueryParam: e, hasSignal: t }) =>
    !e && !t
      ? ''
      : e
      ? t
        ? '{ signal, pageParam }'
        : '{ pageParam }'
      : '{ signal }',
  mp = ({
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
      S = t
        ? u
            .map(({ name: v }) =>
              v === 'params' ? `{ ${t}: pageParam, ...params }` : v,
            )
            .join(',')
        : i,
      $ = ip({
        outputClient: g,
        type: n,
        isMutatorHook: c == null ? void 0 : c.isHook,
        operationName: o,
      }),
      x = `AxiosError<${d.definition.errors || 'unknown'}>`;
    c &&
      (x = c.hasErrorType
        ? `${c.default ? b(o) : ''}ErrorType<${
            d.definition.errors || 'unknown'
          }>`
        : d.definition.errors || 'unknown');
    let T =
        c != null && c.isHook
          ? `ReturnType<typeof use${b(o)}Hook>`
          : `typeof ${o}`,
      w = mo({
        operationName: o,
        definitions: '',
        mutator: c,
        isRequestOptions: l,
        type: n,
      }),
      j = ap({
        isRequestOptions: l,
        isExactOptionalPropertyTypes: f,
        mutator: c,
        hasSignal: y,
      }),
      P = pp({ isRequestOptions: l, mutator: c }),
      C = cp({
        hasQueryParam: !!t && u.some(({ type: v }) => v === 'queryParam'),
        hasSignal: y,
      });
    return `
export type ${b(e)}QueryResult = NonNullable<Awaited<ReturnType<${T}>>>
export type ${b(e)}QueryError = ${x}

export const ${R(
      `use-${e}`,
    )} = <TData = Awaited<ReturnType<${T}>>, TError = ${x}>(
 ${h} ${w}
  ): ${$} & { queryKey: QueryKey } => {

  ${P}

  const queryKey = queryOptions?.queryKey ?? ${s}(${a});

  ${c != null && c.isHook ? `const ${o} =  use${b(o)}Hook()` : ''}

  const queryFn: QueryFunction<Awaited<ReturnType<${
    c != null && c.isHook ? `ReturnType<typeof use${b(o)}Hook>` : `typeof ${o}`
  }>>> = (${C}) => ${o}(${S}${S ? ', ' : ''}${j});

  const query = ${R(`use-${n}`)}<Awaited<ReturnType<${
      c != null && c.isHook
        ? `ReturnType<typeof use${b(o)}Hook>`
        : `typeof ${o}`
    }>>, TError, TData>(queryKey, queryFn, ${sp({
      params: p,
      options: r,
      type: n,
    })}) as ${$} & { queryKey: QueryKey };

  query.queryKey = queryKey;

  return query;
}
`;
  },
  lp = (
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
    var j, P, C;
    let f = i == null ? void 0 : i.query,
      y = (i == null ? void 0 : i.requestOptions) !== !1,
      h = (j = l[u]) == null ? void 0 : j.query,
      S = !!(
        (C = (P = d.tsconfig) == null ? void 0 : P.compilerOptions) != null &&
        C.exactOptionalPropertyTypes
      );
    if (
      o === Z.GET ||
      (h == null ? void 0 : h.useInfinite) ||
      (h == null ? void 0 : h.useQuery)
    ) {
      let v = n
          .map(({ name: L, type: ne }) =>
            ne === V.BODY ? r.implementation : L,
          )
          .join(','),
        I = n
          .filter((L) => L.type !== V.HEADER)
          .map(({ name: L, type: ne }) =>
            ne === V.BODY ? r.implementation : L,
          )
          .join(','),
        G = [
          ...(f != null && f.useInfinite
            ? [
                {
                  name: R(`${t}-infinite`),
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
        ae = R(`get-${t}-queryKey`),
        Ce = F(
          n.filter((L) => L.type !== V.HEADER),
          'implementation',
        );
      return `export const ${ae} = (${Ce}) => [\`${c}\`${
        e ? ', ...(params ? [params]: [])' : ''
      }${r.implementation ? `, ${r.implementation}` : ''}];

    ${G.reduce(
      (L, ne) =>
        L +
        mp({
          queryOption: ne,
          operationName: t,
          queryKeyFnName: ae,
          queryProperties: v,
          queryKeyProperties: I,
          params: s,
          props: n,
          mutator: a,
          isRequestOptions: y,
          response: p,
          outputClient: g,
          isExactOptionalPropertyTypes: S,
          hasSignal: !!f.signal,
        }),
      '',
    )}
`;
    }
    let $ = n
        .map(({ definition: v, type: I }) =>
          I === V.BODY
            ? a != null && a.bodyTypeName
              ? `data: ${a.bodyTypeName}<${r.definition}>`
              : `data: ${r.definition}`
            : v,
        )
        .join(';'),
      x = n
        .map(({ name: v, type: I }) => (I === V.BODY ? 'data' : v))
        .join(','),
      T = `AxiosError<${p.definition.errors || 'unknown'}>`;
    a &&
      (T = a.hasErrorType
        ? `${a.default ? b(t) : ''}ErrorType<${
            p.definition.errors || 'unknown'
          }>`
        : p.definition.errors || 'unknown');
    let w =
      a != null && a.isHook
        ? `ReturnType<typeof use${b(t)}Hook>`
        : `typeof ${t}`;
    return `
    export type ${b(t)}MutationResult = NonNullable<Awaited<ReturnType<${w}>>>
    ${
      r.definition
        ? `export type ${b(t)}MutationBody = ${
            a != null && a.bodyTypeName
              ? `${a.bodyTypeName}<${r.definition}>`
              : r.definition
          }`
        : ''
    }
    export type ${b(t)}MutationError = ${T}

    export const ${R(`use-${t}`)} = <TError = ${T},
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


      const mutationFn: MutationFunction<Awaited<ReturnType<${w}>>, ${
      $ ? `{${$}}` : 'TVariables'
    }> = (${x ? 'props' : ''}) => {
          ${x ? `const {${x}} = props ?? {}` : ''};

          return  ${t}(${x}${x ? ',' : ''}${
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
      o = np(e, t),
      s = lp(e, t, r);
    return {
      implementation: `${o}

${s}`,
      imports: n,
    };
  };
m();
var up = [
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
  fp = [
    {
      exports: [
        { name: 'useSwr', values: !0, default: !0 },
        { name: 'SWRConfiguration' },
        { name: 'Key' },
      ],
      dependency: 'swr',
    },
  ],
  lo = (e) => [...(e ? [] : up), ...fp],
  dp = (
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
    var w, j;
    let g = (c == null ? void 0 : c.requestOptions) !== !1,
      f = (c == null ? void 0 : c.formData) !== !1,
      y = (c == null ? void 0 : c.formUrlEncoded) !== !1,
      h = !!(
        (j = (w = d.tsconfig) == null ? void 0 : w.compilerOptions) != null &&
        j.exactOptionalPropertyTypes
      ),
      S = oe.includes(a),
      $ = X(d.tsconfig),
      x = Oe({
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
          isBodyVerb: S,
          isExactOptionalPropertyTypes: h,
        }),
        C =
          (o == null ? void 0 : o.bodyTypeName) && s.definition
            ? F(i, 'implementation').replace(
                new RegExp(`(\\w*):\\s?${s.definition}`),
                `$1: ${o.bodyTypeName}<${s.definition}>`,
              )
            : F(i, 'implementation'),
        v = g ? he(c == null ? void 0 : c.requestOptions, o.hasSecondArg) : '';
      return `export const ${r} = (
    ${C}
 ${
   g && o.hasSecondArg ? `options?: SecondParameter<typeof ${o.name}>` : ''
 }) => {${x}
      return ${o.name}<${n.definition.success || 'unknown'}>(
      ${P},
      ${v});
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
      isExactOptionalPropertyTypes: h,
      hasSignal: !1,
    });
    return `export const ${r} = (
    ${F(i, 'implementation')} ${
      g
        ? `options?: AxiosRequestConfig
`
        : ''
    } ): Promise<AxiosResponse<${n.definition.success || 'unknown'}>> => {${x}
    return axios${$ ? '' : '.default'}.${a}(${T});
  }
`;
  },
  gp = ({ operationName: e, mutator: t, isRequestOptions: r }) => {
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
  yp = ({
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

export const ${R(`use-${e}`)} = <TError = ${g}>(
 ${c} ${gp({ operationName: e, mutator: s, isRequestOptions: i })}
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
    ${(f = _(p.options)) == null ? void 0 : f.slice(1, -1)}
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
  hp = (
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
    if (o !== Z.GET) return '';
    let l = n
        .map(({ name: y, type: h }) => (h === V.BODY ? r.implementation : y))
        .join(','),
      d = n
        .filter((y) => y.type !== V.HEADER)
        .map(({ name: y, type: h }) => (h === V.BODY ? r.implementation : y))
        .join(','),
      g = R(`get-${t}-key`),
      f = F(
        n.filter((y) => y.type !== V.HEADER),
        'implementation',
      );
    return `export const ${g} = (${f}) => [\`${u}\`${
      e ? ', ...(params ? [params]: [])' : ''
    }${r.implementation ? `, ${r.implementation}` : ''}];

    ${yp({
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
      n = dp(e, t),
      o = hp(e, t);
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
      dependencies: Qn,
      footer: _n,
      title: Hn,
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
  Se = ({
    client: e = Ye,
    implementation: t,
    imports: r,
    specsName: n,
    hasSchemaDir: o,
    isAllowSyntheticDefaultImports: s,
    hasGlobalMutator: i,
    packageJson: a,
  }) => {
    let { dependencies: p } = Je(e);
    return ut(t, [...p(i, a), ...r], n, o, s);
  },
  Tt = ({
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
  wt = ({
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
  Op = (e, t) =>
    t.mock
      ? B(t.mock)
        ? t.mock(e, t)
        : io(e, t)
      : { implementation: { function: '', handler: '' }, imports: [] },
  Oo = (e = Ye, t, r) =>
    t.reduce((n, o) => {
      let { client: s } = Je(e),
        i = s(o, r, e),
        a = Op(o, r);
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
    }, {});
m();
m();
var bp = '\\*/',
  tr = '*\\/',
  rr = new RegExp(bp, 'g');
function z({ description: e, deprecated: t, summary: r }, n = !1) {
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
var Xe = (e, t, r, n) => {
  let { schema: o, imports: s } = U(t, r),
    i = M(t) ? s[0].name : e,
    a = n ? 'formUrlEncoded' : 'formData',
    p = n
      ? `const ${a} = new URLSearchParams();
`
      : `const ${a} = new FormData();
`;
  if (o.type === 'object' && o.properties) {
    let u = Object.entries(o.properties).reduce((c, [l, d]) => {
      var y;
      let { schema: g } = U(d, r),
        f = '';
      return (
        g.type === 'object'
          ? (f = `${a}.append('${l}', JSON.stringify(${R(i)}${
              l.includes('-') ? `['${l}']` : `.${l}`
            }));
`)
          : g.type === 'array'
          ? (f = `${R(i)}${
              l.includes('-') ? `['${l}']` : `.${l}`
            }.forEach(value => ${a}.append('${l}', value));
`)
          : g.type === 'number' || g.type === 'integer' || g.type === 'boolean'
          ? (f = `${a}.append('${l}', ${R(i)}${
              l.includes('-') ? `['${l}']` : `.${l}`
            }.toString())
`)
          : (f = `${a}.append('${l}', ${R(i)}${
              l.includes('-') ? `['${l}']` : `.${l}`
            })
`),
        (y = o.required) != null && y.includes(l)
          ? c + f
          : c +
            `if(${R(i)}${
              l.includes('-') ? `['${l}']` : `.${l}`
            } !== undefined) {
 ${f} }
`
      );
    }, '');
    return `${p}${u}`;
  }
  return o.type === 'array'
    ? `${p}${R(i)}.forEach(value => ${a}.append('data', value))
`
    : o.type === 'number' || o.type === 'boolean'
    ? `${p}${a}.append('data', ${R(i)}.toString())
`
    : `${p}${a}.append('data', ${R(i)})
`;
};
m();
m();
var Ge = (e, t, r) => {
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
  bo = /[\s]/g,
  Rt = (e, t) =>
    [...new Set(e.split(' | '))].reduce((r, n) => {
      if (n === 'null') return r;
      let o = n.startsWith("'") ? n.slice(1, -1) : n;
      return (
        !Number.isNaN(Number(o)) && (o = xp(o)),
        bo.test(o) && (o = o.replace(bo, '_')),
        r +
          `  ${_esutils.keyword.isIdentifierNameES5(o) ? o : `'${o}'`}: ${n},
`
      );
    }, ''),
  xp = (e) =>
    e[0] === '-'
      ? `NUMBER_MINUS_${e.slice(1)}`
      : e[0] === '+'
      ? `NUMBER_PLUS_${e.slice(1)}`
      : `NUMBER_${e}`;
m();
m();
m();
var $o = ({ schema: e, name: t, context: r }) => {
  if (e.items) {
    let n = ie({ schema: e.items, propName: t + 'Item', context: r });
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
var Tp = ({ resolvedData: e, resolvedValue: t, separator: r }) =>
    e.isEnum.every((o) => o)
      ? `${e.values.join(' | ')}${t ? ` | ${t.value}` : ''}`
      : r === 'allOf'
      ? `${e.values.join(' & ')}${t ? ` & ${t.value}` : ''}`
      : t
      ? `(${e.values.join(` & ${t.value}) | (`)} & ${t.value})`
      : e.values.join(' | '),
  xo = ({ name: e, schema: t, separator: r, context: n, nullable: o }) => {
    var c;
    let s = (c = t[r]) != null ? c : [],
      i = s.reduce(
        (l, d) => {
          let g = e ? e + b(r) : void 0;
          g && l.schemas.length && (g = g + b(mt(l.schemas.length + 1)));
          let f = ie({ schema: d, propName: g, combined: !0, context: n });
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
      (p = te({ schema: _lodashomit2.default.call(void 0, t, r), context: n }));
    let u = Tp({ resolvedData: i, separator: r, resolvedValue: p });
    if (a && e && s.length > 1) {
      let l = `

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ${b(e)} = ${wp(i)}`;
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
  wp = ({ values: e, isRef: t, types: r }) =>
    e.length === 1
      ? t[0]
        ? e[0]
        : `{${Rt(e[0], r[0])}} as const`
      : `{${e
          .map((o, s) => (t[s] ? `...${o},` : Rt(o, r[s])))
          .join('')}} as const`;
var So = ({ item: e, name: t, context: r, nullable: n }) => {
  var o, s;
  if (M(e)) {
    let { name: i, specKey: a } = $e(e.$ref, r);
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
    return xo({ schema: e, name: t, separator: i, context: r, nullable: n });
  }
  if (e.properties && Object.entries(e.properties).length > 0)
    return Object.entries(e.properties).reduce(
      (i, [a, p], u, c) => {
        var S, $, x;
        let l = (Array.isArray(e.required) ? e.required : []).includes(a),
          d = t ? b(t) + b(a) : void 0;
        !!(
          (x =
            ($ = (S = r.specs[r.target]) == null ? void 0 : S.components) ==
            null
              ? void 0
              : $.schemas) != null && x[d || '']
        ) && (d = d + 'Property');
        let f = ie({ schema: p, propName: d, context: r }),
          y = e.readOnly || p.readOnly;
        u || (i.value += '{');
        let h = z(p, !0);
        if (
          (i.imports.push(...f.imports),
          (i.value += `
  ${h ? `${h}  ` : ''}${y ? 'readonly ' : ''}${De(a)}${l ? '' : '?'}: ${
            f.value
          };`),
          i.schemas.push(...f.schemas),
          c.length - 1 === u)
        ) {
          if (e.additionalProperties)
            if (Y(e.additionalProperties))
              i.value += `
  [key: string]: any;
 }`;
            else {
              let T = te({
                schema: e.additionalProperties,
                name: t,
                context: r,
              });
              i.value += `
  [key: string]: ${T.value};
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
    if (Y(e.additionalProperties))
      return {
        value: '{ [key: string]: any }' + n,
        imports: [],
        schemas: [],
        isEnum: !1,
        type: 'object',
        isRef: !1,
      };
    let i = te({ schema: e.additionalProperties, name: t, context: r });
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
var Pt = ({ item: e, name: t, context: r }) => {
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
      let { value: o, ...s } = $o({ schema: e, name: t, context: r });
      return { value: o + n, ...s };
    }
    case 'string': {
      let o = 'string',
        s = !1;
      return (
        e.enum &&
          ((o = `'${e.enum
            .map((i) => (D(i) ? lt(i) : i))
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
      let { value: o, ...s } = So({
        item: e,
        name: t,
        context: r,
        nullable: n,
      });
      return { value: o, ...s };
    }
  }
};
var te = ({ schema: e, name: t, context: r }) => {
  if (M(e)) {
    let { schema: o, imports: s } = U(e, r),
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
    ...Pt({ item: e, name: t, context: r }),
    originalSchema: e,
    isRef: !1,
  };
};
var ie = ({ schema: e, propName: t, combined: r = !1, context: n }) => {
  var i;
  let o = te({ schema: e, name: t, context: n }),
    s = z((i = o.originalSchema) != null ? i : {});
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
    let a = Ge(o.value, o.type, t);
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
var To = ['multipart/form-data'],
  wo = ['application/x-www-form-urlencoded'],
  Pp = ({ mediaType: e, propName: t, context: r }) => {
    if (!e.schema) return;
    let n = new (0, _redoc.OpenAPIParser)(r.specs[r.specKey]);
    return (
      (e.schema = qe(n, e.schema)),
      ie({ schema: e.schema, propName: t, context: r })
    );
  },
  Fe = (e, t, r, n = 'unknown') => {
    let o = e
      .filter(([s, i]) => Boolean(i))
      .map(([s, i]) => {
        var a, p;
        if (M(i)) {
          let {
              schema: u,
              imports: [{ name: c, specKey: l, schemaName: d }],
            } = U(i, r),
            [g, f] =
              (p = Object.entries((a = u.content) != null ? a : {})[0]) != null
                ? p
                : [],
            y = To.includes(g),
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
          let S = y
              ? Xe(c, f == null ? void 0 : f.schema, {
                  ...r,
                  specKey: l || r.specKey,
                })
              : void 0,
            $ = h
              ? Xe(
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
              formData: S,
              formUrlEncoded: $,
              isRef: !0,
              originalSchema: f == null ? void 0 : f.schema,
              key: s,
              contentType: g,
            },
          ];
        }
        return i.content
          ? Object.entries(i.content)
              .map(([c, l], d, g) => {
                let f = s ? b(t) + b(s) : void 0;
                f && g.length > 1 && (f = f + b(mt(d + 1)));
                let y = Pp({ mediaType: l, propName: f, context: r });
                if (!y) return;
                let h = To.includes(c),
                  S = wo.includes(c);
                if ((!h && !S) || !f) return { ...y, contentType: c };
                let $ = h ? Xe(f, l.schema, r) : void 0,
                  x = S ? Xe(f, l.schema, r, !0) : void 0;
                return { ...y, formData: $, formUrlEncoded: x, contentType: c };
              })
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
      });
    return _lodashuniqby2.default.call(
      void 0,
      o.flatMap((s) => s),
      'value',
    );
  };
var jo = ({ requestBody: e, operationName: t, context: r, contentType: n }) => {
  let o = Fe([[r.override.components.requestBodies.suffix, e]], t, r),
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
        ? R(t) + r.override.components.requestBodies.suffix
        : R(p);
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
var Ro = (e, t, r) =>
  e.operationId
    ? e.operationId
    : b(
        [
          r,
          ...t
            .split('/')
            .map((n) =>
              K(n, { dash: !0, underscore: '-', dot: '-', whitespace: '-' }),
            ),
        ].join('-'),
      );
m();
var Po = ({ parameters: e = [], context: t }) =>
  e.reduce(
    (r, n) => {
      if (M(n)) {
        let { schema: o, imports: s } = U(n, t);
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
var Ep = (e) => {
    let t,
      r = [],
      n = /\{(.*?)\}/g;
    for (; (t = n.exec(e)) !== null; ) r.push(t[1]);
    return r;
  },
  Eo = ({ route: e, pathParams: t = [], operationId: r, context: n }) =>
    Ep(e).map((s) => {
      let i = t.find(
        ({ parameter: f }) =>
          K(R(f.name), { es5keyword: !0, underscore: !0, dash: !0 }) === s,
      );
      if (!i)
        throw new Error(
          `The path params ${s} can't be found in parameters (${r})`,
        );
      let { name: a, required: p = !1, schema: u } = i.parameter,
        c = K(R(a), { es5keyword: !0 });
      if (!u)
        return {
          name: c,
          definition: `${c}${p ? '' : '?'}: unknown`,
          implementation: `${c}${p ? '' : '?'}: unknown`,
          default: !1,
          required: p,
          imports: [],
        };
      let l = te({
          schema: u,
          context: {
            ...n,
            ...(i.imports.length ? { specKey: i.imports[0].specKey } : {}),
          },
        }),
        d = `${c}${!p || l.originalSchema.default ? '?' : ''}: ${l.value}`,
        g = `${c}${!p && !l.originalSchema.default ? '?' : ''}${
          l.originalSchema.default
            ? `= ${_(l.originalSchema.default)}`
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
    });
m();
m();
var vo = (e) =>
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
var Co = ({ body: e, queryParams: t, params: r, headers: n }) => {
  let o = {
      name: e.implementation,
      definition: `${e.implementation}: ${e.definition}`,
      implementation: `${e.implementation}: ${e.definition}`,
      default: !1,
      required: !0,
      type: V.BODY,
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
      type: V.QUERY_PARAM,
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
      type: V.HEADER,
    },
    a = [
      ...r.map((u) => ({ ...u, type: V.PARAM })),
      ...(e.definition ? [o] : []),
      ...(t ? [s] : []),
      ...(n ? [i] : []),
    ];
  return vo(a);
};
m();
var vp = (e, t, r) =>
    e.map(({ parameter: n, imports: o }) => {
      let { name: s, required: i, schema: a, content: p } = n,
        {
          value: u,
          imports: c,
          isEnum: l,
          type: d,
          schemas: g,
          isRef: f,
        } = te({
          schema: a || p['application/json'].schema,
          context: r,
          name: b(t) + b(s),
        }),
        y = De(s);
      if (o.length)
        return {
          definition: `${y}${!i || a.default ? '?' : ''}: ${o[0].name}`,
          imports: o,
          schemas: [],
        };
      if (l && !f) {
        let S = b(t) + b(s),
          $ = Ge(u, d, S);
        return {
          definition: `${y}${!i || a.default ? '?' : ''}: ${S}`,
          imports: [{ name: S }],
          schemas: [...g, { name: S, model: $, imports: c }],
        };
      }
      return {
        definition: `${y}${!i || a.default ? '?' : ''}: ${u}`,
        imports: c,
        schemas: g,
      };
    }),
  nr = ({
    queryParams: e = [],
    operationName: t,
    context: r,
    suffix: n = 'params',
  }) => {
    if (!e.length) return;
    let o = vp(e, t, r),
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
var Ao = ({ responses: e, operationName: t, context: r, contentType: n }) => {
  if (!e)
    return {
      imports: [],
      definition: { success: '', errors: '' },
      isBlob: !1,
      types: { success: [], errors: [] },
      schemas: [],
      contentTypes: [],
    };
  let o = Fe(Object.entries(e), t, r, 'void'),
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
var re = (e, t) => {
    let r = _upath.relative.call(void 0, e, t);
    return _upath.normalizeSafe.call(void 0, `.${_upath.sep}${r}`);
  },
  Et = (e, t) => {
    if (be(e)) {
      let r = new URL(t);
      return e
        .replace(r.origin, '')
        .replace(A(r.pathname).dirname, '')
        .replace(`.${or(e)}`, '');
    }
    return (
      '/' +
      _upath.normalize
        .call(void 0, _upath.relative.call(void 0, A(t).dirname, e))
        .split('../')
        .join('')
        .replace(`.${or(e)}`, '')
    );
  };
var vt = 'BodyType',
  Io = (e, t) => {
    let r = A(e),
      n = A(t.path),
      { pathWithoutExtension: o } = A(re(r.dirname, n.path));
    return o;
  },
  At = async ({
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
        S = Dp(g, h);
      S ||
        (J().error(
          _chalk2.default.red(
            `Your mutator file doesn't have the ${h} exported function`,
          ),
        ),
        process.exit(1));
      let $ = Io(e, t);
      return {
        name: i,
        path: $,
        default: s,
        hasErrorType: u,
        errorTypeName: l,
        hasSecondArg: S.numberOfParams > 1,
        hasThirdArg: S.numberOfParams > 2,
        isHook:
          !!(
            (y = t == null ? void 0 : t.name) != null && y.startsWith('use')
          ) && !S.numberOfParams,
        ...(c ? { bodyTypeName: d } : {}),
      };
    } else {
      let h = Io(e, t);
      return (
        f ||
          J().warn(
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
  Dp = (e, t) => {
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
        if (s.expression.right.name) return Ct(o, s.expression.right.name);
        let a =
          (n = s.expression.right) == null
            ? void 0
            : n.properties.find((p) => p.key.name === t);
        return a.value.name
          ? Ct(o, a.value.name)
          : a.value.type === 'FunctionExpression' ||
            a.value.type === 'ArrowFunctionExpression'
          ? { numberOfParams: a.value.params.length }
          : void 0;
      }
      let i = s.expression.arguments[1].properties.find((a) => {
        var p;
        return ((p = a.key) == null ? void 0 : p.name) === t;
      });
      return Ct(o, i.value.body.name);
    } catch (e7) {
      return;
    }
  },
  Ct = (e, t) => {
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
      ? Ct(e, n.init.name)
      : { numberOfParams: n.init.params.length };
  };
var Gp = async ({
    verb: e,
    output: t,
    operation: r,
    route: n,
    verbParameters: o = [],
    context: s,
  }) => {
    var Qe;
    let {
        responses: i,
        requestBody: a,
        parameters: p,
        tags: u = [],
        deprecated: c,
        description: l,
        summary: d,
      } = r,
      g = Ro(r, n, e),
      f = t.override.operations[r.operationId],
      y = Object.entries(t.override.tags).reduce(
        (He, [st, it]) => (u.includes(st) ? Ee(He, it) : He),
        {},
      ),
      h = { ...t.override, ...y, ...f },
      S =
        (f == null ? void 0 : f.operationName) ||
        ((Qe = t.override) == null ? void 0 : Qe.operationName),
      $ = S ? S(r, n, e) : R(g),
      x = K($, { es5keyword: !0 }),
      T = Ao({
        responses: i,
        operationName: x,
        context: s,
        contentType: h.contentType,
      }),
      w = jo({
        requestBody: a,
        operationName: x,
        context: s,
        contentType: h.contentType,
      }),
      j = Po({ parameters: [...o, ...(p != null ? p : [])], context: s }),
      P = nr({ queryParams: j.query, operationName: x, context: s }),
      C = t.headers
        ? await nr({
            queryParams: j.header,
            operationName: x,
            context: s,
            suffix: 'headers',
          })
        : void 0,
      v = Eo({ route: n, pathParams: j.path, operationId: g, context: s }),
      I = Co({ body: w, queryParams: P, params: v, headers: C }),
      G = await At({
        output: t.target,
        name: x,
        mutator: h == null ? void 0 : h.mutator,
        workspace: s.workspace,
        tsconfig: s.tsconfig,
      }),
      ae =
        D(h == null ? void 0 : h.formData) || N(h == null ? void 0 : h.formData)
          ? await At({
              output: t.target,
              name: x,
              mutator: h.formData,
              workspace: s.workspace,
              tsconfig: s.tsconfig,
            })
          : void 0,
      Ce =
        D(h == null ? void 0 : h.formUrlEncoded) ||
        N(h == null ? void 0 : h.formUrlEncoded)
          ? await At({
              output: t.target,
              name: x,
              mutator: h.formUrlEncoded,
              workspace: s.workspace,
              tsconfig: s.tsconfig,
            })
          : void 0,
      L = z({ description: l, deprecated: c, summary: d }),
      ne = {
        verb: e,
        tags: u,
        summary: r.summary,
        operationId: g,
        operationName: x,
        response: T,
        body: w,
        headers: C,
        queryParams: P,
        params: v,
        props: I,
        mutator: G,
        formData: ae,
        formUrlEncoded: Ce,
        override: h,
        doc: L,
      },
      We = await gt(h == null ? void 0 : h.transformer, s.workspace);
    return We ? We(ne) : ne;
  },
  Do = ({ verbs: e, output: t, route: r, context: n }) =>
    ce(
      Object.entries(e),
      async (o, [s, i]) => {
        if (cn(s)) {
          let a = await Gp({
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
  ce(
    Object.entries(t.specs[t.specKey].paths),
    async (r, [n, o]) => {
      let s = Wn(n),
        i = o,
        a = t;
      if (M(o)) {
        let { schema: l, imports: d } = U(o, t);
        (i = l), (a = { ...t, ...(d.length ? { specKey: d[0].specKey } : {}) });
      }
      let p = await Do({ verbs: i, output: e, route: s, context: a }),
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
        c = Oo(e.client, p, {
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
var pi = ue(br());
var $r = (e = {}, t, r) =>
  (0, pi.default)(e)
    ? []
    : Object.entries(e).reduce((n, [o, s]) => {
        let i = Fe([[r, s]], o, t, 'void'),
          a = i.flatMap(({ imports: g }) => g),
          p = i.flatMap(({ schemas: g }) => g),
          u = i.map(({ value: g }) => g).join(' | '),
          c = `${b(o)}${r}`,
          d = `${z(s)}export type ${c} = ${u || 'unknown'};
`;
        return (
          n.push(...p), c !== u && n.push({ name: c, model: d, imports: a }), n
        );
      }, []);
m();
var ci = (e = {}, t, r) =>
  Object.entries(e).reduce((n, [o, s]) => {
    let i = `${b(o)}${r}`,
      { schema: a, imports: p } = U(s, t);
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
    let u = ie({ schema: a.schema, propName: i, context: t }),
      l = `${z(s)}export type ${i} = ${u.value || 'unknown'};
`;
    return (
      n.push(...u.schemas),
      i !== u.value && n.push({ name: i, model: l, imports: u.imports }),
      n
    );
  }, []);
m();
var ui = ue(br());
m();
var mi = (e, t) => {
  var n, o;
  let r = { ...e };
  for (let s of Object.values(r))
    if ((n = s.discriminator) != null && n.mapping) {
      let { mapping: i, propertyName: a } = s.discriminator;
      for (let [p, u] of Object.entries(i)) {
        let c;
        try {
          let { name: l } = $e(u, t);
          c = r[l];
        } catch (e8) {
          c = r[u];
        }
        !c ||
          ((c.properties = {
            ...c.properties,
            [a]: { type: 'string', enum: [p] },
          }),
          (c.required = [...((o = c.required) != null ? o : []), a]));
      }
    }
  return r;
};
m();
var li = ({ name: e, schema: t, context: r, suffix: n }) => {
  var p;
  let o = Pt({ item: t, name: e, context: r }),
    s = o.value === '{}',
    i = '';
  (i += z(t)),
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
var fi = (e = {}, t, r) => {
  if ((0, ui.default)(e)) return [];
  let n = mi(e, t),
    o = new (0, _redoc.OpenAPIParser)(t.specs[t.specKey]);
  return (
    Object.keys(n).forEach((i) => {
      n[i] = qe(o, n[i]);
    }),
    Object.entries(n).reduce((i, [a, p]) => {
      let u = b(a) + r;
      if (
        (!p.type || p.type === 'object') &&
        !p.allOf &&
        !p.oneOf &&
        !p.anyOf &&
        !M(p) &&
        !p.nullable
      )
        return i.push(...li({ name: u, schema: p, context: t, suffix: r })), i;
      {
        let c = te({ schema: p, name: u, context: t }),
          l = '',
          d = c.imports;
        if (((l += z(p)), c.isEnum && !c.isRef)) l += Ge(c.value, c.type, u);
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
    }, [])
  );
};
m();
var _ibmopenapivalidator = require('ibm-openapi-validator');
var _ibmopenapivalidator2 = _interopRequireDefault(_ibmopenapivalidator);
var di = async (e) => {
  let { errors: t, warnings: r } = await _ibmopenapivalidator2.default.call(
    void 0,
    e,
  );
  r.length && gn(r), t.length && yn(t);
};
var jl = async ({ specs: e, input: t, workspace: r }) => {
    var o;
    let n =
      (o = t.override) != null && o.transformer
        ? await gt(t.override.transformer, r)
        : void 0;
    return ce(
      Object.entries(e),
      async (s, [i, a]) => {
        let p = await Bn(a, t.converterOptions, i),
          u = n ? n(p) : p;
        return t.validation && (await di(u)), (s[i] = u), s;
      },
      {},
    );
  },
  xr = async ({ data: e, input: t, output: r, target: n, workspace: o }) => {
    var p;
    let s = await jl({ specs: e, input: t, workspace: o }),
      i = Object.entries(s).reduce((u, [c, l]) => {
        var $, x, T, w, j, P;
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
          g = fi(
            l.openapi
              ? (T = l.components) == null
                ? void 0
                : T.schemas
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
                  ...((x = ($ = l.components) == null ? void 0 : $.schemas) !=
                  null
                    ? x
                    : {}),
                },
            d,
            r.override.components.schemas.suffix,
          ),
          f = $r(
            (w = l.components) == null ? void 0 : w.responses,
            d,
            r.override.components.responses.suffix,
          ),
          y = $r(
            (j = l.components) == null ? void 0 : j.requestBodies,
            d,
            r.override.components.requestBodies.suffix,
          ),
          h = ci(
            (P = l.components) == null ? void 0 : P.parameters,
            d,
            r.override.components.parameters.suffix,
          ),
          S = [...g, ...f, ...y, ...h];
        return S.length && (u[c] = S), u;
      }, {}),
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
var vl = async (e, { validate: t, ...r }, n) => {
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
  yi = async (e, t) => {
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
      s = await vl(r.target, r.parserOptions, o);
    return xr({ data: s, input: r, output: n, target: r.target, workspace: e });
  };
m();
var _execa = require('execa');
var _execa2 = _interopRequireDefault(_execa);
m();
var _stringargv = require('string-argv');
var Oi = async (e, t = [], r = []) => {
  q(_chalk2.default.white(`Running ${e} hook...`));
  for (let n of t)
    if (D(n)) {
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
var Gl = ({
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
var ql = async ({
    path: e,
    schema: t,
    target: r,
    isRootKey: n,
    specsName: o,
    header: s,
  }) => {
    let i = R(t.name);
    try {
      await _fsextra.outputFile.call(
        void 0,
        Sr(e, i),
        Gl({ schema: t, target: r, isRootKey: n, specsName: o, header: s }),
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
  $i = async ({
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
        ql({
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
var Fl = (e, t) =>
    e +
    `${t}
`,
  Te = (e) =>
    Object.values(e)
      .flatMap((r) => r)
      .sort((r, n) => (r.imports.some((o) => o.name === n.name) ? 1 : -1))
      .reduce((r, { model: n }) => Fl(r, n), '');
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
        var l, d, g, f, y, h;
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
          let S = a.mutators.some((j) => (o ? j.hasThirdArg : j.hasSecondArg)),
            $ =
              (h =
                (y =
                  (d = (l = r.packageJson) == null ? void 0 : l.dependencies) ==
                  null
                    ? void 0
                    : d.typescript) != null
                  ? y
                  : (f =
                      (g = r.packageJson) == null
                        ? void 0
                        : g.devDependencies) == null
                  ? void 0
                  : f.typescript) != null
                ? h
                : '4.4.0',
            x = _compareversions.compare.call(void 0, $, '4.5.0', '>='),
            T = Tt({
              outputClient: r.client,
              isRequestOptions: r.override.requestOptions !== !1,
              isMutator: S,
              isGlobalMutator: !!r.override.mutator,
              provideIn: r.override.angular.provideIn,
              hasAwaitedType: x,
              titles: s,
            });
          (a.implementation = T.implementation + a.implementation),
            (a.implementationMSW.handler =
              T.implementationMSW + a.implementationMSW.handler);
          let w = wt({
            outputClient: r == null ? void 0 : r.client,
            operationNames: n,
            hasMutator: !!a.mutators.length,
            hasAwaitedType: x,
            titles: s,
          });
          (a.implementation += w.implementation),
            (a.implementationMSW.handler += w.implementationMSW);
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
var xi = async ({
  operations: e,
  schemas: t,
  info: r,
  output: n,
  specsName: o,
  header: s,
}) => {
  try {
    let { path: i, dirname: a } = A(n.target, { backupFilename: R(r.title) }),
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
      h = n.schemas ? re(a, A(n.schemas).dirname) : void 0,
      S = X(n.tsconfig);
    return (
      (y += Se({
        client: n.client,
        implementation: c,
        imports: h
          ? [
              {
                exports: p.filter(($) => !u.some((x) => $.name === x.name)),
                dependency: h,
              },
            ]
          : [],
        specsName: o,
        hasSchemaDir: !!n.schemas,
        isAllowSyntheticDefaultImports: S,
        hasGlobalMutator: !!n.override.mutator,
        packageJson: n.packageJson,
      })),
      n.mock &&
        (y += xe({
          implementation: l,
          imports: h ? [{ exports: u, dependency: h }] : [],
          specsName: o,
          hasSchemaDir: !!n.schemas,
          isAllowSyntheticDefaultImports: S,
        })),
      d && (y += H({ mutators: d, implementation: c })),
      g && (y += H({ mutators: g })),
      f && (y += H({ mutators: f })),
      n.schemas || (y += Te(t)),
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
var Si = async ({
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
      } = A(n.target, { backupFilename: R(r.title) }),
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
      S = s,
      $ = n.schemas ? re(a, A(n.schemas).dirname) : './' + i + '.schemas',
      x = X(n.tsconfig);
    (h += Se({
      client: n.client,
      implementation: c,
      imports: [{ exports: u, dependency: $ }],
      specsName: o,
      hasSchemaDir: !!n.schemas,
      isAllowSyntheticDefaultImports: x,
      hasGlobalMutator: !!n.override.mutator,
      packageJson: n.packageJson,
    })),
      (S += xe({
        implementation: l,
        imports: [{ exports: d, dependency: $ }],
        specsName: o,
        hasSchemaDir: !!n.schemas,
        isAllowSyntheticDefaultImports: x,
      }));
    let T = n.schemas
      ? void 0
      : _upath.join.call(void 0, a, i + '.schemas' + p);
    if (T) {
      let C = s + Te(t);
      await _fsextra.outputFile.call(
        void 0,
        _upath.join.call(void 0, a, i + '.schemas' + p),
        C,
      );
    }
    g && (h += H({ mutators: g, implementation: c })),
      f && (h += H({ mutators: f })),
      y && (h += H({ mutators: y })),
      (h += `
${c}`),
      (S += `
${l}`);
    let w = i + (Q.ANGULAR === n.client ? '.service' : '') + p,
      j = _upath.join.call(void 0, a, w);
    await _fsextra.outputFile.call(void 0, _upath.join.call(void 0, a, w), h);
    let P = n.mock ? _upath.join.call(void 0, a, i + '.msw' + p) : void 0;
    return (
      P && (await _fsextra.outputFile.call(void 0, P, S)),
      [j, ...(T ? [T] : []), ...(P ? [P] : [])]
    );
  } catch (i) {
    throw `Oups... \u{1F37B}. An Error occurred while splitting => ${i}`;
  }
};
m();
m();
var Vl = (e) => ({ ...e, tags: e.tags.length ? e.tags : ['default'] }),
  Wl = (e, t) =>
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
        .map(Vl)
        .reduce((o, s, i, a) => {
          let p = Wl(o, s);
          return i === a.length - 1
            ? Object.entries(p).reduce((u, [c, l]) => {
                var x, T, w, j, P, C, v, I;
                let d = !!(
                    (x = l.mutators) != null &&
                    x.some((G) => (r ? G.hasThirdArg : G.hasSecondArg))
                  ),
                  g = Object.values(e)
                    .filter(({ tags: G }) => G.includes(c))
                    .map(({ operationName: G }) => G),
                  f =
                    (v =
                      (C =
                        (w =
                          (T = t.packageJson) == null
                            ? void 0
                            : T.dependencies) == null
                          ? void 0
                          : w.typescript) != null
                        ? C
                        : (P =
                            (j = t.packageJson) == null
                              ? void 0
                              : j.devDependencies) == null
                        ? void 0
                        : P.typescript) != null
                      ? v
                      : '4.4.0',
                  y = _compareversions.compare.call(void 0, f, '4.5.0', '>='),
                  h = jt({
                    outputClient: t.client,
                    title: b(c),
                    customTitleFunc: t.override.title,
                  }),
                  S = wt({
                    outputClient: t == null ? void 0 : t.client,
                    operationNames: g,
                    hasMutator: !!((I = l.mutators) != null && I.length),
                    hasAwaitedType: y,
                    titles: h,
                  }),
                  $ = Tt({
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
                      $.implementation + l.implementation + S.implementation,
                    implementationMSW: {
                      function: l.implementationMSW.function,
                      handler:
                        $.implementationMSW +
                        l.implementationMSW.handler +
                        S.implementationMSW,
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
var Ti = async ({
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
    } = A(n.target, { backupFilename: R(r.title) }),
    u = It(e, n),
    c = X(n.tsconfig);
  return (
    await Promise.all(
      Object.entries(u).map(async ([d, g]) => {
        try {
          let {
              imports: f,
              implementation: y,
              implementationMSW: h,
              importsMSW: S,
              mutators: $,
              formData: x,
              formUrlEncoded: T,
            } = g,
            w = s,
            j = s,
            P = n.schemas
              ? '../' + re(a, A(n.schemas).dirname)
              : '../' + i + '.schemas';
          (w += Se({
            client: n.client,
            implementation: y,
            imports: [{ exports: f, dependency: P }],
            specsName: o,
            hasSchemaDir: !!n.schemas,
            isAllowSyntheticDefaultImports: c,
            hasGlobalMutator: !!n.override.mutator,
            packageJson: n.packageJson,
          })),
            (j += xe({
              implementation: h,
              imports: [{ exports: S, dependency: P }],
              specsName: o,
              hasSchemaDir: !!n.schemas,
              isAllowSyntheticDefaultImports: c,
            }));
          let C = n.schemas
            ? void 0
            : _upath.join.call(void 0, a, i + '.schemas' + p);
          if (C) {
            let ae = s + Te(t);
            await _fsextra.outputFile.call(void 0, C, ae);
          }
          $ && (w += H({ mutators: $, implementation: y, oneMore: !0 })),
            x && (w += H({ mutators: x, oneMore: !0 })),
            T && (w += H({ mutators: T, oneMore: !0 })),
            (w += `
${y}`),
            (j += `
${h}`);
          let v = je(d) + (Q.ANGULAR === n.client ? '.service' : '') + p,
            I = _upath.join.call(void 0, a, je(d), v);
          await _fsextra.outputFile.call(void 0, I, w);
          let G = n.mock
            ? _upath.join.call(void 0, a, je(d), je(d) + '.msw' + p)
            : void 0;
          return (
            G && (await _fsextra.outputFile.call(void 0, G, j)),
            [I, ...(C ? [C] : []), ...(G ? [G] : [])]
          );
        } catch (f) {
          throw `Oups... \u{1F37B}. An Error occurred while splitting tag ${d} => ${f}`;
        }
      }),
    )
  ).flatMap((d) => d);
};
m();
var Ri = async ({
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
    } = A(n.target, { backupFilename: R(r.title) }),
    u = It(e, n),
    c = X(n.tsconfig);
  return (
    await Promise.all(
      Object.entries(u).map(async ([d, g]) => {
        try {
          let {
              imports: f,
              implementation: y,
              implementationMSW: h,
              importsMSW: S,
              mutators: $,
              formData: x,
              formUrlEncoded: T,
            } = g,
            w = s,
            j = n.schemas ? re(a, A(n.schemas).dirname) : './' + i + '.schemas';
          (w += Se({
            client: n.client,
            implementation: y,
            imports: [
              {
                exports: f.filter((v) => !S.some((I) => v.name === I.name)),
                dependency: j,
              },
            ],
            specsName: o,
            hasSchemaDir: !!n.schemas,
            isAllowSyntheticDefaultImports: c,
            hasGlobalMutator: !!n.override.mutator,
            packageJson: n.packageJson,
          })),
            n.mock &&
              (w += xe({
                implementation: h,
                imports: [{ exports: S, dependency: j }],
                specsName: o,
                hasSchemaDir: !!n.schemas,
                isAllowSyntheticDefaultImports: c,
              }));
          let P = n.schemas
            ? void 0
            : _upath.join.call(void 0, a, i + '.schemas' + p);
          if (P) {
            let v = s + Te(t);
            await _fsextra.outputFile.call(void 0, P, v);
          }
          $ && (w += H({ mutators: $, implementation: y })),
            x && (w += H({ mutators: x })),
            T && (w += H({ mutators: T })),
            (w += `

`),
            (w += y),
            n.mock &&
              ((w += `

`),
              (w += h));
          let C = _upath.join.call(void 0, a, `${je(d)}${p}`);
          return (
            await _fsextra.outputFile.call(void 0, C, w), [C, ...(P ? [P] : [])]
          );
        } catch (f) {
          throw `Oups... \u{1F37B}. An Error occurred while writing tag ${d} => ${f}`;
        }
      }),
    )
  ).flatMap((d) => d);
};
var Jl = (e, t) => {
    if (!e) return '';
    let r = e(t);
    return Array.isArray(r) ? z({ description: r }) : r;
  },
  vi = async ({ operations: e, schemas: t, target: r, info: n }, o, s, i) => {
    let { output: a } = s,
      p = i || n.title,
      u = Object.keys(t).reduce((g, f) => {
        let h = Et(f, r).slice(1).split('/').join('-');
        return (g[f] = h), g;
      }, {}),
      c = Jl(a.override.header, n);
    if (a.schemas) {
      let g = a.schemas;
      await Promise.all(
        Object.entries(t).map(([f, y]) => {
          let h = r === f,
            S = h ? g : _upath.join.call(void 0, g, u[f]);
          return $i({
            schemaPath: S,
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
        case pe.SPLIT:
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
        case pe.TAGS:
          l = await Ri({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
        case pe.TAGS_SPLIT:
          l = await Ti({
            workspace: o,
            operations: e,
            output: a,
            info: n,
            schemas: t,
            specsName: u,
            header: c,
          });
          break;
        case pe.SINGLE:
        default:
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
      }
    if (a.workspace) {
      let g = a.workspace,
        f = l
          .filter((h) => !h.endsWith('.msw.ts'))
          .map((h) => re(g, A(h).pathWithoutExtension));
      a.schemas && f.push(re(g, A(a.schemas).dirname));
      let y = _upath.join.call(void 0, g, '/index.ts');
      if (await _fsextra.pathExists.call(void 0, y)) {
        let h = await _fsextra.readFile.call(void 0, y, 'utf8'),
          S = f.filter(($) => !h.includes($));
        await _fsextra.appendFile.call(
          void 0,
          y,
          _lodashuniq2.default
            .call(void 0, S)
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
    let d = [...(a.schemas ? [A(a.schemas).dirname] : []), ...l];
    if (
      (s.hooks.afterAllFilesWrite &&
        (await Oi('afterAllFilesWrite', s.hooks.afterAllFilesWrite, d)),
      a.prettier)
    )
      try {
        await _execa2.default.call(void 0, 'prettier', ['--write', ...d]);
      } catch (e9) {
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
var Ci = (e) => {
  fn(e), process.exit(1);
};
var Mi = async (e, t, r) => {
    if (t.output.clean) {
      let o = Array.isArray(t.output.clean) ? t.output.clean : [];
      t.output.target &&
        (await Qt(['**/*', '!**/*.d.ts', ...o], A(t.output.target).dirname)),
        t.output.schemas &&
          (await Qt(['**/*', '!**/*.d.ts', ...o], A(t.output.schemas).dirname)),
        q(`${r ? `${r}: ` : ''}Cleaning output folder`);
    }
    let n = await yi(e, t);
    await vi(n, e, t, r);
  },
  ki = async (e, t, r) => {
    if (r) {
      let n = e[r];
      if (n)
        try {
          await Mi(t, n, r);
        } catch (o) {
          q(_chalk2.default.red(`\u{1F6D1}  ${r ? `${r} - ` : ''}${o}`));
        }
      else Ci('Project not found');
      return;
    }
    return ce(
      Object.entries(e),
      async (n, [o, s]) => {
        try {
          n.push(await Mi(t, s, o));
        } catch (i) {
          q(_chalk2.default.red(`\u{1F6D1}  ${o ? `${o} - ` : ''}${i}`));
        }
        return n;
      },
      [],
    );
  },
  Ix = (exports.M = async (e, t) => {
    let {
      path: r,
      file: n,
      error: o,
    } = await ft(e, { defaultFileName: 'orval.config' });
    if (!n) throw `failed to load from ${r} => ${o}`;
    let s = _upath.dirname.call(void 0, r),
      i = await (B(n) ? n() : n),
      a = await ce(
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
        .filter((u) => D(u));
    (t == null ? void 0 : t.watch) && p.length
      ? Nn(
          t == null ? void 0 : t.watch,
          () => ki(a, s, t == null ? void 0 : t.projectName),
          p,
        )
      : await ki(a, s, t == null ? void 0 : t.projectName);
  });
exports.a = Dt;
exports.b = m;
exports.c = D;
exports.d = q;
exports.e = pu;
exports.f = b;
exports.g = R;
exports.h = mu;
exports.i = je;
exports.j = lu;
exports.k = _;
exports.l = K;
exports.m = F;
exports.n = mt;
exports.o = lt;
exports.p = Ji;
exports.q = Ae;
exports.r = oe;
exports.s = Ou;
exports.t = Sn;
exports.u = H;
exports.v = Zi;
exports.w = ut;
exports.x = de;
exports.y = ea;
exports.z = ta;
exports.A = ge;
exports.B = ra;
exports.C = na;
exports.D = ye;
exports.E = he;
exports.F = Oe;
exports.G = zf;
exports.H = Fn;
exports.I = Gn;
exports.J = X;
exports.K = Nn;
exports.L = Mi;
exports.M = Ix;
