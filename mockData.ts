
import { User, Role, Course, Confirmation, Company } from './types';
import { DEFAULT_PASSWORD } from './constants';

export const initialUsers: User[] = [
  // Tài khoản Admin cố định theo yêu cầu: ID 16041988, Pass: @nhdmaidinh164
  { 
    id: '16041988', 
    name: 'Hệ thống Quản trị', 
    part: 'ADMIN', 
    group: 'HQ', 
    role: Role.ADMIN, 
    password: '@nhdmaidinh164', 
    company: Company.SAMSUG 
  }
];

export const initialCourses: Course[] = [];
export const initialConfirmations: Confirmation[] = [];
