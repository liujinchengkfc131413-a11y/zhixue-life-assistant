import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { completeSetup } from './helpers/complete-setup.js';

const shanghaiInput = (offsetDays: number, hour: number, minute = 0): string => {
  const shifted = new Date(Date.now() + 8 * 3_600_000 + offsetDays * 86_400_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

test('M1 through M6 vertical workflow runs without an AI key', async ({ page, request }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(10_000);
  await page.goto('/');

  await completeSetup(page, resolve('test-results/e2e/data'), { includeDemoData: false });
  await expect(page.getByLabel('今日压力与当前状态')).toContainText('压力指数');
  await expect(page.getByLabel('24 小时时间轴')).toBeVisible();

  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await page.getByRole('button', { name: '分类与标签' }).click();
  await expect(page.locator('input[value="自媒体"]')).toBeVisible();

  await page.getByPlaceholder('新分类名称').fill('个人项目');
  await page.getByRole('button', { name: '新增分类' }).click();
  await expect(page.locator('input[value="个人项目"]')).toBeVisible();

  await page.getByPlaceholder('新标签名称').fill('重要');
  await page.getByRole('button', { name: '新增标签' }).click();
  await expect(page.locator('input[value="重要"]')).toBeVisible();

  await page.getByRole('button', { name: '高级' }).click();
  await expect(page.getByText('应用与后台服务状态')).toBeVisible();
  await expect(page.locator('.status-panel').getByText('应用版本')).toBeVisible();
  await expect(page.getByText('磁盘空间')).toBeVisible();
  await expect(page.getByRole('heading', { name: '诊断信息' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出诊断包' })).toBeVisible();

  await page.getByRole('button', { name: 'AI 与模型' }).click();
  await expect(page.getByText('AI 数据')).toBeVisible();
  await expect(page.getByRole('button', { name: '清空 AI 记忆' })).toBeVisible();

  await page.getByRole('button', { name: '作息与日历' }).click();
  await expect(page.getByText('中国法定节假日')).toBeVisible();
  await expect(page.getByRole('button', { name: '联网更新' })).toBeVisible();
  // 测试环境未配置节假日来源，点击后应显示离线降级提示且不崩溃
  await page.getByRole('button', { name: '联网更新' }).click();
  await expect(page.getByText('节假日来源当前不可用')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: '数据与备份' }).click();
  await page.getByRole('button', { name: '立即备份' }).click();
  await expect(page.getByText(/备份已生成/)).toBeVisible();

  await page.getByRole('link', { name: '今日' }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByRole('tab', { name: '固定日程' }).click();
  await page.getByLabel('事项标题').fill('M2 验收会议');
  await page.getByLabel('开始', { exact: true }).fill(shanghaiInput(1, 10));
  await page.getByLabel('结束', { exact: true }).fill(shanghaiInput(1, 11));
  await page.getByRole('button', { name: '添加并自动安排' }).click();

  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByRole('tab', { name: '弹性任务' }).click();
  await page.getByLabel('事项标题').fill('M2 紧急验收任务');
  // 周末作息模板没有 WORK 时段，弹性任务改用 LIFE 区域使其与运行日期无关地排入今日。
  await page.getByLabel('所属区域').selectOption('LIFE');
  await page.getByLabel('优先级').selectOption('URGENT');
  await page.getByLabel('截止').fill(shanghaiInput(2, 18));
  await page.getByRole('button', { name: '添加并自动安排' }).click();
  const scheduledTask = page
    .locator('.today-plan__section--primary .today-plan__main')
    .filter({ hasText: 'M2 紧急验收任务' });
  await expect(scheduledTask).toBeVisible();
  await scheduledTask.click();
  await page
    .getByRole('dialog', { name: '任务详情' })
    .getByLabel('标题')
    .fill('M2 紧急验收任务（已编辑）');
  await page.getByRole('button', { name: '保存并重新安排' }).click();
  await expect(
    page
      .locator('.today-plan__section--primary .today-plan__main')
      .filter({ hasText: 'M2 紧急验收任务（已编辑）' }),
  ).toBeVisible();

  await page.getByRole('link', { name: '计划与目标' }).click();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建目标', exact: true }).click();
  await page.getByLabel('目标名称').fill('完成 M2 验收');
  await page.getByRole('button', { name: '创建目标' }).click();
  await page.getByRole('button', { name: '目标树' }).click();
  await expect(page.getByRole('heading', { name: '完成 M2 验收' })).toBeVisible();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建计划', exact: true }).click();
  await page.getByLabel('计划名称').fill('M2 收尾计划');
  await page.getByLabel('关联目标').selectOption({ label: '完成 M2 验收' });
  await page.getByRole('button', { name: '创建计划' }).click();
  await expect(page.getByText('M2 收尾计划')).toBeVisible();
  await page.getByRole('button', { name: '看板' }).click();
  await expect(page.getByText('M2 收尾计划')).toBeVisible();
  await page.getByRole('button', { name: '日历' }).click();
  await expect(page.getByText('M2 收尾计划').first()).toBeVisible();
  await page.getByRole('button', { name: '时间轴' }).click();
  await expect(page.getByText('M2 收尾计划')).toBeVisible();

  await page.getByRole('link', { name: '今日' }).click();
  const taskRow = page
    .locator('.today-plan__section--primary')
    .getByRole('listitem')
    .filter({ hasText: 'M2 紧急验收任务（已编辑）' });
  await taskRow.getByRole('button', { name: '完成' }).click();
  await expect(
    page.locator('.today-plan__main').filter({ hasText: 'M2 紧急验收任务（已编辑）' }),
  ).toHaveCount(0);

  await page.getByRole('link', { name: '工作', exact: true }).click();
  await expect(page.getByRole('heading', { name: '工作总览' })).toBeVisible();
  await expect(page.getByText('任务完成率')).toBeVisible();
  await page.getByRole('button', { name: '自定义' }).click();
  await expect(page.getByLabel('开始日期')).toBeVisible();
  await page.getByLabel('开始日期').fill('2026-01-01');

  await page.getByRole('link', { name: '自媒体' }).click();
  await page.getByRole('button', { name: '新增内容' }).click();
  await page.getByPlaceholder('选题或内容标题').fill('M4 实机发布内容');
  await page.getByPlaceholder('发布平台（可选）').fill('个人博客');
  await page.getByRole('button', { name: '创建内容' }).click();
  await page.getByRole('button', { name: /M4 实机发布内容/ }).click();
  await page.getByPlaceholder('脚本正文').fill('M4 第二批验收脚本');
  const saveContentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/v1\/work\/self-media\/contents\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page.locator('form.compact-form--flush').getByRole('button', { name: '保存修改' }).click();
  expect((await saveContentResponse).status()).toBe(200);
  const productionStatus = page.getByLabel('制作状态');
  await expect(productionStatus).toBeEnabled();
  for (const status of ['PLANNING', 'CREATING', 'READY', 'PUBLISHED']) {
    const transitionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/transition'),
    );
    await productionStatus.selectOption(status);
    expect((await transitionResponse).status()).toBe(200);
    await expect(productionStatus).toHaveValue(status);
  }
  await page.getByPlaceholder('播放 / 阅读').fill('500');
  await page.getByPlaceholder('点赞').fill('30');
  await page.getByRole('button', { name: '保存表现' }).click();
  await page.locator('.note-composer').getByLabel('笔记标题').fill('发布脚本笔记');
  await page.getByLabel('Markdown 正文').fill('# 开场\n工作模块验收');
  await page.locator('.note-composer').getByRole('button', { name: '保存笔记' }).click();
  await expect(page.getByText('发布脚本笔记')).toBeVisible();
  await page.getByRole('button', { name: '发布脚本笔记' }).click();
  await page.getByRole('button', { name: '富文本' }).click();
  await expect(page.getByLabel('转换预览')).toBeVisible();
  await page.getByRole('button', { name: '返回编辑' }).click();
  await page.getByRole('button', { name: '加粗' }).click();
  await page.locator('.note-composer').getByRole('button', { name: '保存修改' }).click();
  await page.getByRole('button', { name: '趋势' }).click();
  await expect(page.getByLabel('近月内容表现趋势')).toBeVisible();
  await page.getByRole('button', { name: '日历' }).click();
  await page.getByRole('button', { name: '管线' }).click();
  await page.getByRole('button', { name: '新增内容' }).click();
  await page.getByPlaceholder('选题或内容标题').fill('M4 临时内容');
  await page.getByRole('button', { name: '创建内容' }).click();
  await page.getByRole('button', { name: /M4 临时内容/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('form.compact-form--flush')
    .getByRole('button', { name: '删除', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /M4 临时内容/ })).toHaveCount(0);
  await page.getByLabel('内容状态筛选').selectOption('PUBLISHED');
  await expect(page.getByRole('button', { name: /M4 实机发布内容/ })).toBeVisible();

  await page.getByRole('link', { name: '开发项目' }).click();
  await page.getByPlaceholder('新项目名称').fill('M4 开发项目');
  await page.getByPlaceholder('一句话概览').fill('覆盖项目、功能、缺陷与仓库链接');
  await page.getByRole('button', { name: '新增项目' }).click();
  await expect(page.locator('input[value="M4 开发项目"]')).toBeVisible();
  await page.getByPlaceholder('新增里程碑').fill('M4 退出验收');
  await page
    .locator('form.quick-add')
    .filter({ has: page.getByPlaceholder('新增里程碑') })
    .getByRole('textbox')
    .nth(1)
    .fill(shanghaiInput(2, 18).slice(0, 10));
  await page
    .locator('form.quick-add')
    .filter({ has: page.getByPlaceholder('新增里程碑') })
    .getByRole('button', { name: '添加' })
    .click();
  await expect(page.getByText('M4 退出验收')).toBeVisible();
  await page.getByPlaceholder('新增功能').fill('工作总览');
  await page.getByPlaceholder('新增功能').press('Enter');
  await expect(page.getByText('工作总览').last()).toBeVisible();
  await page.getByPlaceholder('记录缺陷').fill('统计范围未刷新');
  await page.getByPlaceholder('记录缺陷').press('Enter');
  await expect(page.getByText('统计范围未刷新')).toBeVisible();
  await page.getByLabel('统计范围未刷新状态').selectOption('RESOLVED');
  await page.getByPlaceholder('链接名称').fill('主仓库');
  await page.getByPlaceholder('https://…').fill('https://example.com/life-assistant');
  await page
    .locator('form.quick-add')
    .filter({ has: page.getByPlaceholder('https://…') })
    .getByRole('button', { name: '添加' })
    .click();
  await expect(page.getByRole('link', { name: '主仓库' })).toHaveAttribute(
    'href',
    'https://example.com/life-assistant',
  );
  await page.locator('.note-composer').getByLabel('笔记标题').fill('技术文档');
  await page.getByLabel('Markdown 正文').fill('数据库迁移与接口说明');
  await page.locator('.note-composer').getByRole('button', { name: '保存笔记' }).click();

  await page.getByRole('link', { name: '学习', exact: true }).click();
  await page.getByPlaceholder('新增学习资源').fill('SQLite 设计课程');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await page.getByRole('button', { name: /SQLite 设计课程/ }).click();
  await page.locator('aside').getByRole('combobox').first().selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: '保存资源' }).click();
  await page.getByPlaceholder('学习分钟').fill('45');
  await page.getByPlaceholder('进度增量（可选）').fill('1');
  await page.getByPlaceholder('知识摘要 / 学习笔记').fill('完成迁移与索引章节');
  await page.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByText('45 分钟')).toBeVisible();
  await page.locator('.note-composer').getByLabel('笔记标题').fill('SQLite 知识卡');
  await page.getByLabel('Markdown 正文').fill('事务与 WAL 模式');
  await page.locator('.note-composer').getByRole('button', { name: '保存笔记' }).click();
  await expect(page.getByText('SQLite 知识卡')).toBeVisible();

  await page.getByRole('link', { name: '工作', exact: true }).click();
  await expect(page.getByText('500')).toBeVisible();
  await expect(page.getByText('45').first()).toBeVisible();

  await page.getByRole('link', { name: '生活', exact: true }).click();
  await expect(page.getByRole('heading', { name: '生活总览' })).toBeVisible();
  await page.getByRole('link', { name: '购物' }).click();
  await page.getByRole('button', { name: '＋ 添加待购' }).click();
  await page.getByPlaceholder('新增待购商品').fill('M5 人体工学椅');
  await page.getByPlaceholder('商品分类').first().fill('家具');
  await page.getByPlaceholder('计划单价（元）').fill('1200');
  await page.getByRole('button', { name: '加入清单' }).click();
  await page.getByRole('button', { name: /M5 人体工学椅/ }).click();
  await page.getByPlaceholder('实际单价（元）').fill('1099');
  await page.getByPlaceholder('实际渠道').fill('线下门店');
  await page.getByRole('button', { name: '确认购买' }).click();
  await expect(page.getByText('¥1,099.00')).toBeVisible();
  await page.getByRole('link', { name: '生活总览' }).click();
  await expect(page.getByText('¥1,099.00').first()).toBeVisible();
  await page.getByRole('link', { name: '饮食' }).click();
  await page.getByRole('heading', { name: '饮食', exact: true }).isVisible();
  await page.getByRole('button', { name: '管理饮食资料' }).click();
  await page.getByPlaceholder('食谱名称').fill('M5 番茄鸡蛋面');
  await page.getByPlaceholder('热量 kcal').first().fill('520');
  await page.getByRole('button', { name: '保存食谱' }).click();
  await page.getByRole('button', { name: '＋ 记录一餐' }).click();
  await page.getByPlaceholder('餐食名称').fill('M5 午餐');
  await page
    .locator('form.inline-work-form select[name="recipeId"]')
    .selectOption({ label: 'M5 番茄鸡蛋面' });
  await page.getByRole('button', { name: '加入餐食计划' }).click();
  const planRow = page.locator('.diet-row').filter({ hasText: 'M5 午餐' });
  await expect(planRow).toBeVisible();
  await planRow.getByRole('button', { name: '完成用餐' }).click();
  await expect(page.locator('strong').filter({ hasText: '520 kcal' })).toBeVisible();
  await page.getByRole('button', { name: '管理饮食资料' }).click();
  await page.locator('input[name="amountMl"]').fill('350');
  await page.getByRole('button', { name: '记一杯水' }).click();
  await expect(page.getByText(/1 条记录 · 350 ml/)).toBeVisible();
  await page.getByRole('button', { name: '管理饮食资料' }).click();
  await page.getByPlaceholder('食物或规则').fill('花生');
  await page.locator('select[name="type"]').selectOption('ALLERGY');
  await page.getByRole('button', { name: '添加偏好' }).click();
  await page.getByRole('button', { name: '管理饮食资料' }).click();
  await expect(page.getByText('偏好与限制 · 1')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('link', { name: '生活总览' }).click();
  await expect(page.getByText('1 餐 · 520 kcal')).toBeVisible();
  await expect(page.getByText('350 ml')).toBeVisible();
  await page.getByRole('link', { name: '健身' }).click();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await page.getByPlaceholder('动作名称').fill('M5 深蹲');
  await page.getByPlaceholder('肌群，用顿号分隔').fill('腿部');
  await page.getByPlaceholder('默认单位').fill('kg');
  await page.getByRole('button', { name: '添加动作' }).click();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await page.getByPlaceholder('训练计划名称').fill('M5 下肢力量');
  await page
    .locator('form')
    .filter({ hasText: '训练计划' })
    .getByRole('combobox')
    .selectOption({ label: 'M5 深蹲' });
  await page.getByPlaceholder('目标组数').fill('3');
  await page.getByPlaceholder('目标次数，如 8–10').fill('5');
  await page.getByRole('button', { name: '创建计划' }).click();
  await page.getByRole('button', { name: '＋ 记录一次训练' }).click();
  await page
    .locator('form.inline-work-form select[name="planId"]')
    .selectOption({ label: 'M5 下肢力量' });
  await page
    .locator('form.inline-work-form select[name="exerciseId"]')
    .selectOption({ label: 'M5 深蹲' });
  await page.getByPlaceholder('次数', { exact: true }).fill('5');
  await page.getByPlaceholder('重量 kg', { exact: true }).fill('80');
  await page.getByPlaceholder('消耗 kcal').fill('420');
  await page.getByPlaceholder('主观强度 1–10').fill('8');
  await page.getByRole('button', { name: '保存训练' }).click();
  await expect(page.getByText('60 分钟').first()).toBeVisible();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await page.getByPlaceholder('体重 kg').fill('65.5');
  await page.getByPlaceholder('体脂 %').fill('20');
  await page.getByRole('button', { name: '记录指标' }).click();
  await expect(page.getByText('65.5 kg')).toBeVisible();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await page.locator('form').filter({ hasText: '今日恢复' }).getByPlaceholder('恢复 1–5').fill('4');
  await page.getByRole('button', { name: '记录恢复' }).click();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await expect(page.getByText('今日恢复 · 4/5')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('link', { name: '生活总览' }).click();
  await expect(page.getByText('1 次 · 60 分钟')).toBeVisible();
  await expect(page.getByText('420 kcal')).toBeVisible();
  await page.getByRole('link', { name: '娱乐' }).click();
  await page.getByRole('button', { name: '＋ 添加娱乐' }).click();
  await page.getByPlaceholder('娱乐条目名称').fill('M5 城市艺术节');
  await page.locator('form.inline-work-form select[name="itemType"]').selectOption('ACTIVITY');
  await page.getByPlaceholder('总进度').fill('1');
  await page.getByPlaceholder('进度单位，如集/章').fill('次');
  await page.getByRole('button', { name: '加入清单' }).click();
  await expect(page.getByRole('button', { name: /M5 城市艺术节/ })).toBeVisible();
  await page
    .getByRole('button', { name: /M5 城市艺术节/ })
    .first()
    .click();
  await page.getByPlaceholder('分钟').fill('120');
  await page.getByPlaceholder('进度增量').fill('1');
  const sessionResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && r.url().endsWith('/api/v1/life/entertainment/sessions'),
  );
  await page.getByRole('button', { name: '保存时间' }).click();
  expect((await sessionResponse).status()).toBe(201);
  await expect(page.locator('form.compact-form--flush').last()).toHaveAttribute(
    'data-version',
    '2',
  );
  await expect(page.getByText('120 分钟').first()).toBeVisible();
  await page
    .getByRole('button', { name: /M5 城市艺术节/ })
    .first()
    .click();
  await page.getByPlaceholder('地点').fill('城市美术馆');
  const tripResponse = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().includes('/trip-details'),
  );
  await page.getByRole('button', { name: '保存详情' }).click();
  expect((await tripResponse).status()).toBe(200);
  await expect(page.locator('form.compact-form--flush').last()).toHaveAttribute(
    'data-version',
    '3',
  );
  await page
    .getByRole('button', { name: /M5 城市艺术节/ })
    .first()
    .click();
  const progressForm = page.locator('form').filter({
    has: page.getByRole('button', { name: '更新进度' }),
  });
  await progressForm.locator('select[name="status"]').selectOption('COMPLETED');
  await progressForm.locator('input[name="progress"]').fill('1');
  await progressForm.getByPlaceholder('评分 0–10').fill('9');
  const progressResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/set-progress'),
  );
  await page.getByRole('button', { name: '更新进度' }).click();
  expect((await progressResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: /M5 城市艺术节 活动 · 已完成/ })).toBeVisible();
  await page
    .getByRole('button', { name: /M5 城市艺术节/ })
    .first()
    .click();
  await page.getByPlaceholder('金额（元）').fill('68');
  await page.getByPlaceholder('商家').fill('艺术节');
  await page.getByRole('button', { name: '记录支出' }).click();
  await page.getByRole('link', { name: '生活总览' }).click();
  await expect(page.getByText('1 项 · 120 分钟')).toBeVisible();
  await expect(page.getByText('¥68.00')).toBeVisible();

  await page.getByRole('button', { name: /快速记录/ }).click();
  await expect(page.getByRole('dialog', { name: '快速记录' })).toBeVisible();
  await page.getByLabel('记录内容').fill('完成 M6 验收；买 M6 标签纸');
  await page.getByRole('button', { name: '仅收集' }).click();
  await page.getByRole('link', { name: '收集箱' }).click();
  await expect(page.getByRole('heading', { name: '收集箱' })).toBeVisible();
  await expect(page.getByRole('blockquote')).toHaveText('完成 M6 验收；买 M6 标签纸');
  const rows = page.locator('.inbox-result-row');
  await rows.nth(1).getByLabel('结果类型').selectOption('SHOPPING_ITEM');
  await page.getByRole('button', { name: '保存处理结果' }).click();
  await expect(page.getByText('处理完成')).toBeVisible();
  await expect(page.getByText('已生成：任务、购物项')).toBeVisible();

  await page.keyboard.press('Control+Shift+Space');
  await expect(page.getByRole('dialog', { name: '快速记录' })).toBeVisible();
  await page.getByLabel('记录内容').fill('AI 不可用明确提示');
  await page.getByRole('button', { name: '交给 AI' }).click();
  await expect(page.getByRole('alert')).toContainText('已按原模式保留在收集箱');
  await page.getByRole('button', { name: '关闭快速记录' }).click();

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: '全局搜索' })).toBeVisible();
  await page.getByPlaceholder('搜索任务、笔记、项目、购物与生活记录…').fill('发布脚本笔记');
  await expect(page.getByRole('link', { name: /发布脚本笔记/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/e2e/m6-global-search.png', fullPage: true });
  await page.getByRole('button', { name: 'Esc' }).click();
  await page.getByRole('link', { name: '数据管理' }).click();
  await expect(page.getByRole('heading', { name: '数据管理' })).toBeVisible();
  await expect(page.getByText('DevProjectCreated').first()).toBeVisible();
  await page.getByRole('button', { name: '版本' }).first().click();
  await expect(page.getByRole('dialog', { name: '对象版本历史' })).toBeVisible();
  await expect(page.getByText(/版本 \d+/).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/e2e/m6-version-history.png', fullPage: true });
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: /回收站/ }).click();
  await expect(page.getByText('M4 临时内容', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/e2e/m6-data-management.png', fullPage: true });

  // M8-002 提醒中心：任务详情添加提醒 → 提醒中心展示
  await page.getByRole('link', { name: '今日' }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByRole('tab', { name: '弹性任务' }).click();
  await page.getByLabel('事项标题').fill('M8 提醒验收任务');
  await page.getByLabel('所属区域').selectOption('LIFE');
  await page.getByLabel('优先级').selectOption('URGENT');
  // 截止明天，确保任务进入今日排程；提醒用固定时间（昨天 6 点，必然已过去）保证立即投递
  await page.getByLabel('截止').fill(shanghaiInput(1, 18));
  await page.getByRole('button', { name: '添加并自动安排' }).click();
  const reminderTask = page
    .locator('.today-plan__section--primary .today-plan__main')
    .filter({ hasText: 'M8 提醒验收任务' });
  await expect(reminderTask).toBeVisible();
  await reminderTask.click();
  await page
    .getByRole('dialog', { name: '任务详情' })
    .getByLabel('提醒模式')
    .selectOption('ABSOLUTE');
  await page
    .getByRole('dialog', { name: '任务详情' })
    .getByLabel('提醒绝对时间')
    .fill(shanghaiInput(-1, 6));
  const addReminderButton = page
    .getByRole('dialog', { name: '任务详情' })
    .getByRole('button', { name: '添加提醒' });
  await addReminderButton.scrollIntoViewIfNeeded();
  await addReminderButton.click();
  await expect(
    page.getByRole('dialog', { name: '任务详情' }).getByText(/固定时间 2026/),
  ).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  // 等待后台投递任务（10 秒间隔）生成到期通知
  await page.waitForTimeout(12000);
  await page.getByRole('link', { name: /提醒中心/ }).click();
  await expect(page.getByRole('heading', { name: '提醒中心' })).toBeVisible();
  await expect(page.getByText('提醒：M8 提醒验收任务')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '标记已读' }).first().click();
  await expect(page.getByRole('button', { name: /全部已读/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/e2e/m8-reminders.png', fullPage: true });

  await page.close();
  expect((await request.get('/health/ready')).ok()).toBe(true);
});
