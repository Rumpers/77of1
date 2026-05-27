import type { DataProvider } from 'react-admin';

/**
 * No-op React Admin data provider.
 * HID-011..019 modules supply real providers via registerAdminModule.
 */
export const StubDataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async (_resource, { id }) => ({ data: { id } }),
  getMany: async () => ({ data: [] }),
  getManyReference: async () => ({ data: [], total: 0 }),
  create: async (_resource, { data }) => ({ data: { ...data, id: 'stub' } }),
  update: async (_resource, { data }) => ({ data }),
  updateMany: async () => ({ data: [] }),
  delete: async (_resource, { id }) => ({ data: { id } }),
  deleteMany: async () => ({ data: [] }),
};
