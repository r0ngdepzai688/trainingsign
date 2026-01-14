
import React, { useState, useMemo, useRef } from 'react';
import { User, Course, Confirmation, Role, Company, CourseStatus, AttendanceRecord } from '../types';
import { ICONS, DEFAULT_PASSWORD } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Hàm hỗ trợ loại bỏ dấu tiếng Việt để tránh lỗi font trong PDF
const removeVietnameseTones = (str: string) => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str;
};

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
  const [userTab, setUserTab] = useState<'SEV' | 'Vendor'>('SEV');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getCourseStatus = (course: Course) => {
    const isCompleted = course.attendance.length > 0 && 
      course.attendance.every(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== ''));
    if (isCompleted) return CourseStatus.CLOSED;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(course.start);
    const endDate = new Date(course.end);
    if (now < startDate) return CourseStatus.PLAN;
    if (now > endDate) return CourseStatus.PENDING;
    return CourseStatus.OPENING;
  };

  const getCompletionStats = (course: Course) => {
    const total = course.attendance.length;
    if (total === 0) return { percent: 0, signed: 0, total: 0 };
    const signed = course.attendance.filter(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== '')).length;
    return { percent: Math.round((signed / total) * 100), signed, total };
  };

  const getPendingCountByGroup = (course: Course, groupTag: string) => {
    return course.attendance.filter(a => {
      if (a.status === 'Signed' || (a.reason && a.reason.trim() !== '')) return false;
      const u = users.find(usr => usr.id === a.userId);
      if (!u) return false;
      const part = u.part.toUpperCase();
      if (groupTag === 'G') return part.includes(' G') || part.endsWith('G');
      return part.includes(groupTag);
    }).length;
  };

  const handleExportPDF = (course: Course) => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text(removeVietnameseTones("BAO CAO KET QUA DAO TAO"), 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(removeVietnameseTones(`Ten khoa hoc: ${course.name}`), 14, 35);
      doc.text(`Thoi gian: ${course.start} - ${course.end}`, 14, 42);
      doc.text(`Doi tuong: ${course.target}`, 14, 49);
      
      const content = removeVietnameseTones(`Noi dung: ${course.content || "N/A"}`);
      const splitContent = doc.splitTextToSize(content, 180);
      doc.text(splitContent, 14, 58);

      const tableData = course.attendance.map((a, i) => {
        const u = users.find(usr => usr.id === a.userId);
        let statusText = "CHUA KY";
        if (a.status === 'Signed') statusText = "DA KY";
        else if (a.reason) statusText = `VANG (${removeVietnameseTones(a.reason)})`;
        
        return [
          i + 1,
          u?.id || 'N/A',
          removeVietnameseTones(u?.name || 'N/A'),
          removeVietnameseTones(u?.part || 'N/A'),
          statusText
        ];
      });

      autoTable(doc, {
        startY: 75,
        head: [['STT', 'Ma NV', 'Ho Ten', 'Bo Phan', 'Xac Nhan']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 4: { cellWidth: 50 } }, // Dành chỗ cho chữ ký
        didDrawCell: (data) => {
          if (data.column.index === 4 && data.cell.section === 'body') {
            const rowIndex = data.row.index;
            const att = course.attendance[rowIndex];
            if (att.status === 'Signed' && att.signature) {
              try {
                doc.addImage(att.signature, 'PNG', data.cell.x + 2, data.cell.y + 1, 45, 10);
              } catch (e) {}
            }
          }
        }
      });

      doc.save(`Bao_cao_${course.id}.pdf`);
      showToast("Đã tải PDF!");
    } catch (err) {
      console.error(err);
      showToast("Lỗi xuất PDF!", "error");
    }
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
            const foundKey = Object.keys(row).find(k => k.toLowerCase().replace(/\s/g, '').includes(key.toLowerCase()));
            if (foundKey) return row[foundKey];
          }
          return '';
        };

        const imported = jsonData.map((row: any) => ({
          id: String(getVal(row, ['id', 'manhanvien', 'mnv', 'staffid', 'manv']) || '').trim().padStart(8, '0'),
          name: String(getVal(row, ['name', 'hova', 'hoten', 'fullname']) || '').trim(),
          part: String(getVal(row, ['part', 'bophan', 'dept']) || 'N/A').trim(),
          group: String(getVal(row, ['group', 'nhom', 'team']) || 'N/A').trim(),
          role: Role.USER, 
          password: DEFAULT_PASSWORD, 
          company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR
        })).filter(u => u.id && u.id !== '00000000' && u.name);
        
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          return [...prev, ...imported.filter(i => !existingIds.has(i.id))];
        });
        showToast(`Đã thêm ${imported.length} nhân sự`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) { showToast("Lỗi file!", "error"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const activeCourses = courses.filter(c => getCourseStatus(c) !== CourseStatus.CLOSED);
  const finishedCourses = courses.filter(c => getCourseStatus(c) === CourseStatus.CLOSED);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFF]">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-lg font-bold text-xs text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white border-b p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs">IQC</div>
          <h2 className="font-black text-slate-800 text-base">Training Pro</h2>
        </div>
        <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500">{ICONS.Power}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {activeTab === 'create' && <CourseForm users={users} onSubmit={(c, list) => { onCreateCourse(c, list); setActiveTab('acting'); }} />}

        {activeTab === 'acting' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-slate-50 text-slate-400 uppercase font-black">
                    <tr>
                      <th className="p-4 text-left">KHÓA ĐÀO TẠO & TIẾN ĐỘ</th>
                      <th className="p-4 text-center">G</th>
                      <th className="p-4 text-center">1P</th>
                      <th className="p-4 text-center">2P</th>
                      <th className="p-4 text-center">3P</th>
                      <th className="p-4 text-center">TF</th>
                      <th className="p-4 text-center">XỬ LÝ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeCourses.map(c => {
                      const stats = getCompletionStats(c);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <div className="font-black text-slate-700 mb-1">{c.name}</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${stats.percent}%` }}></div>
                              </div>
                              <span className="font-black text-blue-600">{stats.percent}%</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Đã ký: {stats.signed}/{stats.total}</div>
                          </td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, 'G')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '1P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '2P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '3P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, 'TF')}</td>
                          <td className="p-4 text-center space-x-1">
                            <button onClick={() => handleExportPDF(c)} className="text-emerald-500 p-1">{ICONS.Pdf}</button>
                            <button onClick={() => onDeleteCourse(c.id)} className="text-red-300 p-1">{ICONS.Trash}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finished' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800">Lịch sử hoàn thành</h3>
            {finishedCourses.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-3xl border flex items-center justify-between">
                <div>
                  <div className="font-black text-slate-800 text-sm">{c.name}</div>
                  <div className="text-[10px] font-bold text-slate-400">{c.start} - {c.end}</div>
                </div>
                <button onClick={() => handleExportPDF(c)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg">{ICONS.Pdf}</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border shadow-sm">
               <h3 className="font-black text-slate-800">Quản lý nhân sự</h3>
               <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer">
                 IMPORT EXCEL
                 <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
               </label>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setUserTab('SEV')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SAMSUNG</button>
              <button onClick={() => setUserTab('Vendor')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>VENDOR</button>
            </div>
            <div className="bg-white rounded-[2rem] border overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b">
                  <tr>
                    <th className="p-4 text-left">HỌ TÊN / ID</th>
                    <th className="p-4 text-left">BỘ PHẬN</th>
                    <th className="p-4 text-left">NHÓM</th>
                    <th className="p-4 text-center w-12">XÓA</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.filter(u => userTab === 'SEV' ? u.company === Company.SAMSUG : u.company === Company.VENDOR).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="font-black text-slate-700">{u.name}</div>
                        <div className="text-blue-500 font-bold opacity-70">ID: {u.id}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-500 uppercase">{u.part}</td>
                      <td className="p-4 font-bold text-blue-600 uppercase bg-blue-50/30">{u.group}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => setUsers(prev => prev.filter(x => x.id !== u.id))} className="text-red-300 hover:text-red-500 transition-colors">{ICONS.Trash}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/80 backdrop-blur-xl border-t px-6 py-4 fixed bottom-0 left-0 right-0 flex justify-between items-center max-w-lg mx-auto rounded-t-3xl shadow-lg z-50">
        <TabButton active={activeTab === 'create'} icon={ICONS.Plus} label="Tạo mới" onClick={() => setActiveTab('create')} />
        <TabButton active={activeTab === 'acting'} icon={ICONS.FileText} label="Tiến độ" onClick={() => setActiveTab('acting')} />
        <TabButton active={activeTab === 'finished'} icon={ICONS.Check} label="Báo cáo" onClick={() => setActiveTab('finished')} />
        <TabButton active={activeTab === 'users'} icon={ICONS.User} label="Nhân sự" onClick={() => setActiveTab('users')} />
      </div>
    </div>
  );
};

const TabButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-blue-600' : 'text-slate-300'}`}>
    <div className={`p-2 rounded-xl ${active ? 'bg-blue-600 text-white shadow-md' : ''}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

const CourseForm = ({ users, onSubmit }: { users: User[], onSubmit: (c: Course, specificUsers?: User[]) => void }) => {
  const [formData, setFormData] = useState<any>({ id: 'c' + Date.now(), name: '', start: '', end: '', content: '', target: 'SEV_IQC', isEnabled: true, attendance: [] });
  const [targetType, setTargetType] = useState<'SEV_IQC' | 'VENDOR' | 'EXCEL'>('SEV_IQC');
  const [specificUsers, setSpecificUsers] = useState<User[]>([]);

  const handleExcel = (e: any) => {
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
            const foundKey = Object.keys(row).find(k => k.toLowerCase().replace(/\s/g, '').includes(key.toLowerCase()));
            if (foundKey) return row[foundKey];
          }
          return '';
        };
        const list = jsonData.map((row: any) => ({
          id: String(getVal(row, ['id', 'manhanvien', 'mnv', 'staffid', 'manv']) || '').trim().padStart(8, '0'),
          name: String(getVal(row, ['name', 'hova', 'hoten', 'fullname']) || '').trim(),
          part: String(getVal(row, ['part', 'bophan', 'dept']) || 'N/A').trim(),
          group: String(getVal(row, ['group', 'nhom', 'team']) || 'N/A').trim(),
          role: Role.USER, password: DEFAULT_PASSWORD, company: Company.SAMSUG
        })).filter(u => u.id && u.id !== '00000000' && u.name);
        setSpecificUsers(list);
      } catch (err) { alert('Lỗi file Excel!'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCreate = () => {
    if (!formData.name || !formData.start || !formData.end) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    let finalUsers: User[] = [];
    if (targetType === 'SEV_IQC') {
      finalUsers = users.filter(u => u.group.toUpperCase().includes('IQC G'));
    } else if (targetType === 'VENDOR') {
      finalUsers = users.filter(u => u.company === Company.VENDOR);
    } else {
      finalUsers = [...specificUsers];
    }
    if (finalUsers.length === 0) {
      alert("Không tìm thấy nhân sự phù hợp!");
      return;
    }
    onSubmit({ ...formData, target: targetType === 'VENDOR' ? Company.VENDOR : Company.SAMSUG }, finalUsers);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border space-y-5">
      <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Khởi tạo đào tạo</h4>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tên khóa học</label>
        <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border focus:border-blue-300 transition-all" placeholder="Nhập tên khóa học..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Bắt đầu</label>
          <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Kết thúc</label>
          <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Đối tượng đào tạo</label>
        <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border focus:border-blue-300 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]" 
          value={targetType} onChange={e => setTargetType(e.target.value as any)}>
          <option value="SEV_IQC">Samsung IQC (Nhóm IQC G)</option>
          <option value="VENDOR">Vendor (Toàn bộ nhà thầu)</option>
          <option value="EXCEL">Danh sách riêng (Tải tệp Excel)</option>
        </select>
      </div>
      {targetType === 'EXCEL' && (
        <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
          <input type="file" className="text-[10px] w-full" onChange={handleExcel} />
          {specificUsers.length > 0 && <p className="text-[10px] font-black text-emerald-500 mt-2">✅ Đã nhận {specificUsers.length} nhân sự</p>}
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nội dung cam kết</label>
        <textarea rows={3} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border focus:border-blue-300 transition-all" placeholder="Nhập nội dung..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      </div>
      <button onClick={handleCreate} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">BẮT ĐẦU TRIỂN KHAI</button>
    </div>
  );
};

export default AdminDashboard;
