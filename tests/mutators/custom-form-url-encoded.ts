export const customFormUrlEncoded = <Body extends Record<string, string>>(
  body: Body,
): URLSearchParams => {
  const formData = new URLSearchParams();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return formData;
};

export default customFormUrlEncoded;
