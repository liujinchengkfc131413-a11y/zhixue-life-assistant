// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { EmptyState, ErrorState, LoadingState } from './state-panel.js';

describe('ErrorState', () => {
  it('renders a Chinese error with recovery guidance and icon', () => {
    render(<ErrorState>本地服务暂时无法完成此操作。请确认服务仍在运行，然后重试。</ErrorState>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(
      screen.getByText('本地服务暂时无法完成此操作。请确认服务仍在运行，然后重试。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert').querySelector('.lucide-circle-alert')).toBeInTheDocument();
  });

  it('renders custom title and action', () => {
    render(
      <ErrorState title="节假日更新失败" action={<button type="button">重试</button>}>
        来源不可用。
      </ErrorState>,
    );
    expect(screen.getByText('节假日更新失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders a guiding empty message', () => {
    render(
      <EmptyState title="暂无提醒">为任务或日程设置提醒后，到期内容会出现在这里。</EmptyState>,
    );
    expect(screen.getByText('暂无提醒')).toBeInTheDocument();
    expect(screen.getByText('为任务或日程设置提醒后，到期内容会出现在这里。')).toBeInTheDocument();
    expect(document.querySelector('.lucide-circle-dashed')).toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('announces a real loading state without a generic spinner', () => {
    render(<LoadingState>正在同步提醒。</LoadingState>);
    const panel = screen.getByText('正在同步提醒。').closest('section');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(panel).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('正在加载')).toBeInTheDocument();
    expect(document.querySelector('.lucide-loader-circle')).toBeInTheDocument();
  });
});
