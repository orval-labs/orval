export const customFormData = <Body extends Record<string, unknown>>(
  body: Body,
): FormData => {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value instanceof Blob ? value : String(value));
  });

  return formData;
};

export default customFormData;
