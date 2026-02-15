export type DeepNonNullable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? DeepNonNullable<NonNullable<U>>[]
    : T extends object
      ? {
          [K in keyof T]: DeepNonNullable<NonNullable<T[K]>>;
        }
      : NonNullable<T>;
