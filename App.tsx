
import React, { useState, useEffect } from 'react';
import { User, Role, Course, Confirmation, Company, CourseStatus, AttendanceRecord } from './types';
import { DEFAULT_PASSWORD } from './constants';
import LoginView from './views/LoginView';
import AdminDashboard from './views/AdminDashboard';
import UserDashboard from './views/UserDashboard';
import { initialUsers, initialCourses, initialConfirmations } from './mockData';

const getCourseStatusHelper = (course: Course) => {
  const now = new Date();
  const start = new Date(course.start);
  const end = new Date(course.end);
  const isCompleted = course.attendance.length > 0 && 
    course.attendance.every(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== ''));

  if (now < start) return CourseStatus.PLAN;
  if (isCompleted || now > end) {
    return isCompleted ? CourseStatus.CLOSED : CourseStatus.PENDING;
  }
  return CourseStatus.OPENING;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('iqc_users_db');
    return saved ? JSON.parse(saved) : initialUsers;
  });
  
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('iqc_courses_db');
    return saved ? JSON.parse(saved) : initialCourses;
  });

  const [confirmations, setConfirmations] = useState<Confirmation[]>(() => {
    const saved = localStorage.getItem('iqc_confirmations_db');
    return saved ? JSON.parse(saved) : initialConfirmations;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => { localStorage.setItem('iqc_users_db', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('iqc_courses_db', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('iqc_confirmations_db', JSON.stringify(confirmations)); }, [confirmations]);

  const handleLogin = (id: string, pass: string, remember: boolean) => {
    setLoading(true);
    setTimeout(() => {
      // Tìm kiếm user khớp ID và Password
      const user = users.find(u => u.id === id && String(u.password) === String(pass));
      
      if (user) {
        setCurrentUser(user);
        if (remember) {
          localStorage.setItem('iqc_current_user', JSON.stringify(user));
        }
      } else {
        alert("ID hoặc Mật khẩu không chính xác!");
      }
      setLoading(false);
    }, 400);
  };

  const handleRegister = (newUser: User) => {
    if (users.some(u => u.id === newUser.id)) {
      alert("Mã nhân viên này đã tồn tại!");
      return;
    }
    
    setUsers(prev => [...prev, newUser]);
    
    // Tự động thêm vào các khóa đang chạy
    setCourses(prevCourses => prevCourses.map(course => {
      const status = getCourseStatusHelper(course);
      if (status !== CourseStatus.CLOSED && course.target === newUser.company) {
        return {
          ...course,
          attendance: [...course.attendance, { userId: newUser.id, status: 'Pending' }]
        };
      }
      return course;
    }));

    alert(`Đăng ký thành công! Mật khẩu là ${DEFAULT_PASSWORD}`);
  };

  const handleCreateCourse = (course: Course) => {
    const targetUsers = users.filter(u => u.company === course.target && u.role !== Role.ADMIN);
    const snapshot: AttendanceRecord[] = targetUsers.map(u => ({ userId: u.id, status: 'Pending' }));
    setCourses(prev => [...prev, { ...course, attendance: snapshot }]);
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const handleDeleteCourse = (id: string) => {
    if (window.confirm("Xác nhận xóa khóa học này?")) {
      setCourses(prev => prev.filter(c => c.id !== id));
      setConfirmations(prev => prev.filter(conf => conf.courseId !== id));
    }
  };

  const handleAddConfirmation = (conf: Confirmation) => {
    setConfirmations(prev => [...prev, conf]);
    setCourses(prev => prev.map(c => {
      if (c.id === conf.courseId) {
        return {
          ...c,
          attendance: c.attendance.map(a => 
            a.userId === conf.userId ? { 
              ...a, status: 'Signed', timestamp: conf.timestamp, signature: conf.signature 
            } : a
          )
        };
      }
      return c;
    }));
  };

  const handleToggleCourseStatus = (id: string) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, isEnabled: !c.isEnabled } : c));
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-white shadow-2xl relative overflow-hidden">
      {!currentUser ? (
        <LoginView onLogin={handleLogin} onRegister={handleRegister} loading={loading} />
      ) : currentUser.role === Role.ADMIN ? (
        <AdminDashboard 
          user={currentUser} users={users} setUsers={setUsers}
          courses={courses} confirmations={confirmations}
          onLogout={() => setCurrentUser(null)} onCreateCourse={handleCreateCourse}
          onUpdateCourse={handleUpdateCourse} onDeleteCourse={handleDeleteCourse}
          onToggleStatus={handleToggleCourseStatus}
        />
      ) : (
        <UserDashboard 
          user={currentUser} courses={courses} confirmations={confirmations}
          onConfirm={handleAddConfirmation} onLogout={() => setCurrentUser(null)}
        />
      )}
    </div>
  );
};

export default App;
