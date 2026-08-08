import fs from 'fs-extra';

const TRAILING_WHITESPACE_RE = /[^\S\r\n]+$/gm;

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
  const nextContent = content.replaceAll(TRAILING_WHITESPACE_RE, '');

  // Skip the write when the file already holds this exact output, so a no-op
  // regeneration does not churn mtime and wake every downstream watcher. Same
  // reasoning as the barrel writers (#3756), applied to generated artifacts
  // as well. (#3787)
  if (await fs.pathExists(filePath)) {
    const existingContent = await fs.readFile(filePath, 'utf8');
    if (existingContent === nextContent) return;
  }

  await fs.outputFile(filePath, nextContent);
}
