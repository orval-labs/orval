import { cleanup, getByText, render, waitFor } from '@testing-library/react';
import React from 'react';
import App from './app';

describe('App', () => {
  afterEach(() => {
    delete global['fetch'];
    cleanup();
  });

  it('should render successfully', async () => {
    global['fetch'] = jest.fn().mockResolvedValueOnce({
      json: () => ({
        message: 'my message',
      }),
    });

    const { baseElement } = render(<App />);
    await waitFor(() => getByText(baseElement, 'my message'));
  });
});
