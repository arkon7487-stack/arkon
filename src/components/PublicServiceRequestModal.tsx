import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, CheckCircle2, Loader2, Home } from 'lucide-react';

const SERVICE_TYPES = [
  'التنظيف الاحترافي',
  'الصيانة العامة',
  'مكافحة الآفات',
  'تنسيق المشهدية',
  'إدارة المرافق',
  'مراقبة الجودة',
  'أخرى',
];

const PROPERTY_TYPES = [
  'منزل',
  'شقة',
  'مكتب',
  'محل تجاري',
  'مبنى تجاري',
  'مصنع',
  'مدرسة',
  'مستشفى',
  'أخرى',
];

interface FormState {
  full_name: string;
  phone_number: string;
  alt_phone: string;
  address: string;
  city: string;
  interested_service: string;
  preferred_contact_time: string;
  preferred_days: string;
  property_type: string;
  notes: string;
  website: string; // honeypot
}

const EMPTY_FORM: FormState = {
  full_name: '',
  phone_number: '',
  alt_phone: '',
  address: '',
  city: '',
  interested_service: '',
  preferred_contact_time: '',
  preferred_days: '',
  property_type: '',
  notes: '',
  website: '',
};

export function PublicServiceRequestModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const validate = (): boolean => {
    if (!form.full_name.trim()) { setError('الاسم الكامل مطلوب'); return false; }
    if (!form.phone_number.trim()) { setError('رقم الهاتف مطلوب'); return false; }
    if (!form.address.trim()) { setError('العنوان مطلوب'); return false; }
    if (!form.city.trim()) { setError('المدينة مطلوبة'); return false; }
    if (!form.interested_service) { setError('نوع الخدمة مطلوب'); return false; }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot — silently succeed
    if (form.website.trim()) { setSuccess(true); return; }

    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arkon-public-request`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(form),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (resp.status === 429) {
          throw new Error('يوجد طلب سابق مرتبط بهذا الرقم. سيتواصل معك فريق ARKON قريبًا.');
        }
        if (resp.status === 400) {
          throw new Error('يرجى التحقق من البيانات المدخلة.');
        }
        throw new Error(data.error ?? 'تعذر إرسال الطلب مؤقتًا، حاول مرة أخرى.');
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message ?? 'تعذر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
              <CheckCircle2 size={36} className="text-success-600" />
            </div>
            <h2 className="font-arabic mt-5 text-xl font-700 text-slate-900">تم إرسال طلبك بنجاح</h2>
            <p className="font-arabic mt-2 text-sm leading-relaxed text-slate-500">
              سيتواصل معك فريق ARKON قريبًا.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={onClose} className="btn-primary px-8">إغلاق</button>
              <button onClick={() => navigate('/')} className="btn-ghost inline-flex items-center gap-1.5 px-6">
                <Home size={16} />
                العودة إلى الصفحة الرئيسية
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <h2 className="font-arabic text-lg font-700 text-slate-900">طلب خدمة</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1 text-xs font-600 text-slate-400 transition hover:text-brand-600"
                >
                  <Home size={14} />
                  الرئيسية
                </button>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4 p-5">
              {/* Required fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="الاسم الكامل" required>
                  <input
                    className="input"
                    value={form.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                    placeholder="الاسم الكامل"
                    required
                  />
                </Field>
                <Field label="رقم الهاتف" required>
                  <input
                    className="input"
                    value={form.phone_number}
                    onChange={(e) => update('phone_number', e.target.value)}
                    placeholder="05XXXXXXXX"
                    required
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="العنوان التفصيلي" required>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                    placeholder="العنوان التفصيلي"
                    required
                  />
                </Field>
                <Field label="المدينة / المنطقة" required>
                  <input
                    className="input"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="المدينة"
                    required
                  />
                </Field>
              </div>

              <Field label="نوع الخدمة المطلوبة" required>
                <select
                  className="input"
                  value={form.interested_service}
                  onChange={(e) => update('interested_service', e.target.value)}
                  required
                >
                  <option value="" disabled>اختر نوع الخدمة</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              {/* Optional fields */}
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-600 text-slate-400">معلومات إضافية (اختياري)</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="هاتف بديل">
                    <input
                      className="input"
                      value={form.alt_phone}
                      onChange={(e) => update('alt_phone', e.target.value)}
                      placeholder="هاتف بديل"
                      dir="ltr"
                    />
                  </Field>
                  <Field label="نوع العقار / المنشأة">
                    <select
                      className="input"
                      value={form.property_type}
                      onChange={(e) => update('property_type', e.target.value)}
                    >
                      <option value="">اختر</option>
                      {PROPERTY_TYPES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="وقت التواصل المفضل">
                    <input
                      className="input"
                      value={form.preferred_contact_time}
                      onChange={(e) => update('preferred_contact_time', e.target.value)}
                      placeholder="مثال: صباحاً"
                    />
                  </Field>
                  <Field label="أيام الخدمة المفضلة">
                    <input
                      className="input"
                      value={form.preferred_days}
                      onChange={(e) => update('preferred_days', e.target.value)}
                      placeholder="مثال: السبت - الأربعاء"
                    />
                  </Field>
                </div>

                <Field label="ملاحظات إضافية">
                  <textarea
                    className="input min-h-[80px] resize-y"
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="أي تفاصيل إضافية تود مشاركتها"
                  />
                </Field>
              </div>

              {/* Honeypot — hidden from users */}
              <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
                <label>Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm font-600 text-danger-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3.5 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    جاري الإرسال...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send size={18} />
                    إرسال الطلب
                  </span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-500 text-slate-600">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      {children}
    </div>
  );
}
