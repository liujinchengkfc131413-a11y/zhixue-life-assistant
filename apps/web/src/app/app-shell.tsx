import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  Bell,
  Bot,
  Briefcase,
  Database,
  Heart,
  Home,
  Inbox,
  PenLine,
  Search,
  Settings,
  Sprout,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { QuickCaptureDialog } from '../features/inbox/quick-capture-dialog.js';
import { SearchDialog } from '../features/information/search-dialog.js';
import { useNotifications } from '../features/reminders/api.js';
import { clearProductFieldError, showProductFieldError } from '../shared/product-fields.js';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const coreNavigation: readonly NavigationItem[] = [
  { to: '/', label: '今日', icon: Home },
  { to: '/work', label: '工作', icon: Briefcase },
  { to: '/life', label: '生活', icon: Heart },
  { to: '/plans-goals', label: '计划与目标', icon: Target },
  { to: '/assistant', label: 'AI 助手', icon: Bot },
];

const systemNavigation: readonly NavigationItem[] = [
  { to: '/inbox', label: '收集箱', icon: Inbox },
  { to: '/data-management', label: '数据管理', icon: Database },
  { to: '/reminders', label: '提醒中心', icon: Bell },
];

const settingsNavigation: readonly NavigationItem[] = [
  { to: '/settings', label: '设置', icon: Settings },
];

const isSelected = (to: string, currentPath: string): boolean =>
  to === '/' ? currentPath === '/' : currentPath.startsWith(to);

export type AppTheme = 'today' | 'work' | 'life' | 'vision' | 'ai' | 'system';

export const resolveAppTheme = (currentPath: string): AppTheme => {
  if (currentPath === '/') return 'today';
  if (currentPath.startsWith('/work')) return 'work';
  if (currentPath.startsWith('/life')) return 'life';
  if (currentPath.startsWith('/plans-goals')) return 'vision';
  if (currentPath.startsWith('/assistant')) return 'ai';
  return 'system';
};

const navLabel = (to: string, label: string, unreadCount: number): string =>
  to === '/reminders' && unreadCount > 0 ? `${label} · ${String(unreadCount)}` : label;

const renderNavItems = (
  items: readonly NavigationItem[],
  currentPath: string,
  unreadCount: number,
) =>
  items.map((item) => (
    <li key={item.to}>
      <Link
        aria-label={navLabel(item.to, item.label, unreadCount)}
        className="sidebar__link"
        data-selected={isSelected(item.to, currentPath)}
        to={item.to}
      >
        <item.icon className="sidebar__icon" size={15} strokeWidth={2} aria-hidden="true" />
        <span>{navLabel(item.to, item.label, unreadCount)}</span>
      </Link>
    </li>
  ));

export const AppShell = () => {
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const theme = resolveAppTheme(currentPath);
  const isToday = theme === 'today';
  const notifications = useNotifications();
  const unreadCount = (notifications.data ?? []).filter((item) => item.readAt === null).length;
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPath]);

  useEffect(() => {
    const openCapture = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
        event.preventDefault();
        setCaptureOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setCaptureOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', openCapture);
    return () => {
      window.removeEventListener('keydown', openCapture);
    };
  }, []);

  return (
    <div
      className="app-shell"
      data-theme={theme}
      onInputCapture={(event) => {
        clearProductFieldError(event.target);
      }}
      onInvalidCapture={(event) => {
        event.preventDefault();
        showProductFieldError(event.target);
      }}
    >
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark" aria-hidden="true">
            <Sprout size={22} strokeWidth={1.8} />
          </span>
          <span className="sidebar__brand-copy">
            <strong>生活助手</strong>
            <small>陪你 · 看见生活</small>
          </span>
        </div>
        <button
          className="sidebar__capture"
          aria-label="快速记录"
          onClick={() => {
            setCaptureOpen(true);
          }}
          type="button"
        >
          <span className="sidebar__capture-label">
            <PenLine size={15} strokeWidth={2} aria-hidden="true" />
            快速记录
          </span>
          <kbd>Ctrl ⇧ Space</kbd>
        </button>
        <button
          className="sidebar__search"
          aria-label="全局搜索"
          onClick={() => {
            setSearchOpen(true);
          }}
          type="button"
        >
          <span className="sidebar__capture-label">
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            全局搜索
          </span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav className="sidebar__group" aria-label="核心空间">
          <p className="sidebar__group-label">核心空间</p>
          <ul className="sidebar__navigation">
            {renderNavItems(coreNavigation, currentPath, unreadCount)}
          </ul>
        </nav>
        <nav className="sidebar__group" aria-label="辅助与系统">
          <p className="sidebar__group-label">辅助 / 系统</p>
          <ul className="sidebar__navigation">
            {renderNavItems(systemNavigation, currentPath, unreadCount)}
          </ul>
        </nav>
        <nav className="sidebar__group" aria-label="设置">
          <p className="sidebar__group-label">设置</p>
          <ul className="sidebar__navigation">
            {renderNavItems(settingsNavigation, currentPath, unreadCount)}
          </ul>
        </nav>
      </aside>
      <main
        ref={contentRef}
        className={isToday ? 'content content--today' : 'content'}
        id="main-content"
      >
        {isToday ? null : <div className="theme-atmosphere" aria-hidden="true" />}
        <Outlet />
      </main>
      <QuickCaptureDialog
        open={captureOpen}
        onClose={() => {
          setCaptureOpen(false);
        }}
      />
      <SearchDialog
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
      />
    </div>
  );
};
