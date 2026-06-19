export interface GroupItem {
  id: string;
  name: string;
  level: string;
  school: { id: string; name: string };
  pembina: { id: string; name: string };
  _count: { members: number };
  members?: { user: { id: string; name: string; email: string; totalPoints: number } }[];
}

export interface OverviewData {
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
  group: { name: string };
  attendances: { userId: string; status: string; note?: string; user: { name: string } }[];
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  pointValue: number;
}

export interface MateriItem {
  id: string;
  title: string;
  description?: string;
  weekDate: string;
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
