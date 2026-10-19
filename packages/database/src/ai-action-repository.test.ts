import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';

import { AiActionRepository } from './ai-action-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

describe('A16 AI action state machine', () => {
  it('expires due proposals without executing them', () => {
    const clock = new FixedClock(new Date('2026-09-04T12:00:00.000Z'));
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    try {
      const consistency = new ConsistencyRepository(database, clock);
      const confirmation = consistency.createConfirmation(
        'DELETE_RECORD',
        { entityId: 'task-1' },
        { count: 1 },
      );
      const actions = new AiActionRepository(database, clock);
      const action = actions.create({
        actionType: 'DELETE_RECORD',
        request: { entityId: 'task-1' },
        preview: { count: 1 },
        confirmationId: confirmation.id,
        expiresAt: '2026-09-04T11:59:59.000Z',
      });
      expect(actions.expireDue()).toBe(1);
      expect(actions.get(action.id)).toMatchObject({ status: 'EXPIRED', result: null });
      expect(() => actions.markConfirmed(action.id)).toThrow('AI_ACTION_NOT_CONFIRMABLE');
    } finally {
      database.close();
    }
  });

  it('persists execution success/failure and makes completed execution idempotently readable', () => {
    const clock = new FixedClock(new Date('2026-09-04T12:00:00.000Z'));
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    try {
      const consistency = new ConsistencyRepository(database, clock);
      const actions = new AiActionRepository(database, clock);
      const create = (actionType: 'CLEAR_AI_MEMORY' | 'EMPTY_RECYCLE_BIN') => {
        const confirmation = consistency.createConfirmation(actionType, {}, {});
        return actions.create({
          actionType,
          request: {},
          preview: {},
          confirmationId: confirmation.id,
        });
      };
      const success = create('CLEAR_AI_MEMORY');
      actions.markConfirmed(success.id);
      actions.markExecuting(success.id);
      expect(actions.markExecuted(success.id, { cleared: 2 })).toMatchObject({
        status: 'EXECUTED',
        result: { cleared: 2 },
      });
      expect(actions.markExecuting(success.id)).toMatchObject({ status: 'EXECUTED' });

      const failure = create('EMPTY_RECYCLE_BIN');
      actions.markConfirmed(failure.id);
      actions.markExecuting(failure.id);
      expect(actions.markFailed(failure.id, 'PURGE_FAILED')).toMatchObject({
        status: 'FAILED',
        errorCode: 'PURGE_FAILED',
      });
    } finally {
      database.close();
    }
  });
});
