export const getAuthHeader = (token?: string | null) => {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};
