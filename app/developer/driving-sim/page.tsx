import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DrivingSimClient from "./DrivingSimClient";

const DEVELOPER_COOKIE_NAME = "developer_access";

export default async function DrivingSimPage() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(DEVELOPER_COOKIE_NAME);

  if (accessCookie?.value !== "granted") {
    redirect("/developer/unlock");
  }

  return <DrivingSimClient />;
}
