export const getStreamReader = () => `
  const readStream = <T>(
    response: Response,
    processLine: (value: T) => void = () => {},
  ) => {
    if (!response.ok || !response.body) return Promise.reject();
    const stream = response.body.getReader();
    const matcher = /\\r?\\n/;
    const decoder = new TextDecoder();
    let buffer: string = '';

    const loop: () => Promise<void> = async () => {
      const { done, value } = await stream.read();
      if (done) {
        if (buffer.length > 0) processLine(JSON.parse(buffer));
        return Promise.resolve();
      } else {
        buffer += decoder.decode(value, {
          stream: true,
        });
        const parts = buffer.split(matcher);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part) continue;
          processLine(JSON.parse(part));
        }

        return loop();
      }
    };

    return loop();
  };
`;
export const getAggregateStreamReader = () => `
  const readAggregateStream = <T>(
    response: Response,
    processLine?: (value: T) => void,
  ) => {
    if (!response.ok || !response.body) return Promise.reject();
    const stream = response.body.getReader();
    const matcher = /\\r?\\n/;
    const decoder = new TextDecoder();
    let buffer: string = '';
    const aggregate: T[] = [];

    const loop: () => Promise<T[]> = async () => {
      const { done, value } = await stream.read();
      if (done) {
        if (buffer.length > 0) {
          const parsed = JSON.parse(buffer);
          aggregate.push(parsed);
          processLine?.(parsed);
        }
        return Promise.resolve(aggregate);
      } else {
        buffer += decoder.decode(value, {
          stream: true,
        });
        const parts = buffer.split(matcher);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part) continue;
          const parsed = JSON.parse(part);
          aggregate.push(parsed);
          processLine?.(parsed);
        }

        return loop();
      }
    };

    return loop();
  };
`;
