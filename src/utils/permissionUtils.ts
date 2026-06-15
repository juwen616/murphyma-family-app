import { UserRole, UserProfile, Family } from "../types";

export interface FamilyPermissions {
  canManageFamily: boolean;
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageInvites: boolean;
  canManageTasks: boolean;
  canManageEvents: boolean;
  canManageAnnouncements: boolean;
}

/**
 * Clean helper to get permissions from a normalized user role.
 * Source rules:
 * - owner: all true
 * - parent: only canManageInvites, canManageTasks, canManageEvents, canManageAnnouncements (manageFamily, manageMembers, manageRoles are false)
 * - child: only canManageTasks, canManageEvents, canManageAnnouncements (canManageInvites is false)
 * - viewer: all false
 */
export function getPermissionsByRole(role: string | undefined): FamilyPermissions {
  const norm = String(role || "").toLowerCase();
  
  if (norm === "owner" || norm === "admin") {
    return {
      canManageFamily: true,
      canManageMembers: true,
      canManageRoles: true,
      canManageInvites: true,
      canManageTasks: true,
      canManageEvents: true,
      canManageAnnouncements: true,
    };
  } else if (norm === "parent") {
    return {
      canManageFamily: false,
      canManageMembers: false,
      canManageRoles: false,
      canManageInvites: true,
      canManageTasks: true,
      canManageEvents: true,
      canManageAnnouncements: true,
    };
  } else if (norm === "child" || norm === "kid") {
    return {
      canManageFamily: false,
      canManageMembers: false,
      canManageRoles: false,
      canManageInvites: false,
      canManageTasks: true,
      canManageEvents: true,
      canManageAnnouncements: true,
    };
  } else {
    // viewer
    return {
      canManageFamily: false,
      canManageMembers: false,
      canManageRoles: false,
      canManageInvites: false,
      canManageTasks: false,
      canManageEvents: false,
      canManageAnnouncements: false,
    };
  }
}

/**
 * Unified privilege assertion helper to identify family administrators / managers
 */
export function canManageFamily(
  currentUser: UserProfile | any,
  activeFamily: Family | any
): boolean {
  if (!currentUser) return false;

  const email = currentUser.email || "";
  const role = String(currentUser.role || "").toLowerCase();

  // 1. Whitelisted Super Admin check (Always authorized)
  if (email === "juwen616@gmail.com" || role === "super_admin" || role === "superadmin") {
    return true;
  }

  // Strictly base it on the role from families/{familyId}/members:
  const perms = getPermissionsByRole(currentUser.role);
  return perms.canManageFamily;
}

