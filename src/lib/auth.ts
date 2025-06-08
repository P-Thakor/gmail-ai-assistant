import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify"
          ].join(" "),
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        console.log('New account login - setting tokens:', {
          access_token: account.access_token ? 'present' : 'missing',
          refresh_token: account.refresh_token ? 'present' : 'missing',
          expires_at: account.expires_at
        });
        
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        // Set expiration time - account.expires_at is in seconds, convert to milliseconds
        // Add a buffer to avoid immediate expiration checks
        token.accessTokenExpires = account.expires_at ? (account.expires_at * 1000) : (Date.now() + 3600000) // 1 hour default
        
        // Clear any previous errors on fresh login
        token.error = undefined
        
        return token
      }

      // Return previous token if the access token has not expired yet
      // Add a 5-minute buffer to avoid edge cases
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      if (token.accessTokenExpires && Date.now() < ((token.accessTokenExpires as number) - bufferTime)) {
        return token
      }

      // Access token has expired, try to update it
      console.log('Token expired, attempting refresh for user:', token.email || 'unknown');
      return refreshAccessToken(token)
    },    async session({ session, token }) {
      // Send properties to the client, but only if they exist
      if (token.accessToken) {
        session.accessToken = token.accessToken as string
      }
      if (token.error) {
        session.error = token.error as string
        console.log('Session has error for user:', session.user?.email || 'unknown', 'Error:', token.error);
      }
      
      console.log('Session created for user:', session.user?.email || 'unknown', 'Has token:', !!token.accessToken, 'Has error:', !!token.error);
      return session
    }
  },
    
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error"
  },
  session: {
    strategy: "jwt"
  }
}

async function refreshAccessToken(token: any) {
  try {
    console.log('Starting token refresh for user:', token.email || 'unknown');
    
    // Check if refresh token exists
    if (!token.refreshToken) {
      console.log('No refresh token available, cannot refresh');
      throw new Error("No refresh token available")
    }

    const url = "https://oauth2.googleapis.com/token"
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens)
      throw refreshedTokens
    }

    console.log('Token refresh successful for user:', token.email || 'unknown');
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in * 1000),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined, // Clear any previous errors
    }  } catch (error) {
    console.error("RefreshAccessTokenError for user:", token.email || 'unknown', error)

    // For invalid_grant errors (expired/revoked refresh token), 
    // we need to force re-authentication
    const errorObj = error as any;
    const isInvalidGrant = 
      errorObj?.error === 'invalid_grant' ||
      errorObj?.message === 'invalid_grant' ||
      (errorObj?.error_description && errorObj.error_description.includes('expired or revoked'));

    if (isInvalidGrant) {
      console.log('Invalid grant detected - clearing tokens and setting RefreshAccessTokenError for user:', token.email || 'unknown');
      return {
        ...token,
        error: "RefreshAccessTokenError",
        accessToken: null,
        refreshToken: null,
        accessTokenExpires: null
      }
    }

    // For other errors, maintain the token but mark it as errored
    console.log('Other refresh error - maintaining token but marking as errored for user:', token.email || 'unknown');
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}