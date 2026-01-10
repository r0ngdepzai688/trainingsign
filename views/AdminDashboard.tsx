
import React, { useState, useMemo } from 'react';
import { User, Course, Confirmation, Role, Company, CourseStatus, AttendanceRecord } from '../types';
import { PARTS, ICONS, GROUPS, DEFAULT_PASSWORD } from '../constants';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  user: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  courses: Course[];
  confirmations: Confirmation[];
  onLogout: () => void;
  onCreateCourse: (c: Course) => void;
  onUpdateCourse: (c: Course) => void;
  onDeleteCourse: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, users, setUsers, courses, confirmations, onLogout, 
  onCreateCourse, onUpdateCourse, onDeleteCourse, onToggleStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'acting' | 'finished' | 'users'>('acting');
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userTab, setUserTab] = useState<'SEV' | 'Vendor'>('SEV');
  const [pendingSearch, setPendingSearch] = useState('');

  const getCourseStatus = (course: Course) => {
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

  const getStatusColor = (status: CourseStatus) => {
    switch (status) {
      case CourseStatus.PLAN: return 'text-slate-400 bg-slate-100';
      case CourseStatus.OPENING: return 'text-blue-600 bg-blue-50';
      case CourseStatus.PENDING: return 'text-amber-600 bg-amber-50';
      case CourseStatus.CLOSED: return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  };

  const handleExportExcel = (course: Course) => {
    const wb = XLSX.utils.book_new();
    const attendanceData = course.attendance.map((a, i) => {
      const u = users.find(usr => usr.id === a.userId);
      return { 'No': i+1, 'Name': u?.name, 'ID': u?.id, 'Part': u?.part, 'Status': a.status, 'Reason': a.reason || '' };
    });
    const ws = XLSX.utils.json_to_sheet(attendanceData);
    XLSX.utils.book_append_sheet(wb, ws, "Bao Cao");
    XLSX.writeFile(wb, `${course.name}_BaoCao.xlsx`);
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      const newUsers: User[] = data.map(row => ({
        id: String(row.id || row.ID).padStart(8, '0'),
        name: row.name || row.Name,
        part: row.part || row.Part || PARTS[0],
        group: row.group || row.Group || GROUPS[0],
        role: Role.USER,
        password: row.password || row.Password || DEFAULT_PASSWORD,
        company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR
      }));

      // Lọc trùng ID
      const filtered = newUsers.filter(nu => !users.some(u => u.id === nu.id));
      setUsers(prev => [...prev, ...filtered]);
      alert(`Đã thêm ${filtered.length} nhân viên mới từ Excel!`);
    };
    reader.readAsBinaryString(file);
  };

  const updateReason = (courseId: string, userId: string, reason: string) => {
    const targetCourse = courses.find(c => c.id === courseId);
    if (!targetCourse) return;
    const updatedCourse = {
      ...targetCourse,
      attendance: targetCourse.attendance.map(a => a.userId === userId ? { ...a, reason } : a)
    };
    onUpdateCourse(updatedCourse);
  };

  const filteredPendingList = useMemo(() => {
    if (!pendingSearch.trim()) return [];
    const results: {course: Course, att: AttendanceRecord, usr: User | undefined}[] = [];
    courses.forEach(course => {
      if (getCourseStatus(course) !== CourseStatus.CLOSED) {
        course.attendance.forEach(att => {
          if (att.status === 'Pending') {
            const usr = users.find(u => u.id === att.userId);
            if (usr && (usr.name.toLowerCase().includes(pendingSearch.toLowerCase()) || usr.id.includes(pendingSearch))) {
              results.push({ course, att, usr });
            }
          }
        });
      }
    });
    return results;
  }, [courses, users, pendingSearch]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight">IQC Training Pro</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.name} • ADMIN</p>
        </div>
        <button onClick={onLogout} className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white transition-colors">{ICONS.Power}</button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-24">
        {activeTab === 'create' && (
          <CourseForm 
            initialData={editCourse} 
            onSubmit={(c) => { 
              if (!editCourse) onCreateCourse(c); else onUpdateCourse(c);
              setEditCourse(null); setActiveTab('acting'); 
            }} 
          />
        )}

        {activeTab === 'acting' && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang thực hiện (SEV)</h3>
            <div className="overflow-x-auto rounded-[2rem] bg-white shadow-sm border border-gray-100">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 text-slate-500 uppercase font-black border-b border-gray-100">
                  <tr>
                    <th className="p-3 text-left">No</th><th className="p-3 text-left">Name</th><th className="p-3 text-center">Start</th><th className="p-3 text-center">End</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses
                    .filter(c => c.target === Company.SAMSUG && [CourseStatus.PLAN, CourseStatus.OPENING, CourseStatus.PENDING].includes(getCourseStatus(c)))
                    .map((c, i) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-400 font-bold">{i + 1}</td>
                          <td className="p-3 font-bold text-blue-600 cursor-pointer hover:underline truncate max-w-[120px]" onClick={() => { setEditCourse(c); setActiveTab('create'); }}>{c.name}</td>
                          <td className="p-3 text-center whitespace-nowrap">{c.start}</td>
                          <td className="p-3 text-center whitespace-nowrap">{c.end}</td>
                          <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full font-black uppercase text-[8px] ${getStatusColor(getCourseStatus(c))}`}>{getCourseStatus(c)}</span></td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => handleExportExcel(c)} className="text-emerald-500">{ICONS.FileText}</button>
                              <button onClick={() => onDeleteCourse(c.id)} className="text-red-400">{ICONS.Trash}</button>
                              <button onClick={() => onToggleStatus(c.id)} className={c.isEnabled ? 'text-blue-500' : 'text-gray-300'}>{ICONS.Power}</button>
                            </div>
                          </td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm mt-8">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Xử lý lý do ngoại lệ</h4>
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center mb-4"><span className="text-slate-300 mr-3">{ICONS.Search}</span><input type="text" className="bg-transparent text-sm w-full outline-none font-bold" placeholder="ID hoặc Tên nhân viên..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} /></div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredPendingList.map(({course, att, usr}) => (
                  <div key={`${course.id}-${att.userId}`} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex-1 truncate"><div className="font-black text-xs">{usr?.name} <span className="text-blue-500 font-bold">#{usr?.id}</span></div><div className="text-[9px] text-slate-400">{course.name}</div></div>
                    <input className="p-2 bg-blue-50/50 border border-blue-100 outline-none rounded-xl w-32 text-xs font-bold" placeholder="Lý do..." defaultValue={att.reason} onBlur={(e) => updateReason(course.id, att.userId, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finished' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Khóa đào tạo đã hoàn thành</h3>
            <div className="overflow-x-auto rounded-[2rem] bg-white shadow-sm border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-black">
                  <tr><th className="p-4 text-left">No</th><th className="p-4 text-left">Course Name</th><th className="p-4 text-center">Rate</th><th className="p-4 text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses.filter(c => getCourseStatus(c) === CourseStatus.CLOSED).map((c, i) => {
                    const total = c.attendance.length;
                    const signed = c.attendance.filter(a => a.status === 'Signed').length;
                    const rate = total > 0 ? Math.round((signed/total)*100) : 0;
                    return (
                      <tr key={c.id}>
                        <td className="p-4 text-slate-400 font-bold">{i+1}</td>
                        <td className="p-4 font-black text-slate-700">{c.name}</td>
                        <td className="p-4 text-center"><span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black">{signed}/{total} ({rate}%)</span></td>
                        <td className="p-4 text-center"><button onClick={() => handleExportExcel(c)} className="text-emerald-500 mr-2">{ICONS.FileText}</button><button className="text-red-500">{ICONS.Pdf}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-400 uppercase">Quản lý Nhân sự</h3>
              <div className="flex gap-2">
                <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
                  {ICONS.FileText} IMPORT EXCEL
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportUsers} />
                </label>
              </div>
            </div>
            <UserManagement users={users} setUsers={setUsers} userTab={userTab} setUserTab={setUserTab} searchTerm={userSearchTerm} setSearchTerm={setUserSearchTerm} />
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-100 px-6 py-4 shrink-0 flex justify-between items-center fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50 rounded-t-[2.5rem] shadow-inner">
        <TabButton active={activeTab === 'create'} icon={ICONS.Plus} label="Tạo Mới" onClick={() => { setEditCourse(null); setActiveTab('create'); }} />
        <TabButton active={activeTab === 'acting'} icon={ICONS.FileText} label="Acting" onClick={() => setActiveTab('acting')} />
        <TabButton active={activeTab === 'finished'} icon={ICONS.Check} label="Báo Cáo" onClick={() => setActiveTab('finished')} />
        <TabButton active={activeTab === 'users'} icon={ICONS.User} label="Nhân Sự" onClick={() => setActiveTab('users')} />
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, icon: React.ReactNode, label: string, onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-600 scale-105 font-black' : 'text-slate-400'}`}>
    <div className={`p-2.5 rounded-2xl transition-all ${active ? 'bg-blue-50' : 'bg-transparent'}`}>{icon}</div>
    <span className="text-[9px] uppercase tracking-tighter">{label}</span>
  </button>
);

const CourseForm: React.FC<{ initialData: Course | null, onSubmit: (c: Course) => void }> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<Course>(initialData || {
    id: 'c' + Date.now(), name: '', start: '', end: '', content: '', target: Company.SAMSUG, isEnabled: true, attendance: []
  });

  return (
    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-gray-100 space-y-6">
      <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">{initialData ? 'Cập nhật' : 'Tạo mới đào tạo'}</h4>
      <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl text-sm outline-none font-bold" placeholder="Tiêu đề khóa học..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      <div className="grid grid-cols-2 gap-4">
        <input type="date" className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        <input type="date" className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
      </div>
      <textarea rows={5} className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold text-slate-600" placeholder="Nội dung chi tiết..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
        <div className="flex gap-2">
          <button type="button" onClick={() => setFormData({...formData, target: Company.SAMSUG})} className={`px-4 py-2 rounded-xl text-[10px] font-black ${formData.target === Company.SAMSUG ? 'bg-slate-900 text-white' : 'bg-white text-slate-400'}`}>Samsung</button>
          <button type="button" onClick={() => setFormData({...formData, target: Company.VENDOR})} className={`px-5 py-2.5 rounded-xl text-[10px] font-black ${formData.target === Company.VENDOR ? 'bg-slate-900 text-white' : 'bg-white text-slate-400'}`}>Vendor</button>
        </div>
        <button type="button" onClick={() => setFormData({...formData, isEnabled: !formData.isEnabled})} className={`w-12 h-7 rounded-full flex items-center px-1 transition-all ${formData.isEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}><div className="w-5 h-5 bg-white rounded-full"/></button>
      </div>
      <button onClick={() => onSubmit(formData)} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-sm uppercase shadow-xl shadow-slate-200">Lưu và Triển Khai</button>
    </div>
  );
};

const UserManagement: React.FC<{ users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>>, userTab: 'SEV' | 'Vendor', setUserTab: (v: 'SEV' | 'Vendor') => void, searchTerm: string, setSearchTerm: (s: string) => void }> = ({ users, setUsers, userTab, setUserTab, searchTerm, setSearchTerm }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({ id: '', name: '', part: PARTS[0], group: GROUPS[0], password: DEFAULT_PASSWORD });

  const filtered = users.filter(u => (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)) && ((userTab === 'SEV' && u.company === Company.SAMSUG) || (userTab === 'Vendor' && u.company === Company.VENDOR)));

  const handleManualAdd = () => {
    if (!newStaff.id || !newStaff.name) return;
    const u: User = { ...newStaff, id: newStaff.id.padStart(8, '0'), role: Role.USER, company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR };
    setUsers(prev => [...prev, u]);
    setShowAdd(false);
    setNewStaff({ id: '', name: '', part: PARTS[0], group: GROUPS[0], password: DEFAULT_PASSWORD });
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-gray-100 flex items-center transition-all focus-within:ring-2 focus-within:ring-blue-100"><span className="text-slate-300 mr-3">{ICONS.Search}</span><input type="text" className="bg-transparent text-sm w-full outline-none font-bold" placeholder="Tìm kiếm nhân sự..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
      <div className="flex bg-slate-100 p-1 rounded-2xl"><button onClick={() => setUserTab('SEV')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Nhân viên SEV</button><button onClick={() => setUserTab('Vendor')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Đối tác Vendor</button></div>
      
      <button onClick={() => setShowAdd(!showAdd)} className="w-full bg-slate-50 border-2 border-dashed border-slate-200 py-3 rounded-2xl text-[11px] font-black text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-100 transition-all uppercase">
        {ICONS.Plus} {showAdd ? 'Hủy' : 'Thêm nhân sự mới thủ công'}
      </button>

      {showAdd && (
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-blue-50 space-y-4 animate-in fade-in">
          <input type="text" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold" placeholder="ID (8 số)..." value={newStaff.id} onChange={e => setNewStaff({...newStaff, id: e.target.value.replace(/\D/g, '')})} />
          <input type="text" className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold" placeholder="Họ và Tên..." value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
          <select className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold" value={newStaff.part} onChange={e => setNewStaff({...newStaff, part: e.target.value})}>{PARTS.map(p => <option key={p} value={p}>{p}</option>)}</select>
          <button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-sm">XÁC NHẬN THÊM</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-[2rem] bg-white border border-gray-100 shadow-sm"><table className="w-full text-[10px]"><thead className="bg-slate-50 text-slate-400 uppercase font-black tracking-widest"><tr><th className="p-4 text-left">No</th><th className="p-4 text-left">Staff Details</th><th className="p-4 text-center">Action</th></tr></thead><tbody className="divide-y divide-gray-50">{filtered.map((u, i) => (<tr key={u.id} className="hover:bg-slate-50"><td className="p-4 text-slate-300 font-bold">{i+1}</td><td className="p-4 font-black text-slate-800">{u.name}<div className="text-[9px] font-bold text-slate-400">ID: {u.id}</div></td><td className="p-4"><div className="flex gap-2 justify-center"><button onClick={() => setUsers(users.filter(usr => usr.id !== u.id))} className="text-red-400">{ICONS.Trash}</button></div></td></tr>))}</tbody></table></div>
    </div>
  );
};

export default AdminDashboard;
