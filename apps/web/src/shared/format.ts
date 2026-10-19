/**
 * M8-005 统一的简体中文日期/时间格式化。
 * 应用时区固定为东八区（Asia/Shanghai），所有面向用户的日期时间显示
 * 必须经由此处，避免依赖运行系统时区导致显示不一致。
 */

export const formatDateTime = (value: string | number | Date): string =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));

export const formatDate = (value: string | number | Date): string =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));

/** 东八区 HH:mm 时间标签。 */
export const formatTime = (value: string | number | Date): string =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));

/** 东八区长日期：2026年8月15日星期六。 */
export const formatLongDate = (value: string | number | Date): string =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
