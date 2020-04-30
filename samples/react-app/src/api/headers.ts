export const getAuthHeader = (token?: string) => {
  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
};
