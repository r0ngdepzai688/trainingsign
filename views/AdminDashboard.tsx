
import React, { useState, useMemo } from 'react';
import { User, Course, Confirmation, Role, Company, CourseStatus, AttendanceRecord } from '../types';
import { ICONS, DEFAULT_PASSWORD } from '../constants';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  user: User; users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  courses: Course[]; confirmations: Confirmation[]; onLogout: () => void;
  onCreateCourse: (c: Course) => void; onUpdateCourse: (c: Course) => void;
  onDeleteCourse: (id: string) => void; onToggleStatus: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, users, setUsers, courses, onLogout, onCreateCourse, onUpdateCourse, onDeleteCourse, onToggleStatus }) => {
  const [activeTab, setActiveTab] = useState<'acting' | 'create' | 'finished' | 'users'>('acting');
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [userTab, setUserTab] = useState<'SEV' | 'Vendor'>('SEV');
  const [searchTerm, setSearchTerm] = useState('');

  const getCourseStatus = (course: Course) => {
    const now = new Date();
    const start = new Date(course.start);
    const end = new Date(course.end);
    const isCompleted = course.attendance.length > 0 && course.attendance.every(a => a.status === 'Signed' || !!a.reason);
    if (now < start) return CourseStatus.PLAN;
    if (isCompleted || now > end) return isCompleted ? CourseStatus.CLOSED : CourseStatus.PENDING;
    return CourseStatus.OPENING;
  };

  const sortedUsers = useMemo(() => {
    return [...users]
      .filter(u => u.company === (userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR))
      .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, userTab, searchTerm]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 shadow-lg">
        <div>
          <h2 className="text-xl font-black">IQC Training Pro</h2>
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{user.name} • ADMIN</p>
        </div>
        <button onClick={onLogout} className="bg-slate-800 p-2 rounded-xl text-slate-400">{ICONS.Power}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'acting' && (
          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đào tạo đang triển khai</h3>
             <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
               <table className="w-full text-[10px]">
                 <thead className="bg-slate-50 border-b text-slate-400 font-black uppercase">
                   <tr><th className="p-3 text-left">No</th><th className="p-3 text-left">Tên Khóa</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th></tr>
                 </thead>
                 <tbody className="divide-y">
                   {courses.filter(c => [CourseStatus.PLAN, CourseStatus.OPENING, CourseStatus.PENDING].includes(getCourseStatus(c))).map((c, i) => (
                     <tr key={c.id} className="hover:bg-slate-50">
                       <td className="p-3 font-bold text-slate-300">{i+1}</td>
                       <td className="p-3 font-bold text-blue-600 cursor-pointer" onClick={() => { setEditCourse(c); setActiveTab('create'); }}>{c.name}</td>
                       <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-black">{getCourseStatus(c)}</span></td>
                       <td className="p-3 text-center flex justify-center gap-2">
                         <button onClick={() => onDeleteCourse(c.id)} className="text-red-400">{ICONS.Trash}</button>
                         <button onClick={() => onToggleStatus(c.id)} className={c.isEnabled ? 'text-blue-500' : 'text-slate-200'}>{ICONS.Power}</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border">
            <h3 className="text-xl font-black mb-6 uppercase">{editCourse ? 'Sửa đào tạo' : 'Tạo đào tạo mới'}</h3>
            <div className="space-y-4">
              <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" placeholder="Tên khóa học..." value={editCourse?.name || ''} onChange={e => setEditCourse(prev => prev ? {...prev, name: e.target.value} : null)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={editCourse?.start || ''} onChange={e => setEditCourse(prev => prev ? {...prev, start: e.target.value} : null)} />
                <input type="date" className="p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={editCourse?.end || ''} onChange={e => setEditCourse(prev => prev ? {...prev, end: e.target.value} : null)} />
              </div>
              <textarea rows={4} className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-sm" placeholder="Nội dung đào tạo..." value={editCourse?.content || ''} onChange={e => setEditCourse(prev => prev ? {...prev, content: e.target.value} : null)} />
              <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl" onClick={() => { if(editCourse) { onCreateCourse(editCourse); setActiveTab('acting'); } }}>LƯU & PHÁT HÀNH</button>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border shadow-sm flex items-center">
              <span className="mr-3">{ICONS.Search}</span>
              <input type="text" className="bg-transparent outline-none w-full font-bold text-sm" placeholder="Tìm kiếm nhân sự..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setUserTab('SEV')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SEV</button>
              <button onClick={() => setUserTab('Vendor')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Vendor</button>
            </div>
            <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 border-b font-black uppercase text-slate-400">
                  <tr><th className="p-3 text-left">Họ Tên</th><th className="p-3 text-left">Part</th><th className="p-3 text-left">Group</th><th className="p-3 text-center">Xóa</th></tr>
                </thead>
                <tbody className="divide-y">
                  {sortedUsers.map(u => (
                    <tr key={u.id}>
                      <td className="p-3 font-black">{u.name}<div className="text-[8px] text-slate-300">ID: {u.id}</div></td>
                      <td className="p-3 text-slate-500 font-bold">{u.part}</td>
                      <td className="p-3 text-slate-500 font-bold">{u.group}</td>
                      <td className="p-3 text-center">{u.id !== '16041988' && <button onClick={() => setUsers(prev => prev.filter(x => x.id !== u.id))} className="text-red-400">{ICONS.Trash}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around items-center max-w-lg mx-auto rounded-t-[2.5rem] shadow-inner">
        <button onClick={() => setActiveTab('acting')} className={activeTab === 'acting' ? 'text-blue-600' : 'text-slate-300'}>{ICONS.FileText}</button>
        <button onClick={() => { setEditCourse({id: 'c'+Date.now(), name:'', start:'', end:'', content:'', target: Company.SAMSUG, isEnabled:true, attendance:[]}); setActiveTab('create'); }} className={activeTab === 'create' ? 'text-blue-600' : 'text-slate-300'}>{ICONS.Plus}</button>
        <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'text-blue-600' : 'text-slate-300'}>{ICONS.User}</button>
      </div>
    </div>
  );
};

export default AdminDashboard;
