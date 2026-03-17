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
  await fs.outputFile(filePath, content.replaceAll(TRAILING_WHITESPACE_RE, ''));
}
