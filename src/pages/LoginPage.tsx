import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Phone, ArrowRight, ShieldCheck, UserRound, KeyRound, CheckCircle2, Home } from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';
import { Spinner } from '@/components/Feedback';
import { useAuth } from '@/lib/auth';
import { getDefaultRoute } from '@/lib/navigation';

type Tab = 'staff' | 'client';
type ClientStep = 'phone' | 'activate' | 'login';

function toEnglishDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

function sanitizePin(s: string): string {
  return toEnglishDigits(s).replace(/\D/g, '').slice(0, 4);
}

export function LoginPage() {
  const { staffLogin, clientLogin, clientActivate, clientCheckStatus } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('staff');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  // Client login state
  const [clientStep, setClientStep] = useState<ClientStep>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [activationPin, setActivationPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Rate limiting: progressive delay after repeated failures
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const secs = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      setError(`تم تجاوز عدد محاولات الدخول. حاول مرة أخرى بعد ${secs} ثانية.`);
      return;
    }

    setLoading(true);
    try {
      const session = await staffLogin(email, password);
      setLoginAttempts(0);
      setRateLimitedUntil(null);
      navigate(getDefaultRoute(session.permissions ?? [], 'staff'));
    } catch {
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= 5) {
        const delay = Math.min(30, attempts * 5) * 1000;
        setRateLimitedUntil(Date.now() + delay);
        setError('تم تجاوز عدد محاولات الدخول. حاول مرة أخرى لاحقاً.');
      } else {
        setError('تعذر تسجيل الدخول. تحقق من بيانات الدخول وحاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const submitClientPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { needs_activation } = await clientCheckStatus(phone);
      if (needs_activation) {
        setClientStep('activate');
      } else {
        setClientStep('login');
      }
    } catch {
      setError('تعذر التحقق من رقم الهاتف. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const submitClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await clientLogin(phone, pin);
      navigate(getDefaultRoute(session.permissions ?? [], 'client'));
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من رقم الهاتف ورمز PIN.');
    } finally {
      setLoading(false);
    }
  };

  const submitClientActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPin !== confirmPin) {
      setError('رمزا PIN غير متطابقين');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const session = await clientActivate(phone, activationPin, newPin, confirmPin);
      navigate(getDefaultRoute(session.permissions ?? [], 'client'));
    } catch {
      setError('تعذر تفعيل الحساب. تحقق من رمز التفعيل وحاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const resetClient = () => {
    setClientStep('phone');
    setPhone('');
    setPin('');
    setActivationPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10" dir="rtl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-200/40 blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-brand-100/50 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#1952d0 1px, transparent 1px), linear-gradient(90deg, #1952d0 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <ArkonLogo size={56} />
          <h1 className="mt-5 font-display text-2xl font-700 tracking-tight text-slate-900">ARKON</h1>
          <p className="mt-1 text-sm text-slate-500">منصة إدارة العمليات الميدانية للمؤسسات</p>
        </div>

        <div className="card animate-fade-in p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => { setTab('staff'); setError(null); }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-600 transition ${tab === 'staff' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldCheck size={16} /> موظف
            </button>
            <button
              onClick={() => { setTab('client'); setError(null); resetClient(); }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-600 transition ${tab === 'client' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserRound size={16} /> عميل
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600">
              {error}
            </div>
          )}

          {tab === 'staff' ? (
            <form onSubmit={submitStaff} className="space-y-4">
              <div>
                <label className="label">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="أدخل البريد الإلكتروني أو اسم المستخدم" required autoComplete="username" />
                </div>
              </div>
              <div>
                <label className="label">كلمة المرور</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <>تسجيل الدخول <ArrowRight size={16} /></>}
              </button>
            </form>
          ) : clientStep === 'phone' ? (
            <form onSubmit={submitClientPhone} className="space-y-4">
              <div>
                <label className="label">رقم الهاتف</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-10" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="059 000 0000" required dir="ltr" autoComplete="tel" />
                </div>
                <p className="mt-2 text-xs text-slate-500">أدخل رقم الهاتف المسجل في ARKON للمتابعة.</p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <>المتابعة <ArrowRight size={16} /></>}
              </button>
            </form>
          ) : clientStep === 'activate' ? (
            <form onSubmit={submitClientActivate} className="space-y-4">
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                <CheckCircle2 size={16} />
                <span>مرحباً بك! يرجى تفعيل حسابك بإنشاء رمز PIN شخصي.</span>
              </div>
              <div>
                <label className="label">رمز التفعيل المؤقت</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={activationPin}
                    onChange={(e) => setActivationPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    required
                    dir="ltr"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
              <div>
                <label className="label">رمز PIN الجديد (4 أرقام)</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(sanitizePin(e.target.value))}
                    placeholder="••••"
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              </div>
              <div>
                <label className="label">تأكيد رمز PIN</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(sanitizePin(e.target.value))}
                    placeholder="••••"
                    required
                    dir="ltr"
                    autoComplete="new-password"
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <>تفعيل ودخول <ArrowRight size={16} /></>}
              </button>
              <button type="button" onClick={resetClient} className="w-full text-center text-xs text-slate-500 hover:text-slate-700">
                رجوع
              </button>
            </form>
          ) : (
            <form onSubmit={submitClientLogin} className="space-y-4">
              <div>
                <label className="label">رقم الهاتف</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-10" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="059 000 0000" required dir="ltr" autoComplete="tel" />
                </div>
              </div>
              <div>
                <label className="label">رمز PIN (4 أرقام)</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(sanitizePin(e.target.value))}
                    placeholder="••••"
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : <>دخول <ArrowRight size={16} /></>}
              </button>
              <button type="button" onClick={resetClient} className="w-full text-center text-xs text-slate-500 hover:text-slate-700">
                تغيير رقم الهاتف
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ARKON · منصة العمليات المركزية
        </p>

        <div className="mt-4 flex justify-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-600 text-slate-500 transition hover:text-brand-600">
            <Home size={14} />
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
