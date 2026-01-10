
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

  const pending = courses.filter(c => {
    const isTarget = c.target === user.company;
    const isOpening = c.isEnabled && new Date() >= new Date(c.start) && new Date() <= new Date(c.end);
    const signed = confirmations.some(conf => conf.courseId === c.id && conf.userId === user.id);
    return isTarget && isOpening && !signed;
  });

  useEffect(() => {
    if (!selectedCourse || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let drawing = false;
    const start = (e: any) => { drawing = true; draw(e); };
    const end = () => { drawing = false; ctx.beginPath(); setIsSigned(true); };
    const draw = (e: any) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
      ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
    };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('touchstart', start);
    window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
    canvas.addEventListener('mousemove', draw); canvas.addEventListener('touchmove', draw);
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('touchstart', start);
      window.removeEventListener('mouseup', end); window.removeEventListener('touchend', end);
      canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('touchmove', draw);
    };
  }, [selectedCourse]);

  if (selectedCourse) {
    return (
      <div className="flex-1 flex flex-col bg-white h-screen">
        <div className="bg-slate-900 p-4 text-white font-black uppercase text-center shrink-0">XÁC NHẬN ĐÀO TẠO</div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          <h2 className="text-xl font-black text-slate-800">{selectedCourse.name}</h2>
          <div className="p-4 bg-slate-50 rounded-2xl text-sm italic border">{selectedCourse.content}</div>
          <div className="space-y-4 pt-4 border-t">
            <label className="flex items-center gap-3 font-bold text-sm">
              <input type="checkbox" className="w-5 h-5" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} />
              Tôi đã đọc hiểu nội dung và cam kết tuân thủ
            </label>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Chữ ký</span><button onClick={() => { canvasRef.current?.getContext('2d')?.clearRect(0,0,400,200); setIsSigned(false); }} className="text-blue-500">Ký lại</button></div>
              <canvas ref={canvasRef} width={400} height={200} className="w-full h-40 border-2 border-dashed rounded-2xl bg-slate-50 touch-none" />
            </div>
          </div>
        </div>
        <div className="p-6 bg-white border-t shrink-0">
          <button className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl ${isAgreed && isSigned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`} 
            onClick={() => {
              if(!isAgreed || !isSigned) return;
              onConfirm({ courseId: selectedCourse.id, userId: user.id, timestamp: new Date().toLocaleString(), signature: canvasRef.current?.toDataURL() || '' });
              setSelectedCourse(null); setIsSigned(false); setIsAgreed(false);
            }}>XÁC NHẬN HOÀN THÀNH</button>
          <button onClick={() => setSelectedCourse(null)} className="w-full mt-2 text-slate-400 font-bold text-xs uppercase py-2">Quay lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      <div className="bg-slate-900 p-8 rounded-b-[3rem] shadow-xl text-white shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-2xl font-black">Chào {user.name.split(' ').pop()}! 👋</h2><p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{user.part} • {user.group}</p></div>
          <button onClick={onLogout} className="bg-white/10 p-3 rounded-2xl">{ICONS.Power}</button>
        </div>
        <div className="bg-white/10 p-4 rounded-3xl border border-white/10 flex items-center justify-between">
          <div><div className="text-[10px] font-black uppercase text-blue-200">Cần xác nhận</div><div className="text-3xl font-black">{pending.length}</div></div>
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">{ICONS.FileText}</div>
        </div>
      </div>
      <div className="flex-1 -mt-6 px-6 overflow-y-auto pb-10">
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="bg-white p-10 rounded-[2.5rem] text-center shadow-sm border border-dashed border-gray-200">
               <div className="text-emerald-500 mb-2 flex justify-center">{ICONS.Check}</div>
               <p className="text-slate-400 font-bold text-sm">Bạn đã hoàn thành tất cả!</p>
            </div>
          ) : (
            pending.map((c, i) => (
              <div key={c.id} onClick={() => setSelectedCourse(c)} className="bg-white p-5 rounded-[2rem] shadow-sm border flex items-center gap-4 active:scale-95 transition-all">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">{i+1}</div>
                <div className="flex-1"><h4 className="font-black text-slate-800 text-sm">{c.name}</h4><div className="text-[9px] font-bold text-slate-400 uppercase">Hạn: {c.end}</div></div>
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
