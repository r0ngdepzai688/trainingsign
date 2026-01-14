
import React, { useState, useEffect } from 'react';
import { User, Role, Course, Confirmation, Company, AttendanceRecord } from './types';
import LoginView from './views/LoginView';
import AdminDashboard from './views/AdminDashboard';
import UserDashboard from './views/UserDashboard';
import { initialUsers } from './mockData';
import { db } from './lib/firebase';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);

  // 1. Lấy dữ liệu Nhân sự (Users)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as User);
      // Nếu db trống, đẩy initialUsers lên (chỉ lần đầu)
      if (data.length === 0) {
        initialUsers.forEach(u => setDoc(doc(db, 'users', u.id), u));
      }
      setUsers(data.length > 0 ? data : initialUsers);
    });
    return unsub;
  }, []);

  // 2. Lấy dữ liệu Khóa học (Courses)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => doc.data() as Course));
    });
    return unsub;
  }, []);

  // 3. Lấy dữ liệu Xác nhận (Confirmations)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'confirmations'), (snapshot) => {
      setConfirmations(snapshot.docs.map(doc => doc.data() as Confirmation));
    });
    return unsub;
  }, []);

  const handleLogin = (id: string, pass: string, remember: boolean) => {
    const user = users.find(u => u.id === id && u.password === pass);
    if (user) {
      setCurrentUser(user);
      if (remember) localStorage.setItem('iqc_remember_user', id);
    } else alert("Mã nhân viên hoặc mật khẩu sai!");
  };

  const handleRegister = async (newUser: User) => {
    if (users.some(u => u.id === newUser.id)) return alert("ID này đã tồn tại!");
    try {
      await setDoc(doc(db, 'users', newUser.id), newUser);
      alert("Đăng ký thành công!");
    } catch (e) { alert("Lỗi kết nối server!"); }
  };

  const handleCreateCourse = async (newCourse: Course, specificUsers?: User[]) => {
    let targetAttendance: AttendanceRecord[] = [];
    const isNotAdmin = (u: User) => u.role !== Role.ADMIN;

    if (specificUsers && specificUsers.length > 0) {
      // Đảm bảo user từ Excel cũng được lưu vào DB
      for (const u of specificUsers) {
        if (!users.some(ex => ex.id === u.id)) {
          await setDoc(doc(db, 'users', u.id), u);
        }
      }
      targetAttendance = specificUsers.filter(isNotAdmin).map(u => ({ userId: u.id, status: 'Pending' }));
    } else {
      const targetUsers = users.filter(u => u.company === newCourse.target && isNotAdmin(u));
      targetAttendance = targetUsers.map(u => ({ userId: u.id, status: 'Pending' }));
    }

    const courseData = { ...newCourse, attendance: targetAttendance };
    await setDoc(doc(db, 'courses', courseData.id), courseData);
    alert("Khóa học đã được triển khai lên hệ thống Cloud!");
  };

  const handleUpdateCourse = async (updatedCourse: Course) => {
    await setDoc(doc(db, 'courses', updatedCourse.id), updatedCourse);
  };

  const handleConfirm = async (conf: Confirmation) => {
    try {
      // 1. Lưu bản ghi xác nhận
      await setDoc(doc(db, 'confirmations', `${conf.courseId}_${conf.userId}`), conf);
      
      // 2. Cập nhật trạng thái trong khóa học
      const course = courses.find(c => c.id === conf.courseId);
      if (course) {
        const newAttendance = course.attendance.map(att => 
          att.userId === conf.userId 
          ? { ...att, status: 'Signed' as const, timestamp: conf.timestamp, signature: conf.signature } 
          : att
        );
        await updateDoc(doc(db, 'courses', course.id), { attendance: newAttendance });
      }
    } catch (e) { alert("Lỗi lưu dữ liệu!"); }
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-white shadow-2xl flex flex-col">
      {!currentUser ? (
        <LoginView onLogin={handleLogin} onRegister={handleRegister} loading={false} />
      ) : currentUser.role === Role.ADMIN ? (
        <AdminDashboard 
          user={currentUser} users={users} 
          setUsers={() => {}} // Việc set users giờ thông qua register/import
          courses={courses} confirmations={confirmations}
          onLogout={() => setCurrentUser(null)} 
          onCreateCourse={handleCreateCourse}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={(id) => deleteDoc(doc(db, 'courses', id))}
          onToggleStatus={(id) => {
            const c = courses.find(x => x.id === id);
            if (c) updateDoc(doc(db, 'courses', id), { isEnabled: !c.isEnabled });
          }}
        />
      ) : (
        <UserDashboard 
          user={currentUser} courses={courses} confirmations={confirmations}
          onLogout={() => setCurrentUser(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default App;
