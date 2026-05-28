import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("sessionid");
  if (hasSession) {
    redirect("/dashboard");
  }
  redirect("/login?next=/dashboard");
}

