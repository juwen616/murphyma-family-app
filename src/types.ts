export enum SystemMode {
  DAILY = "daily",
  TRAVEL = "travel",
  EXAM = "exam",
  VACATION = "vacation",
  CUSTOM = "custom",
}

export function getLocalToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export enum UserRole {
  ADMIN = "admin",
  PARENT = "parent",
  KID = "kid",
  MEMBER = "member",
  PET = "pet",
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  familyId: string | null;
  role: UserRole;
  stars: number;
  createdAt: any;
  color?: string;
  birthday?: string;
}

export interface Family {
  id: string;
  name: string;
  adminUid: string;
  createdAt: any;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: UserRole;
  stars: number;
  createdAt: any;
}

export interface CalendarEvent {
  id: string;
  familyId: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM~HH:MM" or similar, can be empty
  category?: string;
  isFixed: boolean;
  weekdays?: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0 = Sunday
  note: string;
  isPublic: boolean;
  creatorUid: string;
  creatorName: string;
  createdAt: any;
  templateId?: string; // linked recurring favorite template ID
  exceptionDates?: string[]; // Date strings to skip in format "YYYY-MM-DD"
  startDate?: string; // Valid start date for repeating activity (YYYY-MM-DD)
  endDate?: string; // Valid end date for repeating activity (YYYY-MM-DD)
  dailyNotes?: Record<string, string>; // Daily-specific content for multi-day events mapped by ISO YYYY-MM-DD date string
}

export enum TaskStatus {
  PENDING = "pending",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface Task {
  id: string;
  familyId: string;
  title: string;
  requirement: string;
  starsReward: number;
  assignedTo: string; // UID of specific member or "all", or comma-separated kid UIDs
  status: TaskStatus;
  submissionNote?: string;
  rejectionNote?: string;
  submittedAt?: any;
  approvedAt?: any;
  approvedBy?: string;
  createdAt: any;
  startDate?: string;
  endDate?: string;
  taskType?: "single" | "daily" | "weekly" | "monthly" | "regular";
  submitterUid?: string;
  parentEncouragement?: string;
  childMood?: string;
}

export enum RewardStatus {
  WISHED = "wished",
  AVAILABLE = "available",
  PAUSED = "paused",
  ARCHIVED = "archived",
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  starsCost: number;
  stock: number;
  status: RewardStatus;
  creatorUid: string;
  creatorName: string;
  createdAt: any;
  description?: string;
  imageUrl?: string;
  note?: string;
  sortOrder?: number;
}

export interface Announcement {
  id: string;
  familyId: string;
  title: string;
  content: string;
  creatorUid: string;
  creatorName: string;
  createdAt: any;
}

export interface CommonTemplate {
  id: string;
  familyId: string;
  title: string;
  type: "calendar" | "task" | "both";
  usageType?: "calendar" | "task" | "both";
  isRecurring: boolean;
  repeatDays?: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0 = Sunday
  defaultStartTime?: string;
  defaultEndTime?: string;
  hasDefaultTime?: boolean;
  creatorUid: string;
  createdAt: any;
  startDate?: string; // Starting date for fixed recurring calendar generation
}

export interface ConfiguredMode {
  id: string; // unique ID
  type: SystemMode; // "daily" | "travel" | "exam" | "vacation" | "custom"
  name: string; // e.g. "峇里島旅行"
  icon: string; // Emoji
  color: string; // Color preset (e.g. bg classes or simple names)
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  createdAt: any;

  // Travel Mode Fields
  travelType?: "international" | "domestic";
  airline?: string;
  flightNumber?: string;
  departureTime?: string;
  returnTime?: string;
  departureTerminal?: string;
  returnTerminal?: string;
  passportReminder?: boolean;
  visaReminder?: boolean;
  notes?: string;
  transportation?: string; // drive, hightrain, train, bus, rent, custom or custom text
  itinerary?: {
    [dateStr: string]: {
      breakfast?: string;
      morning?: string;
      lunch?: string;
      afternoon?: string;
      dinner?: string;
      night?: string;
      lodging?: string;
      transport?: string;
      customNotes?: string;
      todayTheme?: string;
      todayRemarks?: string;
    };
  };

  // Exam Mode Fields
  examName?: string;
  subjects?: Array<{
    name: string;
    target: string;
  }>;
  dailyPlan?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    subjectName: string;
  }>;

  // Vacation Mode Fields
  vacationType?: string; // 暑假, 寒假, 冬令營, 夏令營, 回外婆家, etc.
  dailyTasks?: Array<{
    id: string;
    text: string;
    completed?: boolean;
  }>;

  // Custom Mode Fields
  customTasks?: Array<{
    id: string;
    text: string;
    completed?: boolean;
  }>;
}

export interface FamilySetting {
  id: string; // familyId
  familyId: string;
  systemMode: SystemMode;
  updatedAt: any;
  configuredModes?: ConfiguredMode[]; // Store all mapped modes
}

export interface Redemption {
  id: string;
  familyId: string;
  rewardId: string;
  rewardTitle: string;
  starsRequired: number;
  childUid: string;
  childName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
  approvedAt?: any;
}
