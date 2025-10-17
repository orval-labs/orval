export const customFormUrlEncoded = <Body extends Record<string, string>>(
  body: Body,
): URLSearchParams => {
  const formData = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value);
  }

  return formData;
};

export default customFormUrlEncoded;
