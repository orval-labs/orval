export type DeepNonNullable<T> = T extends Function
  ? T
  : T extends readonly (infer U)[]
    ? DeepNonNullable<NonNullable<U>>[]
    : T extends object
      ? {
          [K in keyof T]: DeepNonNullable<NonNullable<T[K]>>;
        }
      : NonNullable<T>;
