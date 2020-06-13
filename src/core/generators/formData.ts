import { GetterBody } from '../../types/getters';
import { camel } from '../../utils/case';

export const generateFormData = (body: GetterBody) => {
  if (!body.isBlob) {
    return '';
  }

  return `const formData = new FormData(); formData.append('file', ${camel(
    body.implementation,
  )});`;
};
