import { useEffect, useRef } from 'react';

/**
 * M8-006 对话框无障碍 hook：
 * - 打开时聚焦到面板（或指定元素）
 * - Tab / Shift+Tab 焦点循环（不逃出对话框）
 * - Escape 触发 onClose
 * - 关闭后把焦点还给打开前的元素
 */
export const useDialogA11y = <T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  initialFocusSelector?: string,
) => {
  const panelRef = useRef<T>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const timer = window.setTimeout(() => {
      if (initialFocusSelector !== undefined) {
        const target = panel?.querySelector<HTMLElement>(initialFocusSelector);
        target?.focus();
        return;
      }
      panel?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || panel === null) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus();
    };
  }, [open, onClose, initialFocusSelector]);

  return panelRef;
};
