import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Collects what a run would write instead of writing it, so the result can
 * be compared with the files on disk afterwards (`--outdated`).
 */
export interface GeneratedFileCheck {
  /** Final content per absolute path. A later write to a path replaces it. */
  files: Map<string, string>;
  /** Files that `clean` would have removed. */
  obsoleteCandidates: Set<string>;
}

export interface OutdatedGeneratedFile {
  path: string;
  status: 'missing' | 'outdated' | 'obsolete';
}

const generatedFileCheck = new AsyncLocalStorage<GeneratedFileCheck>();

export function createGeneratedFileCheck(): GeneratedFileCheck {
  return { files: new Map(), obsoleteCandidates: new Set() };
}

export function withGeneratedFileCheck<T>(
  check: GeneratedFileCheck,
  callback: () => Promise<T>,
): Promise<T> {
  return generatedFileCheck.run(check, callback);
}

export function getGeneratedFileCheck(): GeneratedFileCheck | undefined {
  return generatedFileCheck.getStore();
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Read a generated file as the current run left it. Under a check the
 * content comes from the collected writes, so a writer that merges into a
 * barrel sees what an earlier writer produced rather than the stale file on
 * disk.
 */
export function readGeneratedFile(
  filePath: string,
): Promise<string | undefined> {
  const pending = generatedFileCheck
    .getStore()
    ?.files.get(path.resolve(filePath));
  return pending === undefined
    ? readFileIfExists(filePath)
    : Promise.resolve(pending);
}

export async function collectOutdatedGeneratedFiles(
  check: GeneratedFileCheck,
): Promise<OutdatedGeneratedFile[]> {
  const outdated: OutdatedGeneratedFile[] = [];

  for (const [filePath, content] of check.files) {
    const existing = await readFileIfExists(filePath);
    if (existing === undefined) {
      outdated.push({ path: filePath, status: 'missing' });
    } else if (existing !== content) {
      outdated.push({ path: filePath, status: 'outdated' });
    }
  }

  for (const candidate of check.obsoleteCandidates) {
    const filePath = path.resolve(candidate);
    if (!check.files.has(filePath) && fs.existsSync(filePath)) {
      outdated.push({ path: filePath, status: 'obsolete' });
    }
  }

  return outdated.toSorted((a, b) => (a.path < b.path ? -1 : 1));
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

  const check = generatedFileCheck.getStore();
  if (check) {
    check.files.set(path.resolve(filePath), nextContent);
    return;
  }

  // Skip the write when the file already holds this exact output, so a no-op
  // regeneration does not churn mtime and wake every downstream watcher. Same
  // reasoning as the barrel writers (#3756), applied to generated artifacts
  // as well. (#3787)
  if ((await readFileIfExists(filePath)) === nextContent) {
    return;
  }

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, nextContent);
}
