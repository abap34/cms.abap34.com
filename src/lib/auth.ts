import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const ALLOWED_USERS = ["abap34"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      checks: ["state"],
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      return ALLOWED_USERS.includes(profile?.login as string);
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
