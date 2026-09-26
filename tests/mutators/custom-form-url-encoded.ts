// orval copies this type parameter onto generated callers.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
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
