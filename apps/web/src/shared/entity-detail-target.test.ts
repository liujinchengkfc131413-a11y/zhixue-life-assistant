import { describe, expect, it } from 'vitest';

import { buildEntityDetailHref, readEntityDetailTarget } from './entity-detail-target.js';

describe('entity detail target resolver', () => {
  it.each([
    ['TASK', 'task-1', '/?entityType=TASK&entityId=task-1'],
    ['EVENT', 'event-1', '/?entityType=EVENT&entityId=event-1'],
    ['GOAL', 'goal-1', '/plans-goals?entityType=GOAL&entityId=goal-1'],
    ['PLAN', 'plan-1', '/plans-goals?entityType=PLAN&entityId=plan-1'],
    [
      'SELF_MEDIA_CONTENT',
      'content-1',
      '/work/self-media?entityType=SELF_MEDIA_CONTENT&entityId=content-1',
    ],
    ['DEV_PROJECT', 'project-1', '/work/development?entityType=DEV_PROJECT&entityId=project-1'],
    [
      'LEARNING_RESOURCE',
      'resource-1',
      '/work/learning?entityType=LEARNING_RESOURCE&entityId=resource-1',
    ],
    ['SHOPPING_ITEM', 'shopping-1', '/life/shopping?entityType=SHOPPING_ITEM&entityId=shopping-1'],
    ['RECIPE', 'recipe-1', '/life/diet?entityType=RECIPE&entityId=recipe-1'],
    ['WORKOUT_PLAN', 'workout-1', '/life/fitness?entityType=WORKOUT_PLAN&entityId=workout-1'],
    [
      'ENTERTAINMENT_ITEM',
      'item-1',
      '/life/entertainment?entityType=ENTERTAINMENT_ITEM&entityId=item-1',
    ],
    ['INBOX_ITEM', 'inbox-1', '/inbox?entityType=INBOX_ITEM&entityId=inbox-1'],
    ['ATTACHMENT', 'file-1', '/data-management?entityType=ATTACHMENT&entityId=file-1'],
    ['UNKNOWN', 'unknown-1', '/data-management?entityType=UNKNOWN&entityId=unknown-1'],
  ])('maps %s to a stable object-specific target', (type, id, expected) => {
    expect(buildEntityDetailHref(type, id)).toBe(expected);
  });

  it('uses the assistant session contract for chat sessions', () => {
    expect(buildEntityDetailHref('CHAT_SESSION', 'chat-1')).toBe('/assistant?sessionId=chat-1');
  });

  it('routes a note through its owning record and preserves the note identity', () => {
    expect(
      buildEntityDetailHref('NOTE', 'note-1', {
        entityType: 'DEV_PROJECT',
        entityId: 'project-1',
      }),
    ).toBe('/work/development?entityType=DEV_PROJECT&entityId=project-1&noteId=note-1');
    expect(
      readEntityDetailTarget('?entityType=DEV_PROJECT&entityId=project-1&noteId=note-1'),
    ).toEqual({ entityType: 'DEV_PROJECT', entityId: 'project-1', noteId: 'note-1' });
  });

  it('reads a complete detail identity and rejects incomplete targets', () => {
    expect(readEntityDetailTarget('?entityType=TASK&entityId=task-1')).toEqual({
      entityType: 'TASK',
      entityId: 'task-1',
    });
    expect(readEntityDetailTarget('?entityType=TASK')).toBeUndefined();
  });
});
