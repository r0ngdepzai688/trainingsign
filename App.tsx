
import React, { useState, useEffect } from 'react';
import { User, Role, Course, Confirmation, Company, AttendanceRecord } from './types';
import LoginView from './views/LoginView';
import AdminDashboard from './views/AdminDashboard';
import UserDashboard from './views/UserDashboard';
import { initialUsers, initialCourses, initialConfirmations } from './mockData';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('iqc_users_db');
    const savedUsers = saved ? JSON.parse(saved) : [];
    const merged = [...initialUsers];
    savedUsers.forEach((su: User) => { if (!merged.some(u => u.id === su.id)) merged.push(su); });
    return merged;
  });
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('iqc_courses_db');
    return saved ? JSON.parse(saved) : initialCourses;
  });
  const [confirmations, setConfirmations] = useState<Confirmation[]>(() => {
    const saved = localStorage.getItem('iqc_confirmations_db');
    return saved ? JSON.parse(saved) : initialConfirmations;
  });

  useEffect(() => { localStorage.setItem('iqc_users_db', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('iqc_courses_db', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('iqc_confirmations_db', JSON.stringify(confirmations)); }, [confirmations]);

  const handleLogin = (id: string, pass: string, remember: boolean) => {
    const user = users.find(u => u.id === id && u.password === pass);
    if (user) {
      setCurrentUser(user);
      if (remember) localStorage.setItem('iqc_current_user', JSON.stringify(user));
    } else alert("Mã nhân viên hoặc mật khẩu sai!");
  };

  const handleRegister = (newUser: User) => {
    if (users.some(u => u.id === newUser.id)) return alert("ID này đã tồn tại!");
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    alert("Đăng ký thành công!");
  };

  const handleCreateCourse = (newCourse: Course, specificUsers?: User[]) => {
    let targetAttendance: AttendanceRecord[] = [];
    
    // Logic loại bỏ Admin
    const isNotAdmin = (u: User) => u.role !== Role.ADMIN;

    if (specificUsers && specificUsers.length > 0) {
      setUsers(prev => {
        const existingIds = new Set(prev.map(u => u.id));
        const newOnes = specificUsers.filter(u => !existingIds.has(u.id));
        return [...prev, ...newOnes];
      });

      targetAttendance = specificUsers.filter(isNotAdmin).map(u => ({
        userId: u.id,
        status: 'Pending'
      }));
    } else {
      const targetUsers = users.filter(u => u.company === newCourse.target && isNotAdmin(u));
      targetAttendance = targetUsers.map(u => ({
        userId: u.id,
        status: 'Pending'
      }));
    }

    const courseWithAttendance = { ...newCourse, attendance: targetAttendance };
    setCourses(prev => [...prev.filter(x => x.id !== courseWithAttendance.id), courseWithAttendance]);
    alert(`Đã triển khai khóa học cho ${targetAttendance.length} nhân sự (Đã loại bỏ Admin).`);
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  useEffect(() => {
    if (confirmations.length > 0) {
      setCourses(prev => prev.map(course => {
        let changed = false;
        const newAttendance = course.attendance.map(att => {
          const conf = confirmations.find(c => c.courseId === course.id && c.userId === att.userId);
          if (conf && att.status === 'Pending') {
            changed = true;
            return { ...att, status: 'Signed' as const, timestamp: conf.timestamp, signature: conf.signature };
          }
          return att;
        });
        return changed ? { ...course, attendance: newAttendance } : course;
      }));
    }
  }, [confirmations]);

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-white shadow-2xl flex flex-col">
      {!currentUser ? (
        <LoginView onLogin={handleLogin} onRegister={handleRegister} loading={false} />
      ) : currentUser.role === Role.ADMIN ? (
        <AdminDashboard 
          user={currentUser} users={users} setUsers={setUsers} 
          courses={courses} confirmations={confirmations}
          onLogout={() => setCurrentUser(null)} 
          onCreateCourse={handleCreateCourse}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={(id) => setCourses(prev => prev.filter(c => c.id !== id))}
          onToggleStatus={(id) => setCourses(prev => prev.map(c => c.id === id ? {...c, isEnabled: !c.isEnabled} : c))}
        />
      ) : (
        <UserDashboard 
          user={currentUser} courses={courses} confirmations={confirmations}
          onLogout={() => setCurrentUser(null)}
          onConfirm={(conf) => setConfirmations(prev => [...prev, conf])}
        />
      )}
    </div>
  );
};

export default App;
