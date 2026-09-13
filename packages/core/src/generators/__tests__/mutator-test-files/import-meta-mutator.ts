// A mutator that uses syntax an older ECMAScript target cannot express:
// `import.meta` (warned about under the old `es6` fallback) and a default
// argument (which downleveling rewrites into the body, changing arity).
// See https://github.com/orval-labs/orval/issues/4093 and issues/1185.
const baseURL = import.meta.url;

export const importMetaMutator = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${baseURL}${url}`, options);
  return res.json() as Promise<T>;
};
