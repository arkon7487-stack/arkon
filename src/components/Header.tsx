import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, ChevronDown, Search } from 'lucide-react';
import { ArkonLogo } from '@/components/ArkonLogo';
import { useAuth } from '@/lib/auth';
import { notificationService } from '@/services/notificationService';
import { contractService } from '@/services/contractService';
import { searchService } from '@/services/searchService';
import { useNotifications } from '@/lib/notifications/useNotifications';
import { computeReminders, type ContractReminder, cn, formatDateTime, initials } from '@/lib/utils';
import type { NotificationItem, SearchResult } from '@/types';

interface HeaderProps {
  onMenu: () => void;
}

export function Header({ onMenu }: HeaderProps) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<ContractReminder[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const [n, contracts] = await Promise.all([
        notificationService.list(),
        contractService.getReminders(),
      ]);
      setNotifications(n);
      setReminders(computeReminders(contracts));
    } catch {
      // ignore for header
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Realtime: refresh notifications when new ones arrive
  useNotifications({
    onNewNotification: () => { loadNotifications(); },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await searchService.global(searchQuery);
        setSearchResults(results);
        setSearchOpen(true);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length + reminders.length;
  const displayName = session?.kind === 'staff'
    ? session.profile?.display_name ?? session.profile?.employee?.full_name ?? 'المدير'
    : session?.client?.full_name ?? 'عميل';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden">
        <Menu size={20} />
      </button>

      <div className="lg:hidden">
        <ArkonLogo size={28} />
      </div>

      <div className="hidden flex-1 md:block" ref={searchRef}>
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 py-2"
            placeholder="ابحث عن عملاء، عقود، باقات…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          />
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute mt-1 w-full max-h-80 overflow-y-auto card z-50">
              {searchResults.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => { navigate(r.link); setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-600 uppercase text-brand-600">{r.type}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{r.label}</p>
                    <p className="truncate text-xs text-slate-400">{r.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-700 text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-slide-in">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="font-display text-sm font-600 text-slate-900">الإشعارات</p>
                  {unreadCount > 0 && <span className="text-xs text-slate-400">{unreadCount} جديد</span>}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {reminders.length === 0 && notifications.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">لا توجد إشعارات جديدة.</p>
                  )}
                  {reminders.slice(0, 6).map((r) => (
                    <div key={r.contract.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.severity === 'danger' ? 'bg-danger-500' : r.severity === 'warning' ? 'bg-warning-500' : 'bg-brand-500')} />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{r.label}</p>
                        <p className="truncate text-xs text-slate-400">{r.contract.contract_number} · {r.contract.client?.full_name}</p>
                      </div>
                    </div>
                  ))}
                  {notifications.slice(0, 6).map((n) => (
                    <div key={n.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-slate-300' : 'bg-brand-500')} />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-400">{n.body}</p>}
                        <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                  className="block w-full border-t border-slate-100 px-4 py-2.5 text-center text-sm font-500 text-brand-600 hover:bg-slate-50"
                >
                  عرض الكل
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 transition hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-700 text-white">
              {initials(displayName)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-600 text-slate-800">{displayName}</span>
              <span className="block text-[10px] capitalize text-slate-400">{session?.kind === 'staff' ? 'موظف' : 'عميل'}</span>
            </span>
            <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 animate-slide-in">
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-600 text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-400">{session?.kind === 'staff' ? 'حساب موظف' : 'حساب عميل'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <LogOut size={16} /> تسجيل الخروج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
