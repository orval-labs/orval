export const customFormUrlEncoded = <Body extends Record<string, unknown>>(
  body: Body,
): URLSearchParams => {
  const formData = new URLSearchParams();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  return formData;
};

export default customFormUrlEncoded;
