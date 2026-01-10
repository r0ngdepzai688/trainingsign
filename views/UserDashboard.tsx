
import React, { useState } from 'react';
import { User, Course, Confirmation, CourseStatus } from '../types';
import { ICONS } from '../constants';

interface UserDashboardProps {
  user: User;
  courses: Course[];
  confirmations: Confirmation[];
  onConfirm: (conf: Confirmation) => void;
  onLogout: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, courses, confirmations, onConfirm, onLogout }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const pendingCourses = courses.filter(c => {
    const isTarget = c.target === user.company;
    const isOpening = c.isEnabled && new Date() >= new Date(c.start) && new Date() <= new Date(c.end);
    const hasConfirmed = confirmations.some(conf => conf.courseId === c.id && conf.userId === user.id);
    return isTarget && isOpening && !hasConfirmed;
  });

  if (selectedCourse) {
    return (
      <SignatureView 
        user={user} 
        course={selectedCourse} 
        onCancel={() => setSelectedCourse(null)} 
        onSubmit={(sig) => {
          const now = new Date();
          const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
          onConfirm({
            courseId: selectedCourse.id,
            userId: user.id,
            timestamp,
            signature: sig
          });
          setSelectedCourse(null);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* User Header */}
      <div className="bg-slate-900 p-6 pt-12 pb-12 rounded-b-[40px] shadow-xl shadow-slate-200">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-white text-2xl font-bold flex items-center gap-2">
              Xin chào, {user.name.split(' ').pop()}!
              <span className="inline-block animate-bounce">👋</span>
            </h2>
            <p className="text-blue-400 font-semibold text-xs uppercase tracking-widest mt-1">
              {user.part} • {user.group}
            </p>
          </div>
          <button onClick={onLogout} className="bg-white/10 p-3 rounded-2xl text-white backdrop-blur-md hover:bg-white/20 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>

        <div className="bg-white/10 rounded-3xl p-4 backdrop-blur-md border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-blue-200 uppercase font-bold tracking-tight">Cần xác nhận</div>
            <div className="text-3xl font-black text-white">{pendingCourses.length}</div>
          </div>
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
            {ICONS.FileText}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 -mt-6 px-6 pb-6 overflow-y-auto">
        <h3 className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-4 ml-2">KHÓA ĐÀO TẠO ĐANG DIỄN RA</h3>
        <div className="space-y-4">
          {pendingCourses.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-gray-100 flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                {ICONS.Check}
              </div>
              <p className="text-slate-400 text-sm font-medium">Bạn đã hoàn thành tất cả<br/>các khóa học. Tuyệt vời!</p>
            </div>
          ) : (
            pendingCourses.map((c, i) => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCourse(c)}
                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{c.name}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="bg-emerald-50 text-emerald-500 px-2 py-0.5 rounded-full font-bold">OPENING</span>
                    <span>Hết hạn: {c.end}</span>
                  </div>
                </div>
                <div className="text-blue-500">{ICONS.Edit}</div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 border-t border-gray-100 flex justify-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
        IQC TRAINING PRO • MOBILE SYSTEM
      </div>
    </div>
  );
};

const SignatureView: React.FC<{ user: User, course: Course, onCancel: () => void, onSubmit: (sig: string) => void }> = ({ user, course, onCancel, onSubmit }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let drawing = false;
    const startDrawing = (e: any) => {
      drawing = true;
      draw(e);
    };
    const endDrawing = () => {
      drawing = false;
      ctx.beginPath();
      setIsSigned(true);
    };
    const draw = (e: any) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0F172A';

      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    window.addEventListener('mouseup', endDrawing);
    window.addEventListener('touchend', endDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchmove', draw);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      window.removeEventListener('mouseup', endDrawing);
      window.removeEventListener('touchend', endDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchmove', draw);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      setIsSigned(false);
    }
  };

  const handleConfirm = () => {
    if (!isAgreed) return alert("Vui lòng tích xác nhận cam kết!");
    if (!isSigned) return alert("Vui lòng ký xác nhận!");
    const dataUrl = canvasRef.current?.toDataURL();
    if (dataUrl) onSubmit(dataUrl);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
        <button onClick={onCancel} className="text-slate-400 font-bold text-sm uppercase">Hủy bỏ</button>
        <span className="font-bold text-sm uppercase tracking-widest">Ký xác nhận</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 leading-tight">{course.name}</h2>
          <div className="flex gap-4 text-xs text-slate-400 font-medium uppercase tracking-tight">
            <span>Bắt đầu: {course.start}</span>
            <span>Kết thúc: {course.end}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl p-6 text-sm text-slate-600 leading-relaxed italic border border-slate-100">
          {course.content || "Nội dung đào tạo chưa được cập nhật..."}
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isAgreed}
              onChange={e => setIsAgreed(e.target.checked)}
            />
            <span className="text-sm font-bold text-slate-700 leading-tight group-hover:text-blue-600 transition-colors">
              Tôi đã đọc hiểu nội dung trên và cam kết tuân thủ
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chữ ký điện tử</label>
              <button onClick={clear} className="text-[10px] font-bold text-blue-500 uppercase">Ký lại</button>
            </div>
            <div className="signature-pad overflow-hidden">
               <canvas ref={canvasRef} width={400} height={200} className="w-full h-auto cursor-crosshair touch-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-50 z-10">
        <button 
          onClick={handleConfirm}
          className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-[0.98] ${isAgreed && isSigned ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-slate-100 text-slate-300'}`}
        >
          Xác nhận hoàn thành
        </button>
      </div>
    </div>
  );
};

export default UserDashboard;
