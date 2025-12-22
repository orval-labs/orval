export const customFormData = <Body extends Record<string, any>>(
  body: Body,
): FormData => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value);
  }

  return formData;
};

export default customFormData;
