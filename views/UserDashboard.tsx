
import React, { useState, useRef, useEffect } from 'react';
import { User, Course, Confirmation } from '../types';
import { ICONS } from '../constants';

interface UserDashboardProps {
  user: User; courses: Course[]; confirmations: Confirmation[];
  onConfirm: (conf: Confirmation) => void; onLogout: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, courses, confirmations, onConfirm, onLogout }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  // Logic lọc khóa học cần ký
  const pending = courses.filter(c => {
    const isTarget = c.target === user.company;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startDate = new Date(c.start);
    const endDate = new Date(c.end);
    
    // Đã ký chưa? (Kiểm tra trong confirmations từ Firebase)
    const signed = confirmations.some(conf => conf.courseId === c.id && conf.userId === user.id);
    const isOpening = c.isEnabled && now >= startDate && now <= endDate;

    return isTarget && isOpening && !signed;
  });

  useEffect(() => {
    if (!selectedCourse || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let drawing = false;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    const start = (e: any) => { 
      drawing = true; 
      ctx.beginPath();
      const pos = getPos(e);
      ctx.moveTo(pos.x, pos.y);
    };
    
    const end = () => { 
      if (drawing) {
        drawing = false; 
        setIsSigned(true);
      }
    };

    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const draw = (e: any) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchmove', draw, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('touchstart', start);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchmove', draw);
    };
  }, [selectedCourse]);

  if (selectedCourse) {
    return (
      <div className="flex-1 flex flex-col bg-white h-screen">
        <div className="bg-slate-900 p-4 text-white font-black uppercase text-center shrink-0">XÁC NHẬN ĐÀO TẠO</div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          <h2 className="text-xl font-black text-slate-800">{selectedCourse.name}</h2>
          <div className="p-4 bg-slate-50 rounded-2xl text-sm italic border text-slate-600 whitespace-pre-line">
            {selectedCourse.content}
          </div>
          <div className="space-y-4 pt-4 border-t">
            <label className="flex items-start gap-3 font-bold text-sm cursor-pointer select-none">
              <input type="checkbox" className="w-5 h-5 mt-0.5" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} />
              <span>Tôi đã đọc hiểu nội dung và cam kết tuân thủ các quy định nêu trên.</span>
            </label>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                <span>Chữ ký nhân viên</span>
                <button onClick={() => { 
                  const ctx = canvasRef.current?.getContext('2d');
                  ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                  setIsSigned(false); 
                }} className="text-blue-500">Xóa ký lại</button>
              </div>
              <canvas ref={canvasRef} className="w-full h-44 border-2 border-dashed rounded-2xl bg-slate-50 touch-none cursor-crosshair" />
            </div>
          </div>
        </div>
        <div className="p-6 bg-white border-t shrink-0">
          <button className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all ${isAgreed && isSigned ? 'bg-blue-600 text-white active:scale-95' : 'bg-slate-100 text-slate-300'}`} 
            onClick={() => {
              if(!isAgreed || !isSigned) return;
              onConfirm({ 
                courseId: selectedCourse.id, 
                userId: user.id, 
                timestamp: new Date().toLocaleString('vi-VN'), 
                signature: canvasRef.current?.toDataURL() || '' 
              });
              setSelectedCourse(null); setIsSigned(false); setIsAgreed(false);
            }}>XÁC NHẬN HOÀN THÀNH</button>
          <button onClick={() => { setSelectedCourse(null); setIsSigned(false); setIsAgreed(false); }} className="w-full mt-2 text-slate-400 font-bold text-xs uppercase py-2">Hủy bỏ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      <div className="bg-slate-900 p-8 rounded-b-[3rem] shadow-xl text-white shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black">Chào {user.name.split(' ').pop()}! 👋</h2>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{user.part} • {user.group}</p>
          </div>
          <button onClick={onLogout} className="bg-white/10 p-3 rounded-2xl text-white/60 hover:text-white transition-colors">{ICONS.Power}</button>
        </div>
        <div className="bg-white/10 p-4 rounded-3xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-blue-200">Khóa học cần ký</div>
            <div className="text-3xl font-black">{pending.length}</div>
          </div>
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">{ICONS.FileText}</div>
        </div>
      </div>
      <div className="flex-1 -mt-6 px-6 overflow-y-auto pb-10">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Danh sách đào tạo</h3>
          {pending.length === 0 ? (
            <div className="bg-white p-10 rounded-[2.5rem] text-center shadow-sm border border-dashed border-gray-200">
               <div className="text-emerald-500 mb-3 flex justify-center scale-150">{ICONS.Check}</div>
               <p className="text-slate-400 font-bold text-sm">Tuyệt vời! Bạn đã hoàn thành tất cả các xác nhận đào tạo.</p>
            </div>
          ) : (
            pending.map((c, i) => (
              <div key={c.id} onClick={() => setSelectedCourse(c)} className="bg-white p-5 rounded-[2rem] shadow-sm border flex items-center gap-4 active:scale-95 transition-all cursor-pointer">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">{i+1}</div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 text-sm leading-tight">{c.name}</h4>
                  <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Hết hạn: {c.end}</div>
                </div>
                <div className="text-blue-500">{ICONS.Edit}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
