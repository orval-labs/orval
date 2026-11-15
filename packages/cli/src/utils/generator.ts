import pkg from '../../package.json';

export const loadGenerator = async <T>(
  name: string,
  load: () => Promise<T>,
): Promise<T> => {
  try {
    import.meta.resolve(name);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND'
    ) {
      throw new Error(
        `Generator package "${name}" is not installed. Install ${name}@${pkg.version} alongside @orval/cli.`,
        { cause: error },
      );
    }
    throw error;
  }

  // Resolve the requested package separately so a broken dependency inside an
  // installed generator retains its original error rather than being reported
  // as a missing generator.
  return load();
};
