import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { StaffRole } from '@7of1/admin-sdk';
import { getAdminDb } from './db.js';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Restrict to 7of1.io Google Workspace accounts.
          hd: '7of1.io',
          prompt: 'select_account',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ profile }) {
      const hd = (profile as Record<string, unknown>)?.hd as string | undefined;
      // Belt-and-suspenders: verify hd claim even though the OAuth param restricts it.
      if (hd !== '7of1.io') return false;
      return true;
    },

    async jwt({ token, user, profile }) {
      if (user && profile?.email) {
        const db = getAdminDb();
        const result = await db.query<{ id: string; role: StaffRole }>(
          'SELECT id, role FROM staff_users WHERE email = $1',
          [profile.email],
        );
        if (!result.rows.length) {
          // Email not in staff_users — deny sign-in.
          throw new Error('User not provisioned in staff_users');
        }
        token.staffUserId = result.rows[0].id;
        token.role = result.rows[0].role;
        await db.end();
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.staffUserId as string;
      session.user.role = token.role as StaffRole;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});
