import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, CalendarClock, Users, ClipboardCheck, QrCode, BarChart3,
  Bell, UserCircle, Smartphone, ShieldCheck, Search, Sparkles, ArrowRight,
  MapPin, FileSignature, UserPlus, Headphones, Database, Cloud, Lock,
  Cpu, Layers, Network, Activity, Zap, TrendingUp, Clock,
} from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';

const features = [
  { icon: FileText, title: 'إدارة العقود', desc: 'إدارة العقود بشكل احترافي مع متابعة مدة العقد، التنبيهات، وحالة التجديد.' },
  { icon: CalendarClock, title: 'الجدولة الذكية', desc: 'يقوم النظام بجدولة الزيارات تلقائيًا واختيار أفضل فريق عمل بناءً على أوقات التوفر ومناطق الخدمة.' },
  { icon: Users, title: 'إدارة فرق العمل', desc: 'تنظيم وإدارة العاملين ميدانيًا وربط كل موظف بالعملاء والزيارات الخاصة به.' },
  { icon: ClipboardCheck, title: 'متابعة الزيارات', desc: 'متابعة جميع الزيارات المجدولة والمنفذة مع معرفة حالة كل زيارة لحظة بلحظة.' },
  { icon: QrCode, title: 'التحقق باستخدام QR', desc: 'توثيق بداية ونهاية كل زيارة باستخدام رمز QR لضمان تنفيذ الخدمة بدقة وشفافية.' },
  { icon: BarChart3, title: 'التقارير والإحصائيات', desc: 'تقارير لحظية ومؤشرات أداء تساعد على متابعة جودة التشغيل واتخاذ القرارات.' },
  { icon: Bell, title: 'الإشعارات والتذكيرات', desc: 'تنبيهات ذكية للعقود، الزيارات، وجدولة فرق العمل لضمان عدم تفويت أي مهمة.' },
  { icon: UserCircle, title: 'بوابة العميل', desc: 'يمكن للعميل مستقبلاً متابعة زياراته، وعقوده، وخدماته من خلال حسابه الخاص.' },
  { icon: Smartphone, title: 'تطبيق العامل', desc: 'يستطيع العامل تسجيل الدخول، مشاهدة جدول زياراته، بدء وإنهاء الزيارة عبر QR، واستلام الإشعارات مباشرة.' },
  { icon: ShieldCheck, title: 'إدارة الجودة', desc: 'متابعة جودة تنفيذ الخدمات من خلال قوائم الفحص والتقارير الدورية لضمان الالتزام بأعلى المعايير.' },
];

const workflow = [
  { icon: Search, label: 'Customer Request', ar: 'طلب العميل' },
  { icon: MapPin, label: 'Site Inspection', ar: 'معاينة الموقع' },
  { icon: FileSignature, label: 'Quotation', ar: 'عرض السعر' },
  { icon: FileText, label: 'Contract Creation', ar: 'إنشاء العقد' },
  { icon: CalendarClock, label: 'Smart Scheduling', ar: 'الجدولة الذكية' },
  { icon: UserPlus, label: 'Employee Assignment', ar: 'تعيين الفريق' },
  { icon: ClipboardCheck, label: 'Visit Execution', ar: 'تنفيذ الزيارة' },
  { icon: QrCode, label: 'QR Verification', ar: 'التحقق بـ QR' },
  { icon: ShieldCheck, label: 'Quality Inspection', ar: 'فحص الجودة' },
  { icon: BarChart3, label: 'Reports & Analytics', ar: 'التقارير والتحليلات' },
  { icon: Headphones, label: 'Continuous Support', ar: 'الدعم المستمر' },
];

const techIcons = [Database, Cloud, Lock, Cpu, Layers, Network];
const dashboardStats = [
  { label: 'Active Contracts', value: '247', icon: FileText, color: 'text-brand-600' },
  { label: 'Visits Today', value: '38', icon: ClipboardCheck, color: 'text-brand-500' },
  { label: 'Team Members', value: '62', icon: Users, color: 'text-success-500' },
  { label: 'Completion Rate', value: '98.4%', icon: TrendingUp, color: 'text-warning-400' },
];

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function FeatureCard({ feature, index, visible }: { feature: typeof features[0]; index: number; visible: boolean }) {
  const Icon = feature.icon;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-500 hover:border-brand-500/40 hover:shadow-[0_8px_30px_-8px_rgba(25,82,208,0.15)]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity .5s ease-out ${index * 70}ms, transform .5s ease-out ${index * 70}ms`,
      }}
    >
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-500/5 blur-2xl transition-all duration-700 group-hover:bg-brand-100 group-hover:scale-150" />
      <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-accent-500/5 blur-2xl transition-all duration-700 group-hover:bg-accent-500/10" />

      <div className="relative mb-4 inline-flex rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 p-3 text-brand-600 transition-all duration-500 group-hover:scale-110 group-hover:scale-110 group-hover:bg-brand-100">
        <Icon size={24} />
      </div>
      <h3 className="relative mb-2 font-display text-lg font-600 text-slate-900">
        {feature.title}
      </h3>
      <p className="relative text-sm leading-relaxed text-slate-400" dir="rtl">{feature.desc}</p>

      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-700 group-hover:w-full" />
    </div>
  );
}

function WorkflowStep({ step, index, total, visible }: { step: typeof workflow[0]; index: number; total: number; visible: boolean }) {
  const Icon = step.icon;
  const isLast = index === total - 1;
  return (
    <div
      className="relative flex items-start gap-5"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-20px)',
        transition: `opacity .5s ease-out ${index * 80}ms, transform .5s ease-out ${index * 80}ms`,
      }}
    >
      {!isLast && (
        <div className="absolute left-[24px] top-14 h-[calc(100%-24px)] w-px overflow-hidden">
          <div
            className="h-full w-full bg-gradient-to-b from-brand-500/60 via-brand-500/20 to-transparent"
            style={{
              transform: visible ? 'scaleY(1)' : 'scaleY(0)',
              transformOrigin: 'top',
              transition: `transform .6s ease-out ${index * 80 + 300}ms`,
            }}
          />
        </div>
      )}
      <div
        className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-sm transition-all duration-300 hover:scale-110 hover:border-brand-400 hover:bg-brand-50"
        style={{ animation: `node-pulse 3s ease-in-out infinite ${index * 0.3}s` }}
      >
        <Icon size={20} />
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-700 text-white shadow-[0_0_10px_rgba(25,82,208,0.5)]">
          {index + 1}
        </span>
      </div>
      <div className="flex-1 pb-8 pt-2">
        <p className="text-[11px] font-600 uppercase tracking-wider text-brand-600">{step.label}</p>
        <p className="mt-1 font-display text-base font-600 text-slate-800" dir="rtl">{step.ar}</p>
      </div>
    </div>
  );
}

function DashboardMockup({ visible }: { visible: boolean }) {
  const bars = [40, 65, 45, 80, 55, 90, 70];
  return (
    <div
      className="relative"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity .8s ease-out .2s, transform .8s ease-out .2s',
      }}
    >
      {/* Scan line effect */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
        <div
          className="absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-brand-400/40 to-transparent"
          style={{ animation: 'scan-line 4s ease-in-out infinite 2s' }}
        />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-brand-500/20 bg-white shadow-lg">
        {/* Window header */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-danger-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-success-400" />
          </div>
          <div className="ml-3 flex items-center gap-1.5 text-xs text-slate-400">
            <Lock size={12} /> arkon.os/dashboard
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {dashboardStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Icon size={16} className={stat.color} />
                    <span className="text-[10px] text-slate-400">{stat.label}</span>
                  </div>
                  <p className="font-display text-xl font-700 text-slate-900" style={{ animation: `count-up .6s ease-out ${i * 100}ms both` }}>
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Chart area */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-600 text-slate-400">Weekly Activity</span>
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-brand-600" />
                <span className="text-[10px] text-brand-600">Live</span>
              </div>
            </div>
            <div className="flex h-24 items-end justify-between gap-1.5">
              {bars.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-brand-400 to-brand-600"
                    style={{
                      height: `${h}%`,
                      transform: visible ? 'scaleY(1)' : 'scaleY(0)',
                      transformOrigin: 'bottom',
                      transition: `transform .6s ease-out ${i * 80 + 400}ms`,
                    }}
                  />
                  <span className="text-[8px] text-slate-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live feed */}
          <div className="mt-4 space-y-2">
            {[
              { icon: QrCode, text: 'Visit verified — QR scan', time: '2m', color: 'text-brand-500' },
              { icon: CalendarClock, text: 'Auto-scheduled 3 visits', time: '5m', color: 'text-brand-600' },
              { icon: ShieldCheck, text: 'Quality check passed', time: '8m', color: 'text-success-500' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  style={{ animation: `slide-in .4s ease-out ${i * 120 + 600}ms both` }}
                >
                  <Icon size={14} className={item.color} />
                  <span className="flex-1 text-xs text-slate-400">{item.text}</span>
                  <span className="text-[10px] text-slate-400">{item.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArkonOSPage() {
  const { ref: whyRef, inView: whyInView } = useInView<HTMLDivElement>();
  const { ref: flowRef, inView: flowInView } = useInView<HTMLDivElement>();
  const { ref: techRef, inView: techInView } = useInView<HTMLDivElement>(0.1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Background layers */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" style={{
        backgroundImage: 'linear-gradient(#4a8fe8 1px, transparent 1px), linear-gradient(90deg, #4a8fe8 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }} />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-brand-100/40 blur-[120px]" />

      {/* Top bar */}
      <header className="relative z-10 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <ArkonLogo size={36} withWordmark variant="full" />
          <Link to="/login" className="btn-ghost text-sm">Sign In <ArrowRight size={14} /></Link>
        </div>
      </header>

      {/* ===== WHY ARKON OS ===== */}
      <section ref={whyRef} className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-300"
            style={{ opacity: whyInView ? 1 : 0, transition: 'opacity .5s ease-out' }}
          >
            <Sparkles size={14} /> ARKON OS — Competitive Advantage
          </div>
          <h1
            className="font-arabic text-4xl font-700 text-slate-900 sm:text-5xl"
            style={{ opacity: whyInView ? 1 : 0, transform: whyInView ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease-out .1s, transform .6s ease-out .1s' }}
            dir="rtl"
          >
            لماذا ARKON OS؟
          </h1>
          <p
            className="font-arabic mx-auto mt-6 max-w-2xl text-base leading-loose text-slate-400"
            style={{ opacity: whyInView ? 1 : 0, transform: whyInView ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease-out .2s, transform .6s ease-out .2s' }}
            dir="rtl"
          >
            لا تقتصر قوة ARKON على تقديم خدمات احترافية، بل تتميز أيضًا بإدارة جميع عملياتها من خلال ARKON OS،
            وهو نظام تشغيل ذكي تم تطويره لتنظيم وإدارة دورة الخدمة بالكامل، مما يضمن أعلى مستويات الجودة، والشفافية، والالتزام.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} visible={whyInView} />
          ))}
        </div>
      </section>

      {/* ===== WORKFLOW TIMELINE ===== */}
      <section ref={flowRef} className="relative z-10 border-y border-slate-200 bg-slate-100/50 py-24">
        <div className="pointer-events-none absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-accent-500/[0.03] blur-[100px]" />
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-500"
              style={{ opacity: flowInView ? 1 : 0, transition: 'opacity .5s ease-out' }}
            >
              <Network size={14} /> ARKON OS Workflow
            </div>
            <h2
              className="font-arabic text-3xl font-700 text-slate-900 sm:text-4xl"
              style={{ opacity: flowInView ? 1 : 0, transform: flowInView ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease-out .1s, transform .6s ease-out .1s' }}
              dir="rtl"
            >
              دورة الخدمة الكاملة
            </h2>
            <p
              className="font-arabic mt-3 text-sm text-slate-400"
              style={{ opacity: flowInView ? 1 : 0, transition: 'opacity .6s ease-out .2s' }}
              dir="rtl"
            >
              من الطلب الأول إلى الدعم المستمر — كل خطوة مدعومة بالتقنية
            </p>
          </div>

          <div className="mx-auto max-w-2xl">
            {workflow.map((step, i) => (
              <WorkflowStep key={step.label} step={step} index={i} total={workflow.length} visible={flowInView} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== TECHNOLOGY HIGHLIGHT ===== */}
      <section ref={techRef} className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <div
          className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-white to-brand-50/50 p-8 sm:p-12 lg:p-16"
          style={{
            opacity: techInView ? 1 : 0,
            transform: techInView ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity .8s ease-out, transform .8s ease-out',
          }}
        >
          {/* Glow orbs */}
          <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-brand-100/50 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-brand-50 blur-[100px]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50 blur-[80px]" />

          {/* Animated orbit graphic — desktop only */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
            <div className="relative h-[420px] w-[420px] opacity-60">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animation: 'glow-pulse 4s ease-in-out infinite' }}>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-brand-200 bg-white shadow-lg">
                  <ArkonLogo size={40} />
                </div>
              </div>
              {[360, 280, 200].map((size, ringIdx) => (
                <div
                  key={size}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-100"
                  style={{ height: `${size}px`, width: `${size}px` }}
                />
              ))}
              {techIcons.map((Icon, i) => {
                const radius = i < 3 ? 140 : 100;
                return (
                  <div
                    key={i}
                    className="absolute left-1/2 top-1/2 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-white text-brand-600 shadow-sm"
                    style={{
                      animation: `${i % 2 === 0 ? 'orbit' : 'orbit-reverse'} ${25 + i * 4}s linear infinite`,
                      animationDelay: `${i * -3}s`,
                      ['--orbit-radius' as string]: `${radius}px`,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-xl">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-300"
              style={{ opacity: techInView ? 1 : 0, transition: 'opacity .5s ease-out .3s' }}
            >
              <Cpu size={14} /> Technology Highlight
            </div>
            <h2
              className="font-arabic mb-6 text-3xl font-700 leading-tight text-slate-900 sm:text-4xl"
              style={{ opacity: techInView ? 1 : 0, transform: techInView ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease-out .4s, transform .6s ease-out .4s' }}
              dir="rtl"
            >
              تقنية متكاملة في كل مرحلة
            </h2>
            <p
              className="font-arabic text-base leading-loose text-slate-400"
              style={{ opacity: techInView ? 1 : 0, transform: techInView ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease-out .5s, transform .6s ease-out .5s' }}
              dir="rtl"
            >
              في ARKON، لا نعتمد على الإدارة التقليدية، بل نوظف التقنية في جميع مراحل تقديم الخدمة.
              يقوم ARKON OS بربط العملاء، والعقود، والزيارات، وفرق العمل، والجودة، والتقارير في منصة واحدة،
              مما يضمن سرعة الاستجابة، ودقة التنفيذ، وتجربة احترافية متكاملة.
            </p>

            {/* Tech pills */}
            <div
              className="mt-8 flex flex-wrap gap-2.5"
              style={{ opacity: techInView ? 1 : 0, transition: 'opacity .5s ease-out .6s' }}
            >
              {['Clients', 'Contracts', 'Visits', 'Teams', 'Quality', 'Reports'].map((t, i) => (
                <span
                  key={t}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-500 text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600"
                  style={{ animation: `slide-in .4s ease-out ${i * 80 + 600}ms both` }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Dashboard mockup */}
            <div className="mt-10">
              <DashboardMockup visible={techInView} />
            </div>

            {/* Badge */}
            <div
              className="mt-10 inline-flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3.5 backdrop-blur-sm"
              style={{ animation: 'glow-pulse 4s ease-in-out infinite', opacity: techInView ? 1 : 0, transition: 'opacity .5s ease-out .8s' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                <ArkonLogo size={22} />
              </div>
              <span className="font-arabic text-sm font-700 text-brand-700" dir="rtl">مدعوم بالكامل بواسطة ARKON OS</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <ArkonLogo size={28} withWordmark />
          <p className="text-xs text-slate-400">ARKON Enterprise Platform — Powered by ARKON OS</p>
          <Link to="/login" className="btn-primary text-sm">Access Platform <ArrowRight size={14} /></Link>
        </div>
      </footer>
    </div>
  );
}
