import validatorIsUrl from 'validator/lib/isURL';

const LOCALHOST_REGEX = /^https?:\/\/\w+(\.\w+)*(:[0-9]+)?(\/.*)?$/;

export const isUrl = (str: string) => {
  return (
    validatorIsUrl(str, { require_protocol: true }) || LOCALHOST_REGEX.test(str)
  );
};
