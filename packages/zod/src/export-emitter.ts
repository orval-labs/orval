import { type ZodVariantOption } from '@orval/core';

import { getZodTypeName } from './compatible-v4';

/** Marks a call as side-effect-free for bundlers' tree-shaking passes. */
export const PURE_COMMENT = '/*#__PURE__*/ ';

/** Renders a Zod Mini functional call, e.g. `zod.minLength(1)`, with the pure-call comment. */
export const zodMiniCall = (fn: string, args = '') =>
  `${PURE_COMMENT}zod.${fn}(${args})`;

/**
 * Descriptor for one generated Zod `export const` block. Everything on this
 * type is already resolved by the caller (a chosen export name, a rendered
 * zod expression) so this module can stay a pure string renderer: no
 * `ContextSpec`, no OpenAPI, testable with plain objects.
 *
 * What this module does NOT own, and callers must resolve first:
 * - name allocation (collision handling needs ref context)
 * - the recursive TS type body (`recursivePin.tsBody`) — produced by the
 *   caller's own model generator
 * - hoisted consts (`…Default`, `…RegExp0`, …) — callers prepend these
 *   themselves as pre-rendered strings
 */
export interface ZodExportBlock {
  /** Already-allocated export name. */
  name: string;
  /** Already-rendered zod expression, the RHS of the `export const`. */
  expression: string;
  /** 'classic' zod calls vs the Zod Mini functional API. */
  variant: ZodVariantOption;
  /**
   * Append a `.brand(...)` call to the wrapper (never to the `Item` schema).
   * `isZodV4` selects the v4 vs v3 brand call syntax and is required here so
   * a caller can't opt into branding without also saying which syntax it
   * wants — omit the whole field at call sites that never brand (e.g.
   * companion-type or recursive-pin blocks).
   */
  brand?: { isZodV4: boolean };
  /** Emit `zod.input`/`zod.output` companion type aliases. */
  companionTypes?: boolean;
  /** Split into an `<name>Item` schema plus a bounded array wrapper. */
  arrayItem?: { rules?: { min?: number; max?: number } };
  /** Pin a recursive schema to a hand-written TS type instead of inferring it. */
  recursivePin?: { tsBody: string };
}

const renderArrayWithBounds = (
  itemName: string,
  variant: ZodVariantOption,
  rules: { min?: number; max?: number } | undefined,
) => {
  if (variant === 'mini') {
    const checks = [
      ...(rules?.min ? [zodMiniCall('minLength', `${rules.min}`)] : []),
      ...(rules?.max ? [zodMiniCall('maxLength', `${rules.max}`)] : []),
    ];
    return `${zodMiniCall('array', itemName)}${checks
      .map((check) => `.check(${check})`)
      .join('')}`;
  }

  return `zod.array(${itemName})${rules?.min ? `.min(${rules.min})` : ''}${
    rules?.max ? `.max(${rules.max})` : ''
  }`;
};

const renderBrand = (block: ZodExportBlock) => {
  if (!block.brand) return '';
  return block.brand.isZodV4
    ? `.brand("${block.name}")`
    : `.brand<"${block.name}">()`;
};

/**
 * Renders one generated Zod export block: the `export const`, its optional
 * `Item` split, brand, and either `zod.input`/`zod.output` companion types
 * or a recursive `zod.ZodType<X>` pin. See {@link ZodExportBlock} for what
 * this deliberately leaves to the caller.
 */
export const renderZodExport = (block: ZodExportBlock): string => {
  if (block.recursivePin) {
    const typeName = getZodTypeName(block.variant);
    return (
      `export type ${block.name} = ${block.recursivePin.tsBody};\n\n` +
      `export const ${block.name}: zod.${typeName}<${block.name}> = ${block.expression};\n\n` +
      `export type ${block.name}Output = zod.output<typeof ${block.name}>;`
    );
  }

  const constLine = block.arrayItem
    ? `export const ${block.name}Item = ${block.expression}\n` +
      `export const ${block.name} = ${renderArrayWithBounds(
        `${block.name}Item`,
        block.variant,
        block.arrayItem.rules,
      )}${renderBrand(block)}`
    : `export const ${block.name} = ${block.expression}${renderBrand(block)}`;

  if (!block.companionTypes) {
    return constLine;
  }

  return (
    `${constLine}\n\n` +
    `export type ${block.name} = zod.input<typeof ${block.name}>;\n` +
    `export type ${block.name}Output = zod.output<typeof ${block.name}>;`
  );
};
