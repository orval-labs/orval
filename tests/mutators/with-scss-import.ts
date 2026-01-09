/**
 * Mutator that imports a scss file.
 * Tests the user-configurable `external` option for mutator bundling.
 */
import './styles.scss';

export const customFetchWithScss = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const response = await fetch(url, options);
  return response.json();
};

export default customFetchWithScss;
