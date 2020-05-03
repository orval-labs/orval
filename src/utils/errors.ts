import { errorMessage } from './messages/logs';

export const catchError = (str: string) => {
  errorMessage(str);
  process.exit(1);
};
