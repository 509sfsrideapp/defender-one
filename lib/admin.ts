export const ADMIN_EMAILS = ["509sfsrideapp@gmail.com", "gabriel.cheney721@gmail.com"] as const;
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalizedEmail);
}
