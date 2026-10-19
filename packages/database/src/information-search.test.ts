import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';

import { ActionRepository } from './action-repository.js';
import { AiRepository } from './ai-repository.js';
import { AttachmentRepository } from './attachment-repository.js';
import { ChatRepository } from './chat-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import { InformationRepository } from './information-repository.js';
import { SharedRepository } from './shared-repository.js';
import { SqliteDatabase } from './sqlite-database.js';
import { WorkRepository } from './work-repository.js';

describe('A8 search projection and filters', () => {
  it('indexes task, attachment metadata and chat text while applying all filter dimensions', () => {
    const clock = new FixedClock(new Date('2026-09-03T00:00:00.000Z'));
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    try {
      const consistency = new ConsistencyRepository(database, clock);
      const shared = new SharedRepository(database, clock);
      const actions = new ActionRepository(database, clock, consistency);
      shared.seedDefaults();
      const category = shared.listCategories().find((item) => item.parentArea === 'LIFE');
      if (category === undefined) throw new Error('测试缺少生活分类。');
      const task = actions.createTask({
        categoryId: category.id,
        title: 'Aurora 任务',
        priority: 'NORMAL',
        dueAt: Date.parse('2026-09-10T01:00:00.000Z'),
        estimatedMinutes: 30,
        isFlexible: true,
        preferredArea: 'LIFE',
      });
      const tag = shared.createTag({ name: 'Aurora 标签' });
      actions.addEntityTag(task.id, tag.id, task.version);

      const attachments = new AttachmentRepository(database, clock);
      const attachmentId = attachments.nextId();
      attachments.create({
        id: attachmentId,
        originalName: 'Aurora-行程.pdf',
        safeName: 'aurora.pdf',
        mediaType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: 128,
        sha256: '0'.repeat(64),
        storageKey: 'SECRET_ATTACHMENT_BODY_TOKEN',
        description: '只索引附件描述',
        status: 'READY',
      });
      attachments.link(attachmentId, task.id, 'DOCUMENT');

      const developmentCategory = shared
        .listCategories()
        .find((item) => item.moduleType === 'DEVELOPMENT');
      if (developmentCategory === undefined) throw new Error('测试缺少开发分类。');
      const work = new WorkRepository(database, clock, consistency);
      const project = work.createProject({
        categoryId: developmentCategory.id,
        name: '搜索归属项目',
        summary: null,
        startDate: null,
        targetDate: null,
        planId: null,
      });
      const note = work.createNoteForEntity({
        entityId: project.id,
        categoryId: developmentCategory.id,
        title: 'Aurora 项目笔记',
        markdownContent: 'owner-aware note',
        role: 'TECHNICAL',
      });

      const provider = new AiRepository(database, clock).createProvider({
        providerType: 'OPENAI',
        displayName: '测试模型',
        modelId: 'gpt-test',
      });
      const chats = new ChatRepository(database, clock);
      const session = chats.createSession({
        title: 'Aurora 会话',
        providerConfigId: provider.id,
      });
      if (typeof session.id !== 'string') throw new Error('测试会话缺少字符串 ID');
      chats.sendMessage(session.id, 'Aurora 聊天正文');

      const information = new InformationRepository(database, clock, consistency);
      expect(information.getAiDomainRecord(undefined, task.id)).toMatchObject({
        found: true,
        recordType: 'TASK',
        data: { title: 'Aurora 任务', estimated_minutes: 30 },
      });
      expect(information.getAiDomainRecord('NOTE', note.id)).toMatchObject({
        found: true,
        recordType: 'NOTE',
        data: { plain_text: 'owner-aware note' },
      });
      const attachmentDto = information.getAiDomainRecord('ATTACHMENT', attachmentId);
      expect(attachmentDto).toMatchObject({
        found: true,
        recordType: 'ATTACHMENT',
        data: {
          original_name: 'Aurora-行程.pdf',
          media_type: 'application/pdf',
          size_bytes: 128,
          owner_entity_id: task.id,
        },
      });
      expect(JSON.stringify(attachmentDto)).not.toContain('SECRET_ATTACHMENT_BODY_TOKEN');
      expect(JSON.stringify(attachmentDto)).not.toContain('aurora.pdf');
      expect(information.getAiDomainRecord('GOAL', task.id)).toBeUndefined();
      const reminderId = '01J5A13REMINDER00000000000';
      const blockId = '01J5A13SCHEDULE00000000000';
      database.raw
        .prepare(
          `INSERT INTO entity_index(id,entity_type,created_at,updated_at)
           VALUES (?,'REMINDER',?,?),(?,'SCHEDULE_BLOCK',?,?)`,
        )
        .run(
          reminderId,
          clock.now().getTime(),
          clock.now().getTime(),
          blockId,
          clock.now().getTime(),
          clock.now().getTime(),
        );
      database.raw
        .prepare(
          `INSERT INTO reminders(id,target_entity_id,trigger_mode,offset_minutes,is_enabled)
           VALUES (?,?,'OFFSET_BEFORE_DUE',30,1)`,
        )
        .run(reminderId, task.id);
      database.raw
        .prepare(
          `INSERT INTO schedule_blocks(id,target_entity_id,block_type,area,start_at,end_at,source,is_locked)
           VALUES (?,?,'TASK','LIFE',?,?, 'RULE_ENGINE',0)`,
        )
        .run(
          blockId,
          task.id,
          Date.parse('2026-09-10T01:00:00.000Z'),
          Date.parse('2026-09-10T01:30:00.000Z'),
        );
      expect(information.getAiDomainRecord('REMINDER', reminderId)).toMatchObject({
        data: { target_entity_id: task.id, offset_minutes: 30 },
      });
      expect(information.getAiDomainRecord('SCHEDULE_BLOCK', blockId)).toMatchObject({
        data: { target_entity_id: task.id, source: 'RULE_ENGINE' },
      });
      const all = information.search('Aurora');
      expect(all.map((item) => item.entityType).sort()).toEqual([
        'ATTACHMENT',
        'CHAT_SESSION',
        'NOTE',
        'TASK',
      ]);
      expect(all.find((item) => item.entityId === note.id)).toMatchObject({
        ownerEntityId: project.id,
        ownerEntityType: 'DEV_PROJECT',
      });
      expect(all.find((item) => item.entityId === task.id)?.eventAt).toBe(
        '2026-09-10T01:00:00.000Z',
      );
      expect(information.search('Aurora', { entityType: 'TASK' })).toHaveLength(1);
      expect(information.search('Aurora', { module: category.moduleType })).toHaveLength(1);
      expect(information.search('Aurora', { categoryId: category.id })).toHaveLength(1);
      expect(information.search('Aurora', { status: 'TODO' })).toHaveLength(1);
      expect(information.search('Aurora', { tagId: tag.id })).toHaveLength(1);
      expect(
        information.search('Aurora', {
          entityType: 'TASK',
          categoryId: category.id,
          status: 'TODO',
          tagId: tag.id,
          from: Date.parse('2026-09-09T00:00:00.000Z'),
          to: Date.parse('2026-09-11T00:00:00.000Z'),
        }),
      ).toHaveLength(1);
      expect(information.search('SECRET_ATTACHMENT_BODY_TOKEN')).toEqual([]);
    } finally {
      database.close();
    }
  });
});
