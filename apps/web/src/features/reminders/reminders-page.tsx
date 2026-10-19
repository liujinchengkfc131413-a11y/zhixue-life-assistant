import { useState } from 'react';
import { buildEntityDetailHref } from '../../shared/entity-detail-target.js';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useSnoozeNotification,
} from './api.js';

const typeLabels = {
  REMINDER: '提醒',
  SYSTEM: '系统',
  AI_SUGGESTION: 'AI 建议',
  SCHEDULE_WARNING: '排程提示',
} as const;

const severityLabels = {
  INFO: '普通',
  WARNING: '注意',
  CRITICAL: '重要',
} as const;

const snoozeOptions = [
  { label: '10 分钟', minutes: 10 },
  { label: '1 小时', minutes: 60 },
  { label: '明天', minutes: 60 * 24 },
] as const;

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));

const dayKey = (value: string | number): string =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));

const notificationState = (
  item: {
    readAt: string | null;
    scheduledAt: string;
  },
  now: number,
): 'READ' | 'UPCOMING' | 'OVERDUE' | 'UNREAD' => {
  if (item.readAt !== null) return 'READ';
  if (new Date(item.scheduledAt).getTime() > now) return 'UPCOMING';
  if (dayKey(item.scheduledAt) < dayKey(now)) return 'OVERDUE';
  return 'UNREAD';
};

const stateLabels = {
  READ: '已读',
  UPCOMING: '即将到来',
  OVERDUE: '已逾期',
  UNREAD: '未读',
} as const;

export const RemindersPage = () => {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const snooze = useSnoozeNotification();
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const items = notifications.data ?? [];
  const unreadCount = items.filter((item) => item.readAt === null).length;
  const todayKey = dayKey(renderedAt);
  const groups = [
    {
      key: 'today',
      label: '今天',
      items: items.filter((item) => dayKey(item.scheduledAt) === todayKey),
    },
    {
      key: 'earlier',
      label: '更早',
      items: items.filter((item) => dayKey(item.scheduledAt) !== todayKey),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <main className="page reminders-page">
      <header className="page__header">
        <div>
          <span className="eyebrow">应用内提醒</span>
          <h1>提醒中心</h1>
          <p>已到期的提醒在这里展示，不会被系统推送打断。</p>
        </div>
        <button
          className="button"
          type="button"
          disabled={markAllRead.isPending || unreadCount === 0}
          onClick={() => {
            markAllRead.mutate();
          }}
        >
          {unreadCount > 0 ? `全部已读（${String(unreadCount)}）` : '全部已读'}
        </button>
      </header>

      {notifications.isLoading ? <p>正在加载提醒…</p> : null}
      {notifications.isError ? (
        <p className="form-error">提醒暂时无法加载。请确认本地服务运行正常后重试。</p>
      ) : null}
      {!notifications.isLoading && !notifications.isError && items.length === 0 ? (
        <section className="empty-state">
          <h2>暂无提醒</h2>
          <p>为任务或日程设置提醒后，到期内容会出现在这里。</p>
        </section>
      ) : null}
      <div className="notification-groups">
        {groups.map((group) => (
          <section
            className="notification-group"
            aria-labelledby={`notification-group-${group.key}`}
            key={group.key}
          >
            <div className="notification-group__heading">
              <h2 id={`notification-group-${group.key}`}>{group.label}</h2>
              <span>{String(group.items.length)} 条</span>
            </div>
            <ul className="notification-list">
              {group.items.map((item) => {
                const state = notificationState(item, renderedAt);
                return (
                  <li
                    key={item.id}
                    className={`notification-row${item.readAt === null ? ' notification-row--unread' : ''}`}
                    data-severity={item.severity}
                    data-state={state}
                  >
                    <div className="notification-row__main">
                      <div className="notification-row__meta">
                        <span className="pill">
                          {typeLabels[item.notificationType]} · {severityLabels[item.severity]}
                        </span>
                        <span className="notification-state">{stateLabels[state]}</span>
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                      <small>{formatTime(item.scheduledAt)}</small>
                    </div>
                    <div className="notification-row__actions">
                      {item.readAt === null ? (
                        <button
                          className="button button--small"
                          type="button"
                          disabled={markRead.isPending}
                          onClick={() => {
                            markRead.mutate(item.id);
                          }}
                        >
                          标记已读
                        </button>
                      ) : null}
                      {snoozeTarget === item.id ? (
                        <div className="row-confirmation">
                          <span>稍后提醒到：</span>
                          {snoozeOptions.map((option) => (
                            <button
                              key={option.minutes}
                              className="button button--small"
                              type="button"
                              disabled={snooze.isPending}
                              onClick={() => {
                                snooze.mutate(
                                  {
                                    id: item.id,
                                    snoozedUntil: new Date(
                                      Date.now() + option.minutes * 60_000,
                                    ).toISOString(),
                                  },
                                  {
                                    onSuccess: () => {
                                      setSnoozeTarget(null);
                                    },
                                  },
                                );
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                          <button
                            className="button button--small"
                            type="button"
                            onClick={() => {
                              setSnoozeTarget(null);
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button button--small"
                          type="button"
                          onClick={() => {
                            setSnoozeTarget(item.id);
                          }}
                        >
                          稍后提醒
                        </button>
                      )}
                      {item.targetEntityId !== null && item.targetEntityType !== null ? (
                        <a
                          className="button button--small"
                          href={buildEntityDetailHref(item.targetEntityType, item.targetEntityId)}
                        >
                          查看详情
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
};
