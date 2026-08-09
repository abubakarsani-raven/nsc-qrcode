import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname.startsWith("/v/") ||
        pathname.startsWith("/api/auth") ||
        pathname === "/login" ||
        pathname.startsWith("/fonts") ||
        pathname.startsWith("/id-card") ||
        pathname.startsWith("/vendor") ||
        pathname.startsWith("/api/photos")
      ) {
        return true;
      }
      return !!auth;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
