export const customFormUrlEncoded = <Body>(body: Body): URLSearchParams => {
  const formData = new URLSearchParams();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return formData;
};

export default customFormUrlEncoded;
