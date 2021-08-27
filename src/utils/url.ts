import validUrl from 'valid-url';

export const isUrl = (path: string) => !!validUrl.isUri(path);
