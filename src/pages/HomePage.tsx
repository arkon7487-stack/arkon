import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, ShieldCheck, CalendarClock, Users, ClipboardCheck,
  QrCode, BarChart3, Bell, UserCircle, Smartphone, FileText, Network,
  Database, Cloud, Lock, Cpu, Layers, Activity, Zap, TrendingUp,
  MapPin, Phone, Mail, Clock, Building2, Wrench, Sparkle, Trees,
  Search, FileSignature, UserPlus, Headphones, CheckCircle2, Star,
  Quote, Eye, Target, Award, Heart, ArrowUpRight, Facebook, Instagram,
} from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';
import { PublicServiceRequestModal } from '@/components/PublicServiceRequestModal';

const services = [
  { icon: Sparkle, title: 'التنظيف الاحترافي', desc: 'خدمات تنظيف شاملة للمرافق والمكاتب والمنشآت بأعلى معايير الجودة.' },
  { icon: Wrench, title: 'الصيانة العامة', desc: 'صيانة دورية وإصلاحات فورية لجميع أنواع المرافق والمعدات.' },
  { icon: ShieldCheck, title: 'مكافحة الآفات', desc: 'حلول متكاملة لمكافحة الحشرات والآفات بطرق آمنة وفعالة.' },
  { icon: Trees, title: 'تنسيق المشهدية', desc: 'تصميم وصيانة الحدائق والمساحات الخضراء للمشاريع التجارية والسكنية.' },
  { icon: Building2, title: 'إدارة المرافق', desc: 'إدارة شاملة لجميع عمليات المرافق من مركز تحكم موحد.' },
  { icon: ClipboardCheck, title: 'مراقبة الجودة', desc: 'فحص دوري ومراقبة مستمرة لضمان الالتزام بأعلى المعايير.' },
];

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
const stats = [
  { value: '247', label: 'Active Contracts', icon: FileText },
  { value: '38', label: 'Visits Today', icon: ClipboardCheck },
  { value: '62', label: 'Team Members', icon: Users },
  { value: '98.4%', label: 'Completion Rate', icon: TrendingUp },
];

const testimonials = [
  { name: 'أحمد المصري', company: 'شركة الإعمار التجارية', text: 'ARKON غيّرت مفهوم النظافة لدينا. خدمة احترافية ودقيقة وموثوقة. أنصح بها بشدة.' },
  { name: 'سارة خليل', company: 'مجموعة النور الطبية', text: 'نظام التتبع والتقارير ممتاز. أصبحنا نعرف كل تفاصيل العمل لحظة بلحظة.' },
  { name: 'محمد عبد الله', company: 'شركة البيان العقارية', text: 'الجودة والالتزام والاحترافية في أعلى مستوياتها. شريك حقيقي للنجاح.' },
];

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(30px)', transition: `opacity .7s ease-out ${delay}ms, transform .7s ease-out ${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* ===== NAVBAR ===== */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-slate-200/80 bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <ArkonLogo size={40} withWordmark variant="full" />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#about" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">عن ARKON</a>
            <a href="#services" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">الخدمات</a>
            <a href="#why-arkon-os" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">ARKON OS</a>
            <a href="#workflow" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">دورة الخدمة</a>
            <a href="#testimonials" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">آراء العملاء</a>
            <a href="#contact" className="text-sm font-500 text-slate-600 transition hover:text-brand-600">تواصل معنا</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-sm font-600 text-slate-600 transition hover:text-brand-600 sm:block">تسجيل الدخول</Link>
            <button onClick={() => setShowRequest(true)} className="btn-primary text-sm">طلب خدمة <ArrowRight size={14} /></button>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-32 pb-24">
        {/* --- Premium branded background --- */}
        <div className="pointer-events-none absolute inset-0">
          {/* Layer 1: soft brand gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-brand-50/30 to-slate-50" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_80%_at_50%_-10%,rgba(25,82,208,0.06)_0%,transparent_65%)]" />

          {/* Layer 2: radial glow behind watermark */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: 600, height: 600, marginLeft: -300, marginTop: -300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(25,82,208,0.08) 0%, rgba(56,189,248,0.04) 45%, transparent 70%)',
              animation: 'wm-glow 9s ease-in-out infinite',
            }}
          />

          {/* Layer 3: logo watermark — icon only, 4% opacity, responsive */}
          <img
            src="/arkon-logo.svg"
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 select-none w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] lg:w-[440px] lg:h-[440px]"
            style={{
              marginLeft: '-50%', marginTop: '-50%',
              opacity: 0.04,
              filter: 'invert(36%) sepia(83%) saturate(1400%) hue-rotate(204deg) brightness(85%) contrast(90%)',
              animation: 'wm-float 24s ease-in-out infinite',
            }}
          />

          {/* Layer 4: geometric accents */}
          <div
            className="absolute -left-20 top-20 h-40 w-40 rounded-3xl border border-brand-200/40 bg-brand-50/20"
            style={{ transform: 'rotate(-18deg)', animation: 'geo-drift 18s ease-in-out infinite' }}
          />
          <div
            className="absolute -right-16 bottom-10 h-56 w-56 rounded-full border border-brand-100/30 bg-brand-50/20"
            style={{ animation: 'geo-drift-2 22s ease-in-out infinite' }}
          />
          <div
            className="absolute left-[10%] top-[60%] h-14 w-14 rounded-xl border border-brand-200/30"
            style={{ transform: 'rotate(35deg)', animation: 'geo-drift 26s ease-in-out infinite reverse' }}
          />

          {/* Layer 5: dot-grid texture */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: 'radial-gradient(circle, #1952d0 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          />

          {/* Ambient corner glows */}
          <div className="absolute -left-40 -top-20 h-[500px] w-[500px] rounded-full bg-brand-100/60 blur-[150px]" />
          <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-brand-50 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-600 text-brand-600">
                <Sparkles size={14} /> مدعوم بتقنية ARKON OS
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="font-arabic text-4xl font-800 leading-[1.2] text-slate-900 sm:text-5xl lg:text-6xl">
                حلول احترافية لإدارة النظافة وبيئات العمل
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="font-arabic mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                نظام تشغيل ذكي يضمن الجودة والتنظيم والاستمرارية — لنمنحك الوقت وراحة البال والثقة في أن أعمالك تسير كما يجب.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <button onClick={() => setShowRequest(true)} className="btn-primary text-base px-6 py-3.5">
                  طلب خدمة <ArrowRight size={18} />
                </button>
                <a href="#services" className="btn-ghost text-base px-6 py-3.5">
                  خدماتنا
                </a>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <stat.icon size={22} className="mx-auto mb-2 text-brand-500" />
                    <p className="font-display text-2xl font-700 text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== ABOUT ===== */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                <Building2 size={14} /> عن ARKON
              </div>
              <h2 className="font-arabic text-3xl font-700 leading-tight text-slate-900 sm:text-4xl">
                شريكك في إدارة النظافة وبيئات العمل
              </h2>
              <p className="font-arabic mt-5 text-base leading-loose text-slate-600">
                ARKON هي شركة تقدم حلولاً احترافية لإدارة النظافة وبيئات العمل، مدعومة بنظام تشغيل ذكي يضمن الجودة، والتنظيم، والاستمرارية.
                نمنح عملاءنا الوقت وراحة البال والثقة في أن أعمالهم تسير كما يجب.
              </p>
              <p className="font-arabic mt-4 text-base leading-loose text-slate-600">
                من خلال دمج التكنولوجيا الذكية مع الخبرة الميدانية، نحقق معايير جودة استثنائية تلبي احتياجات الشركات والمؤسسات بأعلى مستويات الاحترافية.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <Eye size={22} className="mb-3 text-brand-500" />
                  <h3 className="font-arabic text-base font-700 text-slate-900">رؤيتنا</h3>
                  <p className="font-arabic mt-1.5 text-sm leading-relaxed text-slate-500">
                    أن نكون الشريك الأول للشركات والمؤسسات في إدارة النظافة وبيئات العمل، من خلال تقديم حلول مبتكرة ومستدامة.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <Target size={22} className="mb-3 text-brand-500" />
                  <h3 className="font-arabic text-base font-700 text-slate-900">مهمتنا</h3>
                  <p className="font-arabic mt-1.5 text-sm leading-relaxed text-slate-500">
                    تقديم خدمات تنظيف وإدارة مرافق بأعلى معايير الجودة والموثوقية والاحترافية، مدعومة بنظام تشغيل ذكي.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-100 to-brand-50" />
              <div className="relative rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Award size={24} /></div>
                  <div>
                    <p className="font-display text-sm font-700 text-slate-900">ARKON OS</p>
                    <p className="text-xs text-slate-500">Operating System</p>
                  </div>
                  <span className="ml-auto rounded-full bg-success-50 px-2.5 py-1 text-xs font-600 text-success-600">Active</span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    { label: 'Contracts', value: '247', tone: 'text-brand-600' },
                    { label: 'Visits Today', value: '38', tone: 'text-success-600' },
                    { label: 'Field Teams', value: '62', tone: 'text-brand-600' },
                    { label: 'Quality Score', value: '98.4%', tone: 'text-success-600' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">{row.label}</span>
                      <span className={`font-display text-lg font-700 ${row.tone}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3">
                  <CheckCircle2 size={18} className="text-brand-600" />
                  <span className="font-arabic text-sm font-600 text-brand-700">جميع الأنظمة تعمل بكفاءة</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section id="services" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                <Sparkle size={14} /> خدماتنا
              </div>
              <h2 className="font-arabic text-3xl font-700 text-slate-900 sm:text-4xl">حلول متكاملة لإدارة المرافق</h2>
              <p className="font-arabic mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
                نقدم مجموعة شاملة من الخدمات الاحترافية لإدارة وصيانة المرافق، مدعومة بالتقنية لضمان أعلى مستويات الكفاءة والجودة.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 transition-all duration-500 hover:border-brand-300 hover:shadow-[0_8px_30px_-8px_rgba(25,82,208,0.15)]">
                  <div className="mb-5 inline-flex rounded-xl bg-brand-50 p-3.5 text-brand-600 transition-all duration-500 group-hover:scale-110 group-hover:bg-brand-100">
                    <s.icon size={26} />
                  </div>
                  <h3 className="font-arabic mb-2 text-xl font-700 text-slate-900">{s.title}</h3>
                  <p className="font-arabic text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-700 group-hover:w-full" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY ARKON OS ===== */}
      <section id="why-arkon-os" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                <Sparkles size={14} /> ARKON OS
              </div>
              <h2 className="font-arabic text-3xl font-700 text-slate-900 sm:text-4xl">لماذا ARKON OS؟</h2>
              <p className="font-arabic mx-auto mt-5 max-w-2xl text-base leading-loose text-slate-500">
                لا تقتصر قوة ARKON على تقديم خدمات احترافية، بل تتميز أيضًا بإدارة جميع عملياتها من خلال ARKON OS،
                وهو نظام تشغيل ذكي تم تطويره لتنظيم وإدارة دورة الخدمة بالكامل.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-500 hover:border-brand-300 hover:shadow-[0_8px_30px_-8px_rgba(25,82,208,0.15)]">
                  <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-100">
                    <f.icon size={22} />
                  </div>
                  <h3 className="font-arabic mb-1.5 text-lg font-700 text-slate-900">{f.title}</h3>
                  <p className="font-arabic text-sm leading-relaxed text-slate-500">{f.desc}</p>
                  <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-700 group-hover:w-full" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WORKFLOW ===== */}
      <section id="workflow" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                <Network size={14} /> ARKON OS Workflow
              </div>
              <h2 className="font-arabic text-3xl font-700 text-slate-900 sm:text-4xl">دورة الخدمة الكاملة</h2>
              <p className="font-arabic mt-3 text-base text-slate-500">من الطلب الأول إلى الدعم المستمر — كل خطوة مدعومة بالتقنية</p>
            </div>
          </Reveal>

          <div className="mx-auto max-w-2xl">
            {workflow.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === workflow.length - 1;
              return (
                <Reveal key={step.label} delay={i * 60}>
                  <div className="relative flex items-start gap-5">
                    {!isLast && (
                      <div className="absolute left-[24px] top-14 h-[calc(100%-24px)] w-px bg-gradient-to-b from-brand-300 via-brand-200 to-transparent" />
                    )}
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-sm transition-all duration-300 hover:scale-110 hover:border-brand-400 hover:bg-brand-50">
                      <Icon size={20} />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-700 text-white">{i + 1}</span>
                    </div>
                    <div className="flex-1 pb-8 pt-2">
                      <p className="text-[11px] font-600 uppercase tracking-wider text-brand-500">{step.label}</p>
                      <p className="font-arabic mt-1 text-base font-600 text-slate-800">{step.ar}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== TECHNOLOGY HIGHLIGHT ===== */}
      <section id="technology" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/50 p-8 sm:p-12 lg:p-16">
              <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-brand-100/50 blur-[100px]" />
              <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-brand-50 blur-[100px]" />

              <div className="relative z-10 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                    <Cpu size={14} /> Technology Highlight
                  </div>
                  <h2 className="font-arabic text-3xl font-700 leading-tight text-slate-900 sm:text-4xl">تقنية متكاملة في كل مرحلة</h2>
                  <p className="font-arabic mt-5 text-base leading-loose text-slate-600">
                    في ARKON، لا نعتمد على الإدارة التقليدية، بل نوظف التقنية في جميع مراحل تقديم الخدمة.
                    يقوم ARKON OS بربط العملاء، والعقود، والزيارات، وفرق العمل، والجودة، والتقارير في منصة واحدة.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2.5">
                    {['Clients', 'Contracts', 'Visits', 'Teams', 'Quality', 'Reports'].map((t, i) => (
                      <span key={t} className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-500 text-slate-600 transition hover:border-brand-300 hover:text-brand-600" style={{ animation: `slide-in .4s ease-out ${i * 80}ms both` }}>{t}</span>
                    ))}
                  </div>
                  <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                      <ArkonLogo size={22} />
                    </div>
                    <span className="font-arabic text-sm font-700 text-brand-700">مدعوم بالكامل بواسطة ARKON OS</span>
                  </div>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="relative h-[340px] w-[340px]">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animation: 'glow-pulse 4s ease-in-out infinite' }}>
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-brand-200 bg-white shadow-lg">
                        <ArkonLogo size={40} />
                      </div>
                    </div>
                    {[300, 230, 160].map((size) => (
                      <div key={size} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200" style={{ height: `${size}px`, width: `${size}px` }} />
                    ))}
                    {techIcons.map((Icon, i) => (
                      <div key={i} className="absolute left-1/2 top-1/2 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-white text-brand-600 shadow-sm" style={{ animation: `${i % 2 === 0 ? 'orbit' : 'orbit-reverse'} ${25 + i * 4}s linear infinite`, animationDelay: `${i * -3}s`, ['--orbit-radius' as string]: `${i < 3 ? 120 : 80}px` }}>
                        <Icon size={18} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-600 text-brand-600">
                <Heart size={14} /> آراء العملاء
              </div>
              <h2 className="font-arabic text-3xl font-700 text-slate-900 sm:text-4xl">ماذا يقول عملاؤنا</h2>
              <p className="font-arabic mt-4 text-base text-slate-500">ثقة عملائنا هي أعظم إنجازاتنا</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                  <Quote size={32} className="absolute left-6 top-6 text-brand-100" />
                  <div className="relative mb-4 flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={16} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="font-arabic relative mb-6 text-sm leading-relaxed text-slate-600">{t.text}</p>
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-700 text-brand-700">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-arabic text-sm font-700 text-slate-900">{t.name}</p>
                      <p className="font-arabic text-xs text-slate-500">{t.company}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA / CONTACT ===== */}
      <section id="contact" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-center sm:p-16">
              <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-white/10 blur-[120px]" />
              <div className="relative z-10">
                <h2 className="font-arabic text-3xl font-700 text-white sm:text-5xl">جاهزون لخدمتك؟</h2>
                <p className="font-arabic mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100">
                  تواصل معنا اليوم لمعرفة كيف يمكن لـ ARKON تحسين إدارة مرافقك وعمليات مكان عملك.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
                  <div className="flex items-center gap-2 text-sm text-brand-100">
                    <MapPin size={18} />
                    <span className="font-arabic">نابلس، فلسطين</span>
                  </div>
                  <a href="tel:+972598562056" className="flex items-center gap-2 text-sm text-brand-100 transition hover:text-white">
                    <Phone size={18} />
                    <span dir="ltr">+972598562056</span>
                  </a>
                  <div className="flex items-center gap-2 text-sm text-brand-100">
                    <Mail size={18} />
                    <span>info@arkon.ps</span>
                  </div>
                </div>
                <div className="mt-10">
                  <button onClick={() => setShowRequest(true)} className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-600 text-brand-700 transition hover:bg-brand-50">
                    طلب خدمة <ArrowUpRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <ArkonLogo size={40} />
                <div className="leading-none">
                  <span className="font-display text-lg font-700 text-white">ARKON</span>
                  <span className="block text-[10px] font-500 uppercase tracking-[0.2em] text-brand-600">Facility Management</span>
                </div>
              </div>
              <p className="font-arabic mt-4 text-sm leading-relaxed text-slate-500">
                شركة رائدة في إدارة النظافة وبيئات العمل في فلسطين، مدعومة بتقنية ARKON OS.
              </p>
            </div>

            <div>
              <h4 className="font-arabic mb-4 text-sm font-600 text-white">الخدمات</h4>
              <ul className="space-y-2.5">
                {services.slice(0, 5).map((s) => (
                  <li key={s.title}><a href="#services" className="font-arabic text-sm text-slate-500 transition hover:text-brand-600">{s.title}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-arabic mb-4 text-sm font-600 text-white">المنصة</h4>
              <ul className="space-y-2.5">
                <li><Link to="/login" className="text-sm text-slate-500 transition hover:text-brand-600">تسجيل الدخول</Link></li>
                <li><a href="#why-arkon-os" className="font-arabic text-sm text-slate-500 transition hover:text-brand-600">ARKON OS</a></li>
                <li><a href="#workflow" className="font-arabic text-sm text-slate-500 transition hover:text-brand-600">دورة الخدمة</a></li>
                <li><a href="#technology" className="font-arabic text-sm text-slate-500 transition hover:text-brand-600">التقنية</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-arabic mb-4 text-sm font-600 text-white">تواصل معنا</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={14} className="text-brand-600" /><span className="font-arabic">نابلس، فلسطين</span></li>
                <li className="flex items-center gap-2 text-sm text-slate-500"><Phone size={14} className="text-brand-600" /><a href="tel:+972598562056" dir="ltr" className="transition hover:text-brand-600">+972598562056</a></li>
                <li className="flex items-center gap-2 text-sm text-slate-500"><Mail size={14} className="text-brand-600" />info@arkon.ps</li>
                <li className="flex items-center gap-2 text-sm text-slate-500"><Clock size={14} className="text-brand-600" /><span className="font-arabic">السبت - الخميس، 8:00 - 17:00</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
            <p className="text-xs text-slate-500">© 2026 ARKON Enterprise. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-4">
              <a href="https://www.facebook.com/share/1Hf8wMhZwd/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="زيارة صفحة ARKON على فيسبوك" className="text-slate-500 transition hover:text-brand-600">
                <Facebook size={18} />
              </a>
              <a href="https://www.instagram.com/arkon.service?igsh=NXg2MTJqb3pjeHA%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="زيارة حساب ARKON على إنستغرام" className="text-slate-500 transition hover:text-brand-600">
                <Instagram size={18} />
              </a>
              <p className="text-xs text-slate-500">Powered by ARKON OS</p>
            </div>
          </div>
        </div>
      </footer>

      {showRequest && <PublicServiceRequestModal onClose={() => setShowRequest(false)} />}
    </div>
  );
}
