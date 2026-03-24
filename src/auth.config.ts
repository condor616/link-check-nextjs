import { NextAuthConfig, type DefaultSession } from "next-auth"

// Extend NextAuth types (needed in both config and main file for TS)
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      hasAccess: boolean
    } & DefaultSession["user"]
  }
}

export const authConfig = {
  providers: [], // Added in auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.hasAccess = (user as any).hasAccess
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string)
        session.user.role = token.role as string
        session.user.hasAccess = token.hasAccess as boolean
      }
      return session
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
