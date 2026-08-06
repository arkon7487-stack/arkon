import { useEffect, useState } from 'react';
import { Building2, Save, Bell, QrCode, Shield, Clock, Volume2, Globe, MessageSquare } from 'lucide-react';
import { settingsService } from '@/services/settingsService';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useToast } from '@/components/Toast';
import { PageLoader } from '@/components/Feedback';
import { Field } from '@/components/ui';
import { getPreferences, updatePreferences } from '@/lib/notifications/preferences';
import { requestBrowserNotificationPermission } from '@/lib/notifications/manager';
import type { NotificationPreferences } from '@/lib/notifications/types';

export function SettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('ARKON');
  const [legalName, setLegalName] = useState('ARKON Enterprise');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('info@arkon.enterprise');
  const [businessHours, setBusinessHours] = useState('08:00-17:00');
  const [currency, setCurrency] = useState('ILS');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [qrPrefix, setQrPrefix] = useState('ARKON');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getPreferences());

  useEffect(() => {
    (async () => {
      try {
        const settings = await settingsService.getAll();
        if (settings['company_name']) setCompanyName(String(settings['company_name']));
        if (settings['legal_name']) setLegalName(String(settings['legal_name']));
        if (settings['address']) setAddress(String(settings['address']));
        if (settings['phone']) setPhone(String(settings['phone']));
        if (settings['email']) setEmail(String(settings['email']));
        if (settings['business_hours']) setBusinessHours(String(settings['business_hours']));
        if (settings['currency']) setCurrency(String(settings['currency']));
        if (settings['notifications_enabled'] !== undefined) setNotifEnabled(Boolean(settings['notifications_enabled']));
        if (settings['qr_prefix']) setQrPrefix(String(settings['qr_prefix']));
        if (settings['session_timeout']) setSessionTimeout(String(settings['session_timeout']));
      } catch {
        // settings may not exist yet — use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.setMany({
        company_name: companyName,
        legal_name: legalName,
        address,
        phone,
        email,
        business_hours: businessHours,
        currency,
        notifications_enabled: notifEnabled,
        qr_prefix: qrPrefix,
        session_timeout: sessionTimeout,
      });
      toast.push('success', 'تم حفظ الإعدادات.');
    } catch (err) {
      toast.push('error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="جاري تحميل الإعدادات…" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700 text-slate-900">الإعدادات</h1>
          <p className="mt-1 text-sm text-slate-500">إعدادات النظام المركزية لـ ARKON.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary"><Save size={16} /> {saving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2 text-brand-600"><Building2 size={18} /><span className="font-display text-sm font-600">معلومات الشركة</span></div>
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-slate-50 p-4">
            <ArkonLogo size={48} />
            <div>
              <p className="font-display text-lg font-700 text-slate-900">{companyName}</p>
              <p className="text-xs text-slate-9000">{legalName}</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="اسم الشركة" value={companyName} onChange={setCompanyName} />
            <Field label="الاسم القانوني" value={legalName} onChange={setLegalName} />
            <Field label="العنوان" value={address} onChange={setAddress} />
            <Field label="الهاتف" value={phone} onChange={setPhone} />
            <Field label="البريد الإلكتروني" value={email} onChange={setEmail} type="email" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-brand-500"><Clock size={18} /><span className="font-display text-sm font-600">العمل والعملة</span></div>
            <div className="space-y-4">
              <Field label="ساعات العمل" value={businessHours} onChange={setBusinessHours} placeholder="08:00-17:00" />
              <div>
                <label className="label">العملة</label>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="ILS">ILS — ₪ شيكل إسرائيلي</option>
                  <option value="USD">USD — دولار أمريكي</option>
                  <option value="EUR">EUR — يورو</option>
                  <option value="JOD">JOD — دينار أردني</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-brand-600"><Bell size={18} /><span className="font-display text-sm font-600">إعدادات الإشعارات</span></div>
            <p className="mb-4 text-xs text-slate-500">تتحكم هذه الإعدادات في كيفية استلامك للإشعارات على هذا الجهاز.</p>
            <div className="space-y-4">
              <ToggleRow
                icon={<Volume2 size={16} />}
                label="أصوات الإشعارات"
                desc="تشغيل صوت تنبيه عند وصول إشعار جديد"
                value={notifPrefs.soundEnabled}
                onChange={(v) => setNotifPrefs(updatePreferences({ soundEnabled: v }))}
              />
              <ToggleRow
                icon={<MessageSquare size={16} />}
                label="إشعارات داخل التطبيق"
                desc="عرض رسائل تنبيه داخل المنصة"
                value={notifPrefs.toastEnabled}
                onChange={(v) => setNotifPrefs(updatePreferences({ toastEnabled: v }))}
              />
              <ToggleRow
                icon={<Globe size={16} />}
                label="إشعارات المتصفح"
                desc="عرض إشعارات حتى عند تصفح نافذة أخرى"
                value={notifPrefs.browserNotificationsEnabled}
                onChange={async (v) => {
                  if (v) {
                    const perm = await requestBrowserNotificationPermission();
                    if (perm === 'granted') {
                      setNotifPrefs(updatePreferences({ browserNotificationsEnabled: true }));
                    } else {
                      toast.push('error', 'تم رفض إذن الإشعارات من المتصفح.');
                    }
                  } else {
                    setNotifPrefs(updatePreferences({ browserNotificationsEnabled: false }));
                  }
                }}
              />
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-brand-600"><Bell size={18} /><span className="font-display text-sm font-600">إشعارات النظام</span></div>
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-600">تفعيل الإشعارات داخل التطبيق</span>
              <button
                onClick={() => setNotifEnabled(!notifEnabled)}
                className={`relative h-6 w-11 rounded-full transition ${notifEnabled ? 'bg-brand-500' : 'bg-slate-100'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${notifEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </label>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-warning-400"><QrCode size={18} /><span className="font-display text-sm font-600">إعدادات QR</span></div>
            <Field label="بادئة رمز QR" value={qrPrefix} onChange={setQrPrefix} />
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-danger-400"><Shield size={18} /><span className="font-display text-sm font-600">الأمان</span></div>
            <Field label="انتهاء الجلسة (دقائق)" value={sessionTimeout} onChange={setSessionTimeout} type="number" min={1} step={1} inputMode="numeric" />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">إصدار النظام</span>
              <span className="font-mono text-xs font-600 text-slate-500">ARKON v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ icon, label, desc, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-slate-400">{icon}</span>
        <div>
          <p className="text-sm font-600 text-slate-700">{label}</p>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-brand-500' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
