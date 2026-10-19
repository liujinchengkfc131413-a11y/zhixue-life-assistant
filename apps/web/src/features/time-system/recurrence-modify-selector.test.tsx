// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn<(input: Record<string, unknown>, options?: { onSuccess?: () => void }) => void>(),
}));

vi.mock('./api.js', () => ({
  useRecurrenceRule: () => ({
    data: { id: 'rule-1', version: 7, rrule: 'FREQ=DAILY' },
    isLoading: false,
  }),
  useRecurrenceOccurrences: () => ({
    data: [
      {
        recurrenceKey: '2026-09-03T09:00',
        generatedEntityId: 'event-1',
        status: 'GENERATED',
      },
    ],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useModifyRecurrence: () => ({
    mutate: mocks.mutate,
    isPending: false,
    isError: false,
  }),
}));

import { RecurrenceModifySelector } from './recurrence-modify-selector.js';

describe('recurrence modification selector', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.mutate.mockImplementation((_input, options) => {
      options?.onSuccess?.();
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('maps all five visible choices to the unified versioned mutation', async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    render(
      <RecurrenceModifySelector
        entityId="event-1"
        override={{ title: '只改这次' }}
        onApplied={onApplied}
      />,
    );

    const scope = screen.getByLabelText<HTMLSelectElement>('重复修改范围');
    const apply = screen.getByRole('button', { name: '应用重复修改' });
    await user.click(apply);
    expect(mocks.mutate).toHaveBeenLastCalledWith(
      {
        id: 'rule-1',
        version: 7,
        action: 'ONLY_THIS',
        recurrenceKey: '2026-09-03T09:00',
        override: { title: '只改这次' },
      },
      expect.objectContaining({ onSuccess: onApplied }),
    );

    for (const [value, expectedRule] of [
      ['THIS_AND_FUTURE', true],
      ['ENTIRE_SERIES', true],
      ['SKIP_ONCE', false],
      ['END_RECURRENCE', false],
    ] as const) {
      await user.selectOptions(scope, value);
      if (expectedRule) {
        const ruleInput = screen.getByLabelText<HTMLInputElement>('重复规则');
        await user.clear(ruleInput);
        await user.type(ruleInput, 'FREQ=WEEKLY');
      }
      await user.click(apply);
      expect(mocks.mutate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 'rule-1',
          version: 7,
          action: value,
          recurrenceKey: '2026-09-03T09:00',
          ...(expectedRule ? { rrule: 'FREQ=WEEKLY' } : {}),
        }),
        expect.objectContaining({ onSuccess: onApplied }),
      );
    }

    expect(mocks.mutate).toHaveBeenCalledTimes(5);
    expect(onApplied).toHaveBeenCalledTimes(5);
  });
});
