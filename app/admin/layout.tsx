import type { ReactNode } from "react";
import { requireDeveloperAccess } from "../../lib/server/developer-access";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDeveloperAccess();
  return children;
}
