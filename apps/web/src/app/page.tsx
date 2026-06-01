import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/features/landing";

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("sessionid");
  if (hasSession) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}

