import {parse} from 'path';
import {AdvancedOptions} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getGithubOpenApi} from '../../utils/github';
import {dynamicImport} from '../../utils/imports';
import {dynamicReader} from '../../utils/reader';
import {importOpenApi} from './importOpenApi';

export const importSpecs = async (
  options: AdvancedOptions
): Promise<WriteSpecsProps> => {
  const transformer = options.transformer
    ? dynamicImport(options.transformer)
    : undefined;

  if (!options.file && !options.github) {
    throw new Error(
      'You need to provide an input specification with `--file` or `--github`'
    );
  }

  if (options.file) {
    const data = dynamicReader(options.file);
    const {ext} = parse(options.file);
    const format = ['.yaml', '.yml'].includes(ext.toLowerCase())
      ? 'yaml'
      : 'json';

    return importOpenApi({
      data,
      format,
      transformer,
      validation: options.validation,
      override: options.override,
      ...(typeof options.mock === 'object' ? {mockOptions: options.mock} : {})
    });
  } else if (options.github) {
    const {github} = options;

    const data = await getGithubOpenApi(github);

    const format =
      github.toLowerCase().includes('.yaml') ||
      github.toLowerCase().includes('.yml')
        ? 'yaml'
        : 'json';

    return importOpenApi({
      data,
      format,
      transformer,
      override: options.override,
      validation: options.validation,
      ...(typeof options.mock === 'object' ? {mockOptions: options.mock} : {})
    });
  } else {
    return Promise.reject(
      'Please provide a file (--file) or a github (--github) input'
    );
  }
};
