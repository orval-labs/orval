export function getExtension(path: string) {
  return path.toLowerCase().includes('.yaml') ||
    path.toLowerCase().includes('.yml')
    ? 'yaml'
    : 'json';
}
