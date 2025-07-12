const iso8601DateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const reviver = (key: string, value: unknown) => {
  if (value && typeof value === 'string' && iso8601DateRegex.test(value)) {
    return new Date(value);
  }
  return value;
};
export default reviver;
