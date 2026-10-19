import { useEffect, useRef, useState } from 'react';

import { useDialogA11y } from '../../shared/use-dialog-a11y.js';
import { useQuickCapture } from './api.js';
import { useSettings } from '../settings/api.js';

export const QuickCaptureDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const capture = useQuickCapture();
  const settings = useSettings();
  const textArea = useRef<HTMLTextAreaElement>(null);
  const panelRef = useDialogA11y<HTMLElement>(open, onClose, 'textarea[aria-label="记录内容"]');
  const defaultMode =
    settings.data?.find((item) => item.key === 'quick_capture.default_action')?.value === 'AI'
      ? 'AI_PROCESS'
      : 'INBOX_ONLY';

  useEffect(() => {
    if (open) window.setTimeout(() => textArea.current?.focus(), 0);
  }, [open]);
  if (!open) return null;

  const submit = (mode: 'INBOX_ONLY' | 'AI_PROCESS') => {
    if (text.trim() === '') return;
    setMessage('');
    capture.mutate(
      { text, mode },
      {
        onSuccess: () => {
          setText('');
          onClose();
        },
        onError: () => {
          setMessage(
            mode === 'AI_PROCESS'
              ? 'AI 尚未配置，内容已按原模式保留在收集箱，你可以前往手动处理。'
              : '保存失败，请稍后重试。',
          );
        },
      },
    );
  };
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        className="quick-capture-dialog"
        data-surface="system"
        role="dialog"
        tabIndex={-1}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">随手记下，稍后整理</p>
            <h2 id="quick-capture-title">快速记录</h2>
          </div>
          <button aria-label="关闭快速记录" className="text-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <textarea
          ref={textArea}
          aria-label="记录内容"
          placeholder="例如：周五前完成发布页；买牛奶和燕麦……"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        {message !== '' && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <div className="quick-capture-dialog__footer">
          <span>Ctrl + Shift + Space</span>
          <div className="form-actions">
            <button
              className={`button${defaultMode === 'AI_PROCESS' ? ' button--primary' : ''}`}
              disabled={capture.isPending || text.trim() === ''}
              onClick={() => {
                submit('AI_PROCESS');
              }}
              type="button"
            >
              交给 AI{defaultMode === 'AI_PROCESS' ? '（默认）' : ''}
            </button>
            <button
              className={`button${defaultMode === 'INBOX_ONLY' ? ' button--primary' : ''}`}
              disabled={capture.isPending || text.trim() === ''}
              onClick={() => {
                submit('INBOX_ONLY');
              }}
              type="button"
            >
              仅收集{defaultMode === 'INBOX_ONLY' ? '（默认）' : ''}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
