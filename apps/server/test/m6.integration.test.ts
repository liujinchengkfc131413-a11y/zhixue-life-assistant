import {
  CategoriesEnvelopeSchema,
  GoalsEnvelopeSchema,
  InboxItemEnvelopeSchema,
  InboxItemsEnvelopeSchema,
  ShoppingItemsEnvelopeSchema,
  TasksEnvelopeSchema,
  DraftEnvelopeSchema,
  WorkNoteEnvelopeSchema,
  SearchResultsEnvelopeSchema,
  EntityVersionsEnvelopeSchema,
  RecycleItemsEnvelopeSchema,
  ConfirmationPreviewEnvelopeSchema,
} from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M6 quick capture and inbox API', () => {
  it('captures, manually splits and links results without an AI service', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-13T02:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data;
      const work = categories.find((item) => item.parentArea === 'WORK');
      const shopping = categories.find((item) => item.moduleType === 'SHOPPING');
      const fitness = categories.find((item) => item.moduleType === 'FITNESS');
      if (!work || !shopping || !fitness) throw new Error('缺少默认分类');

      const aiResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/quick-capture',
        payload: { text: '不能静默改道', mode: 'AI_PROCESS' },
      });
      expect(aiResponse.statusCode).toBe(503);
      expect(aiResponse.json()).toMatchObject({ code: 'AI_UNAVAILABLE' });
      expect(
        InboxItemsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/inbox' })).json(),
        ).data,
      ).toMatchObject([
        {
          rawText: '不能静默改道',
          captureMode: 'AI_PROCESS',
          status: 'UNPROCESSED',
        },
      ]);

      const captured = InboxItemEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/quick-capture',
            payload: { text: '完成发布页；买燕麦', mode: 'INBOX_ONLY' },
          })
        ).json(),
      ).data;
      const processedResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/inbox/${captured.id}:process-manually`,
        headers: { 'if-match': `"${String(captured.version)}"` },
        payload: {
          expectedVersion: captured.version,
          results: [
            {
              resultType: 'TASK',
              categoryId: work.id,
              title: '完成发布页',
              priority: 'HIGH',
              dueAt: '2026-08-14T01:00:00.000Z',
              estimatedMinutes: 60,
              isFlexible: true,
              preferredArea: 'WORK',
            },
            {
              resultType: 'SHOPPING_ITEM',
              categoryId: shopping.id,
              name: '买燕麦',
              quantity: 2,
              priority: 'NORMAL',
            },
            {
              resultType: 'GOAL',
              categoryId: fitness.id,
              title: '减重两公斤',
              description: '身体指标目标',
              goalType: 'OUTCOME',
              startDate: '2026-08-13',
              endDate: '2026-09-30',
            },
          ],
        },
      });
      expect(processedResponse.statusCode).toBe(200);
      const processed = InboxItemEnvelopeSchema.parse(processedResponse.json()).data;
      expect(processed.status).toBe('PROCESSED');
      expect(processed.results.map((result) => result.resultType).sort()).toEqual([
        'GOAL',
        'SHOPPING_ITEM',
        'TASK',
      ]);
      expect(processed.processedChangeSetId).not.toBeNull();
      expect(
        TasksEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/tasks' })).json(),
        ).data.some((task) => task.title === '完成发布页'),
      ).toBe(true);
      expect(
        GoalsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/goals' })).json(),
        ).data.some((goal) => goal.title === '减重两公斤'),
      ).toBe(true);
      expect(
        ShoppingItemsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/shopping/items' })).json(),
        ).data.some((item) => item.name === '买燕麦'),
      ).toBe(true);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/inbox/${captured.id}:archive`,
            headers: { 'if-match': `"${String(captured.version)}"` },
            payload: { expectedVersion: captured.version },
          })
        ).statusCode,
      ).toBe(409);
      const archived = await app.inject({
        method: 'POST',
        url: `/api/v1/inbox/${captured.id}:archive`,
        headers: { 'if-match': `"${String(processed.version)}"` },
        payload: { expectedVersion: processed.version },
      });
      expect(InboxItemEnvelopeSchema.parse(archived.json()).data.status).toBe('ARCHIVED');
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('persists recoverable drafts and rich-text notes while opening linked attachments', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-13T03:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.moduleType === 'DEVELOPMENT');
      if (!category) throw new Error('缺少工作分类');
      const project: { data: { id: string } } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/work/dev-projects',
          payload: { categoryId: category.id, name: 'M6 笔记项目' },
        })
      ).json();
      const draft = DraftEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'PUT',
            url: '/api/v1/drafts/work-note-test',
            payload: {
              entityId: project.data.id,
              formType: 'WORK_NOTE',
              content: { title: '未保存标题', mode: 'MARKDOWN', markdown: '# 草稿' },
            },
          })
        ).json(),
      ).data;
      expect(draft?.content).toMatchObject({ title: '未保存标题' });
      expect(
        DraftEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/drafts/work-note-test' })).json(),
        ).data?.draftKey,
      ).toBe('work-note-test');
      expect(
        (await app.inject({ method: 'DELETE', url: '/api/v1/drafts/work-note-test' })).statusCode,
      ).toBe(204);

      const note = WorkNoteEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/entities/${project.data.id}/notes`,
            payload: {
              categoryId: category.id,
              title: '富文本验收',
              editorMode: 'RICH_TEXT',
              markdownContent: '加粗条目',
              richContent: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '加粗条目', marks: [{ type: 'bold' }] }],
                  },
                ],
              },
              role: 'TECHNICAL',
            },
          })
        ).json(),
      ).data;
      expect(note.editorMode).toBe('RICH_TEXT');
      expect(note.richContent).toMatchObject({ type: 'doc' });
      const upload = await app.inject({
        method: 'POST',
        url: '/api/v1/attachments',
        headers: { 'content-type': 'multipart/form-data; boundary=m6-boundary' },
        payload:
          '--m6-boundary\r\nContent-Disposition: form-data; name="file"; filename="m6-note.txt"\r\nContent-Type: text/plain\r\n\r\n附件验收内容\r\n--m6-boundary--\r\n',
      });
      expect(upload.statusCode).toBe(201);
      const attachment: { data: { id: string } } = upload.json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/entities/${project.data.id}/attachments`,
            payload: { attachmentId: attachment.data.id, role: 'DOCUMENT' },
          })
        ).statusCode,
      ).toBe(204);
      const content = await app.inject({
        method: 'GET',
        url: `/api/v1/attachments/${attachment.data.id}/content`,
      });
      expect(content.statusCode).toBe(200);
      expect(content.body).toContain('附件验收内容');
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('searches across modules and protects recycle-bin purges with one-time confirmation', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-13T04:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.moduleType === 'DEVELOPMENT');
      if (!category) throw new Error('缺少开发分类');
      const created: { data: { id: string; version: number } } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/work/dev-projects',
          payload: { categoryId: category.id, name: '雪线搜索项目', summary: '检验中文召回' },
        })
      ).json();

      const search = SearchResultsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/search?q=雪线' })).json(),
      ).data;
      expect(search).toHaveLength(1);
      expect(search[0]).toMatchObject({
        entityId: created.data.id,
        entityType: 'DEV_PROJECT',
        title: '雪线搜索项目',
        eventAt: null,
      });
      const filteredSearch = SearchResultsEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/search?q=雪线&entityType=DEV_PROJECT&module=DEVELOPMENT&categoryId=${category.id}&status=PLANNING&from=2026-08-13T03%3A00%3A00.000Z&to=2026-08-13T05%3A00%3A00.000Z`,
          })
        ).json(),
      ).data;
      expect(filteredSearch.map((item) => item.entityId)).toEqual([created.data.id]);
      expect(
        EntityVersionsEnvelopeSchema.parse(
          (
            await app.inject({ method: 'GET', url: `/api/v1/entities/${created.data.id}/versions` })
          ).json(),
        ).data[0]?.summary,
      ).toBe('DevProjectCreated');

      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/v1/work/dev-projects/${created.data.id}`,
            headers: { 'if-match': `"${String(created.data.version)}"` },
            payload: { expectedVersion: created.data.version },
          })
        ).statusCode,
      ).toBe(204);
      let recycle = RecycleItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
      ).data;
      const deleted = recycle.find((item) => item.id === created.data.id);
      expect(deleted?.title).toBe('雪线搜索项目');
      if (!deleted) throw new Error('回收站缺少对象');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/recycle-bin/${deleted.id}:restore`,
            payload: { expectedVersion: deleted.version },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        RecycleItemsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
        ).data.some((item) => item.id === deleted.id),
      ).toBe(false);

      const lifecycleHistory = EntityVersionsEnvelopeSchema.parse(
        (
          await app.inject({ method: 'GET', url: `/api/v1/entities/${deleted.id}/versions` })
        ).json(),
      ).data;
      expect(lifecycleHistory.map((item) => item.entityVersion)).toEqual([3, 2, 1]);
      expect(lifecycleHistory.every((item) => item.historyKind === 'CANONICAL')).toBe(true);

      const restoredVersion = deleted.version + 1;
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/work/dev-projects/${deleted.id}`,
        headers: { 'if-match': `"${String(restoredVersion)}"` },
        payload: { expectedVersion: restoredVersion },
      });
      recycle = RecycleItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
      ).data;
      const purgeTarget = recycle.find((item) => item.id === deleted.id);
      if (!purgeTarget) throw new Error('永久删除目标缺失');
      const confirmation = ConfirmationPreviewEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/recycle-bin/${purgeTarget.id}:purge-preview`,
            payload: { expectedVersion: purgeTarget.version },
          })
        ).json(),
      ).data;
      const executePayload = {
        token: confirmation.token,
        operation: 'PURGE_ENTITY',
        entityId: purgeTarget.id,
        expectedVersion: purgeTarget.version,
      };
      const executed = await app.inject({
        method: 'POST',
        url: `/api/v1/confirmations/${confirmation.id}:execute`,
        payload: executePayload,
      });
      expect(executed.statusCode, executed.body).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/confirmations/${confirmation.id}:execute`,
            payload: executePayload,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        RecycleItemsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
        ).data.some((item) => item.id === purgeTarget.id),
      ).toBe(false);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('restores historical versions and safely undo-redoes only the latest change set', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-13T05:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.moduleType === 'DEVELOPMENT');
      if (!category) throw new Error('缺少开发分类');
      const created: { data: { id: string; version: number } } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/work/dev-projects',
          payload: { categoryId: category.id, name: '历史项目', summary: '第一版' },
        })
      ).json();
      const updated: { data: { version: number } } = (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/work/dev-projects/${created.data.id}`,
          headers: { 'if-match': '"1"' },
          payload: { expectedVersion: 1, name: '历史项目第二版', summary: '第二版' },
        })
      ).json();
      expect(updated.data.version).toBe(2);

      const versions = EntityVersionsEnvelopeSchema.parse(
        (
          await app.inject({ method: 'GET', url: `/api/v1/entities/${created.data.id}/versions` })
        ).json(),
      ).data;
      expect(
        versions.map((item) => [item.entityVersion, item.historyKind, item.restoreEligibility]),
      ).toEqual([
        [2, 'CANONICAL', 'ELIGIBLE'],
        [1, 'CANONICAL', 'ELIGIBLE'],
      ]);
      const updateChangeSet = versions.find((item) => item.entityVersion === 2)?.changeSetId;
      if (!updateChangeSet) throw new Error('更新变更集缺失');
      const undoPreview: {
        data: {
          id: string;
          token: string;
          preview: { entityId: string; expectedVersion: number; targetVersion: number };
        };
      } = (
        await app.inject({
          method: 'POST',
          url: `/api/v1/change-sets/${updateChangeSet}:undo-preview`,
        })
      ).json();
      const undoPayload = {
        token: undoPreview.data.token,
        operation: 'UNDO_CHANGE_SET',
        changeSetId: updateChangeSet,
        entityId: undoPreview.data.preview.entityId,
        expectedVersion: undoPreview.data.preview.expectedVersion,
        targetVersion: undoPreview.data.preview.targetVersion,
      };
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/confirmations/${undoPreview.data.id}:execute`,
            payload: undoPayload,
          })
        ).statusCode,
      ).toBe(200);
      let project: { data: { name: string; version: number } } = (
        await app.inject({ method: 'GET', url: `/api/v1/work/dev-projects/${created.data.id}` })
      ).json();
      expect(project.data).toMatchObject({ name: '历史项目', version: 3 });

      const redoPreview: {
        data: {
          id: string;
          token: string;
          preview: { entityId: string; expectedVersion: number; targetVersion: number };
        };
      } = (
        await app.inject({
          method: 'POST',
          url: `/api/v1/change-sets/${updateChangeSet}:redo-preview`,
        })
      ).json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/confirmations/${redoPreview.data.id}:execute`,
            payload: {
              token: redoPreview.data.token,
              operation: 'REDO_CHANGE_SET',
              changeSetId: updateChangeSet,
              entityId: redoPreview.data.preview.entityId,
              expectedVersion: redoPreview.data.preview.expectedVersion,
              targetVersion: redoPreview.data.preview.targetVersion,
            },
          })
        ).statusCode,
      ).toBe(200);
      project = (
        await app.inject({ method: 'GET', url: `/api/v1/work/dev-projects/${created.data.id}` })
      ).json();
      expect(project.data).toMatchObject({ name: '历史项目第二版', version: 4 });

      const restorePreview: {
        data: {
          id: string;
          token: string;
          preview: { entityId: string; expectedVersion: number; targetVersion: number };
        };
      } = (
        await app.inject({
          method: 'POST',
          url: `/api/v1/entities/${created.data.id}/versions/1:restore-preview`,
          payload: { expectedVersion: 4 },
        })
      ).json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/confirmations/${restorePreview.data.id}:execute`,
            payload: {
              token: restorePreview.data.token,
              operation: 'RESTORE_VERSION',
              entityId: restorePreview.data.preview.entityId,
              expectedVersion: restorePreview.data.preview.expectedVersion,
              targetVersion: restorePreview.data.preview.targetVersion,
            },
          })
        ).statusCode,
      ).toBe(200);
      project = (
        await app.inject({ method: 'GET', url: `/api/v1/work/dev-projects/${created.data.id}` })
      ).json();
      expect(project.data).toMatchObject({ name: '历史项目', version: 5 });
      const fullHistory = EntityVersionsEnvelopeSchema.parse(
        (
          await app.inject({ method: 'GET', url: `/api/v1/entities/${created.data.id}/versions` })
        ).json(),
      ).data;
      expect(fullHistory.map((item) => item.entityVersion)).toEqual([5, 4, 3, 2, 1]);
      expect(fullHistory.every((item) => item.restoreEligibility === 'ELIGIBLE')).toBe(true);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/change-sets/${updateChangeSet}:undo-preview`,
          })
        ).statusCode,
      ).toBe(409);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
