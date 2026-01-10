
import React, { useState } from 'react';
import { ICONS, DEFAULT_PASSWORD, GROUPS, PARTS } from '../constants';
import { User, Role, Company } from '../types';

interface LoginViewProps {
  onLogin: (id: string, pass: string, remember: boolean) => void;
  onRegister: (user: User) => void;
  loading: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, loading }) => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [showPass, setShowPass] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    password: '',
    remember: false
  });

  const [regData, setRegData] = useState({
    id: '',
    name: '',
    part: PARTS[0],
    group: GROUPS[0],
    company: Company.SAMSUG
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.password) {
      alert("Vui lòng điền đầy đủ Mã nhân viên và Mật khẩu!");
      return;
    }
    onLogin(formData.id, formData.password, formData.remember);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = regData.id.padStart(8, '0');
    if (id.length !== 8) {
      alert("Mã nhân viên phải có 8 chữ số!");
      return;
    }
    if (!regData.name.trim()) {
      alert("Vui lòng nhập Họ và Tên!");
      return;
    }
    
    const newUser: User = {
      ...regData,
      id,
      role: Role.USER,
      password: DEFAULT_PASSWORD
    };
    onRegister(newUser);
    setView('login');
  };

  const handleForgotPassword = () => {
    alert(`Mật khẩu mặc định cố định là ${DEFAULT_PASSWORD}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 max-w-lg mx-auto relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-5%] right-[-5%] w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50"></div>

      <div className="w-full max-w-sm space-y-8 z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white shadow-2xl rounded-[2rem] flex items-center justify-center mb-6 border border-gray-50 ring-4 ring-blue-50/50">
            <div className="text-center">
              <span className="text-blue-600 font-black text-3xl block leading-none">IQC</span>
              <span className="text-slate-400 font-bold text-[10px] tracking-[0.2em] mt-1 uppercase">PRO</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {view === 'login' ? 'IQC training Pro' : 'Đăng ký mới'}
          </h1>
          <p className="text-slate-400 text-[10px] mt-2 uppercase tracking-[0.15em] font-black">
            {view === 'login' ? 'HỆ THỐNG XÁC NHẬN ĐÀO TẠO ONLINE' : 'HỆ THỐNG XÁC NHẬN ĐÀO TẠO'}
          </p>
        </div>

        {view === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4 absolute -top-2 bg-white px-2 z-10 transition-colors group-focus-within:text-blue-600">
                  MÃ NHÂN VIÊN (8 SỐ)
                </label>
                <div className="flex items-center bg-gray-50/80 rounded-2xl border border-gray-100 p-4 transition-all focus-within:ring-4 focus-within:ring-blue-100/50 focus-within:bg-white focus-within:border-blue-400">
                  <span className="text-slate-300 mr-3">{ICONS.User}</span>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="Nhập 8 số ID..."
                    className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-300 font-medium"
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value.replace(/\D/g, '')})}
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4 absolute -top-2 bg-white px-2 z-10 transition-colors group-focus-within:text-blue-600">
                  MẬT KHẨU
                </label>
                <div className="flex items-center bg-gray-50/80 rounded-2xl border border-gray-100 p-4 transition-all focus-within:ring-4 focus-within:ring-blue-100/50 focus-within:bg-white focus-within:border-blue-400">
                  <span className="text-slate-300 mr-3">{ICONS.Lock}</span>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-300 font-medium"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(!showPass)}
                    className="text-slate-300 hover:text-slate-600 ml-2 transition-colors"
                  >
                    {showPass ? ICONS.EyeOff : ICONS.Eye}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] px-1 font-bold">
              <label className="flex items-center text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  checked={formData.remember}
                  onChange={(e) => setFormData({...formData, remember: e.target.checked})}
                />
                Ghi nhớ tài khoản
              </label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              disabled={loading}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>ĐĂNG NHẬP NGAY</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">CÔNG TY</label>
                 <select 
                   className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm outline-none font-bold text-slate-700"
                   value={regData.company}
                   onChange={(e) => setRegData({...regData, company: e.target.value as Company})}
                 >
                   <option value={Company.SAMSUG}>Samsung</option>
                   <option value={Company.VENDOR}>Vendor</option>
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">ID (8 SỐ)</label>
                 <input 
                   type="text" 
                   required
                   maxLength={8}
                   className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm outline-none font-bold"
                   placeholder="00123456"
                   value={regData.id}
                   onChange={(e) => setRegData({...regData, id: e.target.value.replace(/\D/g, '')})}
                 />
               </div>
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">HỌ VÀ TÊN</label>
               <input 
                 type="text" 
                 required
                 className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm outline-none font-bold"
                 placeholder="Nguyễn Văn A"
                 value={regData.name}
                 onChange={(e) => setRegData({...regData, name: e.target.value})}
               />
             </div>

             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">BỘ PHẬN</label>
                 <select 
                   className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm outline-none font-bold"
                   value={regData.part}
                   onChange={(e) => setRegData({...regData, part: e.target.value})}
                 >
                   {PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">NHÓM</label>
                 <select 
                   className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm outline-none font-bold"
                   value={regData.group}
                   onChange={(e) => setRegData({...regData, group: e.target.value})}
                 >
                   {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
               </div>
             </div>

             <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-center gap-2">
               <div className="text-blue-600">{ICONS.Lock}</div>
               <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">
                 MẬT KHẨU MẶC ĐỊNH: {DEFAULT_PASSWORD}
               </p>
             </div>

             <button className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all">
                XÁC NHẬN ĐĂNG KÝ
             </button>
          </form>
        )}

        <div className="text-center pt-4 border-t border-gray-100">
          <button 
            type="button" 
            onClick={() => setView(view === 'login' ? 'register' : 'login')}
            className="text-slate-400 font-black hover:text-slate-600 tracking-[0.1em] text-[10px] uppercase transition-colors"
          >
            {view === 'login' ? 'CHƯA CÓ TÀI KHOẢN? ĐĂNG KÝ NGAY' : 'ĐÃ CÓ TÀI KHOẢN? ĐĂNG NHẬP'}
          </button>
          <div className="mt-8 flex flex-col items-center gap-1">
             <p className="text-[8px] text-slate-300 uppercase font-black tracking-[0.2em]">Designed by IQC Quality Team</p>
             <p className="text-[8px] text-slate-200 uppercase font-bold tracking-widest">HAI.DUONG(10545998)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
