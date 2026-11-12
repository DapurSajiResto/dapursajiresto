// NextAuth route handler
// authOptions dipindah ke src/lib/auth-options.ts karena Next.js
// tidak boleh export selain GET/POST dari file route.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
