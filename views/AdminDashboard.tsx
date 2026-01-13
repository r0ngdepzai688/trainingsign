
import React, { useState, useMemo, useRef } from 'react';
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
  const [pendingSearch, setPendingSearch] = useState('');
  
  // Custom Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'info' 
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info' });

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getCourseStatus = (course: Course) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(course.start);
    const end = new Date(course.end);
    const isCompleted = course.attendance.length > 0 && 
      course.attendance.every(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== ''));

    if (now < start) return CourseStatus.PLAN;
    if (isCompleted || now > end) return isCompleted ? CourseStatus.CLOSED : CourseStatus.PENDING;
    return CourseStatus.OPENING;
  };

  // Tính toán tỷ lệ hoàn thành
  const getCompletionStats = (course: Course) => {
    const total = course.attendance.length;
    if (total === 0) return { percent: 0, signed: 0, total: 0 };
    const signed = course.attendance.filter(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== '')).length;
    return {
      percent: Math.round((signed / total) * 100),
      signed,
      total
    };
  };

  const getPendingCountByGroup = (course: Course, groupKey: string) => {
    return course.attendance.filter(a => {
      if (a.status !== 'Pending' || (a.reason && a.reason.trim() !== '')) return false;
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

  // Logic nhập lý do ngoại lệ
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

  const updateReason = (courseId: string, userId: string, reason: string) => {
    const targetCourse = courses.find(c => c.id === courseId);
    if (!targetCourse) return;
    onUpdateCourse({
      ...targetCourse,
      attendance: targetCourse.attendance.map(a => a.userId === userId ? { ...a, reason } : a)
    });
    showToast("Đã lưu lý do ngoại lệ");
  };

  const handleExportExcel = (course: Course) => {
    const wb = XLSX.utils.book_new();
    const attendanceData = course.attendance.map((a, i) => {
      const u = users.find(usr => usr.id === a.userId);
      return { 'STT': i+1, 'Họ tên': u?.name, 'Mã NV': u?.id, 'Bộ phận': u?.part, 'Trạng thái': a.status, 'Lý do': a.reason || '' };
    });
    const ws = XLSX.utils.json_to_sheet(attendanceData);
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${course.name}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        const getVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
            if (foundKey) return row[foundKey];
          }
          return '';
        };
        const imported = jsonData.map((row: any) => ({
          id: String(getVal(row, ['id', 'mã nhân viên', 'ma nhan vien', 'mnv', 'staff id', 'id nv']) || '').trim().padStart(8, '0'),
          name: String(getVal(row, ['name', 'họ và tên', 'ho va ten', 'họ tên', 'ho ten', 'tên', 'ten']) || '').trim(),
          part: String(getVal(row, ['part', 'bộ phận', 'bo phan', 'dept']) || 'N/A').trim(),
          group: String(getVal(row, ['group', 'nhóm', 'nhom', 'team']) || 'N/A').trim(),
          role: Role.USER, password: DEFAULT_PASSWORD, company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR
        })).filter(u => u.id && u.id !== '00000000' && u.name);
        if (imported.length === 0) return showToast("File không đúng định dạng!", "error");
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const newOnes = imported.filter(i => !existingIds.has(i.id));
          return [...prev, ...newOnes];
        });
        showToast(`Đã thêm ${imported.length} nhân sự mới`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) { showToast("Lỗi khi đọc file Excel!", "error"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const activeCourses = courses.filter(c => [CourseStatus.PLAN, CourseStatus.OPENING, CourseStatus.PENDING].includes(getCourseStatus(c)));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFF] font-['Plus_Jakarta_Sans']">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs transition-all animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))}></div>
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full relative shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto ${confirmModal.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
              {confirmModal.type === 'danger' ? ICONS.Trash : ICONS.FileText}
            </div>
            <h3 className="text-xl font-black text-center text-slate-800">{confirmModal.title}</h3>
            <p className="text-sm text-slate-400 text-center mt-2 font-bold leading-relaxed">{confirmModal.message}</p>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} className="py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase hover:bg-slate-200 transition-all">Quay lại</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} className={`py-4 rounded-2xl text-white font-black text-xs uppercase shadow-lg transition-all ${confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-100'}`}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-100 p-5 flex justify-between items-center shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-[1.2rem] flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-blue-100">IQC</div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Training Pro</h2>
            <p className="text-[10px] text-blue-500 font-extrabold uppercase tracking-widest mt-1.5 opacity-70">ADMIN SUITE</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90">{ICONS.Power}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-32">
        {activeTab === 'create' && <CourseForm initialData={editCourse} onSubmit={(c) => { if (!editCourse) onCreateCourse(c); else onUpdateCourse(c); setEditCourse(null); setActiveTab('acting'); showToast("Dữ liệu đã được cập nhật"); }} />}

        {activeTab === 'acting' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-white flex flex-col justify-between h-32">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỉ lệ trung bình</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-800">
                    {activeCourses.length > 0 
                      ? Math.round(activeCourses.reduce((acc, c) => acc + getCompletionStats(c).percent, 0) / activeCourses.length) 
                      : 0}%
                  </span>
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">{ICONS.Check}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-white flex flex-col justify-between h-32">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang triển khai</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-800">{activeCourses.length}</span>
                  <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">{ICONS.FileText}</div>
                </div>
              </div>
            </div>

            {/* Main Course Table with Progress */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2">QUẢN LÝ TIẾN ĐỘ ĐÀO TẠO</h3>
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50/50 text-slate-400 uppercase font-black border-b border-slate-100">
                      <tr>
                        <th className="p-5 text-left w-12 opacity-50">#</th>
                        <th className="p-5 text-left min-w-[200px]">KHÓA ĐÀO TẠO & TIẾN ĐỘ</th>
                        <th className="p-5 text-center bg-blue-50/20">G</th>
                        <th className="p-5 text-center bg-blue-50/20">1P</th>
                        <th className="p-5 text-center bg-blue-50/20">2P</th>
                        <th className="p-5 text-center bg-blue-50/20">3P</th>
                        <th className="p-5 text-center bg-blue-50/20">TF</th>
                        <th className="p-5 text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {activeCourses.filter(c => c.target === Company.SAMSUG).map((c, i) => {
                        const stats = getCompletionStats(c);
                        const progressColor = stats.percent < 50 ? 'bg-red-500' : stats.percent < 80 ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/30 transition-all group">
                            <td className="p-5 text-slate-300 font-bold">{i + 1}</td>
                            <td className="p-5">
                              <div className="flex flex-col gap-2">
                                <button onClick={() => { setEditCourse(c); setActiveTab('create'); }} className="font-extrabold text-slate-700 text-left hover:text-blue-600 transition-colors leading-tight">
                                  {c.name}
                                </button>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${progressColor} transition-all duration-1000 ease-out`} style={{ width: `${stats.percent}%` }}></div>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 min-w-[30px]">{stats.percent}%</span>
                                </div>
                                <div className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
                                  {stats.signed}/{stats.total} Nhân viên đã xác nhận
                                </div>
                              </div>
                            </td>
                            <td className="p-5 text-center font-black text-red-500 text-xs bg-blue-50/5">{getPendingCountByGroup(c, 'G')}</td>
                            <td className="p-5 text-center font-black text-red-500 text-xs bg-blue-50/5">{getPendingCountByGroup(c, '1P')}</td>
                            <td className="p-5 text-center font-black text-red-500 text-xs bg-blue-50/5">{getPendingCountByGroup(c, '2P')}</td>
                            <td className="p-5 text-center font-black text-red-500 text-xs bg-blue-50/5">{getPendingCountByGroup(c, '3P')}</td>
                            <td className="p-5 text-center font-black text-red-500 text-xs bg-blue-50/5">{getPendingCountByGroup(c, 'TF')}</td>
                            <td className="p-5">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleExportExcel(c)} title="Xuất báo cáo" className="text-emerald-400 hover:text-emerald-600 p-1.5 transition-all">{ICONS.FileText}</button>
                                <button onClick={() => setConfirmModal({
                                  isOpen: true,
                                  title: "Xóa đào tạo?",
                                  message: "Mọi dữ liệu ký tên trong khóa học này sẽ bị xóa vĩnh viễn khỏi hệ thống.",
                                  type: 'danger',
                                  onConfirm: () => { onDeleteCourse(c.id); showToast("Đã xóa khóa đào tạo"); }
                                })} title="Xóa" className="text-red-300 hover:text-red-500 p-1.5 transition-all">{ICONS.Trash}</button>
                                <button onClick={() => onToggleStatus(c.id)} title="Bật/Tắt hiển thị" className={`p-1.5 transition-all ${c.isEnabled ? 'text-blue-400 hover:text-blue-600' : 'text-slate-200'}`}>{ICONS.Power}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Exception Reason Management */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">NHẬP LÝ DO NGOẠI LỆ (VẮNG THI / NGHỈ)</h4>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center mb-4 border border-slate-100">
                <span className="text-slate-300 mr-4 ml-1">{ICONS.Search}</span>
                <input type="text" className="bg-transparent text-sm w-full outline-none font-extrabold placeholder:text-slate-300" placeholder="Tìm ID hoặc Tên nhân viên chưa ký..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredPendingList.length === 0 && pendingSearch && (
                  <div className="p-10 text-center text-slate-300 font-bold text-xs italic">Không tìm thấy dữ liệu phù hợp.</div>
                )}
                {filteredPendingList.map(({course, att, usr}) => (
                  <div key={`${course.id}-${att.userId}`} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-50 shadow-sm hover:border-blue-100 transition-all animate-in fade-in zoom-in-95">
                    <div className="flex-1 truncate mr-4">
                      <div className="font-extrabold text-xs text-slate-700">{usr?.name} <span className="text-blue-500 ml-1">#{usr?.id}</span></div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase truncate">{course.name}</div>
                    </div>
                    <input 
                      className="p-2 bg-slate-50 border border-slate-100 outline-none rounded-xl w-32 text-[10px] font-black text-blue-600 focus:bg-white focus:border-blue-200 transition-all" 
                      placeholder="Nhập lý do..." 
                      defaultValue={att.reason} 
                      onBlur={(e) => updateReason(course.id, att.userId, e.target.value)} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Cơ sở dữ liệu</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Phân loại: {userTab}</p>
              </div>
              <label className="bg-blue-600 text-white px-6 py-4 rounded-[1.5rem] text-[11px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-3 cursor-pointer active:scale-95">
                {ICONS.FileText} IMPORT EXCEL
                <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
              </label>
            </div>
            
            <div className="flex bg-slate-100 p-1.5 rounded-[1.8rem] border border-slate-50 shadow-inner">
              <button onClick={() => setUserTab('SEV')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-[1.4rem] transition-all ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400'}`}>SAMSUNG (SEV)</button>
              <button onClick={() => setUserTab('Vendor')} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-[1.4rem] transition-all ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400'}`}>VENDOR</button>
            </div>

            <div className="overflow-hidden rounded-[2.5rem] bg-white border border-white shadow-xl shadow-slate-200/40">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50/50 text-slate-400 uppercase font-black border-b border-slate-100">
                  <tr>
                    <th className="p-5 text-left w-12 opacity-50">#</th>
                    <th className="p-5 text-left">HỌ TÊN NHÂN VIÊN</th>
                    <th className="p-5 text-left">BỘ PHẬN</th>
                    <th className="p-5 text-center">XÓA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => (userTab === 'SEV' ? u.company === Company.SAMSUG : u.company === Company.VENDOR)).map((u, i) => (
                    <tr key={u.id} className="hover:bg-slate-50/30 group transition-all">
                      <td className="p-5 text-slate-300 font-bold">{i+1}</td>
                      <td className="p-5">
                        <div className="font-extrabold text-slate-700">{u.name}</div>
                        <div className="text-[9px] font-bold text-blue-400 tracking-wider">ID: {u.id}</div>
                      </td>
                      <td className="p-5 font-bold text-slate-500 uppercase">{u.part} <span className="opacity-20 mx-1">|</span> {u.group}</td>
                      <td className="p-5 text-center">
                        {u.id !== '16041988' && (
                          <button onClick={() => setConfirmModal({
                            isOpen: true,
                            title: "Xóa nhân sự?",
                            message: `Hành động này sẽ xóa vĩnh viễn nhân viên ${u.name} khỏi cơ sở dữ liệu.`,
                            type: 'danger',
                            onConfirm: () => { setUsers(prev => prev.filter(usr => usr.id !== u.id)); showToast("Đã xóa nhân sự"); }
                          })} className="text-red-300 hover:text-red-500 p-2.5 transition-all">
                            {ICONS.Trash}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-5 shrink-0 flex justify-between items-center fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50 rounded-t-[3rem] shadow-[0_-15px_40px_-20px_rgba(0,0,0,0.1)]">
        <TabButton active={activeTab === 'create'} icon={ICONS.Plus} label="Tạo mới" onClick={() => { setEditCourse(null); setActiveTab('create'); }} />
        <TabButton active={activeTab === 'acting'} icon={ICONS.FileText} label="Tiến độ" onClick={() => setActiveTab('acting')} />
        <TabButton active={activeTab === 'finished'} icon={ICONS.Check} label="Báo cáo" onClick={() => setActiveTab('finished')} />
        <TabButton active={activeTab === 'users'} icon={ICONS.User} label="Nhân sự" onClick={() => setActiveTab('users')} />
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, icon: React.ReactNode, label: string, onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 ${active ? 'text-blue-600 scale-105' : 'text-slate-300 hover:text-slate-400'}`}>
    <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-transparent'}`}>{icon}</div>
    <span className={`text-[9px] font-extrabold tracking-widest uppercase ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
);

const CourseForm: React.FC<{ initialData: Course | null, onSubmit: (c: Course) => void }> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<Course>(initialData || { id: 'c' + Date.now(), name: '', start: '', end: '', content: '', target: Company.SAMSUG, isEnabled: true, attendance: [] });
  return (
    <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-slate-200 border border-white space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      <h4 className="font-extrabold text-slate-800 text-2xl tracking-tighter uppercase">{initialData ? 'Cập nhật đào tạo' : 'Khởi tạo khóa học'}</h4>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Tên chương trình</label>
        <input type="text" className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-sm outline-none font-extrabold border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all" placeholder="Ví dụ: Đào tạo chất lượng công đoạn 1P..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest mb-1 block">Bắt đầu</label>
          <input type="date" className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-sm font-extrabold text-slate-600 border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest mb-1 block">Kết thúc</label>
          <input type="date" className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-sm font-extrabold text-slate-600 border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nội dung cam kết</label>
        <textarea rows={6} className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-sm font-extrabold text-slate-700 border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all resize-none" placeholder="Nhập chi tiết các điều khoản đào tạo..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      </div>
      <button onClick={() => { if(!formData.name || !formData.start || !formData.end) return; onSubmit(formData); }} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-extrabold text-sm uppercase shadow-2xl hover:bg-black active:scale-95 transition-all">Lưu & Triển Khai</button>
    </div>
  );
};

export default AdminDashboard;
