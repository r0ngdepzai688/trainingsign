
export enum Role {
  ADMIN = 'admin',
  USER = 'user'
}

export enum Company {
  SAMSUG = 'Samsung',
  VENDOR = 'Vendor'
}

export interface User {
  id: string; // Mã nhân viên 8 số
  name: string;
  part: string;
  group: string;
  role: Role;
  password: string;
  company: Company;
}

export enum CourseStatus {
  PLAN = 'Plan',
  OPENING = 'Opening',
  CLOSED = 'Closed',
  PENDING = 'Pending',
  FINISHED = 'Finished'
}

export interface AttendanceRecord {
  userId: string;
  status: 'Pending' | 'Signed';
  reason?: string;
  timestamp?: string;
  signature?: string;
}

export interface Course {
  id: string;
  name: string;
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd
  content: string;
  target: Company;
  isEnabled: boolean; // ON/OFF
  attendance: AttendanceRecord[];
}

export interface Confirmation {
  courseId: string;
  userId: string;
  timestamp: string; // HH:mm:ss MM/dd/yyyy
  signature: string; // base64 image data
}
