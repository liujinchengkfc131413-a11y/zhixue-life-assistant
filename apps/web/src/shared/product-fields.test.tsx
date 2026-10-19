// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearProductFieldError, LocalDateInput, showProductFieldError } from './product-fields.js';

describe('product fields', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('uses a localized date format hint', () => {
    render(<LocalDateInput aria-label="日期" />);

    expect(screen.getByLabelText('日期')).toHaveAttribute(
      'placeholder',
      '年-月-日，例如 2026-08-28',
    );
  });

  it('shows and clears a Chinese required-field error without a native validation bubble', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    render(
      <label>
        显示名称
        <input aria-label="显示名称" required />
      </label>,
    );
    const field = screen.getByLabelText('显示名称');

    showProductFieldError(field);

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('请输入显示名称');

    fireEvent.input(field, { target: { value: '知雪' } });
    clearProductFieldError(field);
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
