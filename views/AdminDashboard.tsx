
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
  onCreateCourse: (c: Course, specificUsers?: User[]) => void;
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
    const startDate = new Date(course.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(course.end);
    endDate.setHours(0, 0, 0, 0);

    // ƯU TIÊN 1: Kiểm tra xem đã hoàn thành 100% chưa
    const isCompleted = course.attendance.length > 0 && 
      course.attendance.every(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== ''));

    if (isCompleted) return CourseStatus.CLOSED; // Trạng thái Finished (Xanh lá)

    // ƯU TIÊN 2: Kiểm tra theo thời gian nếu chưa hoàn thành
    if (now < startDate) return CourseStatus.PLAN; // Xám
    if (now > endDate) return CourseStatus.PENDING; // Đỏ
    return CourseStatus.OPENING; // Cam nhấp nháy
  };

  const getCompletionStats = (course: Course) => {
    const total = course.attendance.length;
    if (total === 0) return { percent: 0, signed: 0, total: 0 };
    const signed = course.attendance.filter(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== '')).length;
    return { percent: Math.round((signed / total) * 100), signed, total };
  };

  const getPendingCountByGroup = (course: Course, groupKey: string) => {
    return course.attendance.filter(a => {
      if (a.status !== 'Pending' || (a.reason && a.reason.trim() !== '')) return false;
      const u = users.find(usr => usr.id === a.userId);
      if (!u) return false;
      const p = u.part.toUpperCase();
      switch(groupKey) {
        case 'G': return p.includes(' G') || p.endsWith('G') || p === 'G';
        case '1P': return p.includes('1P');
        case '2P': return p.includes('2P');
        case '3P': return p.includes('3P');
        case 'TF': return p.includes('TF');
        default: return false;
      }
    }).length;
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const StatusDot = ({ status }: { status: CourseStatus }) => {
    switch (status) {
      case CourseStatus.PLAN: 
        return <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" title="Sắp diễn ra" />;
      case CourseStatus.PENDING: 
        return <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" title="Quá hạn" />;
      case CourseStatus.OPENING: 
        return <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.6)] animate-pulse" title="Đang mở" />;
      case CourseStatus.CLOSED: 
        return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" title="Đã hoàn thành" />;
      default: return null;
    }
  };

  const handleExportExcel = (course: Course) => {
    const wb = XLSX.utils.book_new();
    const attendanceData = course.attendance.map((a, i) => {
      const u = users.find(usr => usr.id === a.userId);
      return { 'STT': i+1, 'Họ tên': u?.name, 'Mã NV': u?.id, 'Bộ phận': u?.part, 'Trạng thái': a.status === 'Signed' ? 'Đã ký' : (a.reason ? 'Ngoại lệ' : 'Chưa ký'), 'Lý do': a.reason || '', 'Thời gian': a.timestamp || '' };
    });
    const ws = XLSX.utils.json_to_sheet(attendanceData);
    XLSX.utils.book_append_sheet(wb, ws, "BaoCaoDaoTao");
    XLSX.writeFile(wb, `Bao_cao_${course.name}_${new Date().getTime()}.xlsx`);
    showToast("Đã tải xuống báo cáo!");
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
  const finishedCourses = courses.filter(c => getCourseStatus(c) === CourseStatus.CLOSED);

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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFF] font-['Plus_Jakarta_Sans']">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs transition-all animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.message}
        </div>
      )}

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
        {activeTab === 'create' && (
          <CourseForm 
            initialData={editCourse} 
            onSubmit={(c, list) => { 
              if (!editCourse) onCreateCourse(c, list); 
              else onUpdateCourse(c); 
              setEditCourse(null); 
              setActiveTab('acting'); 
            }} 
          />
        )}

        {activeTab === 'acting' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-white flex flex-col justify-between h-32 hover:shadow-lg transition-shadow">
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
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-white flex flex-col justify-between h-32 hover:shadow-lg transition-shadow">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang triển khai</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-800">{activeCourses.length}</span>
                  <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">{ICONS.FileText}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2">QUẢN LÝ TIẾN ĐỘ ĐÀO TẠO</h3>
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50/50 text-slate-400 uppercase font-black border-b border-slate-100">
                      <tr>
                        <th className="p-5 text-center w-8">ST</th>
                        <th className="p-5 text-left min-w-[200px]">KHÓA ĐÀO TẠO & TIẾN ĐỘ</th>
                        <th className="p-5 text-center min-w-[100px]">THỜI GIAN</th>
                        <th className="p-5 text-center bg-blue-50/20">G</th>
                        <th className="p-5 text-center bg-blue-50/20">1P</th>
                        <th className="p-5 text-center bg-blue-50/20">2P</th>
                        <th className="p-5 text-center bg-blue-50/20">3P</th>
                        <th className="p-5 text-center bg-blue-50/20">TF</th>
                        <th className="p-5 text-center">XỬ LÝ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {activeCourses.filter(c => c.target === Company.SAMSUG).map((c, i) => {
                        const stats = getCompletionStats(c);
                        const progressColor = stats.percent < 50 ? 'bg-red-500' : stats.percent < 80 ? 'bg-amber-500' : 'bg-emerald-500';
                        const status = getCourseStatus(c);
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/30 transition-all group">
                            <td className="p-5 text-center">
                              <StatusDot status={status} />
                            </td>
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
                            <td className="p-5 text-center">
                              <div className="text-[10px] font-black text-slate-400 whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-full inline-block">
                                {formatDateShort(c.start)} <span className="text-slate-200">|</span> {formatDateShort(c.end)}
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

            <div className="bg-white p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">NHẬP LÝ DO NGOẠI LỆ (VẮNG THI / NGHỈ)</h4>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center mb-4 border border-slate-100 focus-within:border-blue-200 transition-all">
                <span className="text-slate-300 mr-4 ml-1">{ICONS.Search}</span>
                <input type="text" className="bg-transparent text-sm w-full outline-none font-extrabold placeholder:text-slate-300" placeholder="Tìm ID hoặc Tên nhân viên chưa ký..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filteredPendingList.length === 0 && pendingSearch && (
                  <div className="p-10 text-center text-slate-300 font-bold text-xs italic">Không tìm thấy dữ liệu phù hợp.</div>
                )}
                {filteredPendingList.map(({course, att, usr}) => (
                  <div key={`${course.id}-${att.userId}`} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-50 shadow-sm hover:border-blue-100 transition-all">
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

        {activeTab === 'finished' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-emerald-100">{ICONS.Check}</div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Lịch sử Báo cáo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 opacity-70">Các chương trình đã hoàn thành xác nhận 100%</p>
                </div>
              </div>

              <div className="space-y-4">
                {finishedCourses.length === 0 ? (
                  <div className="text-center py-24 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="mb-4 opacity-20 flex justify-center">{ICONS.FileText}</div>
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Hiện chưa có khóa học hoàn thành</p>
                  </div>
                ) : (
                  finishedCourses.map(c => {
                    const stats = getCompletionStats(c);
                    return (
                      <div key={c.id} className="group p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-50 transition-all flex items-center gap-6">
                        <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 rounded-2xl flex items-center justify-center transition-all">
                          {ICONS.Pdf}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 group-hover:text-emerald-600 transition-colors">{c.name}</h4>
                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="bg-slate-50 px-2 py-1 rounded-lg">{formatDateShort(c.start)} - {formatDateShort(c.end)}</span>
                            <span className="text-slate-200">•</span>
                            <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">100% HOÀN TẤT</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleExportExcel(c)}
                          className="px-6 py-3.5 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center gap-2"
                        >
                          {ICONS.FileText} XUẤT BÁO CÁO
                        </button>
                      </div>
                    );
                  })
                )}
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

const CourseForm: React.FC<{ 
  initialData: Course | null, 
  onSubmit: (c: Course, specificUsers?: User[]) => void 
}> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState<Course>(initialData || { id: 'c' + Date.now(), name: '', start: '', end: '', content: '', target: Company.SAMSUG, isEnabled: true, attendance: [] });
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [specificUsers, setSpecificUsers] = useState<User[]>([]);
  const [importStatus, setImportStatus] = useState('');

  const handleTargetExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const list = jsonData.map((row: any) => ({
          id: String(getVal(row, ['id', 'mã nhân viên', 'ma nhan vien', 'mnv', 'staff id']) || '').trim().padStart(8, '0'),
          name: String(getVal(row, ['name', 'họ và tên', 'ho va ten', 'họ tên', 'tên']) || 'Nhân viên mới').trim(),
          part: String(getVal(row, ['part', 'bộ phận', 'dept']) || 'N/A').trim(),
          group: String(getVal(row, ['group', 'nhóm', 'team']) || 'N/A').trim(),
          role: Role.USER, password: DEFAULT_PASSWORD, company: formData.target
        })).filter(u => u.id && u.id !== '00000000');
        
        setSpecificUsers(list);
        setImportStatus(`Đã nhận ${list.length} nhân sự`);
      } catch (err) { setImportStatus('Lỗi file!'); }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-slate-200 border border-white space-y-6 animate-in slide-in-from-bottom-4 duration-300 pb-12">
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

      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Đối tượng đào tạo</label>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setTargetType('all')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${targetType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>TOÀN BỘ CÔNG TY</button>
          <button onClick={() => setTargetType('specific')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${targetType === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>DANH SÁCH EXCEL</button>
        </div>

        {targetType === 'specific' && (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 border-dashed animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-600 uppercase">{importStatus || 'Chưa có danh sách'}</span>
              <label className="text-[10px] font-black text-white bg-blue-600 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-blue-700 active:scale-95 transition-all">
                CHỌN FILE EXCEL
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleTargetExcel} />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nội dung cam kết</label>
        <textarea rows={4} className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-sm font-extrabold text-slate-700 border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all resize-none" placeholder="Nhập chi tiết các điều khoản đào tạo..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      </div>

      <button 
        onClick={() => { 
          if(!formData.name || !formData.start || !formData.end) return; 
          if(targetType === 'specific' && specificUsers.length === 0) {
            alert("Vui lòng tải lên danh sách Excel đối tượng đào tạo!");
            return;
          }
          onSubmit(formData, targetType === 'specific' ? specificUsers : undefined); 
        }} 
        className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-extrabold text-sm uppercase shadow-2xl hover:bg-black active:scale-95 transition-all"
      >
        Lưu & Triển Khai
      </button>
    </div>
  );
};

export default AdminDashboard;
