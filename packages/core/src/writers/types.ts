export const getOrvalGeneratedTypes = () => `
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;
type Primitive = string | number | boolean | bigint | symbol | undefined | null;
type isBuiltin = Primitive | Function | Date | Error | RegExp;
type NonReadonly<T> =
  T extends Exclude<isBuiltin, Error>
  ? T
  : T extends Map<infer Key, infer Value>
  ? Map<NonReadonly<Key>, NonReadonly<Value>>
  : T extends ReadonlyMap<infer Key, infer Value>
  ? Map<NonReadonly<Key>, NonReadonly<Value>>
  : T extends WeakMap<infer Key, infer Value>
  ? WeakMap<NonReadonly<Key>, NonReadonly<Value>>
  : T extends Set<infer Values>
  ? Set<NonReadonly<Values>>
  : T extends ReadonlySet<infer Values>
  ? Set<NonReadonly<Values>>
  : T extends WeakSet<infer Values>
  ? WeakSet<NonReadonly<Values>>
  : T extends Promise<infer Value>
  ? Promise<NonReadonly<Value>>
  : T extends {}
  ? { -readonly [Key in keyof T]: NonReadonly<T[Key]> }
  : IsUnknown<T> extends true
  ? unknown
  : T;
`;
