import { SPECIAL_CHAR_REGEX } from '../../constants';

export const getKey = (key: string) => {
  return key.match(SPECIAL_CHAR_REGEX) !== null ? `'${key}'` : key;
};
