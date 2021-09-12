export function jsDoc(
  {
    description,
    deprecated,
  }: {
    description?: string[] | string;
    deprecated?: boolean;
  },
  tryOneLine = false,
): string {
  const lines = Array.isArray(description) ? description : [description];

  if (!description && !deprecated) {
    return '';
  }

  const oneLine =
    ((description && !deprecated) || (deprecated && !description)) &&
    tryOneLine;
  let doc = '/**';

  if (description) {
    if (!oneLine) {
      doc += `\n${tryOneLine ? '  ' : ''} *`;
    }
    doc += ` ${lines.join('\n * ')}`;
  }

  if (deprecated) {
    if (!oneLine) {
      doc += `\n${tryOneLine ? '  ' : ''} *`;
    }
    doc += ' @deprecated';
  }

  doc += !oneLine ? `\n ${tryOneLine ? '  ' : ''}` : ' ';

  doc += '*/\n';

  return doc;
}
