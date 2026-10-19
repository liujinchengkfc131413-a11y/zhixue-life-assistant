// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoutineOverrideSettings } from './routine-settings.js';

const saveOverride = { mutate: vi.fn(), isPending: false, isError: false };
const removeOverride = { mutate: vi.fn(), isPending: false };
let currentOverride: {
  id: string;
  localDate: string;
  templateId: string | null;
  segments: null;
  note: string | null;
} | null = null;

vi.mock('./api.js', () => ({
  shanghaiDayRange: () => ({ localDate: '2026-09-08', from: '', to: '' }),
  useRoutines: () => ({
    isLoading: false,
    data: [
      {
        id: 'routine-workday',
        version: 1,
        name: '默认工作日',
        templateType: 'WORKDAY',
        isDefault: true,
        segments: [],
      },
      {
        id: 'routine-weekend',
        version: 1,
        name: '默认周末',
        templateType: 'WEEKEND',
        isDefault: true,
        segments: [],
      },
    ],
  }),
  useRoutineOverride: () => ({ isLoading: false, data: currentOverride }),
  useSaveRoutineOverride: () => saveOverride,
  useRemoveRoutineOverride: () => removeOverride,
  useCreateRoutine: vi.fn(),
  useUpdateRoutine: vi.fn(),
}));

describe('RoutineOverrideSettings', () => {
  beforeEach(() => {
    currentOverride = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('saves an existing template for the selected date', () => {
    render(<RoutineOverrideSettings />);

    fireEvent.change(screen.getByLabelText('覆盖作息模板'), {
      target: { value: 'routine-weekend' },
    });
    fireEvent.change(screen.getByLabelText('覆盖备注'), { target: { value: '只改这一天' } });
    fireEvent.click(screen.getByRole('button', { name: '新增日期覆盖' }));

    expect(saveOverride.mutate).toHaveBeenCalledWith({
      date: '2026-09-08',
      override: { templateId: 'routine-weekend', note: '只改这一天' },
    });
  });

  it('saves custom segments and deletes an existing override', () => {
    currentOverride = {
      id: 'override-1',
      localDate: '2026-09-08',
      templateId: 'routine-workday',
      segments: null,
      note: null,
    };
    render(<RoutineOverrideSettings />);

    fireEvent.change(screen.getByLabelText('覆盖方式'), { target: { value: 'CUSTOM' } });
    fireEvent.change(screen.getByLabelText('覆盖时段 2 名称'), { target: { value: '集中工作' } });
    fireEvent.click(screen.getByRole('button', { name: '保存日期覆盖' }));
    expect(saveOverride.mutate).toHaveBeenCalledTimes(1);
    const savedInput = saveOverride.mutate.mock.calls.at(0)?.at(0) as unknown;
    expect(savedInput).toMatchObject({
      date: '2026-09-08',
      override: {
        segments: [{ name: '睡眠' }, { name: '集中工作' }, { name: '晚间' }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '删除日期覆盖' }));
    expect(removeOverride.mutate).toHaveBeenCalledWith('2026-09-08');
  });
});
