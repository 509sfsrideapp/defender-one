import type { ReactNode } from "react";
import { requireDeveloperAccess } from "../../lib/server/developer-access";

export default async function ForumsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDeveloperAccess();
  return children;
}
