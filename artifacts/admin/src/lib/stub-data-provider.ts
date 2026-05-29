import type { DataProvider } from 'react-admin';

/**
 * No-op React Admin data provider.
 * HID-011..019 modules supply real providers via registerAdminModule.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StubDataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async (_resource, { id }) => ({ data: { id } as any }),
  getMany: async () => ({ data: [] }),
  getManyReference: async () => ({ data: [], total: 0 }),
  create: async (_resource, { data }) => ({ data: { ...data, id: 'stub' } as any }),
  update: async (_resource, { data }) => ({ data: data as any }),
  updateMany: async () => ({ data: [] }),
  delete: async (_resource, { id }) => ({ data: { id } as any }),
  deleteMany: async () => ({ data: [] }),
};
