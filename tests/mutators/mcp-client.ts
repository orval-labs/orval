// MCP client mutator for authentication
export const mcpInstance = async <T>(url: string, config: any): Promise<T> => {
  const headers: Record<string, string> = {
    ...(config.headers || {}),
  };

  // Add authentication token if available
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Token ${apiKey}`;
  }

  const fullUrl = `http://petstore.swagger.io/v1${url}`;

  const response = await fetch(fullUrl, {
    ...config,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // Return with status and headers for compatibility
  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};
