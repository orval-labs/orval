import chalk from 'chalk';

export const createSuccessMessage = (backend?: string) =>
  chalk.green(`${backend || ''}🎉  Your OpenAPI spec has been converted into ready to use orval!`);
