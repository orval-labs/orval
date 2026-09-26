// orval copies this type parameter onto generated callers.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const customFormData = <Body extends object>(body: Body): FormData => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value instanceof Blob ? value : String(value));
  }

  return formData;
};

export default customFormData;
