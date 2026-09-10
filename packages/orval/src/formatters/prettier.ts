import fs from 'node:fs/promises';
import path from 'node:path';

import { type GeneratedFileTransform, writeGeneratedFile } from '@orval/core';
import { execa } from 'execa';

import { logger } from '../logger';

export async function createPrettierFileTransform(): Promise<
  GeneratedFileTransform | undefined
> {
  const prettier = await tryImportPrettier();
  if (!prettier) {
    return;
  }

  return async (filePath, content) => {
    try {
      const config = await prettier.resolveConfig(filePath);

      return await prettier.format(content, {
        ...config,
        // filepath lets Prettier infer the parser from the file extension.
        filepath: filePath,
      });
    } catch (error) {
      // prettier currently doesn't export UndefinedParserError, so having to do it the crude way
      if (error instanceof Error && error.name === 'UndefinedParserError') {
        // skip files with unsupported parsers
        // https://prettier.io/docs/options#parser
        return content;
      }

      logger.warn(error, `Failed to format file ${filePath}`);
      return content;
    }
  };
}

/**
 * Format files with prettier.
 * Tries the programmatic API first (project dependency),
 * then falls back to the globally installed CLI.
 */
export async function formatWithPrettier(paths: string[]): Promise<void> {
  const format = await createPrettierFileTransform();

  if (format) {
    const filePaths = [...new Set(await collectFilePaths(paths))];
    if (filePaths.length === 0) {
      return;
    }

    await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          await writeGeneratedFile(filePath, await format(filePath, content));
        } catch (error) {
          if (isMissingFileError(error)) {
            return;
          }

          // prettier currently doesn't export UndefinedParserError, so having to do it the crude way
          if (error instanceof Error && error.name === 'UndefinedParserError') {
            // skip files with unsupported parsers
            // https://prettier.io/docs/options#parser
            return;
          }

          logger.warn(error, `Failed to format file ${filePath}`);
        }
      }),
    );

    return;
  }

  // fallback to globally installed prettier
  try {
    await execa('prettier', ['--write', ...paths]);
  } catch {
    logger.warn(
      'prettier not found. Install it as a project dependency or globally.',
    );
  }
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
 * Try to import prettier from the project's dependencies.
 * Returns undefined if prettier is not installed.
 */
async function tryImportPrettier() {
  try {
    return await import('prettier');
  } catch {
    return;
  }
}

/**
 * Recursively collect absolute file paths from a mix of files and directories.
 */
async function collectFilePaths(paths: string[]): Promise<string[]> {
  const results: string[] = [];

  for (const p of paths) {
    const absolute = path.resolve(p);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) {
        results.push(absolute);
      } else if (stat.isDirectory()) {
        const entries = await fs.readdir(absolute);
        const subPaths = entries.map((entry) => path.join(absolute, entry));
        const subFiles = await collectFilePaths(subPaths);
        results.push(...subFiles);
      }
    } catch {
      // Skip paths that don't exist or can't be accessed
    }
  }

  return results;
}
