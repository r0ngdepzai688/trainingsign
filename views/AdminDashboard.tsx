
import React, { useState, useMemo, useRef } from 'react';
import { User, Course, Confirmation, Role, Company, CourseStatus, AttendanceRecord } from '../types';
import { ICONS, DEFAULT_PASSWORD } from '../constants';
import * as XLSX from 'xlsx';
// @ts-ignore
import ExcelJS from 'exceljs';

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
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * Xuất Excel chuyên nghiệp với ExcelJS (Hỗ trợ ảnh chữ ký)
   */
  const handleExportExcel = async (course: Course) => {
    try {
      showToast("Đang khởi tạo báo cáo...");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kết Quả Đào Tạo');

      // 1. Định dạng chung cho tiêu đề lớn
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'BÁO CÁO KẾT QUẢ ĐÀO TẠO CHI TIẾT';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

      // 2. Thông tin chung về khóa học
      const infoRows = [
        ['', ''],
        ['Tên khóa học:', course.name],
        ['Thời gian triển khai:', `${course.start} đến ${course.end}`],
        ['Đối tượng:', course.target],
        ['Nội dung cam kết:', course.content || 'N/A'],
        ['Ngày kết xuất:', new Date().toLocaleString('vi-VN')],
        ['', '']
      ];

      infoRows.forEach((row, idx) => {
        const r = worksheet.addRow(row);
        r.getCell(1).font = { bold: true };
        if (idx === 4) { // Nội dung cam kết
          r.height = 40;
          r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
        }
      });

      // 3. Định nghĩa Header bảng
      const headerRow = worksheet.addRow([
        'STT', 
        'Mã Nhân Viên', 
        'Họ Và Tên', 
        'Bộ Phận', 
        'Nhóm', 
        'Trạng Thái', 
        'Chữ Ký / Lý Do', 
        'Thời Gian Xác Nhận'
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      headerRow.height = 30;

      // 4. Cấu hình độ rộng cột
      worksheet.columns = [
        { width: 8 },  // STT
        { width: 15 }, // Mã NV
        { width: 25 }, // Họ Tên
        { width: 20 }, // Bộ Phận
        { width: 15 }, // Nhóm
        { width: 20 }, // Trạng Thái
        { width: 40 }, // Chữ Ký / Lý Do (Rộng để chứa ảnh)
        { width: 25 }, // Thời Gian
      ];

      // 5. Thêm dữ liệu từng hàng
      for (let i = 0; i < course.attendance.length; i++) {
        const a = course.attendance[i];
        const u = users.find(usr => usr.id === a.userId);
        
        let statusText = "Chưa ký";
        if (a.status === 'Signed') statusText = "Đã ký xác nhận";
        else if (a.reason) statusText = "Vắng (Ngoại lệ)";

        const row = worksheet.addRow([
          i + 1,
          u?.id || 'N/A',
          u?.name || 'N/A',
          u?.part || 'N/A',
          u?.group || 'N/A',
          statusText,
          a.reason || "", // Nếu có chữ ký sẽ đè lên ô này
          a.timestamp || ""
        ]);

        row.height = 45; // Chiều cao hàng lớn để hiển thị chữ ký rõ ràng
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // 6. Xử lý chèn ảnh chữ ký
        if (a.status === 'Signed' && a.signature) {
          try {
            const imageId = workbook.addImage({
              base64: a.signature,
              extension: 'png',
            });
            
            // Tính toán vị trí chèn ảnh vào cột G (index 7) của hàng hiện tại
            worksheet.addImage(imageId, {
              tl: { col: 6, row: row.number - 1 },
              ext: { width: 120, height: 40 },
              editAs: 'oneCell'
            });
            
            // Xóa text ở ô G để chỉ hiển thị ảnh
            row.getCell(7).value = "";
          } catch (err) {
            console.error("Lỗi chèn ảnh chữ ký:", err);
            row.getCell(7).value = "Lỗi hiển thị ảnh";
          }
        }
      }

      // 7. Xuất file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Bao_cao_Dao_tao_${course.id}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      showToast("Xuất báo cáo Excel thành công!");
    } catch (err: any) {
      console.error("Lỗi Excel chuyên nghiệp:", err);
      showToast("Lỗi: " + err.message, "error");
    }
  };

  const getCourseStatus = (course: Course) => {
    const isCompleted = course.attendance.length > 0 && 
      course.attendance.every(a => a.status === 'Signed' || (a.reason && a.reason.trim() !== ''));
    if (isCompleted) return CourseStatus.CLOSED;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(course.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(course.end);
    endDate.setHours(0, 0, 0, 0);
    if (now < startDate) return CourseStatus.PLAN;
    if (now > endDate) return CourseStatus.PENDING;
    return CourseStatus.OPENING;
  };

  const getStatusUI = (status: CourseStatus) => {
    switch (status) {
      case CourseStatus.PLAN: return { color: 'bg-slate-400', label: 'Chưa tới' };
      case CourseStatus.OPENING: return { color: 'bg-blue-500', label: 'Đang mở' };
      case CourseStatus.PENDING: return { color: 'bg-amber-500', label: 'Quá hạn' };
      case CourseStatus.CLOSED: return { color: 'bg-emerald-500', label: 'Đã đóng' };
      default: return { color: 'bg-slate-300', label: 'N/A' };
    }
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
          role: Role.USER, password: DEFAULT_PASSWORD, company: userTab === 'SEV' ? Company.SAMSUG : Company.VENDOR
        })).filter(u => u.id && u.id !== '00000000' && u.name);
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          return [...prev, ...imported.filter(i => !existingIds.has(i.id))];
        });
        showToast(`Đã thêm ${imported.length} nhân sự`);
      } catch (err) { showToast("Lỗi file!", "error"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const activeCourses = courses.filter(c => getCourseStatus(c) !== CourseStatus.CLOSED);
  const finishedCourses = courses.filter(c => getCourseStatus(c) === CourseStatus.CLOSED);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const filteredPendingAttendance = useMemo(() => {
    if (!viewingCourse) return [];
    const pending = viewingCourse.attendance.filter(a => a.status === 'Pending');
    if (!searchTerm.trim()) return pending;
    const query = searchTerm.toLowerCase().trim();
    return pending.filter(a => {
      const u = users.find(x => x.id === a.userId);
      if (!u) return false;
      return u.name.toLowerCase().includes(query) || u.id.includes(query);
    });
  }, [viewingCourse, searchTerm, users]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFF]">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-lg font-bold text-xs text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      {viewingCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase leading-tight">{viewingCourse.name}</h3>
                <p className="text-[10px] font-black text-slate-400 mt-1">QUẢN LÝ NGOẠI LỆ / CHƯA KÝ</p>
              </div>
              <button onClick={() => { setViewingCourse(null); setSearchTerm(''); }} className="p-2 bg-slate-100 rounded-xl text-slate-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 border-b bg-slate-50">
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {ICONS.Search}
                </span>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm nhân viên..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {filteredPendingAttendance.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                  <p className="text-slate-400 font-bold text-sm">Không tìm thấy kết quả.</p>
                </div>
              ) : (
                filteredPendingAttendance.map(a => {
                  const u = users.find(x => x.id === a.userId);
                  return (
                    <div key={a.userId} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-slate-800 text-sm">{u?.name || 'Unknown'}</div>
                          <div className="text-[10px] font-bold text-blue-500">{u?.id} • {u?.part}</div>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Nhập lý do vắng mặt..." 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold outline-none"
                        defaultValue={a.reason || ''}
                        onBlur={(e) => {
                          const newReason = e.target.value;
                          if (newReason !== a.reason) {
                            const updatedCourse = {
                              ...viewingCourse,
                              attendance: viewingCourse.attendance.map(att => 
                                att.userId === a.userId ? { ...att, reason: newReason } : att
                              )
                            };
                            onUpdateCourse(updatedCourse);
                            setViewingCourse(updatedCourse);
                          }
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-6 border-t bg-white">
              <button onClick={() => { setViewingCourse(null); setSearchTerm(''); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl">ĐÓNG</button>
            </div>
          </div>
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
                      const status = getCourseStatus(c);
                      const ui = getStatusUI(status);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <div className="flex items-center gap-2 mb-1.5">
                               <div className={`w-2 h-2 rounded-full ${ui.color}`}></div>
                               <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                                 {ui.label} • {formatDate(c.start)}-{formatDate(c.end)}
                               </span>
                            </div>
                            <div className="font-black text-slate-800 mb-2">{c.name}</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${stats.percent}%` }}></div>
                              </div>
                              <span className="font-black text-blue-600">{stats.percent}%</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Ký: {stats.signed}/{stats.total}</div>
                          </td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, 'G')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '1P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '2P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, '3P')}</td>
                          <td className="p-4 text-center font-black text-red-500">{getPendingCountByGroup(c, 'TF')}</td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col gap-2 items-center">
                              <button onClick={() => setViewingCourse(c)} className="text-blue-500 p-1">{ICONS.Eye}</button>
                              <button onClick={() => handleExportExcel(c)} className="text-emerald-500 p-1" title="Xuất Excel Báo Cáo">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                              </button>
                              <button onClick={() => onDeleteCourse(c.id)} className="text-red-300 p-1">{ICONS.Trash}</button>
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
        )}

        {activeTab === 'finished' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800">Lịch sử hoàn thành</h3>
            {finishedCourses.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-3xl border flex items-center justify-between shadow-sm">
                <div>
                  <div className="font-black text-slate-800 text-sm">{c.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{formatDate(c.start)} - {formatDate(c.end)}</div>
                </div>
                <button onClick={() => handleExportExcel(c)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border shadow-sm">
               <h3 className="font-black text-slate-800">Quản lý nhân sự</h3>
               <label className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer active:scale-95 transition-transform">
                 IMPORT EXCEL
                 <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
               </label>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setUserTab('SEV')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${userTab === 'SEV' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SAMSUNG</button>
              <button onClick={() => setUserTab('Vendor')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${userTab === 'Vendor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>VENDOR</button>
            </div>
            <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
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
                      <td className="p-4 font-bold text-blue-600 uppercase">
                        <span className="bg-blue-50 px-2 py-1 rounded-md">{u.group}</span>
                      </td>
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
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-md scale-110' : ''}`}>{icon}</div>
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
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
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
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nội dung cam kết</label>
        <textarea rows={3} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm border focus:border-blue-300 transition-all" placeholder="Nhập nội dung cam kết..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
      </div>
      <button onClick={handleCreate} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">BẮT ĐẦU TRIỂN KHAI</button>
    </div>
  );
};

export default AdminDashboard;
