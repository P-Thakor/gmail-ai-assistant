import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import Dashboard from "@/components/dashboard/dashboard"
import LoginScreen from "@/components/auth/login-screen"

export default async function Home() {
  const session = await getServerSession(authOptions)
  console.log('Session:', session);
  

  if (!session || !session.user) {
    console.log('No session found, redirecting to login');
    return <LoginScreen />
  }

  return <Dashboard />
}