/*
 * Generated by orval v4.2.0 🍺
 * Do not edit manually.
 * example-service
 * Example service
 * OpenAPI spec version: 1.0.0
 */
import axios from 'axios';
import { ChangeUsersStatus200, ChangeUsersStatusBody } from '../model';

export const getExampleService = () => ({
  changeUsersStatus(
    userId: MongoDbID,
    changeUsersStatusBody: ChangeUsersStatusBody,
  ) {
    return axios.post<ChangeUsersStatus200>(
      `/admin/user/status/${userId}`,
      changeUsersStatusBody,
    );
  },
});
