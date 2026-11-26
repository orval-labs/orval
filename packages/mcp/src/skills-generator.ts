import { isUtf8 } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { jsStringLiteralEscape } from '@orval/core';

// Skill rules (frontmatter, name matching its folder, publication limits) are
// left to the SDK: the generated server loads the catalog with
// `strict: true`. Only what the SDK cannot see once the files are embedded is
// checked here.

const listFiles = (root: string, dir = ''): string[] =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return listFiles(root, file);
      if (entry.isFile()) return [file];
      // Reading would follow a symlink and embed whatever it points to, which
      // may sit outside the skills folder. The SDK's own folder adapter skips
      // a skill that holds one for the same reason.
      throw new Error(
        `[orval/mcp] skills: ${path.join(root, file)} is not a regular file`,
      );
    })
    .toSorted();

/** Valid UTF-8 is embedded as a string, anything else as base64. */
const renderFileContent = (
  bytes: Buffer,
): { content: string; binary: boolean } =>
  isUtf8(bytes)
    ? {
        content: `'${jsStringLiteralEscape(bytes.toString('utf8'))}'`,
        binary: false,
      }
    : {
        content: `fromBase64('${bytes.toString('base64')}')`,
        binary: true,
      };

/**
 * Embeds every file under `skillsRoot`, keyed by its `/`-separated relative
 * path, as the record the generated server hands to `memorySkillFiles`. The
 * server then needs no file system at runtime.
 */
export const generateSkillsFileContent = (skillsRoot: string): string => {
  if (!fs.existsSync(skillsRoot) || !fs.statSync(skillsRoot).isDirectory()) {
    throw new Error(`[orval/mcp] skills: ${skillsRoot} is not a directory`);
  }

  const files = listFiles(skillsRoot);

  // The SDK serves an empty catalog without a word, so a mistyped `path`
  // would go unnoticed.
  if (!files.some((file) => path.posix.basename(file) === 'SKILL.md')) {
    throw new Error(`[orval/mcp] skills: ${skillsRoot} holds no SKILL.md`);
  }

  const entries = files.map((file) => ({
    file,
    ...renderFileContent(fs.readFileSync(path.join(skillsRoot, file))),
  }));

  const fromBase64 = entries.some((entry) => entry.binary)
    ? `const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

`
    : '';

  return `${fromBase64}export const skillFiles: Record<string, string | Uint8Array> = {
${entries
  .map(({ file, content }) => `  '${jsStringLiteralEscape(file)}': ${content},`)
  .join('\n')}
};
`;
};
