import type { SqliteDatabase } from './sqlite-database.js';

const DEMO_BATCH_ID = 'demo-2026-08-13';
const DEMO_TIME = Date.parse('2026-08-17T09:00:00.000Z');

type CategoryMap = Readonly<Record<string, string>>;

export class DemoDataRepository {
  public constructor(private readonly database: SqliteDatabase) {}

  public status(): { exists: boolean; recordCount: number; batchId: string } {
    const row = this.database.raw
      .prepare('SELECT COUNT(*) count FROM entity_index WHERE demo_batch_id = ?')
      .get(DEMO_BATCH_ID) as { count: number };
    return { exists: row.count > 0, recordCount: row.count, batchId: DEMO_BATCH_ID };
  }

  public seed(): { recordCount: number; batchId: string } {
    this.clear();
    const categories = this.categories();
    this.database.transaction(() => {
      this.insertEntity('01J5DEMO000000000000000001', 'GOAL');
      this.database.raw
        .prepare(
          `INSERT INTO goals(id,category_id,title,description,goal_type,status,start_date,end_date,horizon)
           VALUES (?,?,'建立可持续的一周节奏','用可执行的计划平衡工作、健康与生活。','OUTCOME','ACTIVE','2026-08-17','2026-12-31','LONG_TERM')`,
        )
        .run('01J5DEMO000000000000000001', categories.DEVELOPMENT);
      this.insertEntity('01J5DEMO000000000000000002', 'PLAN');
      this.database.raw
        .prepare(
          `INSERT INTO plans(id,goal_id,category_id,title,description,status,priority,start_date,end_date)
           VALUES (?,? ,?,'本周优先事项','演示计划：安排一项工作、一项学习和一项生活事务。','ACTIVE','HIGH','2026-08-17','2026-08-23')`,
        )
        .run('01J5DEMO000000000000000002', '01J5DEMO000000000000000001', categories.DEVELOPMENT);
      this.insertEntity('01J5DEMO000000000000000003', 'TASK');
      this.database.raw
        .prepare(
          `INSERT INTO tasks(id,category_id,plan_id,goal_id,title,description,status,priority,due_at,estimated_minutes,is_flexible,is_splittable,preferred_area)
           VALUES (?, ?, ?, ?, '梳理本周项目重点','这是可在今日页自动安排的演示任务。','TODO','HIGH',?,60,1,0,'WORK')`,
        )
        .run(
          '01J5DEMO000000000000000003',
          categories.DEVELOPMENT,
          '01J5DEMO000000000000000002',
          '01J5DEMO000000000000000001',
          DEMO_TIME + 86_400_000,
        );
      this.insertEntity('01J5DEMO000000000000000004', 'SELF_MEDIA_CONTENT');
      this.database.raw
        .prepare(
          `INSERT INTO self_media_contents(id,category_id,title,idea,content_type,platform,production_status)
           VALUES (?,?,'晨间效率复盘','记录一周中最有效的时间安排。','ARTICLE','个人博客','PLANNING')`,
        )
        .run('01J5DEMO000000000000000004', categories.SELF_MEDIA);
      this.insertEntity('01J5DEMO000000000000000005', 'DEV_PROJECT');
      this.database.raw
        .prepare(
          `INSERT INTO dev_projects(id,category_id,name,summary,status,start_date,target_date,plan_id)
           VALUES (?,?,'生活助手改进','演示开发项目：从想法到功能、缺陷和里程碑。','ACTIVE','2026-08-17','2026-09-15',?)`,
        )
        .run('01J5DEMO000000000000000005', categories.DEVELOPMENT, '01J5DEMO000000000000000002');
      this.insertEntity('01J5DEMO000000000000000006', 'LEARNING_RESOURCE');
      this.database.raw
        .prepare(
          `INSERT INTO learning_resources(id,category_id,title,resource_type,author,status,progress_current,progress_total,progress_unit,started_at)
           VALUES (?,?,'SQLite 事务与索引','COURSE','本地学习计划','IN_PROGRESS',2,8,'章节',?)`,
        )
        .run('01J5DEMO000000000000000006', categories.LEARNING, DEMO_TIME);
      this.insertEntity('01J5DEMO000000000000000007', 'SHOPPING_ITEM');
      this.database.raw
        .prepare(
          `INSERT INTO shopping_items(id,category_id,name,product_category,quantity,unit,planned_unit_price_minor,priority,status)
           VALUES (?,?,'桌面收纳盒','居家','1','个',4900,'NORMAL','WANTED')`,
        )
        .run('01J5DEMO000000000000000007', categories.SHOPPING);
      this.insertEntity('01J5DEMO000000000000000008', 'RECIPE');
      this.database.raw
        .prepare(
          `INSERT INTO recipes(id,category_id,name,description,servings,calories_kcal,protein_g,carbs_g,fat_g)
           VALUES (?,?,'番茄鸡蛋面','简单、适合工作日午餐的演示食谱。',1,520,21,68,17)`,
        )
        .run('01J5DEMO000000000000000008', categories.DIET);
      this.insertEntity('01J5DEMO000000000000000009', 'EXERCISE');
      this.database.raw
        .prepare(
          `INSERT INTO exercise_catalog(id,name,exercise_type,muscle_groups_json,default_unit,instructions)
           VALUES (?,'深蹲','STRENGTH','["腿部"]','kg','注意动作稳定与呼吸。')`,
        )
        .run('01J5DEMO000000000000000009');
      this.insertEntity('01J5DEMO000000000000000010', 'ENTERTAINMENT_ITEM');
      this.database.raw
        .prepare(
          `INSERT INTO entertainment_items(id,category_id,title,item_type,list_type,status,progress_current,progress_total,progress_unit,note)
           VALUES (?,?,'周末公园散步','ACTIVITY','WANT_TO_GO','PLANNED',0,1,'次','为生活页准备的一条轻量活动。')`,
        )
        .run('01J5DEMO000000000000000010', categories.ENTERTAINMENT);
    });
    return { ...this.status(), batchId: DEMO_BATCH_ID };
  }

  public clear(): { removedCount: number } {
    const before = this.status().recordCount;
    this.database.transaction(() => {
      // 调度块是演示任务的派生对象，不继承 demo_batch_id；显式清除演示数据时
      // 必须先移除这些派生块，避免 overdue 冷启动补排后由外键阻止清理。
      this.database.raw
        .prepare(
          `DELETE FROM entity_index
           WHERE id IN (
             SELECT block.id
             FROM schedule_blocks block
             JOIN entity_index target ON target.id = block.target_entity_id
             WHERE target.demo_batch_id = ?
           )`,
        )
        .run(DEMO_BATCH_ID);
      this.database.raw
        .prepare(
          `DELETE FROM entity_index
           WHERE id IN (
             SELECT warning.id
             FROM schedule_warnings warning
             JOIN entity_index target ON target.id = warning.entity_id
             WHERE target.demo_batch_id = ?
           )`,
        )
        .run(DEMO_BATCH_ID);
      this.database.raw
        .prepare('DELETE FROM entity_index WHERE demo_batch_id = ?')
        .run(DEMO_BATCH_ID);
    });
    return { removedCount: before };
  }

  private insertEntity(id: string, entityType: string): void {
    this.database.raw
      .prepare(
        `INSERT INTO entity_index(id,entity_type,created_at,updated_at,demo_batch_id) VALUES (?,?,?,?,?)`,
      )
      .run(id, entityType, DEMO_TIME, DEMO_TIME, DEMO_BATCH_ID);
  }

  private categories(): CategoryMap {
    const rows = this.database.raw
      .prepare('SELECT module_type, id FROM categories WHERE is_archived = 0')
      .all() as { module_type: string; id: string }[];
    const mapped = Object.fromEntries(rows.map((row) => [row.module_type, row.id]));
    for (const type of [
      'SELF_MEDIA',
      'DEVELOPMENT',
      'LEARNING',
      'SHOPPING',
      'DIET',
      'FITNESS',
      'ENTERTAINMENT',
    ]) {
      if (typeof mapped[type] !== 'string') throw new Error(`缺少演示数据所需分类：${type}`);
    }
    return mapped;
  }
}
