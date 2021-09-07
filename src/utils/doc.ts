export function jsDoc(
  {
    description,
    deprecated,
  }: {
    description?: string;
    deprecated?: boolean;
  },
  tryOneLine = false,
): string {
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
    doc += ` ${description}`;
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
