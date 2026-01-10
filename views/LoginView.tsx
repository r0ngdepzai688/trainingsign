
import React, { useState } from 'react';
import { ICONS, DEFAULT_PASSWORD } from '../constants';
import { User, Role, Company } from '../types';

interface LoginViewProps {
  onLogin: (id: string, pass: string, remember: boolean) => void;
  onRegister: (user: User) => void;
  loading: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, loading }) => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [showPass, setShowPass] = useState(false);
  const [formData, setFormData] = useState({ id: '', password: '', remember: false });
  const [regData, setRegData] = useState({ id: '', name: '', part: '', group: '', company: Company.SAMSUG });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(formData.id, formData.password, formData.remember);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = regData.id.padStart(8, '0');
    if (id.length !== 8) return alert("Mã nhân viên phải có 8 chữ số!");
    if (!regData.name.trim()) return alert("Vui lòng nhập Họ và Tên!");
    
    onRegister({
      ...regData,
      id,
      role: Role.USER,
      password: DEFAULT_PASSWORD,
      part: regData.part || 'N/A',
      group: regData.group || 'N/A'
    });
    setView('login');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 max-w-lg mx-auto relative overflow-hidden">
      <div className="absolute top-[-5%] right-[-5%] w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
      <div className="w-full max-w-sm space-y-8 z-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white shadow-2xl rounded-[2rem] flex items-center justify-center mb-6 border border-gray-50 ring-4 ring-blue-50/50">
            <div className="text-center">
              <span className="text-blue-600 font-black text-3xl block leading-none">IQC</span>
              <span className="text-slate-400 font-bold text-[10px] mt-1 uppercase">PRO</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900">{view === 'login' ? 'IQC training Pro' : 'Đăng ký mới'}</h1>
          <p className="text-slate-400 text-[10px] mt-2 uppercase tracking-[0.15em] font-black">HỆ THỐNG XÁC NHẬN ĐÀO TẠO ONLINE</p>
        </div>

        {view === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4 absolute -top-2 bg-white px-2">ID (8 SỐ)</label>
                <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-slate-300 mr-3">{ICONS.User}</span>
                  <input type="text" maxLength={8} className="bg-transparent outline-none w-full font-bold" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value.replace(/\D/g, '')})} />
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4 absolute -top-2 bg-white px-2">MẬT KHẨU</label>
                <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-slate-300 mr-3">{ICONS.Lock}</span>
                  <input type={showPass ? "text" : "password"} className="bg-transparent outline-none w-full font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPass(!showPass)}>{showPass ? ICONS.EyeOff : ICONS.Eye}</button>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-400">
              <label className="flex items-center cursor-pointer"><input type="checkbox" className="mr-2" checked={formData.remember} onChange={e => setFormData({...formData, remember: e.target.checked})} /> Ghi nhớ</label>
              <button type="button" onClick={() => alert(`Mật khẩu mặc định: ${DEFAULT_PASSWORD}`)} className="text-blue-500">Quên mật khẩu?</button>
            </div>
            <button disabled={loading} className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black shadow-xl">ĐĂNG NHẬP</button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">CÔNG TY</label>
                 <select className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm" value={regData.company} onChange={e => setRegData({...regData, company: e.target.value as Company})}>
                   <option value={Company.SAMSUG}>Samsung</option>
                   <option value={Company.VENDOR}>Vendor</option>
                 </select>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">ID (8 SỐ)</label>
                 <input type="text" maxLength={8} required className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm" value={regData.id} onChange={e => setRegData({...regData, id: e.target.value.replace(/\D/g, '')})} />
               </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">HỌ VÀ TÊN</label>
              <input type="text" required className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">PART</label>
                 <input type="text" placeholder="Ví dụ: IQC 1P..." className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm" value={regData.part} onChange={e => setRegData({...regData, part: e.target.value})} />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">GROUP</label>
                 <input type="text" placeholder="Ví dụ: IQC G..." className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm" value={regData.group} onChange={e => setRegData({...regData, group: e.target.value})} />
               </div>
            </div>
            <button className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black shadow-xl">XÁC NHẬN ĐĂNG KÝ</button>
          </form>
        )}
        <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="w-full text-slate-400 font-black text-[10px] uppercase">{view === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
      </div>
    </div>
  );
};

export default LoginView;
