import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DEVELOPER_COOKIE_NAME = "developer_access";

export async function requireDeveloperAccess() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(DEVELOPER_COOKIE_NAME);

  if (accessCookie?.value !== "granted") {
    redirect("/developer/unlock");
  }
}
