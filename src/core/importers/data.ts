import axios from 'axios';
import { getExtension } from '../../utils/extension';
import { getGithubOpenApi } from '../../utils/github';
import { dynamicReader } from '../../utils/reader';
import { isUrl } from '../../utils/url';

const extensions = ['.yaml', '.yml', '.json'];

export const getSpecData = async (
  path: string,
): Promise<{
  data: string | object;
  format: 'json' | 'yaml';
  isUrl: boolean;
}> => {
  const pathIncludeExtension = extensions.some((ext) => path.includes(ext));

  if (isUrl(path)) {
    if (path.includes('github.com')) {
      const data = await getGithubOpenApi(path);
      const format = pathIncludeExtension
        ? getExtension(path)
        : data.startsWith('{')
        ? 'json'
        : 'yaml';
      return {
        data,
        format,
        isUrl: true,
      };
    }

    try {
      const { headers, data } = await axios.get(path);
      const isContentTypeYaml = headers['content-type'].includes('text/yaml');
      const isContentTypeTextPlain = headers['content-type'].includes(
        'text/plain',
      );
      const isContentTypeJson = headers['content-type'].includes(
        'application/json',
      );

      if (pathIncludeExtension) {
        const format = getExtension(path);
        return {
          data,
          format,
          isUrl: true,
        };
      }

      if (isContentTypeJson || isContentTypeYaml || isContentTypeTextPlain) {
        let format: 'json' | 'yaml' = 'json';

        if (
          isContentTypeYaml ||
          (isContentTypeTextPlain &&
            typeof data === 'string' &&
            !data.startsWith('{'))
        ) {
          format = 'yaml';
        }

        return {
          data,
          format,
          isUrl: true,
        };
      }

      throw 'Unsupported content type';
    } catch (error) {
      throw `Oups... 🍻. ${error}`;
    }
  }

  const data = dynamicReader(path, '');
  const format = pathIncludeExtension
    ? getExtension(path)
    : data.startsWith('{')
    ? 'json'
    : 'yaml';

  return { data, format, isUrl: false };
};
