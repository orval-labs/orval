import axios, { AxiosRequestConfig, Method } from 'axios';
import React from 'react';
import ReactDOM from 'react-dom';
import { QueryCache, ReactQueryCacheProvider } from 'react-query';
import App from './App';
import './index.css';
import * as serviceWorker from './serviceWorker';

const defaultQueryFn = async (
  method: Method,
  url: string,
  options: Partial<AxiosRequestConfig>,
) => {
  const { data } = await axios({
    url,
    method,
    ...options,
  });

  return data;
};

// provide the default query function to your app with defaultConfig
const queryCache = new QueryCache({
  defaultConfig: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});

if (process.env.NODE_ENV === 'development') {
  require('./mock');
}

ReactDOM.render(
  <React.StrictMode>
    <ReactQueryCacheProvider queryCache={queryCache}>
      <App />
    </ReactQueryCacheProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
