import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface MutatorSource {
  readonly content: string;
  readonly hash: string;
}

interface MutatorSourceScope {
  files: Map<string, Promise<MutatorSource>> | undefined;
}

const mutatorSources = new AsyncLocalStorage<MutatorSourceScope>();

/** Share source reads within one generation; every regeneration starts fresh. */
export async function withMutatorSourceCache<T>(
  callback: () => Promise<T>,
): Promise<T> {
  const files = new Map<string, Promise<MutatorSource>>();
  const scope: MutatorSourceScope = { files };
  try {
    return await mutatorSources.run(scope, callback);
  } finally {
    // Cached bundle promises may retain their async context after the run.
    // Release sources and keep late descendants from repopulating the cache.
    scope.files = undefined;
    files.clear();
  }
}

export function readMutatorSource(filePath: string): Promise<MutatorSource> {
  const resolvedPath = path.resolve(filePath);
  const cache = mutatorSources.getStore()?.files;
  const cached = cache?.get(resolvedPath);
  if (cached) return cached;

  const pending = loadMutatorSource(resolvedPath);
  cache?.set(resolvedPath, pending);
  if (cache) {
    // A failed read must not prevent repair and retry within the same run.
    pending.catch(() => cache.delete(resolvedPath));
  }
  return pending;
}

async function loadMutatorSource(filePath: string): Promise<MutatorSource> {
  const buffer = await fs.promises.readFile(filePath);
  return {
    content: buffer.toString('utf8'),
    hash: createHash('sha256').update(buffer).digest('hex'),
  };
}
