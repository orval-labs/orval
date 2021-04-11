import Axios, { AxiosRequestConfig } from 'axios/lib/axios.js';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
	return AXIOS_INSTANCE(config).then(({ data }) => data);
};

export default customInstance;
