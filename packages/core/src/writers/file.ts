import { AsyncLocalStorage } from 'node:async_hooks';

import fs from 'fs-extra';

const TRAILING_WHITESPACE_RE = /[^\S\r\n]+$/gm;

export type GeneratedFileTransform = (
  filePath: string,
  content: string,
) => Promise<string>;

const generatedFileTransform = new AsyncLocalStorage<GeneratedFileTransform>();

export function withGeneratedFileTransform<T>(
  transform: GeneratedFileTransform,
  callback: () => Promise<T>,
): Promise<T> {
  return generatedFileTransform.run(transform, callback);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

/**
 * Write generated code to a file, stripping trailing whitespace from each line.
 *
 * Template literals in code generators can produce lines with only whitespace
 * when conditional expressions evaluate to empty strings. This function
 * ensures the output is always clean regardless of generator implementation.
 */
export async function writeGeneratedFile(
  filePath: string,
  content: string,
): Promise<void> {
  let nextContent = content.replaceAll(TRAILING_WHITESPACE_RE, '');
  const transform = generatedFileTransform.getStore();
  if (transform) {
    nextContent = (await transform(filePath, nextContent)).replaceAll(
      TRAILING_WHITESPACE_RE,
      '',
    );
  }

  // Skip the write when the file already holds this exact output, so a no-op
  // regeneration does not churn mtime and wake every downstream watcher. Same
  // reasoning as the barrel writers (#3756), applied to generated artifacts
  // as well. (#3787)
  try {
    const existingContent = await fs.readFile(filePath, 'utf8');
    if (existingContent === nextContent) {
      return;
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  await fs.outputFile(filePath, nextContent);
}
