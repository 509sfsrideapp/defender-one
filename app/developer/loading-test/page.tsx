import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DeveloperLoaderTestClient from "./DeveloperLoaderTestClient";

const DEVELOPER_COOKIE_NAME = "developer_access";

export default async function DeveloperLoadingTestPage() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(DEVELOPER_COOKIE_NAME);

  if (accessCookie?.value !== "granted") {
    redirect("/developer/unlock");
  }

  return <DeveloperLoaderTestClient />;
}
