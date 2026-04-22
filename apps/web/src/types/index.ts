export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "organizer" | "checkin_staff";
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

export interface Workshop {
  id: string;
  title: string;
  description?: string;
  speakerName?: string;
  capacity: number;
  registeredCount: number;
  startsAt: string;
  endsAt: string;
  price: number;
  status: string;
  aiSummary?: string;
  room?: { name: string; building?: string };
}
