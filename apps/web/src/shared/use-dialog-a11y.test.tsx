// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { useDialogA11y } from './use-dialog-a11y.js';

const Dialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return (
    <div ref={panelRef} role="dialog" tabIndex={-1} aria-label="测试对话框">
      <button type="button">第一个</button>
      <button type="button">第二个</button>
    </div>
  );
};

describe('useDialogA11y', () => {
  it('moves focus into the dialog when opened', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open={false} onClose={onClose} />);
    rerender(<Dialog open={true} onClose={onClose} />);
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        expect(screen.getByRole('dialog')).toHaveFocus();
        resolve();
      }, 10);
    });
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab at the last focusable element', async () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const buttons = screen.getAllByRole('button');
    const last = buttons[buttons.length - 1];
    if (last === undefined) throw new Error('缺少按钮');
    last.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    // 焦点陷阱必须阻止默认 Tab 行为（jsdom 无法完整模拟焦点移动，验证 preventDefault）
    expect(window.dispatchEvent(event)).toBe(false);
  });

  it('restores focus to the opener when closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">opener</button>
        <Dialog open={false} onClose={onClose} />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    rerender(
      <>
        <button type="button">opener</button>
        <Dialog open={true} onClose={onClose} />
      </>,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    rerender(
      <>
        <button type="button">opener</button>
        <Dialog open={false} onClose={onClose} />
      </>,
    );
    expect(opener).toHaveFocus();
  });
});
