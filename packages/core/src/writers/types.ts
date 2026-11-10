export function getOrvalGeneratedTypes(useReadonlyArrays = false) {
  // Filtering response-only fields must preserve readonly collection identity;
  // mapping through WritableKeys alone turns arrays into objects with methods.
  return `
// https://stackoverflow.com/questions/49579094/typescript-conditional-types-filter-out-readonly-properties-pick-only-requir/49579497#49579497
type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <
T,
>() => T extends Y ? 1 : 2
? A
: B;

type WritableKeys<T> = {
[P in keyof T]-?: IfEquals<
  { [Q in P]: T[P] },
  { -readonly [Q in P]: T[P] },
  P
>;
}[keyof T];

type UnionToIntersection<U> =
  (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never;
type DistributeReadOnlyOverUnions<T> = T extends any ? NonReadonly<T> : never;

type Writable<T> = Pick<T, WritableKeys<T>>;
type NonReadonly<T> = ${
    useReadonlyArrays
      ? `T extends string | number | boolean | bigint | symbol | null | undefined ? T
: T extends (...args: never[]) => unknown ? T
: T extends readonly unknown[] ? { [P in keyof T]: NonReadonly<T[P]> }
: T extends object ? `
      : ''
  }[T] extends [UnionToIntersection<T>] ? {
  [P in keyof Writable<T>]: T[P] extends object
    ? NonReadonly<NonNullable<T[P]>>
    : T[P];
} : DistributeReadOnlyOverUnions<T>${useReadonlyArrays ? ' : T' : ''};
`;
}

export function getTypedResponse() {
  return `
interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}
`;
}
