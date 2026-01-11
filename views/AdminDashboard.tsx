
import React, { useState, useMemo } from 'react';
import { User, Course, Confirmation, Role, Company, CourseStatus, AttendanceRecord } from '../types';
import { ICONS, DEFAULT_PASSWORD } from '../constants';
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
  const [userTab, setUserTab] = useState<'SEV' | 'Vendor'>('SEV');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');

  const getCourseStatus = (course: Course) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(course.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(course.end);
    end.setHours(0, 0, 0, 0);
    
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

  // Hàm đếm số người chưa ký theo Group/Part (G, 1P, 2P, 3P, TF)
  const getPendingCountByGroup = (course: Course, groupKey: string) => {
    return course.attendance.filter(a => {
      if (a.status !== 'Pending') return false;
      const u = users.find(usr => usr.id === a.userId);
      if (!u) return false;
      
      const p = u.part.toUpperCase();
      const g = u.group.toUpperCase();

      switch(groupKey) {
        case 'G': return g.includes('G') || p === 'G';
        case '1P': return p.includes('1P');
        case '2P': return p.includes('2P');
        case '3P': return p.includes('3P');
        case 'TF': return p.includes('TF');
        default: return false;
      }
    }).length;
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

  const activeCourses = courses.filter(c => [CourseStatus.PLAN, CourseStatus.OPENING, CourseStatus.PENDING].includes(getCourseStatus(c)));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFF]">
      {/* Header */}
      <div className="bg-white border-b border-blue-50 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs">IQC</div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Training Pro</h2>
            <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-700">{user.name}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">{user.group}</p>
          </div>
          <button onClick={onLogout} className="bg-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">{ICONS.Power}</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        
        {/* TAB 1: CREATE */}
        {activeTab === 'create' && (
          <CourseForm 
            initialData={editCourse} 
            onSubmit={(c) => { 
              if (!editCourse) onCreateCourse(c); else onUpdateCourse(c);
              setEditCourse(null); setActiveTab('acting'); 
            }} 
          />
        )}

        {/* TAB 2: ACTING */}
        {activeTab === 'acting' && (
          <div className="space-y-8">
            {/* Section SAMSUNG (SEV) */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">SAMSUNG (SEV)</h3>
              <div className="bg-white rounded-[2rem] shadow-sm border border-blue-50/50 overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-[#FBFDFF] text-slate-400 uppercase font-black border-b border-blue-50">
                    <tr>
                      <th className="p-4 text-left w-12">NO</th>
                      <th className="p-4 text-left min-w-[150px]">NAME</th>
                      <th className="p-4 text-center">START</th>
                      <th className="p-4 text-center">END</th>
                      <th className="p-4 text-center">G</th>
                      <th className="p-4 text-center">1P</th>
                      <th className="p-4 text-center">2P</th>
                      <th className="p-4 text-center">3P</th>
                      <th className="p-4 text-center">TF</th>
                      <th className="p-4 text-center">STATUS</th>
                      <th className="p-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50/50">
                    {activeCourses.filter(c => c.target === Company.SAMSUG).map((c, i) => (
                      <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="p-4 text-slate-300 font-bold">{i + 1}</td>
                        <td className="p-4">
                          <button onClick={() => { setEditCourse(c); setActiveTab('create'); }} className="font-bold text-blue-600 text-left hover:underline leading-tight">
                            {c.name}
                          </button>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap font-bold text-slate-500">{c.start}</td>
                        <td className="p-4 text-center whitespace-nowrap font-bold text-slate-500">{c.end}</td>
                        <td className="p-4 text-center font-black text-red-500 text-xs">{getPendingCountByGroup(c, 'G')}</td>
                        <td className="p-4 text-center font-black text-red-500 text-xs">{getPendingCountByGroup(c, '1P')}</td>
                        <td className="p-4 text-center font-black text-red-500 text-xs">{getPendingCountByGroup(c, '2P')}</td>
                        <td className="p-4 text-center font-black text-red-500 text-xs">{getPendingCountByGroup(c, '3P')}</td>
                        <td className="p-4 text-center font-black text-red-500 text-xs">{getPendingCountByGroup(c, 'TF')}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-lg font-black text-[8px] uppercase ${getStatusColor(getCourseStatus(c))}`}>
                            {getCourseStatus(c)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleExportExcel(c)} title="Xuất báo cáo" className="text-emerald-500 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors">{ICONS.FileText}</button>
                            <button onClick={() => { if(confirm('Xóa khóa học này?')) onDeleteCourse(c.id); }} title="Xóa" className="text-red-400 p-1.5 hover:bg-red-50 rounded-lg transition-colors">{ICONS.Trash}</button>
                            <button onClick={() => onToggleStatus(c.id)} title="Bật/Tắt" className={`p-1.5 rounded-lg transition-colors ${c.isEnabled ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-50'}`}>{ICONS.Power}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeCourses.filter(c => c.target === Company.SAMSUG).length === 0 && (
                      <tr><td colSpan={11} className="p-12 text-center text-slate-300 font-bold italic">Chưa có dữ liệu đào tạo SEV</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section VENDOR */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">OTHER (COMING SOON)</h3>
              <div className="bg-white rounded-[2rem] border border-dashed border-blue-100 p-12 flex items-center justify-center shadow-sm">
                <span className="text-slate-300 font-bold italic text-sm">Chưa phát triển dữ liệu vendor</span>
              </div>
            </div>

            {/* Exception Handling */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Xử lý lý do ngoại lệ</h4>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center mb-4 border border-blue-50/50">
                <span className="text-slate-300 mr-3">{ICONS.Search}</span>
                <input type="text" className="bg-transparent text-sm w-full outline-none font-bold" placeholder="Tìm ID hoặc Tên để nhập lý do..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {filteredPendingList.map(({course, att, usr}) => (
                  <div key={`${course.id}-${att.userId}`} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-blue-50 shadow-sm">
                    <div className="flex-1 truncate">
                      <div className="font-black text-xs text-slate-700">{usr?.name} <span className="text-blue-500 font-bold">#{usr?.id}</span></div>
                      <div className="text-[9px] text-slate-400 font-bold">{course.name}</div>
                    </div>
                    <input className="p-2 bg-blue-50/30 border border-blue-100 outline-none rounded-xl w-32 text-[10px] font-black text-center text-blue-600 focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Nhập lý do..." defaultValue={att.reason} onBlur={(e) => updateReason(course.id, att.userId, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FINISHED / REPORT */}
        {activeTab === 'finished' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">Báo cáo đào tạo hoàn thành</h3>
            <div className="overflow-x-auto rounded-[2rem] bg-white shadow-sm border border-blue-50">
              <table className="w-full text-xs">
                <thead className="bg-[#FBFDFF] text-slate-500 uppercase font-black border-b border-blue-50">
                  <tr>
                    <th className="p-4 text-left">No</th>
                    <th className="p-4 text-left">Tên Khóa Học</th>
                    <th className="p-4 text-center">Tỷ Lệ</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50/50">
                  {courses.filter(c => getCourseStatus(c) === CourseStatus.CLOSED).map((c, i) => {
                    const total = c.attendance.length;
                    const signed = c.attendance.filter(a => a.status === 'Signed').length;
                    const rate = total > 0 ? Math.round((signed/total)*100) : 0;
                    return (
                      <tr key={c.id}>
                        <td className="p-4 text-slate-400 font-bold">{i+1}</td>
                        <td className="p-4 font-black text-slate-700">{c.name}</td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black text-[10px]">
                            {signed}/{total} ({rate}%)
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleExportExcel(c)} className="text-emerald-500 p-2 hover:bg-emerald-50 rounded-lg transition-colors">{ICONS.FileText}</button>
                            <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">{ICONS.Pdf}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-blue-50 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Quản lý Nhân sự</h3>
              <label className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black cursor-pointer shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95">
                {ICONS.FileText} IMPORT EXCEL
                <input type="file" accept=".xlsx, .xls" className="hidden" />
              </label>
            </div>
            <UserManagement users={users} setUsers={setUsers} userTab={userTab} setUserTab={setUserTab} searchTerm={userSearchTerm} setSearchTerm={setUserSearchTerm} />
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <div className="bg-white border-t border-blue-50 px-6 py-4 shrink-0 flex justify-between items-center fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50 rounded-t-[3rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <TabButton active={activeTab === 'create'} icon={ICONS.Plus} label="CREATE" onClick={() => { setEditCourse(null); setActiveTab('create'); }} />
        <TabButton active={activeTab === 'acting'} icon={ICONS.FileText} label="ACTING" onClick={() => setActiveTab('acting')} />
        <TabButton active={activeTab === 'finished'} icon={ICONS.Check} label="FINISHED" onClick={() => setActiveTab('finished')} />
        <TabButton active={activeTab === 'users'} icon={ICONS.User} label="USERS" onClick={() => setActiveTab('users')} />
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, icon: React.ReactNode, label: string, onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-blue-600 scale-105' : 'text-slate-300 hover:text-slate-400'}`}>
    <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-blue-50 shadow-inner' : 'bg-transparent'}`}>{icon}</div>
    <span className={`text-[8px] font-black tracking-widest uppercase ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

const CourseForm: React.FC<{ initialData: Course | null, onSubmit: (c: Course) => void }> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<Course>(initialData || {
    id: 'c' + Date.now(), name: '', start: '', end: '', content: '', target: Company.SAMSUG, isEnabled: true, attendance: []
  });

  return (
    <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-blue-50 space-y-6">
      <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">{initialData ? 'Sửa đào tạo' : 'Tạo mới đào tạo'}</h4>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Tên khóa học</label>
        <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm outline-none font-bold border border-transparent focus:border-blue-100 focus:bg-white transition-all" placeholder="Nhập tiêu đề..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Ngày bắt đầu</label>
          <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-black text-slate-600 border border-transparent focus:border-blue-100 focus:bg-white transition-all" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Ngày kết thúc</label>
          <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-black text-slate-600 border border-transparent focus:border-blue-100 focus:bg-white transition-all" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Nội dung chi tiết</label>
        <textarea rows={5} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 border border-transparent focus:border-blue-100 focus:bg-white transition-all" placeholder="Nội dung cần xác nhận..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      </div>
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-blue-50/50">
        <div className="flex gap-2">
          <button type="button" onClick={() => setFormData({...formData, target: Company.SAMSUG})} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.target === Company.SAMSUG ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Samsung</button>
          <button type="button" onClick={() => setFormData({...formData, target: Company.VENDOR})} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.target === Company.VENDOR ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Vendor</button>
        </div>
        <div className="flex items-center gap-3">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formData.isEnabled ? 'Active' : 'Draft'}</span>
           <button type="button" onClick={() => setFormData({...formData, isEnabled: !formData.isEnabled})} className={`w-12 h-7 rounded-full flex items-center px-1 transition-all ${formData.isEnabled ? 'bg-blue-600 justify-end shadow-inner' : 'bg-slate-300 justify-start'}`}><div className="w-5 h-5 bg-white rounded-full shadow-sm"/></button>
        </div>
      </div>
      <button onClick={() => onSubmit(formData)} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-sm uppercase shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all">Lưu và Triển Khai</button>
    </div>
  );
};

const UserManagement: React.FC<{ users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>>, userTab: 'SEV' | 'Vendor', setUserTab: (v: 'SEV' | 'Vendor') => void, searchTerm: string, setSearchTerm: (s: string) => void }> = ({ users, setUsers, userTab, setUserTab, searchTerm, setSearchTerm }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({ id: '', name: '', part: '', group: '', password: DEFAULT_PASSWORD });

  const filtered = users
    .filter(u => (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)) && ((userTab === 'SEV' && u.company === Company.SAMSUG) || (userTab === 'Vendor' && u.company === Company.VENDOR)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleManualAdd = () => {
    if (!newStaff.id || !newStaff.name) return alert("Vui lòng nhập đầy đủ!");
    const u: User = { 
      ...newStaff, 
      id: newStaff.id.padStart(8, '0'), 
      role: Role.USER, 
      company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR,
      part: newStaff.part || 'N/A',
      group: newStaff.group || 'N/A'
    };
    setUsers(prev => [...prev, u]);
    setShowAdd(false);
    setNewStaff({ id: '', name: '', part: '', group: '', password: DEFAULT_PASSWORD });
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-blue-50 flex items-center transition-all focus-within:ring-2 focus-within:ring-blue-100/50">
        <span className="text-blue-200 mr-3">{ICONS.Search}</span>
        <input type="text" className="bg-transparent text-sm w-full outline-none font-bold placeholder:text-slate-300" placeholder="Tìm kiếm theo tên hoặc ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>
      
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner">
        <button onClick={() => setUserTab('SEV')} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SEV STAFF</button>
        <button onClick={() => setUserTab('Vendor')} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>VENDOR PARTNER</button>
      </div>
      
      <button onClick={() => setShowAdd(!showAdd)} className="w-full bg-white border-2 border-dashed border-blue-100 py-4 rounded-[2rem] text-[10px] font-black text-blue-400 flex items-center justify-center gap-2 hover:bg-blue-50/50 transition-all uppercase tracking-widest">
        {ICONS.Plus} {showAdd ? 'Đóng form' : 'Thêm nhân sự thủ công'}
      </button>

      {showAdd && (
        <div className="bg-white p-7 rounded-[2.5rem] shadow-xl shadow-blue-50 border border-blue-50 space-y-4 animate-in fade-in slide-in-from-top-4">
          <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-blue-100 outline-none" placeholder="Mã nhân viên (8 số)..." value={newStaff.id} onChange={e => setNewStaff({...newStaff, id: e.target.value.replace(/\D/g, '')})} />
          <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-blue-100 outline-none" placeholder="Họ và tên..." value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-blue-100 outline-none" placeholder="Part (IQC 1P...)" value={newStaff.part} onChange={e => setNewStaff({...newStaff, part: e.target.value})} />
            <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-blue-100 outline-none" placeholder="Group (IQC G...)" value={newStaff.group} onChange={e => setNewStaff({...newStaff, group: e.target.value})} />
          </div>
          <button onClick={handleManualAdd} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs hover:bg-black shadow-lg active:scale-95 transition-all uppercase tracking-widest">Xác nhận thêm</button>
        </div>
      )}

      <div className="overflow-hidden rounded-[2.5rem] bg-white border border-blue-50 shadow-sm">
        <table className="w-full text-[10px]">
          <thead className="bg-[#FBFDFF] text-slate-400 uppercase font-black tracking-widest border-b border-blue-50">
            <tr>
              <th className="p-4 text-left w-12">NO</th>
              <th className="p-4 text-left">STAFF INFO</th>
              <th className="p-4 text-left">PART</th>
              <th className="p-4 text-left">GROUP</th>
              <th className="p-4 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50/50">
            {filtered.map((u, i) => (
              <tr key={u.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="p-4 text-slate-300 font-bold">{i+1}</td>
                <td className="p-4 font-black text-slate-700">
                  {u.name}
                  <div className="text-[8px] font-bold text-blue-400 tracking-wider">ID: {u.id}</div>
                </td>
                <td className="p-4 font-black text-slate-500 uppercase">{u.part}</td>
                <td className="p-4 font-black text-slate-500 uppercase">{u.group}</td>
                <td className="p-4">
                  <div className="flex gap-2 justify-center">
                    {u.id !== '16041988' && (
                      <button onClick={() => { if(confirm('Xóa nhân viên này?')) setUsers(users.filter(usr => usr.id !== u.id)) }} className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-all">
                        {ICONS.Trash}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-12 text-center text-slate-300 font-bold italic">Không tìm thấy nhân sự phù hợp</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
