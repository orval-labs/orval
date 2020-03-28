export const getExtension = (path: string) =>
  path.toLowerCase().includes('.yaml') || path.toLowerCase().includes('.yml')
    ? 'yaml'
    : 'json';
