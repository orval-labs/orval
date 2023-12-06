export const customFormData = <Body extends Record<string, any>>(
  body: Body,
): FormData => {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return formData;
};

export default customFormData;
