import { UserRole, UserProfile, Family } from "../types";

/**
 * Unified privilege assertion helper to identify family administrators / managers
 * (e.g. Owners, Parents, Creators, are authorized to delete and adjust records).
 */
export function canManageFamily(
  currentUser: UserProfile | any,
  activeFamily: Family | any
): boolean {
  if (!currentUser) return false;

  const email = currentUser.email || "";
  const uid = currentUser.uid || "";
  const role = currentUser.role || "";

  // 1. Whitelisted Super Admin check (Always authorized)
  if (email === "juwen616@gmail.com" || role === UserRole.SUPER_ADMIN || role === "SUPER_ADMIN" || currentUser.systemRole === "SUPER_ADMIN") {
    return true;
  }

  // 2. Family creator / administrator check
  if (activeFamily) {
    if (activeFamily.adminUid === uid || activeFamily.createdBy === uid) {
      return true;
    }
    // Backward compatibility checks on family owner fields
    if (activeFamily.ownerEmail && activeFamily.ownerEmail === email) {
      return true;
    }
  }

  // 3. User level roles and family-specific dynamic roles
  const normalizedRole = String(role).toLowerCase();
  if (
    normalizedRole === "owner" ||
    normalizedRole === "parent" ||
    normalizedRole === "admin" ||
    role === UserRole.OWNER ||
    role === UserRole.PARENT
  ) {
    return true;
  }

  // 4. Secondary checks for simulated overrides
  if (currentUser.isOwner || currentUser.isParent || currentUser.isAdmin) {
    return true;
  }

  return false;
}
