import axios from 'axios';

export const axiosInstance = axios.create({
  baseURL: 'http://petstore.swagger.io/v1',
});
