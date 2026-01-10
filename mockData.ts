
import { User, Role, Course, Confirmation, Company } from './types';

export const initialUsers: User[] = [
  { 
    id: '16041988', 
    name: 'Hệ thống Quản trị', 
    part: 'ADMIN', 
    group: 'IQC G', 
    role: Role.ADMIN, 
    password: '@nhdmaidinh164', 
    company: Company.SAMSUG 
  }
];

export const initialCourses: Course[] = [];
export const initialConfirmations: Confirmation[] = [];
