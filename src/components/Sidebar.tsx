import { NavLink } from 'react-router-dom';
import { ChevronLeft, X, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { STAFF_NAV, WORKER_NAV, CLIENT_NAV, type NavGroup } from '@/lib/navigation';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { session, hasPermission } = useAuth();

  let navGroups: NavGroup[] = STAFF_NAV;
  let isMobileApp = false;

  if (session?.kind === 'staff') {
    const perms = session.permissions ?? [];
    if (perms.includes('worker_home')) {
      navGroups = WORKER_NAV;
      isMobileApp = true;
    } else {
      navGroups = STAFF_NAV;
    }
  } else if (session?.kind === 'client') {
    navGroups = CLIENT_NAV;
    isMobileApp = true;
  }

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex flex-col border-r border-slate-200/60 bg-white transition-all duration-300 lg:static lg:translate-x-0',
          isMobileApp ? 'w-64' : collapsed ? 'w-[72px]' : 'w-64',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-slate-200/60 px-4', !isMobileApp && collapsed && 'justify-center px-0')}>
          {(!isMobileApp && collapsed) ? (
            <ArkonLogo size={32} />
          ) : (
            <div className="flex items-center justify-between">
              <ArkonLogo size={32} withWordmark variant="full" />
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden">
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {filteredGroups.map((group) => (
            <div key={group.section} className="mb-6">
              {!isMobileApp && !collapsed && (
                <p className="mb-2 px-3 text-[10px] font-600 uppercase tracking-[0.18em] text-slate-400">{group.section}</p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard' || item.to === '/worker' || item.to === '/client'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-500 transition-all',
                        !isMobileApp && collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                    title={(!isMobileApp && collapsed) ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={18} className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
                        {(!isMobileApp || !collapsed) && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200/60 p-3">
          <div className={cn('flex items-center', (!isMobileApp && collapsed) ? 'justify-center' : 'justify-between')}>
            {(!isMobileApp && !collapsed) && (
              <div className="flex items-center gap-2 px-2 text-xs text-slate-400">
                <ShieldCheck size={14} className="text-success-500" />
                <span>جلسة آمنة</span>
              </div>
            )}
            {!isMobileApp && (
              <button
                onClick={onToggleCollapse}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title={collapsed ? 'توسيع' : 'طي'}
              >
                <ChevronLeft size={18} className={cn('transition-transform', collapsed && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
