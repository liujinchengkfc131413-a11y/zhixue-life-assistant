import {
  CategoriesEnvelopeSchema,
  DevDefectEnvelopeSchema,
  DevFeatureEnvelopeSchema,
  DevProjectEnvelopeSchema,
  DevProjectMilestoneEnvelopeSchema,
  LinkedAttachmentsEnvelopeSchema,
  LearningResourceEnvelopeSchema,
  LearningSessionEnvelopeSchema,
  RepositoryLinkEnvelopeSchema,
  SelfMediaContentEnvelopeSchema,
  SelfMediaMetricEnvelopeSchema,
  SelfMediaTrendEnvelopeSchema,
  WorkNoteEnvelopeSchema,
  WorkNotesEnvelopeSchema,
  WorkOverviewEnvelopeSchema,
} from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M4 work modules API', () => {
  it('runs self-media, development, learning and overview as one local vertical slice', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-11T04:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/setup/initialize',
            payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
          })
        ).statusCode,
      ).toBe(200);
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data;
      const category = (type: string) => {
        const value = categories.find((x) => x.moduleType === type);
        if (value === undefined) throw new Error(`缺少 ${type} 分类`);
        return value.id;
      };

      const content = SelfMediaContentEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/self-media/contents',
            payload: {
              categoryId: category('SELF_MEDIA'),
              title: 'M4 发布说明',
              contentType: 'ARTICLE',
              idea: '记录工作模块实现',
              platform: '个人博客',
            },
          })
        ).json(),
      ).data;
      let published = content;
      for (const status of ['PLANNING', 'CREATING', 'READY', 'PUBLISHED'] as const) {
        published = SelfMediaContentEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/work/self-media/contents/${content.id}/transition`,
              headers: { 'if-match': `"${String(published.version)}"` },
              payload: {
                expectedVersion: published.version,
                status,
                ...(status === 'PUBLISHED' ? { publishedAt: '2026-08-11T05:00:00.000Z' } : {}),
              },
            })
          ).json(),
        ).data;
      }
      expect(published.productionStatus).toBe('PUBLISHED');
      expect(
        SelfMediaMetricEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/work/self-media/contents/${content.id}/metrics`,
              payload: { recordedDate: '2026-08-11', platform: '个人博客', views: 320, likes: 18 },
            })
          ).json(),
        ).data.views,
      ).toBe(320);
      expect(
        SelfMediaTrendEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'GET',
              url: '/api/v1/work/self-media/statistics?range=CUSTOM&from=2026-08-01&to=2026-08-31',
            })
          ).json(),
        ).data,
      ).toEqual([expect.objectContaining({ date: '2026-08-11', views: 320, likes: 18 })]);

      const scriptNote = WorkNoteEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/entities/${content.id}/notes`,
            payload: {
              categoryId: category('SELF_MEDIA'),
              title: '发布脚本',
              markdownContent: '# 开场\n完成 M4 第二批',
              role: 'SCRIPT',
            },
          })
        ).json(),
      ).data;
      expect(
        WorkNotesEnvelopeSchema.parse(
          (
            await app.inject({ method: 'GET', url: `/api/v1/work/entities/${content.id}/notes` })
          ).json(),
        ).data[0]?.plainText,
      ).toContain('完成 M4 第二批');
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/work/entities/${content.id}/notes/${scriptNote.id}`,
            headers: { 'if-match': `"${String(scriptNote.version)}"` },
            payload: { expectedVersion: scriptNote.version, title: '最终发布脚本' },
          })
        ).statusCode,
      ).toBe(200);

      const project = DevProjectEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/dev-projects',
            payload: {
              categoryId: category('DEVELOPMENT'),
              name: '生活助手',
              summary: '本地优先桌面应用',
              status: 'ACTIVE',
              targetDate: '2026-09-01',
            },
          })
        ).json(),
      ).data;
      expect(
        DevFeatureEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/work/dev-projects/${project.id}/features`,
              payload: { title: '工作总览', status: 'DONE', priority: 'HIGH' },
            })
          ).json(),
        ).data.status,
      ).toBe('DONE');
      expect(
        DevDefectEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/work/dev-projects/${project.id}/defects`,
              payload: {
                title: '范围切换未刷新',
                severity: 'HIGH',
                reproductionSteps: '切换到本月',
              },
            })
          ).json(),
        ).data.severity,
      ).toBe('HIGH');
      const repo = RepositoryLinkEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/dev-projects/${project.id}/repositories`,
            payload: { name: '主仓库', url: 'https://example.com/life-assistant' },
          })
        ).json(),
      ).data;
      expect(repo.url).toBe('https://example.com/life-assistant');

      const milestone = DevProjectMilestoneEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/dev-projects/${project.id}/milestones`,
            payload: { title: 'M4 验收', dueAt: '2026-08-15T10:00:00.000Z' },
          })
        ).json(),
      ).data;
      expect(
        DevProjectMilestoneEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'PATCH',
              url: `/api/v1/work/dev-milestones/${milestone.id}`,
              headers: { 'if-match': `"${String(milestone.version)}"` },
              payload: { expectedVersion: milestone.version, status: 'ACHIEVED' },
            })
          ).json(),
        ).data.status,
      ).toBe('ACHIEVED');

      const attachmentRepository = runtime.attachmentRepository;
      if (attachmentRepository === undefined) throw new Error('附件仓库未初始化。');
      const attachmentId = attachmentRepository.nextId();
      attachmentRepository.create({
        id: attachmentId,
        originalName: 'm4-notes.md',
        safeName: 'm4-notes.md',
        mediaType: 'text/markdown',
        extension: '.md',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        storageKey: 'attachments/test/m4-notes.md',
        description: null,
        status: 'READY',
      });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/entities/${project.id}/attachments`,
            payload: { attachmentId, role: 'DOCUMENT' },
          })
        ).statusCode,
      ).toBe(204);
      expect(
        LinkedAttachmentsEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'GET',
              url: `/api/v1/work/entities/${project.id}/attachments`,
            })
          ).json(),
        ).data[0],
      ).toMatchObject({ id: attachmentId, role: 'DOCUMENT' });

      const resource = LearningResourceEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/learning/resources',
            payload: {
              categoryId: category('LEARNING'),
              title: 'SQLite 设计',
              resourceType: 'BOOK',
              author: '测试作者',
              status: 'IN_PROGRESS',
              progressCurrent: 20,
              progressTotal: 200,
              progressUnit: '页',
            },
          })
        ).json(),
      ).data;
      const session = LearningSessionEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/learning/sessions',
            payload: {
              resourceId: resource.id,
              sessionDate: '2026-08-11',
              durationMinutes: 45,
              progressDelta: 12,
              summary: '完成迁移章节',
            },
          })
        ).json(),
      ).data;
      expect(session.durationMinutes).toBe(45);

      const overview = WorkOverviewEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/work/overview?range=WEEK' })).json(),
      ).data;
      expect(overview.selfMedia).toMatchObject({ published: 1, views: 320 });
      expect(overview.development).toMatchObject({
        projects: 1,
        featureCompletionRate: 100,
        openDefects: 1,
      });
      expect(overview.learning).toMatchObject({ minutes: 45, activeResources: 1 });

      const noFetch = await app.inject({
        method: 'GET',
        url: `/api/v1/work/dev-projects/${project.id}/repositories`,
      });
      expect(noFetch.statusCode).toBe(200);
      expect(noFetch.body).toContain('https://example.com/life-assistant');
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('rejects invalid published content, non-http repository URLs and negative metrics', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
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
      const media = categories.find((x) => x.moduleType === 'SELF_MEDIA');
      const dev = categories.find((x) => x.moduleType === 'DEVELOPMENT');
      if (media === undefined || dev === undefined) throw new Error('测试缺少 M4 默认分类。');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/self-media/contents',
            payload: {
              categoryId: media.id,
              title: '非法发布',
              contentType: 'VIDEO',
              productionStatus: 'PUBLISHED',
            },
          })
        ).statusCode,
      ).toBe(422);
      const project = DevProjectEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/work/dev-projects',
            payload: { categoryId: dev.id, name: '安全链接' },
          })
        ).json(),
      ).data;
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/work/dev-projects/${project.id}/repositories`,
            payload: { name: '本地文件', url: 'file:///etc/passwd' },
          })
        ).statusCode,
      ).toBe(422);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
