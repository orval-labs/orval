import fs from 'node:fs/promises';
import path from 'node:path';

import { log } from '@orval/core';
import chalk from 'chalk';
import { execa } from 'execa';

/**
 * Format files with prettier.
 * Tries the programmatic API first (project dependency),
 * then falls back to the globally installed CLI.
 */
export async function formatWithPrettier(
  paths: string[],
  projectTitle?: string,
): Promise<void> {
  const prettier = await tryImportPrettier();

  if (prettier) {
    const filePaths = await collectFilePaths(paths);
    const config = await prettier.resolveConfig(filePaths[0]);
    await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await fs.readFile(filePath, 'utf8');
        try {
          const formatted = await prettier.format(content, {
            ...config,
            // options.filepath can be specified for Prettier to infer the parser from the file extension
            filepath: filePath,
          });
          await fs.writeFile(filePath, formatted);
        } catch (error) {
          if (error instanceof Error) {
            // prettier currently doesn't export UndefinedParserError, so having to do it the crude way
            if (error.name === 'UndefinedParserError') {
              // skip files with unsupported parsers
              // https://prettier.io/docs/options#parser
            } else {
              log(
                chalk.yellow(
                  `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Failed to format file ${filePath}: ${error.toString()}`,
                ),
              );
            }
          } else {
            log(
              chalk.yellow(
                `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Failed to format file ${filePath}: unknown error}`,
              ),
            );
          }
        }
      }),
    );

    return;
  }

  // fallback to globally installed prettier
  try {
    await execa('prettier', ['--write', ...paths]);
  } catch {
    log(
      chalk.yellow(
        `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}prettier not found. Install it as a project dependency or globally.`,
      ),
    );
  }
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
