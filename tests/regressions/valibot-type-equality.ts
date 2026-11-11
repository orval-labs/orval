// `true` only when the two types are identical. Unlike assignability, this
// also compares readonly keys. The comparison needs a type parameter that the
// function type uses once.
export type Equal<A, B> =
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
