import type { DataProvider } from 'react-admin';

/**
 * No-op React Admin data provider.
 * HID-011..019 modules supply real providers via registerAdminModule.
 */
export const StubDataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async (_resource: string, { id }: { id: unknown }) => ({ data: { id } }),
  getMany: async () => ({ data: [] }),
  getManyReference: async () => ({ data: [], total: 0 }),
  create: async (_resource: string, { data }: { data: Record<string, unknown> }) => ({ data: { ...data, id: 'stub' } }),
  update: async (_resource: string, { data }: { data: Record<string, unknown> }) => ({ data }),
  updateMany: async () => ({ data: [] }),
  delete: async (_resource: string, { id }: { id: unknown }) => ({ data: { id } }),
  deleteMany: async () => ({ data: [] }),
} as unknown as DataProvider;
