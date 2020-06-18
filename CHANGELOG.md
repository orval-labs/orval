# [2.4.0](https://github.com/anymaniax/orval/compare/v2.3.1...v2.4.0) (2020-06-18)


### Features

* **msw:** implementation ([124d376](https://github.com/anymaniax/orval/commit/124d3769a6549175f79a05eeb2cbcf1ed4141fd4))
* **msw:** samples & readme ([a07c919](https://github.com/anymaniax/orval/commit/a07c91916624bad29cbb54a407fb159471ec3e38))

## [2.3.1](https://github.com/anymaniax/orval/compare/v2.3.0...v2.3.1) (2020-06-13)


### Bug Fixes

* **generator:** types ([30e8d21](https://github.com/anymaniax/orval/commit/30e8d21666303b15d9c1070c859eb00ebef63ab8))

# [2.3.0](https://github.com/anymaniax/orval/compare/v2.2.2...v2.3.0) (2020-06-13)


### Bug Fixes

* **bin:** correctly  handle options ([4b364c1](https://github.com/anymaniax/orval/commit/4b364c1b89e94d71f267b0171d51cdba59dbae30))
* **client-angular:** writer definition name ([177f5c5](https://github.com/anymaniax/orval/commit/177f5c5ed3da45e9070103642f7725c1bc879df2))
* **doc:** update ([31611cd](https://github.com/anymaniax/orval/commit/31611cd4a2113a78b0432bfa9cba230b7221c43a))


### Features

* **bin:** add project command ([f2f4902](https://github.com/anymaniax/orval/commit/f2f490223e1c23737923ed35ef11abc1f5ee4e91))
* **client:** add angular ([918d19d](https://github.com/anymaniax/orval/commit/918d19d0a49ba7a8461a7392d74c64e4e2926c4e))
* **commandline:** use action instead of multiple files ([ef0d17a](https://github.com/anymaniax/orval/commit/ef0d17a883ab47a571ed5e5b7612046b06edb130))
* **config:** handle transformer and mutator function ([dcf2705](https://github.com/anymaniax/orval/commit/dcf270525a35f76d23e9be9e8fda4b17eb12c707))
* **dependencies:** update ([554c842](https://github.com/anymaniax/orval/commit/554c8422ae3ebf09a3b6c1afdc12271051e497e3))
* **generator:** add readonly ([b9b10c8](https://github.com/anymaniax/orval/commit/b9b10c848bc65c10a7c82426b03bd19c75ad712e))

## [2.2.2](https://github.com/anymaniax/orval/compare/v2.2.1...v2.2.2) (2020-05-03)


### Features

* **generator:** add workspace gesture ([9175184](https://github.com/anymaniax/orval/commit/9175184a22095cdebcf5cd241a255558ac6ea1ed))

## [2.2.1](https://github.com/anymaniax/orval/compare/v2.2.0...v2.2.1) (2020-05-03)


### Features

* **generate:** possibility to pass a path ([6f861bd](https://github.com/anymaniax/orval/commit/6f861bd951a2ad9c36118a43f00ab4c7a99ad458))

# [2.2.0](https://github.com/anymaniax/orval/compare/v2.1.2...v2.2.0) (2020-05-03)


### Bug Fixes

* **samples-react:** add dependencies faker and axios ([2d9ba80](https://github.com/anymaniax/orval/commit/2d9ba8099c0a40c952c49290bc7bbd53930c2fc7))
* **tags mode:** add default tag if operation has none ([ad188f5](https://github.com/anymaniax/orval/commit/ad188f5f0c0b05066412f3b6961ffc367e9179bb))
* **tags mode:** interface name was not properly pascal-cased ([f0e87bf](https://github.com/anymaniax/orval/commit/f0e87bf0123815db409ecafe5bd4975d15d31a4c))


### Features

* **case:** implementation ([c57342b](https://github.com/anymaniax/orval/commit/c57342bfad41e51877c4c389ae98ed509ca87e21))
* **orval-command:** deprecated import command and export a generate ([a139fab](https://github.com/anymaniax/orval/commit/a139fab80fcaf9258d1cd9886126dfe5677e3eab))
* **release-it:** setup ([efbb316](https://github.com/anymaniax/orval/commit/efbb316d65259831cc82bb0a333dc972ed5d175f))
* **samples:** add a react app examples ([9fc2999](https://github.com/anymaniax/orval/commit/9fc2999c546bc17871f4f9aebbc19cce30befa87))
* **samples:** update basic ([96b9c0e](https://github.com/anymaniax/orval/commit/96b9c0eb97def76a605f00ec4306f3adec2dc9d0))

### [2.1.2](https://github.com/anymaniax/orval/compare/v2.1.1...v2.1.2) (2020-04-30)

### [2.1.1](https://github.com/anymaniax/orval/compare/v2.1.0...v2.1.1) (2020-04-30)


### Bug Fixes

* **getters-route:** add missing character in path ([94488ab](https://github.com/anymaniax/orval/commit/94488ab77eb94a3843033d1bd6f278a558843302))

## [2.1.0](https://github.com/anymaniax/orval/compare/v2.0.7...v2.1.0) (2020-04-29)


### ⚠ BREAKING CHANGES

* **generator-override:** The transformer function in the override of the orval config have a totally new
functionnality. The old transformer is now named mutator and have the same behavior.

### Features

* **generator-override:** transformer => mutator and add new transformer ([cf601f7](https://github.com/anymaniax/orval/commit/cf601f71ff4147dbd58289a9c506dd37c46c1592))

### [2.0.7](https://github.com/anymaniax/orval/compare/v2.0.6...v2.0.7) (2020-04-29)


### Bug Fixes

* **generator:** correctly handling responses schemas ([5472b9a](https://github.com/anymaniax/orval/commit/5472b9aa8dd10957a5255f83ed607fc55dd7576f))

### [2.0.6](https://github.com/anymaniax/orval/compare/v2.0.5...v2.0.6) (2020-04-28)


### Bug Fixes

* **imports:** return empty string when no imports needed. ([#83](https://github.com/anymaniax/orval/issues/83)) ([bda3d49](https://github.com/anymaniax/orval/commit/bda3d498b4376e74b842f02d588ab1bb59e2a692))

### [2.0.5](https://github.com/anymaniax/orval/compare/v2.0.4...v2.0.5) (2020-04-14)


### Bug Fixes

* **generator:** handle special char params, query, body ([ad3e561](https://github.com/anymaniax/orval/commit/ad3e56154f69a7b3b1d8702f5ad78da6268b2e35))
* **yarn:** lock ([5718b97](https://github.com/anymaniax/orval/commit/5718b97adafe05328e73e9096c27cda173b8b8f4))

### [2.0.4](https://github.com/anymaniax/orval/compare/v2.0.3...v2.0.4) (2020-04-08)


### Bug Fixes

* **generator:** remove useless comma ([f8bad9c](https://github.com/anymaniax/orval/commit/f8bad9cf073dd7ef6a7f31afe19157e7fc463d39))

### [2.0.3](https://github.com/anymaniax/orval/compare/v2.0.2...v2.0.3) (2020-04-07)


### Bug Fixes

* **generator:** props remove type if default value ([89d3d88](https://github.com/anymaniax/orval/commit/89d3d88edfa37719eee84881ad786d55352596ef))

### [2.0.2](https://github.com/anymaniax/orval/compare/v2.0.1...v2.0.2) (2020-04-07)


### Bug Fixes

* **resolver:** path ([831aa2a](https://github.com/anymaniax/orval/commit/831aa2a78c27c809a1ac346d7a2ad5fb80352081))

### [2.0.1](https://github.com/anymaniax/orval/compare/v2.0.0...v2.0.1) (2020-04-06)


### Bug Fixes

* **files:** format ([b94e4a7](https://github.com/anymaniax/orval/commit/b94e4a7d7206c66e680f3bd74750ff01b9776ff1))

## 2.0.0 (2020-04-06)


### Features

* **config-options:** add operations to override an api call ([bc3caa1](https://github.com/anymaniax/orval/commit/bc3caa1fa8bc4d0a2b09bf5204f025b24764f6f5))
* **dependencies:** upgrade ([fe17383](https://github.com/anymaniax/orval/commit/fe17383f043f15ce70deb434a1894317a73fbb3d))
* **dependencies:** upgrade ([df8640d](https://github.com/anymaniax/orval/commit/df8640d3e3fc83d48aa7faa934d4e6f847a62bbe))
* **format:** update ([e939b06](https://github.com/anymaniax/orval/commit/e939b062deedfef0ff763a745db83b4e0b2add63))
* **generator:** better gesture of upload file ([a172e2f](https://github.com/anymaniax/orval/commit/a172e2fe9aa985e1c5d695b6f5f2473af3950652))
* **generator:** create type for child object ([461791a](https://github.com/anymaniax/orval/commit/461791a71c2e7786589ef17baea9e2191906b0fc))
* **generator:** handle default value ([04f7af6](https://github.com/anymaniax/orval/commit/04f7af6f9243bd0a0f38f61719b895838462a345))
* **generator:** possibility to add custom params ([cc2998e](https://github.com/anymaniax/orval/commit/cc2998ed93fdf8135b4086516da2bd266f7eac30))
* **github-template:** add templates for pull requests & issues ([#22](https://github.com/anymaniax/orval/issues/22)) ([0c52de7](https://github.com/anymaniax/orval/commit/0c52de774d530a52ec5a43d3e30f01e724f8083e))
* **lint:** add husky, eslint, prettier ([ec9cfac](https://github.com/anymaniax/orval/commit/ec9cfacc8df3962d281ba67ac5f09ed39d630b67))
* **logs:** centralizes all system logs ([#26](https://github.com/anymaniax/orval/issues/26)) ([8229fda](https://github.com/anymaniax/orval/commit/8229fda2c2b3bc9f67f033b618b42fb4df4fbcd4)), closes [#8](https://github.com/anymaniax/orval/issues/8)
* **mock:** data override ([e926deb](https://github.com/anymaniax/orval/commit/e926deb7ee7e8eb26983721df7894b0a450655c0))
* **mocks:** add regex ([fa4a4a7](https://github.com/anymaniax/orval/commit/fa4a4a7b1b5aa16a0b8dacb0245c57654839aae9))
* **mocks:** first version ([9fe55a1](https://github.com/anymaniax/orval/commit/9fe55a19ea94d7d0c8f80eb62f3c0056ccbf7214))
* **mocks:** override properties ([19f4bd8](https://github.com/anymaniax/orval/commit/19f4bd8a2f360915cd7f41a9ca83a26ba13eafaf))
* **output:** split mode ([#32](https://github.com/anymaniax/orval/issues/32)) ([df45089](https://github.com/anymaniax/orval/commit/df450893fa5778e30b296ea38938a636eaa57d63))
* **output-mode:** add tags mode ([17cc657](https://github.com/anymaniax/orval/commit/17cc6578b8ef58ab70b54e93f0bfd27508048ac6))
* **package:** version 0.0.6 ([0d9f632](https://github.com/anymaniax/orval/commit/0d9f63274cba0237f07a12580f946aeb7ea67d68))
* **publish:** 1.0.2 ([0914775](https://github.com/anymaniax/orval/commit/0914775b02edfccc5ce455a610a0dc5a28fbaf10))
* **release:** version 0.0.14 ([06c4837](https://github.com/anymaniax/orval/commit/06c48372c12e02d6438501e549c4e8347e826e88))
* **rename:** restful-client => orval ([dd5e424](https://github.com/anymaniax/orval/commit/dd5e424328974a2e1be45dcb791d1d9c1e3bbf38))
* **restful-client:** first version ([63a13a1](https://github.com/anymaniax/orval/commit/63a13a1f418bf35bfa0a444c99a87f7e25750c40))
* **transfomer:** examples ([dcf81ff](https://github.com/anymaniax/orval/commit/dcf81fff1790454da20064b5288719c02c177846))
* **types-generation:** better handling of query params ([cb3218e](https://github.com/anymaniax/orval/commit/cb3218e3a0345adeb1e8e238b1656246a7fe6b6a))
* **utils:** add is function ([60810aa](https://github.com/anymaniax/orval/commit/60810aac0f5542bec330dae81670320f65ab3b21))
* **utils:** export sortParams ([38833f5](https://github.com/anymaniax/orval/commit/38833f572613c2188a1f89355bbbd608efa3768b))
* **version:** 1.1.0 ([3c21fa3](https://github.com/anymaniax/orval/commit/3c21fa3d7752bbc941a80008a7e4af25b7fd47b1))
* **version:** 1.1.10 ([f808c89](https://github.com/anymaniax/orval/commit/f808c89532dd63905e0caccf1d2bc65054248474))
* **version:** 1.1.11 ([91f0941](https://github.com/anymaniax/orval/commit/91f094180b781ec2b333bcd5a3195493bdf96400))
* **version:** 1.1.2 ([253b7e3](https://github.com/anymaniax/orval/commit/253b7e301802c83e2cf4b602e1049995440e61ee))
* **version:** 1.1.3 ([df45000](https://github.com/anymaniax/orval/commit/df450007de89a0ac052179d47ef12ea167efa2aa))
* **version:** 1.1.4 ([ff7d510](https://github.com/anymaniax/orval/commit/ff7d510e7bac636419ea71a5e073807759aae343))
* **version:** 1.1.5 ([f4ba9d8](https://github.com/anymaniax/orval/commit/f4ba9d80b78d34135624c7998f42cde2a61cf452))
* **version:** 1.1.6 ([f2bd819](https://github.com/anymaniax/orval/commit/f2bd8190c2d244fec3c6537621e3b4bf0a02c188))
* **version:** 1.1.7 ([96c0873](https://github.com/anymaniax/orval/commit/96c08730b1c59e3a73e4cb9e9b6d94c0ca8f572c))
* **version:** 1.1.8 ([f59319e](https://github.com/anymaniax/orval/commit/f59319eae76103bf11061610d759b81a979586c3))
* **version:** 1.1.9 ([159fc27](https://github.com/anymaniax/orval/commit/159fc27e457fda4a6da422e1d45429452ae33df5))
* **writers:** gesture directory ([621265f](https://github.com/anymaniax/orval/commit/621265f2b987299ed1bcc20b31e5c29fa0d2ce69))


### Bug Fixes

* **architecture:** imports ([3d99c52](https://github.com/anymaniax/orval/commit/3d99c52006a9d86c5151870715a4709d6defdd6d))
* **base:** import ([200ef31](https://github.com/anymaniax/orval/commit/200ef316989dd0a2e15e91902d9d2a27829c683a))
* **base:** line return ([c7757c2](https://github.com/anymaniax/orval/commit/c7757c25c0e41b8194eade6c57f1daa338623183))
* **changelog:** remove useless commit ([abf4fc1](https://github.com/anymaniax/orval/commit/abf4fc144c6d722fab1563ab9c992d2c2c9b084e))
* **danger:** removed ([9b843f5](https://github.com/anymaniax/orval/commit/9b843f5f27f83a5479105953746ffb6b2f3b9e66))
* **dependencies:** add cuid and remove faker dependencies ([1265687](https://github.com/anymaniax/orval/commit/12656879fef2d5409618e6d19bdc8675a13600a5))
* **examples:** paths ([91f0049](https://github.com/anymaniax/orval/commit/91f0049adbe7f5f6845452a3c03cc3e23d3190ad))
* **examples:** update ([08ab5d4](https://github.com/anymaniax/orval/commit/08ab5d44ab40f0262cf27a7f6b5f9e52289683bb))
* **generator:** better handling body ([5391203](https://github.com/anymaniax/orval/commit/5391203be0960fdbe9137f4ae7ef19b431e6af0f))
* **generator:** body with general type ([8d5fd1a](https://github.com/anymaniax/orval/commit/8d5fd1a6545ad861028ac6f9e9442022990fa7dc))
* **generator:** child object type uniq import ([3ef38ea](https://github.com/anymaniax/orval/commit/3ef38eab0a2c8f80e6b280b9ae0c09dbb005fa79))
* **generator:** child object use type instead of interface ([a705905](https://github.com/anymaniax/orval/commit/a705905a93eeb22a22ec280aad20702a88330b85))
* **generator:** correctly handling imports from response type ([9f06e49](https://github.com/anymaniax/orval/commit/9f06e4917d6c465fe113f4daaf61e13f213fb598))
* **generator:** duplicate import ([78f9410](https://github.com/anymaniax/orval/commit/78f9410e2c031e87c67bfc501dbf0f1befdd75cc))
* **generator:** duplicate imports types ([06dd9ce](https://github.com/anymaniax/orval/commit/06dd9ce43b14d26d5c474d95f2c982f093cfc747))
* **generator:** handling enum integer ([9238267](https://github.com/anymaniax/orval/commit/9238267e8d8c6f20eaeaeba8493803cf4231de29))
* **generator:** imports ([01b1933](https://github.com/anymaniax/orval/commit/01b1933d2eec7d75e4ca2b385114f6f57cb436ba))
* **generator:** interface summary ([3684387](https://github.com/anymaniax/orval/commit/368438797ba966e63ba57616e8449b1706c36a3f))
* **generator:** operations add Transformer type ([21570fe](https://github.com/anymaniax/orval/commit/21570fe3b04e26ec19bfa1307299349ceb206d4d))
* **generator:** operations add transformer types ([29d40d7](https://github.com/anymaniax/orval/commit/29d40d727f1d7b58536081407749394c1989c613))
* **generator:** order default ([6cb2d37](https://github.com/anymaniax/orval/commit/6cb2d37db548ebf1d075798dfc15d3f740db2d04))
* **generator:** order props ([35c9524](https://github.com/anymaniax/orval/commit/35c952451e99561b6705fc52ea8ccb7636453dfd))
* **generator:** pathOnly generation with only 1 element in imports array now works ([#20](https://github.com/anymaniax/orval/issues/20)) ([06bef60](https://github.com/anymaniax/orval/commit/06bef6001777061797bc19c426d244a0fcae3453))
* **generator:** remove useless imports ([d93cd4d](https://github.com/anymaniax/orval/commit/d93cd4d4705f4162bf87761672a5ae9dc028328c))
* **generator:** response types ([876047d](https://github.com/anymaniax/orval/commit/876047defedcc88562d483d2a190ca8b674b1ffc))
* **generator:** uniq types ([7d295f2](https://github.com/anymaniax/orval/commit/7d295f236f6c7342fb6d43285536de06a854ca80))
* **generator-api:** remove double query params schemas ([d9d5481](https://github.com/anymaniax/orval/commit/d9d54815e685726fb25dba6e2cebb78ee721cb54))
* **generator-mock:** allOf enums definition ([88a4c4e](https://github.com/anymaniax/orval/commit/88a4c4e9061a370bf45c752d7680033a02a165a5))
* **generators:** add utils filter imports with regex ([875a121](https://github.com/anymaniax/orval/commit/875a12192a1b7a8866fdadf974e17432ea0a1009))
* **gitignore:** remove tsconfig ([927c426](https://github.com/anymaniax/orval/commit/927c4261187adf8955a9dc0d2c06a2e931b3b429))
* **import-types:** filter wrong import ([4034059](https://github.com/anymaniax/orval/commit/4034059609540963883f616cf76e9f83a0135c2b))
* **readme:** update ([4540161](https://github.com/anymaniax/orval/commit/45401615fa65acff42cc20d445c91677f60e213b))
* **readme:** update ([66ad37f](https://github.com/anymaniax/orval/commit/66ad37f92b8ab0db5aa71ee5ba8e20979a7b0ab6))
* **readme:** update ([4f63209](https://github.com/anymaniax/orval/commit/4f632094f2cb712d96a5c529bbd67ad27d37f12e))
* **readme:** update ([5adea5b](https://github.com/anymaniax/orval/commit/5adea5b210c1f3225c994e87c301550113054770))
* **scripts:** build ([283cb18](https://github.com/anymaniax/orval/commit/283cb18cb99707b03e75e92b2533105aaf6cac0f))
* **scripts:** build - clean lib ([53a987d](https://github.com/anymaniax/orval/commit/53a987d378100afc399329645a6176f0650ba980))
* **types:** recursive definition object ([796bad5](https://github.com/anymaniax/orval/commit/796bad5c5098f156fa8e373dbe96916c11c6e4dc))
* **utils:** better handling generalTypesFilter ([49dc761](https://github.com/anymaniax/orval/commit/49dc76158650abf366f7ac14dd3094ea653378b8))
* **writer:** add better comment ([b26c871](https://github.com/anymaniax/orval/commit/b26c87162d3ef5e239bae2377c0ccfb7894a9784))
* **writer:** add comment into generated files ([db3b16e](https://github.com/anymaniax/orval/commit/db3b16e31fa88116dc1f3138d12218469b7249d5))
* **writer:** camelcase files ([c850516](https://github.com/anymaniax/orval/commit/c8505161ee78f14c4dfd6641788e12560a90fec0))
* **writer:** import camelcase ([e3704ec](https://github.com/anymaniax/orval/commit/e3704ecb1d00d985fbc60fe39c83961ca59881e3))
* **writers:** line return ([17c38c0](https://github.com/anymaniax/orval/commit/17c38c0b1a3f47d4a638f1bbec33326b13dbbac7))

### [1.4.9](https://github.com/anymaniax/orval/compare/v1.4.8...v1.4.9) (2020-03-26)


### Bug Fixes

* **generator:** interface summary ([a80ce1a](https://github.com/anymaniax/orval/commit/a80ce1adc18f3307700a21d2531d19b11a22a7a1))

### [1.4.8](https://github.com/anymaniax/orval/compare/v1.4.7...v1.4.8) (2020-03-26)


### Bug Fixes

* **generator:** duplicate import ([03abb55](https://github.com/anymaniax/orval/commit/03abb552d86692d2395d33dd5c6f409f2218c814))

### [1.4.7](https://github.com/anymaniax/orval/compare/v1.4.6...v1.4.7) (2020-03-26)


### Features

* **logs:** centralizes all system logs ([#26](https://github.com/anymaniax/orval/issues/26)) ([6f7d574](https://github.com/anymaniax/orval/commit/6f7d574ad45b37bf009ee51a1154fa3cb23fc469)), closes [#8](https://github.com/anymaniax/orval/issues/8)


### Bug Fixes

* **generator:** better handling body ([e3ef8c1](https://github.com/anymaniax/orval/commit/e3ef8c135b0fc23ae116727cb4a617f04be95594))

### [1.4.6](https://github.com/anymaniax/orval/compare/v1.4.5...v1.4.6) (2020-03-23)


### Features

* **github-template:** add templates for pull requests & issues ([#22](https://github.com/anymaniax/orval/issues/22)) ([04db4d3](https://github.com/anymaniax/orval/commit/04db4d3faa99bde5e7b1635cd4e87a81b2f4e5ce))


### Bug Fixes

* **generator-mock:** allOf enums definition ([78352b5](https://github.com/anymaniax/orval/commit/78352b5a5c5da397564e789c04e5ac9709813b76))
* **types:** recursive definition object ([2494a16](https://github.com/anymaniax/orval/commit/2494a165c3458fc202b251dac7db780b1eb2a04d))

### [1.4.5](https://github.com/anymaniax/orval/compare/v1.4.4...v1.4.5) (2020-03-12)


### Bug Fixes

* **generator:** pathOnly generation with only 1 element in imports array now works ([#20](https://github.com/anymaniax/orval/issues/20)) ([1f53dd2](https://github.com/anymaniax/orval/commit/1f53dd2ffa2026fb55fbddb703de8970a63a8eae))

### [1.4.4](https://github.com/anymaniax/orval/compare/v1.4.3...v1.4.4) (2020-03-11)


### Bug Fixes

* **generator:** child object use type instead of interface ([69027a9](https://github.com/anymaniax/orval/commit/69027a9963d813b03c84ad161ce99fa1610d6dea))

### [1.4.3](https://github.com/anymaniax/orval/compare/v1.4.2...v1.4.3) (2020-03-10)


### Bug Fixes

* **writer:** add better comment ([25d6427](https://github.com/anymaniax/orval/commit/25d6427a3e144c17cfcb44e2b43a580da5ae50e6))

### [1.4.2](https://github.com/anymaniax/orval/compare/v1.4.1...v1.4.2) (2020-03-10)


### Bug Fixes

* **writer:** add comment into generated files ([655c2dd](https://github.com/anymaniax/orval/commit/655c2dd03596fac4c3d779f76f4cf10746f11b2d))

### [1.4.1](https://github.com/anymaniax/orval/compare/v1.4.0...v1.4.1) (2020-03-10)


### Bug Fixes

* **generator:** child object type uniq import ([6838047](https://github.com/anymaniax/orval/commit/6838047bc2b2ee4860edb487a45dac5554063c47))

## [1.4.0](https://github.com/anymaniax/orval/compare/v1.3.2...v1.4.0) (2020-03-10)


### Features

* **generator:** create type for child object ([c2b33f5](https://github.com/anymaniax/orval/commit/c2b33f506d52ea47ec0febc785487d5c2aa9dcc9))

### [1.3.2](https://github.com/anymaniax/orval/compare/v1.3.1...v1.3.2) (2020-03-10)


### Bug Fixes

* **changelog:** remove useless commit ([fbd3d61](https://github.com/anymaniax/orval/commit/fbd3d6162952f79b4409bbc4965b040bf8df1d7e))
* **generator:** operations add Transformer type ([186dc41](https://github.com/anymaniax/orval/commit/186dc4125ed0d69272f89706e80ab2ff1ed59b93))

### [1.3.1](https://github.com/anymaniax/orval/compare/v1.3.0...v1.3.1) (2020-03-10)


### Bug Fixes

* **generator:** operations add transformer types ([44bd798](https://github.com/anymaniax/orval/commit/44bd7981be1a9bf6ec4f67fc38d07043027d5e7a))

## 1.3.0 (2020-03-10)


### Features

* **config-options:** add operations to override an api call ([693e54a](https://github.com/anymaniax/orval/commit/693e54aa20603e0abc3e8454760e49c6d0fbba17))

### 1.2.1 (2020-03-09)


### Bug Fixes

* **generator:** response types ([1418546](https://github.com/anymaniax/orval/commit/1418546b103546d0a262ebdda0131b1b187625bc))

## 1.2.0 (2020-03-05)


### Bug Fixes

* **architecture:** imports ([590f0d1](https://github.com/anymaniax/orval/commit/590f0d178e026a82aab36f200daba0c8cf5db5d7))
* **base:** import ([a890349](https://github.com/anymaniax/orval/commit/a890349575bd8d6f0fa3ddf24db7360db415948a))
* **base:** line return ([b700c30](https://github.com/anymaniax/orval/commit/b700c30c7c61b86e3dd48fbb6917d582e64d7dfe))
* **danger:** removed ([12d5598](https://github.com/anymaniax/orval/commit/12d5598ecc462ed6170fb7dcf9772c4370eee9c5))
* **dependencies:** add cuid and remove faker dependencies ([16c1116](https://github.com/anymaniax/orval/commit/16c111645064d4356a094e4f9243d90f9d6a3ccc))
* **examples:** paths ([c89d400](https://github.com/anymaniax/orval/commit/c89d4004ed3111de407ac9ba3e2734267a857cd4))
* **examples:** update ([d01c2a6](https://github.com/anymaniax/orval/commit/d01c2a63386312d1a3d9e21c23fb8597d2b8f7ff))
* **generator:** body with general type ([8a723fa](https://github.com/anymaniax/orval/commit/8a723fa6a72d9b186a12fbcdeda708433413c2ba))
* **generator:** correctly handling imports from response type ([405f6c4](https://github.com/anymaniax/orval/commit/405f6c49124b99e3b436b4ac77ab114f1cbe2d34))
* **generator:** duplicate imports types ([06dd9ce](https://github.com/anymaniax/orval/commit/06dd9ce43b14d26d5c474d95f2c982f093cfc747))
* **generator:** handling enum integer ([e9dbd36](https://github.com/anymaniax/orval/commit/e9dbd36a20e0234fcf888c52ee00f71db071eb5f))
* **generator:** imports ([01b1933](https://github.com/anymaniax/orval/commit/01b1933d2eec7d75e4ca2b385114f6f57cb436ba))
* **generator:** order default ([6cb2d37](https://github.com/anymaniax/orval/commit/6cb2d37db548ebf1d075798dfc15d3f740db2d04))
* **generator:** order props ([ec2b88b](https://github.com/anymaniax/orval/commit/ec2b88b7d1f2c066dc32e46a24dec873fc824730))
* **generator:** remove useless imports ([0adee8f](https://github.com/anymaniax/orval/commit/0adee8f74434cb94b5d423ea2184f5b160c8be07))
* **generator:** uniq types ([7d295f2](https://github.com/anymaniax/orval/commit/7d295f236f6c7342fb6d43285536de06a854ca80))
* **generators:** add utils filter imports with regex ([dfb2eb5](https://github.com/anymaniax/orval/commit/dfb2eb55184bb12129368256b3e0583205b5136d))
* **gitignore:** remove tsconfig ([1e87596](https://github.com/anymaniax/orval/commit/1e87596a992dc169216a49b869eea9cf397e039d))
* **import-types:** filter wrong import ([4034059](https://github.com/anymaniax/orval/commit/4034059609540963883f616cf76e9f83a0135c2b))
* **readme:** update ([9b57fd5](https://github.com/anymaniax/orval/commit/9b57fd5d996e5d354ffe1c917b6935c13da7803b))
* **scripts:** build ([20bb90d](https://github.com/anymaniax/orval/commit/20bb90d37c96b2434776b4f8bcf2947e71dd9071))
* **scripts:** build - clean lib ([717bc4c](https://github.com/anymaniax/orval/commit/717bc4c91ebde2b8ea16e6c805da3b5457468044))
* **utils:** better handling generalTypesFilter ([93bbd43](https://github.com/anymaniax/orval/commit/93bbd438a1b63b80c613f9886583b51892633532))
* **writer:** camelcase files ([5b3846e](https://github.com/anymaniax/orval/commit/5b3846eedc7699938b77976d80855c26f6ed750e))
* **writer:** import camelcase ([de7fd6e](https://github.com/anymaniax/orval/commit/de7fd6e7c4ddeda7f6be3dd3d5ccbb0977b2b67e))


### Features

* **dependencies:** upgrade ([43def1f](https://github.com/anymaniax/orval/commit/43def1fe63e221caf65f6f831c89675bdf88edb2))
* **dependencies:** upgrade ([21d8bc5](https://github.com/anymaniax/orval/commit/21d8bc50fa3f8dab70f57d480156973701f33296))
* **generator:** better gesture of upload file ([42f7375](https://github.com/anymaniax/orval/commit/42f7375e60e6bb761d9bc4b6ebb417dc9e171e74))
* **generator:** handle default value ([04f7af6](https://github.com/anymaniax/orval/commit/04f7af6f9243bd0a0f38f61719b895838462a345))
* **generator:** possibility to add custom params ([cc2998e](https://github.com/anymaniax/orval/commit/cc2998ed93fdf8135b4086516da2bd266f7eac30))
* **mock:** data override ([d8ad3c9](https://github.com/anymaniax/orval/commit/d8ad3c9c4bb5fcaa7859a366beecc549dfc5f649))
* **mocks:** add regex ([840287c](https://github.com/anymaniax/orval/commit/840287cce36bcc7dd4d7773357fd1033bccfe9d8))
* **mocks:** first version ([d4e36b2](https://github.com/anymaniax/orval/commit/d4e36b2b6ed58bf17b97d2b91b93d9d3b42f6b14))
* **mocks:** override properties ([1852b5c](https://github.com/anymaniax/orval/commit/1852b5cf17819b5b7e9e60e9268e6699e1e8eafc))
* **package:** version 0.0.6 ([0d9f632](https://github.com/anymaniax/orval/commit/0d9f63274cba0237f07a12580f946aeb7ea67d68))
* **publish:** 1.0.2 ([bbcdd77](https://github.com/anymaniax/orval/commit/bbcdd7725daa30f755a740bf896cfec669eb5b3e))
* **release:** version 0.0.14 ([a68a216](https://github.com/anymaniax/orval/commit/a68a216fc367234550e9001578437fb5c1a652b7))
* **rename:** restful-client => orval ([16c6994](https://github.com/anymaniax/orval/commit/16c6994df385d511aec1210bef2a85cf80b8eabf))
* **restful-client:** first version ([63a13a1](https://github.com/anymaniax/orval/commit/63a13a1f418bf35bfa0a444c99a87f7e25750c40))
* **transfomer:** examples ([dcf81ff](https://github.com/anymaniax/orval/commit/dcf81fff1790454da20064b5288719c02c177846))
* **types-generation:** better handling of query params ([0f613ed](https://github.com/anymaniax/orval/commit/0f613edb9be88dfc31426543db5a99eabaaab78a))
* **utils:** export sortParams ([b0db49f](https://github.com/anymaniax/orval/commit/b0db49f2c6345621c136b6de181a8a4d22e66883))
* **version:** 1.1.0 ([b49d3cf](https://github.com/anymaniax/orval/commit/b49d3cf00f9ac5e1d04849ce6b053a0350f38fab))
* **version:** 1.1.10 ([ff434d3](https://github.com/anymaniax/orval/commit/ff434d3efc9a1637bb1effadbc2cdc038728510d))
* **version:** 1.1.11 ([e009c15](https://github.com/anymaniax/orval/commit/e009c15293f73a06705b3786c6bb4d7612a58647))
* **version:** 1.1.2 ([8c50199](https://github.com/anymaniax/orval/commit/8c5019980a3662fc1a81b24d0962cef3169b854f))
* **version:** 1.1.3 ([fe15774](https://github.com/anymaniax/orval/commit/fe157743c6b1db17ec8868db6abbb87309260680))
* **version:** 1.1.4 ([ae989fb](https://github.com/anymaniax/orval/commit/ae989fb11c3a9971d6d8946332a9b6d884c307d4))
* **version:** 1.1.5 ([59e5cf5](https://github.com/anymaniax/orval/commit/59e5cf549d86f393d2e99202373e2cba09bf9892))
* **version:** 1.1.6 ([e6fb26c](https://github.com/anymaniax/orval/commit/e6fb26cb2c119db6f55d32f187cc39fbb72eeae6))
* **version:** 1.1.7 ([4884e7e](https://github.com/anymaniax/orval/commit/4884e7eb6ceed6d3722c99ecd7a93e62290f678f))
* **version:** 1.1.8 ([43bf7a6](https://github.com/anymaniax/orval/commit/43bf7a6e9fd427114d50b2c1ee2a354a8b4b3463))
* **version:** 1.1.9 ([c4d6b21](https://github.com/anymaniax/orval/commit/c4d6b210ba1fc6dad6a2ca27f88a82e7eee6b1b3))
