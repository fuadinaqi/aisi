export interface GroupMemberDetail {
  joinedAt: string;
  attendanceRate: number | null;
  totalHadir: number;
  totalPekan: number;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    totalPoints: number;
    lastLoginAt: string | null;
    createdAt: string;
  };
  group: { id: string; name: string; level: string };
  school: { id: string; name: string };
}

export interface GroupItem {
  id: string;
  name: string;
  level: string;
  school: { id: string; name: string };
  pembina: { id: string; name: string; email?: string };
  _count: { members: number };
  attendanceRate?: number | null;
  totalHadir?: number;
  totalPekan?: number;
  totalSlots?: number;
  members?: {
    joinedAt: string;
    user: { id: string; name: string; email: string; totalPoints: number };
    attendanceRate: number | null;
    totalHadir: number;
    totalPekan: number;
  }[];
}

export interface OverviewData {
  totalSchools?: number;
  totalGroups: number;
  totalPembina: number;
  totalAnggota: number;
  submissionRate: number;
  evaluationsThisWeek: number;
  groups?: GroupItem[];
}

export interface EvaluationItem {
  id: string;
  weekDate: string;
  isSubmitted: boolean;
  notes?: string;
  group: { id: string; name: string };
  attendances: { userId: string; status: string; note?: string; user: { name: string } }[];
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  pointValue: number;
  imageUrl?: string | null;
  school?: { id: string; name: string } | null;
  targetLevels?: string[];
  myCheckIn?: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    checkedAt: string;
    photoUrl?: string;
    approvedAt?: string | null;
    rejectionNote?: string | null;
  } | null;
  isOngoing?: boolean;
  hasEnded?: boolean;
  hasStarted?: boolean;
}

export interface MateriItem {
  id: string;
  title: string;
  description?: string | null;
  weekDate: string;
  contentType: 'FILE' | 'LINK' | 'RICH_TEXT';
  linkUrl?: string | null;
  contentHtml?: string | null;
  fileUrls: string[];
  createdAt?: string;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  totalPoints: number;
  roles: { role: string }[];
}

export interface InvitationItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface NotificationData {
  items: { id: string; title: string; body: string; isRead: boolean; createdAt: string }[];
  unreadCount: number;
}

export interface PointsData {
  totalPoints: number;
  logs: { id: string; points: number; description: string; createdAt: string }[];
}

export interface SchoolItem {
  id: string;
  name: string;
  city: string;
}

export interface SchoolDetail extends SchoolItem {
  pjUsers: { id: string; name: string; email: string; phone?: string | null }[];
  groups: GroupItem[];
  totalGroups: number;
  totalAnggota: number;
}
