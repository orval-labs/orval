import {
  findPetsByStatus,
  findPetsByTags,
  getPetById,
  updatePetWithForm,
  deletePet,
  getInventory,
  getOrderById,
  deleteOrder,
  loginUser,
  logoutUser,
  getUserByName,
  deleteUser,
} from './http-client';
export const findPetsByStatusHandler = async (args) => {
  const res = await findPetsByStatus(args.queryParams);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const findPetsByTagsHandler = async (args) => {
  const res = await findPetsByTags(args.queryParams);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const getPetByIdHandler = async (args) => {
  const res = await getPetById(args.pathParams.petId);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const updatePetWithFormHandler = async (args) => {
  const res = await updatePetWithForm(args.pathParams.petId, args.queryParams);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const deletePetHandler = async (args) => {
  const res = await deletePet(args.pathParams.petId);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
/**
 * Returns a map of status codes to quantities.
 * @summary Returns pet inventories by status.
 */
export const getInventoryHandler = async () => {
  const res = await getInventory();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const getOrderByIdHandler = async (args) => {
  const res = await getOrderById(args.pathParams.orderId);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const deleteOrderHandler = async (args) => {
  const res = await deleteOrder(args.pathParams.orderId);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const loginUserHandler = async (args) => {
  const res = await loginUser(args.queryParams);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
/**
 * Log user out of the system.
 * @summary Logs out current logged in user session.
 */
export const logoutUserHandler = async () => {
  const res = await logoutUser();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const getUserByNameHandler = async (args) => {
  const res = await getUserByName(args.pathParams.username);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
export const deleteUserHandler = async (args) => {
  const res = await deleteUser(args.pathParams.username);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(res),
      },
    ],
  };
};
