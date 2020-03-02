export const sortParams = (
  arr: {default?: boolean; required?: boolean; definition: string}[]
) =>
  arr.sort((a, b) => {
    if (a.default) {
      return 1;
    }

    if (b.default) {
      return -1;
    }

    if (a.required && b.required) {
      return 0;
    }

    if (a.required) {
      return -1;
    }

    if (b.required) {
      return 1;
    }
    return 0;
  });
