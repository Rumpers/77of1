import type { StaffRole } from '@7of1/admin-sdk';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: StaffRole;
    };
  }

  interface User {
    role: StaffRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    staffUserId: string;
    role: StaffRole;
  }
}
