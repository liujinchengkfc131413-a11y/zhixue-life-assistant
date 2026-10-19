import './zod-openapi.js';

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { ProblemDetailsSchema } from './problem-details.js';
import { DiagnosticExportEnvelopeSchema, DiagnosticInfoEnvelopeSchema } from './m8-011.js';
import { SystemStatusEnvelopeSchema, SystemStatusSchema } from './system-status.js';
import {
  ArchiveCategoryRequestSchema,
  AttachmentEnvelopeSchema,
  BackupEnvelopeSchema,
  BackupRecordsEnvelopeSchema,
  BackupRestoreExecuteRequestSchema,
  BackupRestorePreviewEnvelopeSchema,
  BackupRestorePreviewRequestSchema,
  CategoriesEnvelopeSchema,
  CategoryEnvelopeSchema,
  CreateCategoryRequestSchema,
  CreateTagRequestSchema,
  DataDirectoryMigrationExecuteRequestSchema,
  DataDirectoryMigrationPreviewEnvelopeSchema,
  DataDirectoryMigrationPreviewRequestSchema,
  DemoDataClearPreviewEnvelopeSchema,
  DemoDataClearRequestSchema,
  DemoDataStatusEnvelopeSchema,
  DeleteTagPreviewEnvelopeSchema,
  DeleteTagPreviewRequestSchema,
  DeleteTagRequestSchema,
  InitializeRequestSchema,
  ReorderCategoriesRequestSchema,
  SessionEnvelopeSchema,
  SettingsEnvelopeSchema,
  SettingsSchemaEnvelopeSchema,
  SetupStatusEnvelopeSchema,
  TagEnvelopeSchema,
  TagsEnvelopeSchema,
  UpdateCategoryRequestSchema,
  UpdateSettingsRequestSchema,
  UpdateTagRequestSchema,
} from './m1.js';
import {
  AddDependencyRequestSchema,
  TaskDependenciesEnvelopeSchema,
  CreateEventRequestSchema,
  CreateGoalMetricRequestSchema,
  CreateGoalProgressEntryRequestSchema,
  UpdateEventRequestSchema,
  CreateGoalRequestSchema,
  CreatePlanRequestSchema,
  CreatePlanMilestoneRequestSchema,
  CreateRecurrenceRuleRequestSchema,
  CreateRoutineTemplateRequestSchema,
  CreateTaskRequestSchema,
  EventConflictsRequestSchema,
  EntityTagLinkRequestSchema,
  EntityTagsEnvelopeSchema,
  EventEnvelopeSchema,
  EventsEnvelopeSchema,
  GoalEnvelopeSchema,
  GoalMetricsStateEnvelopeSchema,
  GoalsEnvelopeSchema,
  HolidaysEnvelopeSchema,
  PlanEnvelopeSchema,
  PlanMilestoneEnvelopeSchema,
  PlanMilestonesEnvelopeSchema,
  PlansEnvelopeSchema,
  ModifyRecurrenceRequestSchema,
  NullableRecurrenceRuleEnvelopeSchema,
  RecurrenceExceptionRequestSchema,
  RecurrenceOccurrencesEnvelopeSchema,
  RecurrenceRuleEnvelopeSchema,
  RescheduleRequestSchema,
  NullableRoutineOverrideEnvelopeSchema,
  RoutineOverrideRequestSchema,
  RoutineOverrideEnvelopeSchema,
  RoutineTemplateEnvelopeSchema,
  RoutineTemplatesEnvelopeSchema,
  ScheduleRunDetailEnvelopeSchema,
  ScheduleRunEnvelopeSchema,
  ScheduleWarningsEnvelopeSchema,
  SetProgressRequestSchema,
  SplitRecurrenceRequestSchema,
  TaskEnvelopeSchema,
  TaskScheduleHistoryEnvelopeSchema,
  TasksEnvelopeSchema,
  TaskTransitionRequestSchema,
  TimelineEnvelopeSchema,
  UpdateGoalRequestSchema,
  UpdateGoalMetricRequestSchema,
  UpdatePlanRequestSchema,
  UpdatePlanMilestoneRequestSchema,
  UpdateRoutineTemplateRequestSchema,
  UpdateTaskRequestSchema,
} from './m2.js';
import {
  CalendarEnvelopeSchema,
  FreeTimeEnvelopeSchema,
  GoalTreeEnvelopeSchema,
  KanbanEnvelopeSchema,
  PlanningQuerySchema,
  PlanTimelineEnvelopeSchema,
  PressureEnvelopeSchema,
  TodayEnvelopeSchema,
  TodayPlanEnvelopeSchema,
  TodayTotalsEnvelopeSchema,
} from './m3.js';
import {
  CreateDevDefectSchema,
  CreateDevFeatureSchema,
  CreateDevProjectSchema,
  CreateDevProjectMilestoneSchema,
  CreateLearningResourceSchema,
  CreateLearningSessionSchema,
  CreateMetricSchema,
  CreateRepositoryLinkSchema,
  CreateSelfMediaContentSchema,
  CreateWorkNoteSchema,
  DevDefectEnvelopeSchema,
  DevDefectsEnvelopeSchema,
  DevFeatureEnvelopeSchema,
  DevFeaturesEnvelopeSchema,
  DevProjectEnvelopeSchema,
  DevProjectMilestoneEnvelopeSchema,
  DevProjectMilestonesEnvelopeSchema,
  DevProjectsEnvelopeSchema,
  LearningResourceEnvelopeSchema,
  LearningResourcesEnvelopeSchema,
  LearningSessionEnvelopeSchema,
  LearningSessionsEnvelopeSchema,
  LinkedAttachmentsEnvelopeSchema,
  LinkAttachmentSchema,
  RepositoryLinkEnvelopeSchema,
  RepositoryLinksEnvelopeSchema,
  SelfMediaContentEnvelopeSchema,
  SelfMediaContentsEnvelopeSchema,
  SelfMediaMetricEnvelopeSchema,
  SelfMediaMetricsEnvelopeSchema,
  SelfMediaTrendEnvelopeSchema,
  TransitionContentSchema,
  UpdateDevDefectSchema,
  UpdateDevFeatureSchema,
  UpdateDevProjectMilestoneSchema,
  UpdateDevProjectSchema,
  UpdateLearningResourceSchema,
  UpdateLearningSessionSchema,
  UpdateMetricSchema,
  UpdateRepositoryLinkSchema,
  UpdateSelfMediaContentSchema,
  UpdateWorkNoteSchema,
  WorkNoteEnvelopeSchema,
  WorkNotesEnvelopeSchema,
  WorkOverviewEnvelopeSchema,
  WorkRangeQuerySchema,
} from './m4.js';
import {
  BudgetEnvelopeSchema,
  BudgetsEnvelopeSchema,
  CreateBudgetSchema,
  CreateBodyMeasurementSchema,
  CreateExerciseSchema,
  CreatePersonalRecordSchema,
  CreateRecoverySchema,
  CreateWorkoutPlanSchema,
  UpdateWorkoutPlanSchema,
  UpdateExerciseSchema,
  UpdateWorkoutSessionSchema,
  UpdateBodyMeasurementSchema,
  UpdatePersonalRecordSchema,
  UpdateRecoverySchema,
  UpdateEntertainmentItemSchema,
  UpdateEntertainmentSessionSchema,
  CreateWorkoutSessionSchema,
  CompleteMealPlanSchema,
  CreateDietaryPreferenceSchema,
  CreateEntertainmentExpenseSchema,
  CreateEntertainmentItemSchema,
  CreateEntertainmentSessionSchema,
  EntertainmentItemFiltersSchema,
  CreateHydrationSchema,
  CreateMealPlanSchema,
  CreateMealSchema,
  CreateRecipeSchema,
  DietaryPreferenceEnvelopeSchema,
  DietaryPreferencesEnvelopeSchema,
  BodyMeasurementEnvelopeSchema,
  BodyMeasurementsEnvelopeSchema,
  DateRangeFilterSchema,
  ExerciseEnvelopeSchema,
  ExercisesEnvelopeSchema,
  EntertainmentItemEnvelopeSchema,
  EntertainmentItemsEnvelopeSchema,
  EntertainmentSessionEnvelopeSchema,
  EntertainmentSessionsEnvelopeSchema,
  HydrationRecordEnvelopeSchema,
  HydrationRecordsEnvelopeSchema,
  CreateShoppingItemSchema,
  LifeOverviewEnvelopeSchema,
  LifeRangeQuerySchema,
  MealPlanEnvelopeSchema,
  MealPlansEnvelopeSchema,
  MealRecordEnvelopeSchema,
  MealRecordsEnvelopeSchema,
  MealRecordFiltersSchema,
  PurchaseRecordEnvelopeSchema,
  PurchaseRecordsEnvelopeSchema,
  PurchaseShoppingItemSchema,
  PutTripDetailsSchema,
  PersonalRecordEnvelopeSchema,
  PersonalRecordsEnvelopeSchema,
  RecoveryRecordEnvelopeSchema,
  RecoveryRecordsEnvelopeSchema,
  ShoppingItemEnvelopeSchema,
  ShoppingItemsEnvelopeSchema,
  ShoppingStatusSchema,
  SetEntertainmentProgressSchema,
  RecipeEnvelopeSchema,
  RecipesEnvelopeSchema,
  UpdateMealPlanSchema,
  UpdateMealSchema,
  UpdateHydrationSchema,
  UpdateDietaryPreferenceSchema,
  UpdateRecipeSchema,
  UpdateShoppingItemSchema,
  WorkoutPlanEnvelopeSchema,
  WorkoutPlansEnvelopeSchema,
  WorkoutSessionEnvelopeSchema,
  WorkoutSessionsEnvelopeSchema,
} from './m5.js';
import {
  ArchiveInboxItemRequestSchema,
  ConvertNotePreviewEnvelopeSchema,
  ConvertNotePreviewRequestSchema,
  DraftEnvelopeSchema,
  InboxItemEnvelopeSchema,
  InboxItemsEnvelopeSchema,
  InboxStatusSchema,
  ProcessInboxManuallyRequestSchema,
  QuickCaptureRequestSchema,
  SaveDraftRequestSchema,
  UpdateInboxItemRequestSchema,
  SearchResultsEnvelopeSchema,
  RebuildSearchEnvelopeSchema,
  EntityVersionsEnvelopeSchema,
  ChangeSetsEnvelopeSchema,
  RecycleItemsEnvelopeSchema,
  RestoreRecycleItemRequestSchema,
  PurgePreviewRequestSchema,
  ConfirmationPreviewEnvelopeSchema,
  ExecuteConfirmationRequestSchema,
  MutationEnvelopeSchema,
  VersionRestorePreviewRequestSchema,
} from './m6.js';
import {
  AiProviderConfigsEnvelopeSchema,
  AiProviderEnvelopeSchema,
  AiProviderVersionRequestSchema,
  AiRunEnvelopeSchema,
  AiChangeSetEnvelopeSchema,
  ChatMessagesEnvelopeSchema,
  ChatSessionEnvelopeSchema,
  ChatSessionsEnvelopeSchema,
  CreateAiProviderRequestSchema,
  CreateChatRequestSchema,
  UpdateChatSessionRequestSchema,
  PutAiProviderCredentialRequestSchema,
  SendChatMessageEnvelopeSchema,
  SendChatMessageRequestSchema,
  NotificationsEnvelopeSchema,
  UpdateAiProviderRequestSchema,
  ClearAiMemoryPreviewEnvelopeSchema,
  ClearAiMemoryConfirmRequestSchema,
  ClearAiMemoryConfirmEnvelopeSchema,
} from './m7.js';
import {
  CreateReminderRequestSchema,
  HolidayOverrideRemoveEnvelopeSchema,
  HolidayUpdateRequestSchema,
  HolidayUpdateResultEnvelopeSchema,
  ReminderEnvelopeSchema,
  RemindersEnvelopeSchema,
  SnoozeNotificationRequestSchema,
  UpdateReminderRequestSchema,
} from './m8.js';

export const buildOpenApiDocument = () => {
  const registry = new OpenAPIRegistry();

  const systemStatus = registry.register('SystemStatus', SystemStatusSchema);
  const systemStatusEnvelope = registry.register(
    'SystemStatusEnvelope',
    SystemStatusEnvelopeSchema,
  );
  const diagnosticInfoEnvelope = registry.register(
    'DiagnosticInfoEnvelope',
    DiagnosticInfoEnvelopeSchema,
  );
  const diagnosticExportEnvelope = registry.register(
    'DiagnosticExportEnvelope',
    DiagnosticExportEnvelopeSchema,
  );
  const problemDetails = registry.register('ProblemDetails', ProblemDetailsSchema);
  const inboxItemEnvelope = registry.register('InboxItemEnvelope', InboxItemEnvelopeSchema);
  const inboxItemsEnvelope = registry.register('InboxItemsEnvelope', InboxItemsEnvelopeSchema);
  const draftEnvelope = registry.register('DraftEnvelope', DraftEnvelopeSchema);
  const convertNotePreviewEnvelope = registry.register(
    'ConvertNotePreviewEnvelope',
    ConvertNotePreviewEnvelopeSchema,
  );
  const searchResultsEnvelope = registry.register(
    'SearchResultsEnvelope',
    SearchResultsEnvelopeSchema,
  );
  const rebuildSearchEnvelope = registry.register(
    'RebuildSearchEnvelope',
    RebuildSearchEnvelopeSchema,
  );
  const entityVersionsEnvelope = registry.register(
    'EntityVersionsEnvelope',
    EntityVersionsEnvelopeSchema,
  );
  const changeSetsEnvelope = registry.register('ChangeSetsEnvelope', ChangeSetsEnvelopeSchema);
  const recycleItemsEnvelope = registry.register(
    'RecycleItemsEnvelope',
    RecycleItemsEnvelopeSchema,
  );
  const confirmationPreviewEnvelope = registry.register(
    'ConfirmationPreviewEnvelope',
    ConfirmationPreviewEnvelopeSchema,
  );
  const mutationEnvelope = registry.register('MutationEnvelope', MutationEnvelopeSchema);
  const aiProviderEnvelope = registry.register('AiProviderEnvelope', AiProviderEnvelopeSchema);
  const aiProviderConfigsEnvelope = registry.register(
    'AiProviderConfigsEnvelope',
    AiProviderConfigsEnvelopeSchema,
  );
  const chatSessionEnvelope = registry.register('ChatSessionEnvelope', ChatSessionEnvelopeSchema);
  const chatSessionsEnvelope = registry.register(
    'ChatSessionsEnvelope',
    ChatSessionsEnvelopeSchema,
  );
  const chatMessagesEnvelope = registry.register(
    'ChatMessagesEnvelope',
    ChatMessagesEnvelopeSchema,
  );
  const aiRunEnvelope = registry.register('AiRunEnvelope', AiRunEnvelopeSchema);
  const changeSetEnvelope = registry.register('AiChangeSetEnvelope', AiChangeSetEnvelopeSchema);
  const sendChatMessageEnvelope = registry.register(
    'SendChatMessageEnvelope',
    SendChatMessageEnvelopeSchema,
  );
  const notificationsEnvelope = registry.register(
    'NotificationsEnvelope',
    NotificationsEnvelopeSchema,
  );
  const clearAiMemoryPreviewEnvelope = registry.register(
    'ClearAiMemoryPreviewEnvelope',
    ClearAiMemoryPreviewEnvelopeSchema,
  );
  const clearAiMemoryConfirmEnvelope = registry.register(
    'ClearAiMemoryConfirmEnvelope',
    ClearAiMemoryConfirmEnvelopeSchema,
  );
  const reminderEnvelope = registry.register('ReminderEnvelope', ReminderEnvelopeSchema);
  const remindersEnvelope = registry.register('RemindersEnvelope', RemindersEnvelopeSchema);
  const holidayUpdateResultEnvelope = registry.register(
    'HolidayUpdateResultEnvelope',
    HolidayUpdateResultEnvelopeSchema,
  );
  const holidayOverrideRemove = registry.register(
    'HolidayOverrideRemoveEnvelope',
    HolidayOverrideRemoveEnvelopeSchema,
  );
  const setupStatusEnvelope = registry.register('SetupStatusEnvelope', SetupStatusEnvelopeSchema);
  const settingsEnvelope = registry.register('SettingsEnvelope', SettingsEnvelopeSchema);
  const settingsSchemaEnvelope = registry.register(
    'SettingsSchemaEnvelope',
    SettingsSchemaEnvelopeSchema,
  );
  const categoriesEnvelope = registry.register('CategoriesEnvelope', CategoriesEnvelopeSchema);
  const categoryEnvelope = registry.register('CategoryEnvelope', CategoryEnvelopeSchema);
  const tagsEnvelope = registry.register('TagsEnvelope', TagsEnvelopeSchema);
  const tagEnvelope = registry.register('TagEnvelope', TagEnvelopeSchema);
  const sessionEnvelope = registry.register('SessionEnvelope', SessionEnvelopeSchema);
  const backupEnvelope = registry.register('BackupEnvelope', BackupEnvelopeSchema);
  const backupRecordsEnvelope = registry.register(
    'BackupRecordsEnvelope',
    BackupRecordsEnvelopeSchema,
  );
  const backupRestorePreviewEnvelope = registry.register(
    'BackupRestorePreviewEnvelope',
    BackupRestorePreviewEnvelopeSchema,
  );
  const demoDataStatusEnvelope = registry.register(
    'DemoDataStatusEnvelope',
    DemoDataStatusEnvelopeSchema,
  );
  const demoDataClearPreviewEnvelope = registry.register(
    'DemoDataClearPreviewEnvelope',
    DemoDataClearPreviewEnvelopeSchema,
  );
  const attachmentEnvelope = registry.register('AttachmentEnvelope', AttachmentEnvelopeSchema);
  const migrationPreviewEnvelope = registry.register(
    'DataDirectoryMigrationPreviewEnvelope',
    DataDirectoryMigrationPreviewEnvelopeSchema,
  );
  const deleteTagPreviewEnvelope = registry.register(
    'DeleteTagPreviewEnvelope',
    DeleteTagPreviewEnvelopeSchema,
  );
  const goalsEnvelope = registry.register('GoalsEnvelope', GoalsEnvelopeSchema);
  const goalEnvelope = registry.register('GoalEnvelope', GoalEnvelopeSchema);
  const goalMetricsStateEnvelope = registry.register(
    'GoalMetricsStateEnvelope',
    GoalMetricsStateEnvelopeSchema,
  );
  const plansEnvelope = registry.register('PlansEnvelope', PlansEnvelopeSchema);
  const planEnvelope = registry.register('PlanEnvelope', PlanEnvelopeSchema);
  const planMilestoneEnvelope = registry.register(
    'PlanMilestoneEnvelope',
    PlanMilestoneEnvelopeSchema,
  );
  const planMilestonesEnvelope = registry.register(
    'PlanMilestonesEnvelope',
    PlanMilestonesEnvelopeSchema,
  );
  const tasksEnvelope = registry.register('TasksEnvelope', TasksEnvelopeSchema);
  const taskEnvelope = registry.register('TaskEnvelope', TaskEnvelopeSchema);
  const eventsEnvelope = registry.register('EventsEnvelope', EventsEnvelopeSchema);
  const eventEnvelope = registry.register('EventEnvelope', EventEnvelopeSchema);
  const routinesEnvelope = registry.register(
    'RoutineTemplatesEnvelope',
    RoutineTemplatesEnvelopeSchema,
  );
  const routineEnvelope = registry.register(
    'RoutineTemplateEnvelope',
    RoutineTemplateEnvelopeSchema,
  );
  const holidaysEnvelope = registry.register('HolidaysEnvelope', HolidaysEnvelopeSchema);
  const recurrenceEnvelope = registry.register(
    'RecurrenceRuleEnvelope',
    RecurrenceRuleEnvelopeSchema,
  );
  const nullableRecurrenceEnvelope = registry.register(
    'NullableRecurrenceRuleEnvelope',
    NullableRecurrenceRuleEnvelopeSchema,
  );
  const recurrenceOccurrencesEnvelope = registry.register(
    'RecurrenceOccurrencesEnvelope',
    RecurrenceOccurrencesEnvelopeSchema,
  );
  const timelineEnvelope = registry.register('TimelineEnvelope', TimelineEnvelopeSchema);
  const scheduleRunEnvelope = registry.register('ScheduleRunEnvelope', ScheduleRunEnvelopeSchema);
  const scheduleWarningsEnvelope = registry.register(
    'ScheduleWarningsEnvelope',
    ScheduleWarningsEnvelopeSchema,
  );
  const scheduleRunDetailEnvelope = registry.register(
    'ScheduleRunDetailEnvelope',
    ScheduleRunDetailEnvelopeSchema,
  );
  const taskScheduleHistoryEnvelope = registry.register(
    'TaskScheduleHistoryEnvelope',
    TaskScheduleHistoryEnvelopeSchema,
  );
  const todayEnvelope = registry.register('TodayEnvelope', TodayEnvelopeSchema);
  const todayPlanEnvelope = registry.register('TodayPlanEnvelope', TodayPlanEnvelopeSchema);
  const todayTotalsEnvelope = registry.register('TodayTotalsEnvelope', TodayTotalsEnvelopeSchema);
  const pressureEnvelope = registry.register('PressureEnvelope', PressureEnvelopeSchema);
  const kanbanEnvelope = registry.register('KanbanEnvelope', KanbanEnvelopeSchema);
  const calendarEnvelope = registry.register('CalendarEnvelope', CalendarEnvelopeSchema);
  const freeTimeEnvelope = registry.register('FreeTimeEnvelope', FreeTimeEnvelopeSchema);
  const planTimelineEnvelope = registry.register(
    'PlanTimelineEnvelope',
    PlanTimelineEnvelopeSchema,
  );
  const goalTreeEnvelope = registry.register('GoalTreeEnvelope', GoalTreeEnvelopeSchema);
  const workOverviewEnvelope = registry.register(
    'WorkOverviewEnvelope',
    WorkOverviewEnvelopeSchema,
  );
  const selfMediaContentsEnvelope = registry.register(
    'SelfMediaContentsEnvelope',
    SelfMediaContentsEnvelopeSchema,
  );
  const selfMediaContentEnvelope = registry.register(
    'SelfMediaContentEnvelope',
    SelfMediaContentEnvelopeSchema,
  );
  const selfMediaMetricsEnvelope = registry.register(
    'SelfMediaMetricsEnvelope',
    SelfMediaMetricsEnvelopeSchema,
  );
  const selfMediaMetricEnvelope = registry.register(
    'SelfMediaMetricEnvelope',
    SelfMediaMetricEnvelopeSchema,
  );
  const devProjectsEnvelope = registry.register('DevProjectsEnvelope', DevProjectsEnvelopeSchema);
  const devProjectEnvelope = registry.register('DevProjectEnvelope', DevProjectEnvelopeSchema);
  const devFeaturesEnvelope = registry.register('DevFeaturesEnvelope', DevFeaturesEnvelopeSchema);
  const devFeatureEnvelope = registry.register('DevFeatureEnvelope', DevFeatureEnvelopeSchema);
  const devDefectsEnvelope = registry.register('DevDefectsEnvelope', DevDefectsEnvelopeSchema);
  const devDefectEnvelope = registry.register('DevDefectEnvelope', DevDefectEnvelopeSchema);
  const repositoryLinksEnvelope = registry.register(
    'RepositoryLinksEnvelope',
    RepositoryLinksEnvelopeSchema,
  );
  const repositoryLinkEnvelope = registry.register(
    'RepositoryLinkEnvelope',
    RepositoryLinkEnvelopeSchema,
  );
  const learningResourcesEnvelope = registry.register(
    'LearningResourcesEnvelope',
    LearningResourcesEnvelopeSchema,
  );
  const learningResourceEnvelope = registry.register(
    'LearningResourceEnvelope',
    LearningResourceEnvelopeSchema,
  );
  const learningSessionsEnvelope = registry.register(
    'LearningSessionsEnvelope',
    LearningSessionsEnvelopeSchema,
  );
  const learningSessionEnvelope = registry.register(
    'LearningSessionEnvelope',
    LearningSessionEnvelopeSchema,
  );
  const selfMediaTrendEnvelope = registry.register(
    'SelfMediaTrendEnvelope',
    SelfMediaTrendEnvelopeSchema,
  );
  const devMilestonesEnvelope = registry.register(
    'DevProjectMilestonesEnvelope',
    DevProjectMilestonesEnvelopeSchema,
  );
  const devMilestoneEnvelope = registry.register(
    'DevProjectMilestoneEnvelope',
    DevProjectMilestoneEnvelopeSchema,
  );
  const workNotesEnvelope = registry.register('WorkNotesEnvelope', WorkNotesEnvelopeSchema);
  const workNoteEnvelope = registry.register('WorkNoteEnvelope', WorkNoteEnvelopeSchema);
  const linkedAttachmentsEnvelope = registry.register(
    'LinkedAttachmentsEnvelope',
    LinkedAttachmentsEnvelopeSchema,
  );
  const lifeOverviewEnvelope = registry.register(
    'LifeOverviewEnvelope',
    LifeOverviewEnvelopeSchema,
  );
  const shoppingItemsEnvelope = registry.register(
    'ShoppingItemsEnvelope',
    ShoppingItemsEnvelopeSchema,
  );
  const shoppingItemEnvelope = registry.register(
    'ShoppingItemEnvelope',
    ShoppingItemEnvelopeSchema,
  );
  const purchaseRecordsEnvelope = registry.register(
    'PurchaseRecordsEnvelope',
    PurchaseRecordsEnvelopeSchema,
  );
  const purchaseRecordEnvelope = registry.register(
    'PurchaseRecordEnvelope',
    PurchaseRecordEnvelopeSchema,
  );
  const budgetsEnvelope = registry.register('BudgetsEnvelope', BudgetsEnvelopeSchema);
  const budgetEnvelope = registry.register('BudgetEnvelope', BudgetEnvelopeSchema);
  const recipesEnvelope = registry.register('RecipesEnvelope', RecipesEnvelopeSchema);
  const recipeEnvelope = registry.register('RecipeEnvelope', RecipeEnvelopeSchema);
  const mealPlansEnvelope = registry.register('MealPlansEnvelope', MealPlansEnvelopeSchema);
  const mealPlanEnvelope = registry.register('MealPlanEnvelope', MealPlanEnvelopeSchema);
  const mealRecordsEnvelope = registry.register('MealRecordsEnvelope', MealRecordsEnvelopeSchema);
  const mealRecordEnvelope = registry.register('MealRecordEnvelope', MealRecordEnvelopeSchema);
  const hydrationRecordsEnvelope = registry.register(
    'HydrationRecordsEnvelope',
    HydrationRecordsEnvelopeSchema,
  );
  const hydrationRecordEnvelope = registry.register(
    'HydrationRecordEnvelope',
    HydrationRecordEnvelopeSchema,
  );
  const preferencesEnvelope = registry.register(
    'DietaryPreferencesEnvelope',
    DietaryPreferencesEnvelopeSchema,
  );
  const preferenceEnvelope = registry.register(
    'DietaryPreferenceEnvelope',
    DietaryPreferenceEnvelopeSchema,
  );
  const exercisesEnvelope = registry.register('ExercisesEnvelope', ExercisesEnvelopeSchema),
    exerciseEnvelope = registry.register('ExerciseEnvelope', ExerciseEnvelopeSchema);
  const workoutPlansEnvelope = registry.register(
      'WorkoutPlansEnvelope',
      WorkoutPlansEnvelopeSchema,
    ),
    workoutPlanEnvelope = registry.register('WorkoutPlanEnvelope', WorkoutPlanEnvelopeSchema);
  const workoutSessionsEnvelope = registry.register(
      'WorkoutSessionsEnvelope',
      WorkoutSessionsEnvelopeSchema,
    ),
    workoutSessionEnvelope = registry.register(
      'WorkoutSessionEnvelope',
      WorkoutSessionEnvelopeSchema,
    );
  const bodyMeasurementsEnvelope = registry.register(
      'BodyMeasurementsEnvelope',
      BodyMeasurementsEnvelopeSchema,
    ),
    bodyMeasurementEnvelope = registry.register(
      'BodyMeasurementEnvelope',
      BodyMeasurementEnvelopeSchema,
    );
  const personalRecordsEnvelope = registry.register(
      'PersonalRecordsEnvelope',
      PersonalRecordsEnvelopeSchema,
    ),
    personalRecordEnvelope = registry.register(
      'PersonalRecordEnvelope',
      PersonalRecordEnvelopeSchema,
    );
  const recoveryRecordsEnvelope = registry.register(
      'RecoveryRecordsEnvelope',
      RecoveryRecordsEnvelopeSchema,
    ),
    recoveryRecordEnvelope = registry.register(
      'RecoveryRecordEnvelope',
      RecoveryRecordEnvelopeSchema,
    );
  const entertainmentItemsEnvelope = registry.register(
      'EntertainmentItemsEnvelope',
      EntertainmentItemsEnvelopeSchema,
    ),
    entertainmentItemEnvelope = registry.register(
      'EntertainmentItemEnvelope',
      EntertainmentItemEnvelopeSchema,
    ),
    entertainmentSessionsEnvelope = registry.register(
      'EntertainmentSessionsEnvelope',
      EntertainmentSessionsEnvelopeSchema,
    ),
    entertainmentSessionEnvelope = registry.register(
      'EntertainmentSessionEnvelope',
      EntertainmentSessionEnvelopeSchema,
    );

  registry.registerPath({
    method: 'get',
    path: '/health/live',
    summary: '进程存活检查',
    responses: {
      200: {
        description: '服务进程存活',
        content: {
          'application/json': {
            schema: { type: 'object', properties: { status: { type: 'string' } } },
          },
        },
      },
    },
  });
  const jsonBody = (schema: Parameters<typeof registry.register>[1]) => ({
    required: true,
    content: { 'application/json': { schema } },
  });
  const errors = {
    409: {
      description: '状态或版本冲突',
      content: { 'application/problem+json': { schema: problemDetails } },
    },
    422: {
      description: '请求校验失败',
      content: { 'application/problem+json': { schema: problemDetails } },
    },
  };

  registry.registerPath({
    method: 'get',
    path: '/api/v1/notifications',
    responses: {
      200: {
        description: '应用内通知列表',
        content: { 'application/json': { schema: notificationsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/notifications/{id}:read',
    summary: '标记通知已读',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '已标记',
        content: { 'application/json': { schema: mutationEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/ai/chats/{id}',
    summary: '重命名 AI 会话',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateChatSessionRequestSchema),
    },
    responses: {
      200: {
        description: '更新后的会话',
        content: { 'application/json': { schema: chatSessionEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/tasks/{id}/dependencies',
    summary: '查看任务依赖',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '任务的前置与后继依赖',
        content: { 'application/json': { schema: TaskDependenciesEnvelopeSchema } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/entities/{id}/tags',
    summary: '查看核心对象标签',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '对象当前标签',
        content: { 'application/json': { schema: EntityTagsEnvelopeSchema } },
      },
      ...errors,
    },
  });
  for (const method of ['post', 'delete'] as const) {
    registry.registerPath({
      method,
      path: '/api/v1/entities/{id}/tags',
      summary: method === 'post' ? '关联核心对象标签' : '移除核心对象标签',
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(EntityTagLinkRequestSchema),
      },
      responses: {
        204: { description: method === 'post' ? '标签已关联' : '标签已移除' },
        ...errors,
      },
    });
  }
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/tasks/{id}/dependencies',
    summary: '解除任务前置依赖',
    request: { params: z.object({ id: z.string() }), body: jsonBody(AddDependencyRequestSchema) },
    responses: { 204: { description: '依赖已解除' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/notifications:read-all',
    summary: '全部标记已读',
    responses: {
      200: {
        description: '已全部标记',
        content: { 'application/json': { schema: mutationEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/notifications/{id}:snooze',
    summary: '稍后提醒',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(SnoozeNotificationRequestSchema),
    },
    responses: {
      200: {
        description: '已设置稍后提醒',
        content: { 'application/json': { schema: mutationEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/reminders',
    summary: '列出提醒定义',
    request: { query: z.object({ targetEntityId: z.string().optional() }) },
    responses: {
      200: {
        description: '提醒定义列表',
        content: { 'application/json': { schema: remindersEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/reminders',
    summary: '创建提醒定义',
    request: { body: jsonBody(CreateReminderRequestSchema) },
    responses: {
      201: {
        description: '已创建',
        content: { 'application/json': { schema: reminderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/events/{id}',
    summary: '读取日程详情',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '日程详情',
        content: { 'application/json': { schema: eventEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/reminders/{id}',
    summary: '更新提醒定义',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateReminderRequestSchema),
    },
    responses: {
      200: {
        description: '已更新',
        content: { 'application/json': { schema: reminderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/ai/providers/{id}',
    summary: '删除 AI Provider 配置及其凭据',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(AiProviderVersionRequestSchema),
    },
    responses: { 204: { description: 'Provider 已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/reminders/{id}',
    summary: '删除提醒定义',
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: '已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/holidays:update',
    summary: '联网更新节假日安排',
    request: { body: jsonBody(HolidayUpdateRequestSchema) },
    responses: {
      200: {
        description: '更新结果',
        content: { 'application/json': { schema: holidayUpdateResultEnvelope } },
      },
      503: {
        description: '节假日来源不可用',
        content: { 'application/problem+json': { schema: problemDetails } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/holidays/{date}/override',
    summary: '移除节假日用户覆盖',
    request: { params: z.object({ date: z.string() }) },
    responses: {
      200: {
        description: '移除结果',
        content: { 'application/json': { schema: holidayOverrideRemove } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/ai/chats',
    summary: '列出或搜索 AI 会话',
    request: {
      query: z.object({
        q: z.string().optional(),
        includeArchived: z.enum(['true', 'false']).optional(),
      }),
    },
    responses: {
      200: {
        description: '会话列表',
        content: { 'application/json': { schema: chatSessionsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/chats',
    summary: '创建 AI 会话',
    request: { body: jsonBody(CreateChatRequestSchema) },
    responses: {
      201: {
        description: '已创建',
        content: { 'application/json': { schema: chatSessionEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/events/{id}',
    summary: '更新日程',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateEventRequestSchema) },
    responses: {
      200: {
        description: '更新后的日程',
        content: { 'application/json': { schema: eventEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/events/{id}',
    summary: '将日程移入回收站',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: { 204: { description: '日程已移入回收站' }, ...errors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/ai/chats/{id}/messages',
    summary: '读取会话消息',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '消息列表',
        content: { 'application/json': { schema: chatMessagesEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/chats/{id}/messages',
    summary: '发送消息并创建运行',
    request: { params: z.object({ id: z.string() }), body: jsonBody(SendChatMessageRequestSchema) },
    responses: {
      202: {
        description: '运行已排队',
        content: { 'application/json': { schema: sendChatMessageEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/ai/runs/{id}',
    summary: '读取 AI 运行状态',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '运行状态', content: { 'application/json': { schema: aiRunEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/runs/{id}:cancel',
    summary: '取消 AI 运行',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '已取消', content: { 'application/json': { schema: aiRunEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/ai/change-sets/{id}',
    summary: '读取 AI 操作的变更详情',
    request: { params: z.object({ id: z.string().length(26) }) },
    responses: {
      200: {
        description: '变更集详情',
        content: { 'application/json': { schema: changeSetEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/change-sets/{id}:undo',
    summary: '撤销 AI 创建操作',
    request: { params: z.object({ id: z.string().length(26) }) },
    responses: {
      200: {
        description: '已撤销的变更集',
        content: { 'application/json': { schema: changeSetEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/ai/providers',
    summary: '列出 AI Provider 配置',
    responses: {
      200: {
        description: 'Provider 列表',
        content: { 'application/json': { schema: aiProviderConfigsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/providers',
    summary: '创建 AI Provider 配置',
    request: { body: jsonBody(CreateAiProviderRequestSchema) },
    responses: {
      201: {
        description: '已创建',
        content: { 'application/json': { schema: aiProviderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/ai/providers/{id}',
    summary: '更新 AI Provider 配置',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateAiProviderRequestSchema),
    },
    responses: {
      200: {
        description: '已更新',
        content: { 'application/json': { schema: aiProviderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/routine-overrides/{date}',
    summary: '读取日期作息覆盖',
    request: { params: z.object({ date: z.iso.date() }) },
    responses: {
      200: {
        description: '日期作息覆盖（无覆盖时为 null）',
        content: { 'application/json': { schema: NullableRoutineOverrideEnvelopeSchema } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/v1/ai/providers/{id}/credential',
    summary: '写入 AI Provider 凭据',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(PutAiProviderCredentialRequestSchema),
    },
    responses: { 204: { description: '凭据已写入' }, ...errors },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/ai/providers/{id}/credential',
    summary: '删除 AI Provider 凭据',
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: '凭据已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/providers/{id}:verify',
    summary: '验证 AI Provider 连通性与能力',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '验证完成',
        content: { 'application/json': { schema: aiProviderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ai/providers/{id}:set-default',
    summary: '将 AI Provider 设为默认',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(AiProviderVersionRequestSchema),
    },
    responses: {
      200: {
        description: '默认 Provider 已更新',
        content: { 'application/json': { schema: aiProviderEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/settings/ai-memory:clear-preview',
    summary: '预检清空 AI 记忆',
    responses: {
      200: {
        description: '清空预检',
        content: { 'application/json': { schema: clearAiMemoryPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/settings/ai-memory:clear-confirm',
    summary: '确认清空 AI 记忆',
    request: { body: jsonBody(ClearAiMemoryConfirmRequestSchema) },
    responses: {
      200: {
        description: '已清空',
        content: { 'application/json': { schema: clearAiMemoryConfirmEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/demo-data',
    summary: '获取演示数据状态',
    responses: {
      200: {
        description: '演示数据状态',
        content: { 'application/json': { schema: demoDataStatusEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/demo-data/clear-preview',
    summary: '预检清空演示数据',
    responses: {
      200: {
        description: '清空预检',
        content: { 'application/json': { schema: demoDataClearPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/demo-data/clear',
    summary: '清空演示数据',
    request: { body: jsonBody(DemoDataClearRequestSchema) },
    responses: {
      200: { description: '已清空', content: { 'application/json': { schema: mutationEnvelope } } },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/setup/status',
    summary: '获取首次启动状态',
    responses: {
      200: {
        description: '启动状态',
        content: { 'application/json': { schema: setupStatusEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/change-sets/{id}:undo-preview',
    summary: '撤销最近变更预览',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '确认预览',
        content: { 'application/json': { schema: confirmationPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/change-sets/{id}:redo-preview',
    summary: '重做已撤销变更预览',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '确认预览',
        content: { 'application/json': { schema: confirmationPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/setup/initialize',
    summary: '初始化本地数据目录',
    request: { body: jsonBody(InitializeRequestSchema) },
    responses: {
      200: {
        description: '初始化完成',
        content: { 'application/json': { schema: setupStatusEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/session',
    summary: '获取本地会话和 CSRF Token',
    responses: {
      200: {
        description: '本地会话',
        content: { 'application/json': { schema: sessionEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/settings/data-directory/migration-preview',
    summary: '预检数据目录迁移并签发确认令牌',
    request: { body: jsonBody(DataDirectoryMigrationPreviewRequestSchema) },
    responses: {
      200: {
        description: '迁移影响预览',
        content: { 'application/json': { schema: migrationPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/settings/data-directory/migrate',
    summary: '执行已确认的数据目录迁移',
    request: { body: jsonBody(DataDirectoryMigrationExecuteRequestSchema) },
    responses: {
      200: {
        description: '数据目录已切换',
        content: { 'application/json': { schema: setupStatusEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/settings',
    summary: '获取普通设置',
    responses: {
      200: {
        description: '设置列表',
        content: { 'application/json': { schema: settingsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/settings',
    summary: '批量更新普通设置',
    request: { body: jsonBody(UpdateSettingsRequestSchema) },
    responses: {
      200: {
        description: '更新后的设置',
        content: { 'application/json': { schema: settingsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/settings/schema',
    summary: '获取设置定义',
    responses: {
      200: {
        description: '设置定义',
        content: { 'application/json': { schema: settingsSchemaEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/categories',
    summary: '获取分类',
    request: { query: z.object({ includeArchived: z.coerce.boolean().optional() }) },
    responses: {
      200: {
        description: '分类列表',
        content: { 'application/json': { schema: categoriesEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/categories',
    summary: '新建分类',
    request: { body: jsonBody(CreateCategoryRequestSchema) },
    responses: {
      201: {
        description: '分类已创建',
        content: { 'application/json': { schema: categoryEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/categories/{id}',
    summary: '更新分类',
    request: {
      params: z.object({ id: z.string().length(26) }),
      body: jsonBody(UpdateCategoryRequestSchema),
    },
    responses: {
      200: {
        description: '分类已更新',
        content: { 'application/json': { schema: categoryEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/categories:reorder',
    summary: '原子重排分类',
    request: { body: jsonBody(ReorderCategoriesRequestSchema) },
    responses: {
      200: {
        description: '分类已重排',
        content: { 'application/json': { schema: categoriesEnvelope } },
      },
      ...errors,
    },
  });
  for (const action of ['archive', 'unarchive'] as const) {
    registry.registerPath({
      method: 'post',
      path: `/api/v1/categories/{id}/${action}`,
      summary: action === 'archive' ? '归档分类' : '恢复分类',
      request: {
        params: z.object({ id: z.string().length(26) }),
        body: jsonBody(ArchiveCategoryRequestSchema),
      },
      responses: {
        200: {
          description: '分类状态已更新',
          content: { 'application/json': { schema: categoryEnvelope } },
        },
        ...errors,
      },
    });
  }
  registry.registerPath({
    method: 'get',
    path: '/api/v1/tags',
    summary: '获取标签',
    responses: {
      200: { description: '标签列表', content: { 'application/json': { schema: tagsEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tags',
    summary: '新建标签',
    request: { body: jsonBody(CreateTagRequestSchema) },
    responses: {
      201: { description: '标签已创建', content: { 'application/json': { schema: tagEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/tags/{id}',
    summary: '修改标签',
    request: {
      params: z.object({ id: z.string().length(26) }),
      body: jsonBody(UpdateTagRequestSchema),
    },
    responses: {
      200: { description: '标签已更新', content: { 'application/json': { schema: tagEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/tags/{id}',
    summary: '软删除标签',
    request: {
      params: z.object({ id: z.string().length(26) }),
      body: jsonBody(DeleteTagRequestSchema),
    },
    responses: { 204: { description: '标签已进入回收站' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tags/{id}/delete-preview',
    summary: '预览标签删除影响并签发确认令牌',
    request: {
      params: z.object({ id: z.string().length(26) }),
      body: jsonBody(DeleteTagPreviewRequestSchema),
    },
    responses: {
      200: {
        description: '删除影响预览',
        content: { 'application/json': { schema: deleteTagPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/backups',
    summary: '创建手动完整备份',
    responses: {
      201: {
        description: '备份已生成',
        content: { 'application/json': { schema: backupEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/backups',
    summary: '备份记录',
    responses: {
      200: {
        description: '备份记录列表',
        content: { 'application/json': { schema: backupRecordsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/backups/restore-preview',
    summary: '备份恢复预检',
    request: { body: jsonBody(BackupRestorePreviewRequestSchema) },
    responses: {
      200: {
        description: '恢复预检',
        content: { 'application/json': { schema: backupRestorePreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/backups/restore',
    summary: '执行备份恢复',
    request: { body: jsonBody(BackupRestoreExecuteRequestSchema) },
    responses: {
      200: {
        description: '恢复完成',
        content: { 'application/json': { schema: setupStatusEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/attachments',
    summary: '上传并复制附件到受控数据目录',
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: '附件已保存',
        content: { 'application/json': { schema: attachmentEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/attachments/{id}',
    summary: '获取附件元数据',
    request: { params: z.object({ id: z.string().length(26) }) },
    responses: {
      200: {
        description: '附件元数据',
        content: { 'application/json': { schema: attachmentEnvelope } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/goals',
    summary: '目标列表',
    responses: {
      200: { description: '目标', content: { 'application/json': { schema: goalsEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/goals',
    summary: '创建目标',
    request: { body: jsonBody(CreateGoalRequestSchema) },
    responses: {
      201: { description: '目标已创建', content: { 'application/json': { schema: goalEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/goals/{id}',
    summary: '更新目标',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateGoalRequestSchema) },
    responses: {
      200: { description: '目标已更新', content: { 'application/json': { schema: goalEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/goals/{id}',
    summary: '将目标移入回收站',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: { 204: { description: '目标已移入回收站' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/goals/{id}/set-progress',
    summary: '设置目标进度',
    request: { params: z.object({ id: z.string() }), body: jsonBody(SetProgressRequestSchema) },
    responses: {
      200: { description: '进度已更新', content: { 'application/json': { schema: goalEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/goals/{id}/metrics',
    summary: '目标量化指标与进度记录',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '目标指标状态',
        content: { 'application/json': { schema: goalMetricsStateEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/goals/{id}/metrics',
    summary: '创建目标量化指标',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreateGoalMetricRequestSchema),
    },
    responses: {
      201: {
        description: '目标指标已创建',
        content: { 'application/json': { schema: goalMetricsStateEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/goal-metrics/{id}',
    summary: '更新目标量化指标',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateGoalMetricRequestSchema),
    },
    responses: {
      200: {
        description: '目标指标已更新',
        content: { 'application/json': { schema: goalMetricsStateEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/goal-metrics/{id}',
    summary: '删除目标量化指标',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: {
      200: {
        description: '目标指标已删除',
        content: { 'application/json': { schema: goalMetricsStateEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/goals/{id}/progress-entries',
    summary: '录入目标指标进度',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreateGoalProgressEntryRequestSchema),
    },
    responses: {
      201: {
        description: '目标进度已录入',
        content: { 'application/json': { schema: goalMetricsStateEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/plans',
    summary: '计划列表',
    responses: {
      200: { description: '计划', content: { 'application/json': { schema: plansEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/plans',
    summary: '创建计划',
    request: { body: jsonBody(CreatePlanRequestSchema) },
    responses: {
      201: { description: '计划已创建', content: { 'application/json': { schema: planEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/plans/{id}',
    summary: '更新计划',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdatePlanRequestSchema) },
    responses: {
      200: { description: '计划已更新', content: { 'application/json': { schema: planEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/plans/{id}',
    summary: '将计划移入回收站',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: { 204: { description: '计划已移入回收站' }, ...errors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/plans/{id}/milestones',
    summary: '计划里程碑列表',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '计划里程碑',
        content: { 'application/json': { schema: planMilestonesEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/plans/{id}/milestones',
    summary: '创建计划里程碑',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreatePlanMilestoneRequestSchema),
    },
    responses: {
      201: {
        description: '计划里程碑已创建',
        content: { 'application/json': { schema: planMilestoneEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/milestones/{id}',
    summary: '更新计划里程碑',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdatePlanMilestoneRequestSchema),
    },
    responses: {
      200: {
        description: '计划里程碑已更新',
        content: { 'application/json': { schema: planMilestoneEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/milestones/{id}',
    summary: '将计划里程碑移入回收站',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: { 204: { description: '计划里程碑已移入回收站' }, ...errors },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/tasks',
    summary: '任务列表',
    request: {
      query: z.object({
        includeCompleted: z.coerce.boolean().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        area: z.enum(['WORK', 'LIFE']).optional(),
        ids: z.string().optional(),
        limit: z.coerce.number().int().positive().max(200).optional(),
      }),
    },
    responses: {
      200: { description: '任务', content: { 'application/json': { schema: tasksEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tasks',
    summary: '创建任务',
    request: { body: jsonBody(CreateTaskRequestSchema) },
    responses: {
      201: { description: '任务已创建', content: { 'application/json': { schema: taskEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/tasks/{id}',
    summary: '任务详情',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '任务', content: { 'application/json': { schema: taskEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/tasks/{id}',
    summary: '更新任务',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateTaskRequestSchema) },
    responses: {
      200: { description: '任务已更新', content: { 'application/json': { schema: taskEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/tasks/{id}',
    summary: '将任务移入回收站',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(TaskTransitionRequestSchema),
    },
    responses: { 204: { description: '任务已移入回收站' }, ...errors },
  });
  for (const action of ['start', 'complete', 'cancel', 'reopen'] as const) {
    registry.registerPath({
      method: 'post',
      path: `/api/v1/tasks/{id}/${action}`,
      summary: `任务状态操作：${action}`,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(TaskTransitionRequestSchema),
      },
      responses: {
        200: {
          description: '任务状态已更新',
          content: { 'application/json': { schema: taskEnvelope } },
        },
        ...errors,
      },
    });
  }
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tasks/{id}/subtasks',
    summary: '创建一层子任务',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreateTaskRequestSchema.omit({ parentTaskId: true })),
    },
    responses: {
      201: {
        description: '子任务已创建',
        content: { 'application/json': { schema: taskEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/tasks/{id}/dependencies',
    summary: '添加任务依赖',
    request: { params: z.object({ id: z.string() }), body: jsonBody(AddDependencyRequestSchema) },
    responses: { 204: { description: '依赖已添加' }, ...errors },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/events',
    summary: '日程列表',
    request: {
      query: z.object({ from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }),
    },
    responses: {
      200: { description: '日程', content: { 'application/json': { schema: eventsEnvelope } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/events',
    summary: '创建日程',
    request: { body: jsonBody(CreateEventRequestSchema) },
    responses: {
      201: {
        description: '日程已创建',
        content: { 'application/json': { schema: eventEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/events/conflicts:check',
    summary: '检查日程冲突',
    request: { body: jsonBody(EventConflictsRequestSchema) },
    responses: {
      200: { description: '冲突列表', content: { 'application/json': { schema: eventsEnvelope } } },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/routine-templates',
    summary: '作息模板列表',
    responses: {
      200: {
        description: '作息模板',
        content: { 'application/json': { schema: routinesEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/routine-templates',
    summary: '创建作息模板',
    request: { body: jsonBody(CreateRoutineTemplateRequestSchema) },
    responses: {
      201: {
        description: '作息模板已创建',
        content: { 'application/json': { schema: routineEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/routine-templates/{id}',
    summary: '更新作息模板',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateRoutineTemplateRequestSchema),
    },
    responses: {
      200: {
        description: '作息模板已更新',
        content: { 'application/json': { schema: routineEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/routine-templates/{id}/set-default',
    summary: '设为默认作息',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '默认作息已更新',
        content: { 'application/json': { schema: routineEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/v1/routine-overrides/{date}',
    summary: '设置日期作息覆盖',
    request: {
      params: z.object({ date: z.iso.date() }),
      body: jsonBody(RoutineOverrideRequestSchema),
    },
    responses: {
      200: {
        description: '覆盖已保存',
        content: { 'application/json': { schema: RoutineOverrideEnvelopeSchema } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/routine-overrides/{date}',
    summary: '删除日期作息覆盖',
    request: { params: z.object({ date: z.iso.date() }) },
    responses: { 204: { description: '覆盖已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/holidays',
    summary: '节假日列表',
    request: { query: z.object({ year: z.coerce.number().int() }) },
    responses: {
      200: { description: '节假日', content: { 'application/json': { schema: holidaysEnvelope } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/recurrence-rules',
    summary: '创建重复规则',
    request: { body: jsonBody(CreateRecurrenceRuleRequestSchema) },
    responses: {
      201: {
        description: '重复规则已创建',
        content: { 'application/json': { schema: recurrenceEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/recurrence-rules/by-target/{id}',
    summary: '按任务或日程获取重复规则',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '目标关联的重复规则或空值',
        content: { 'application/json': { schema: nullableRecurrenceEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/recurrence-rules/{id}',
    summary: '重复规则详情',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '重复规则',
        content: { 'application/json': { schema: recurrenceEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/recurrence-rules/{id}/occurrences',
    summary: '重复规则实例列表',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '重复实例及系列关系',
        content: { 'application/json': { schema: recurrenceOccurrencesEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/recurrence-rules/{id}/modify',
    summary: '统一修改重复事项',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(ModifyRecurrenceRequestSchema),
    },
    responses: {
      200: {
        description: '当前规则已修改',
        content: { 'application/json': { schema: recurrenceEnvelope } },
      },
      201: {
        description: '已切分并创建未来规则',
        content: { 'application/json': { schema: recurrenceEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/recurrence-rules/{id}/exceptions',
    summary: '设置单次重复例外',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(RecurrenceExceptionRequestSchema),
    },
    responses: { 204: { description: '例外已保存' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/recurrence-rules/{id}/split',
    summary: '从本次起切分规则',
    request: { params: z.object({ id: z.string() }), body: jsonBody(SplitRecurrenceRequestSchema) },
    responses: {
      201: {
        description: '规则已切分',
        content: { 'application/json': { schema: recurrenceEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/schedules',
    summary: '排程时间块',
    request: { query: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }) },
    responses: {
      200: {
        description: '排程时间块',
        content: { 'application/json': { schema: timelineEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/schedules:reschedule',
    summary: '执行确定性重排',
    request: { body: jsonBody(RescheduleRequestSchema) },
    responses: {
      200: {
        description: '排程结果',
        content: { 'application/json': { schema: scheduleRunEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/schedules/warnings',
    summary: '排程警告',
    responses: {
      200: {
        description: '警告',
        content: { 'application/json': { schema: scheduleWarningsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/schedules/runs/{id}',
    summary: '排程运行详情与历史',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '一次排程运行的触发、影响任务、新块/释放块与警告',
        content: { 'application/json': { schema: scheduleRunDetailEnvelope } },
      },
      404: { description: '排程运行不存在' },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/tasks/{id}/schedule-history',
    summary: '任务调度历史',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '任务维度的排程/重排/释放/失败历史',
        content: { 'application/json': { schema: taskScheduleHistoryEnvelope } },
      },
      404: { description: '任务不存在' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    summary: '服务就绪检查',
    responses: {
      200: {
        description: '服务已就绪',
        content: { 'application/json': { schema: systemStatus } },
      },
      503: {
        description: '服务尚未就绪',
        content: { 'application/problem+json': { schema: problemDetails } },
      },
    },
  });

  for (const endpoint of [
    { path: '/api/v1/today', summary: '今日完整驾驶舱', schema: todayEnvelope },
    { path: '/api/v1/today/timeline', summary: '今日 24 小时时间流', schema: timelineEnvelope },
    { path: '/api/v1/today/plan', summary: '今日计划', schema: todayPlanEnvelope },
    { path: '/api/v1/today/free-time', summary: '今日连续空闲时段', schema: freeTimeEnvelope },
    { path: '/api/v1/today/totals', summary: '今日四类时间统计', schema: todayTotalsEnvelope },
    { path: '/api/v1/today/pressure', summary: '今日压力指数', schema: pressureEnvelope },
  ] as const) {
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: {
        query: z.object({
          date: z.iso.date().optional(),
          area: z.enum(['WORK', 'LIFE']).optional(),
        }),
      },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
      },
    });
  }

  for (const endpoint of [
    { path: '/api/v1/work/overview', summary: '工作综合驾驶舱' },
    { path: '/api/v1/work/statistics', summary: '工作趋势与明细' },
  ] as const)
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { query: WorkRangeQuerySchema },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: workOverviewEnvelope } },
        },
      },
    });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/entertainment/items',
    summary: '娱乐清单',
    request: { query: EntertainmentItemFiltersSchema },
    responses: {
      200: {
        description: '娱乐清单',
        content: { 'application/json': { schema: entertainmentItemsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/entertainment/items',
    summary: '创建娱乐条目',
    request: { body: jsonBody(CreateEntertainmentItemSchema) },
    responses: {
      201: {
        description: '娱乐条目已创建',
        content: { 'application/json': { schema: entertainmentItemEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    {
      path: '/api/v1/life/entertainment/items/{id}',
      schema: UpdateEntertainmentItemSchema,
      envelope: entertainmentItemEnvelope,
      summary: '娱乐条目',
    },
    {
      path: '/api/v1/life/entertainment/sessions/{id}',
      schema: UpdateEntertainmentSessionSchema,
      envelope: entertainmentSessionEnvelope,
      summary: '娱乐时长记录',
    },
  ] as const) {
    registry.registerPath({
      method: 'patch',
      path: endpoint.path,
      summary: `更新${endpoint.summary}`,
      request: { params: z.object({ id: z.string() }), body: jsonBody(endpoint.schema) },
      responses: {
        200: {
          description: `${endpoint.summary}已更新`,
          content: { 'application/json': { schema: endpoint.envelope } },
        },
        ...errors,
      },
    });
    registry.registerPath({
      method: 'delete',
      path: endpoint.path,
      summary: `删除${endpoint.summary}`,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(z.object({ expectedVersion: z.number().int().positive() })),
      },
      responses: { 204: { description: `${endpoint.summary}已移入回收站` }, ...errors },
    });
  }
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/entertainment/items/{id}/set-progress',
    summary: '更新娱乐进度',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(SetEntertainmentProgressSchema),
    },
    responses: {
      200: {
        description: '娱乐进度已更新',
        content: { 'application/json': { schema: entertainmentItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/entertainment/sessions',
    summary: '娱乐时长记录',
    responses: {
      200: {
        description: '娱乐时长记录',
        content: { 'application/json': { schema: entertainmentSessionsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/entertainment/sessions',
    summary: '记录娱乐时长',
    request: { body: jsonBody(CreateEntertainmentSessionSchema) },
    responses: {
      201: {
        description: '娱乐时长已记录',
        content: { 'application/json': { schema: entertainmentSessionEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/v1/life/entertainment/items/{id}/trip-details',
    summary: '保存活动旅行详情',
    request: { params: z.object({ id: z.string() }), body: jsonBody(PutTripDetailsSchema) },
    responses: {
      200: {
        description: '详情已保存',
        content: { 'application/json': { schema: entertainmentItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/entertainment/items/{id}/expense',
    summary: '记录娱乐支出',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreateEntertainmentExpenseSchema),
    },
    responses: {
      201: {
        description: '娱乐支出已记录',
        content: { 'application/json': { schema: entertainmentItemEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/self-media/contents',
    summary: '自媒体内容列表',
    request: {
      query: z.object({
        status: z
          .enum(['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED', 'ARCHIVED'])
          .optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      }),
    },
    responses: {
      200: {
        description: '内容列表',
        content: { 'application/json': { schema: selfMediaContentsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/self-media/contents',
    summary: '创建自媒体内容',
    request: { body: jsonBody(CreateSelfMediaContentSchema) },
    responses: {
      201: {
        description: '内容已创建',
        content: { 'application/json': { schema: selfMediaContentEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/self-media/contents/{id}/transition',
    summary: '流转制作状态',
    request: { params: z.object({ id: z.string() }), body: jsonBody(TransitionContentSchema) },
    responses: {
      200: {
        description: '状态已更新',
        content: { 'application/json': { schema: selfMediaContentEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/self-media/contents/{id}/metrics',
    summary: '内容表现指标',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '指标列表',
        content: { 'application/json': { schema: selfMediaMetricsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/self-media/contents/{id}/metrics',
    summary: '录入内容表现',
    request: { params: z.object({ id: z.string() }), body: jsonBody(CreateMetricSchema) },
    responses: {
      201: {
        description: '指标已录入',
        content: { 'application/json': { schema: selfMediaMetricEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/dev-projects',
    summary: '开发项目列表',
    request: {
      query: z.object({
        status: z.enum(['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
      }),
    },
    responses: {
      200: {
        description: '项目列表',
        content: { 'application/json': { schema: devProjectsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/dev-projects',
    summary: '创建开发项目',
    request: { body: jsonBody(CreateDevProjectSchema) },
    responses: {
      201: {
        description: '项目已创建',
        content: { 'application/json': { schema: devProjectEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    {
      path: '/api/v1/work/dev-projects/{id}/features',
      summary: '项目功能清单',
      list: devFeaturesEnvelope,
      item: devFeatureEnvelope,
      body: CreateDevFeatureSchema,
    },
    {
      path: '/api/v1/work/dev-projects/{id}/defects',
      summary: '项目缺陷',
      list: devDefectsEnvelope,
      item: devDefectEnvelope,
      body: CreateDevDefectSchema,
    },
    {
      path: '/api/v1/work/dev-projects/{id}/repositories',
      summary: '项目仓库链接',
      list: repositoryLinksEnvelope,
      item: repositoryLinkEnvelope,
      body: CreateRepositoryLinkSchema,
    },
  ] as const) {
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.list } },
        },
      },
    });
    registry.registerPath({
      method: 'post',
      path: endpoint.path,
      summary: `新增${endpoint.summary}`,
      request: { params: z.object({ id: z.string() }), body: jsonBody(endpoint.body) },
      responses: {
        201: { description: '已创建', content: { 'application/json': { schema: endpoint.item } } },
        ...errors,
      },
    });
  }

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/learning/resources',
    summary: '学习资源列表',
    request: {
      query: z.object({
        status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ABANDONED']).optional(),
      }),
    },
    responses: {
      200: {
        description: '学习资源',
        content: { 'application/json': { schema: learningResourcesEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/learning/resources',
    summary: '创建学习资源',
    request: { body: jsonBody(CreateLearningResourceSchema) },
    responses: {
      201: {
        description: '学习资源已创建',
        content: { 'application/json': { schema: learningResourceEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/learning/sessions',
    summary: '学习时长记录',
    responses: {
      200: {
        description: '学习记录',
        content: { 'application/json': { schema: learningSessionsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/learning/sessions',
    summary: '记录学习时长',
    request: { body: jsonBody(CreateLearningSessionSchema) },
    responses: {
      201: {
        description: '学习记录已创建',
        content: { 'application/json': { schema: learningSessionEnvelope } },
      },
      ...errors,
    },
  });

  for (const endpoint of [
    {
      path: '/api/v1/work/self-media/calendar',
      summary: '自媒体发布日历',
      schema: selfMediaContentsEnvelope,
    },
    {
      path: '/api/v1/work/self-media/statistics',
      summary: '自媒体表现趋势',
      schema: selfMediaTrendEnvelope,
    },
  ] as const)
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { query: WorkRangeQuerySchema },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
      },
    });

  for (const endpoint of [
    {
      path: '/api/v1/work/self-media/contents/{id}',
      summary: '自媒体内容',
      body: UpdateSelfMediaContentSchema,
      item: selfMediaContentEnvelope,
    },
    {
      path: '/api/v1/work/self-media/metrics/{id}',
      summary: '自媒体指标',
      body: UpdateMetricSchema,
      item: selfMediaMetricEnvelope,
    },
    {
      path: '/api/v1/work/dev-projects/{id}',
      summary: '开发项目',
      body: UpdateDevProjectSchema,
      item: devProjectEnvelope,
    },
    {
      path: '/api/v1/work/dev-features/{id}',
      summary: '开发功能',
      body: UpdateDevFeatureSchema,
      item: devFeatureEnvelope,
    },
    {
      path: '/api/v1/work/dev-defects/{id}',
      summary: '开发缺陷',
      body: UpdateDevDefectSchema,
      item: devDefectEnvelope,
    },
    {
      path: '/api/v1/work/repositories/{id}',
      summary: '仓库链接',
      body: UpdateRepositoryLinkSchema,
      item: repositoryLinkEnvelope,
    },
    {
      path: '/api/v1/work/learning/resources/{id}',
      summary: '学习资源',
      body: UpdateLearningResourceSchema,
      item: learningResourceEnvelope,
    },
    {
      path: '/api/v1/work/learning/sessions/{id}',
      summary: '学习记录',
      body: UpdateLearningSessionSchema,
      item: learningSessionEnvelope,
    },
  ] as const) {
    registry.registerPath({
      method: 'patch',
      path: endpoint.path,
      summary: `更新${endpoint.summary}`,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(endpoint.body),
      },
      responses: {
        200: {
          description: `${endpoint.summary}已更新`,
          content: { 'application/json': { schema: endpoint.item } },
        },
        ...errors,
      },
    });
    registry.registerPath({
      method: 'delete',
      path: endpoint.path,
      summary: `删除${endpoint.summary}`,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(z.object({ expectedVersion: z.number().int().positive() })),
      },
      responses: { 204: { description: `${endpoint.summary}已删除` }, ...errors },
    });
  }

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/dev-projects/{id}/milestones',
    summary: '项目里程碑',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '里程碑列表',
        content: { 'application/json': { schema: devMilestonesEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/dev-projects/{id}/milestones',
    summary: '创建项目里程碑',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CreateDevProjectMilestoneSchema),
    },
    responses: {
      201: {
        description: '里程碑已创建',
        content: { 'application/json': { schema: devMilestoneEnvelope } },
      },
      ...errors,
    },
  });
  for (const method of ['patch', 'delete'] as const)
    registry.registerPath({
      method,
      path: '/api/v1/work/dev-milestones/{id}',
      summary: method === 'patch' ? '更新项目里程碑' : '删除项目里程碑',
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(
          method === 'patch'
            ? UpdateDevProjectMilestoneSchema
            : UpdateDevProjectMilestoneSchema.pick({ expectedVersion: true }),
        ),
      },
      responses:
        method === 'patch'
          ? {
              200: {
                description: '里程碑已更新',
                content: { 'application/json': { schema: devMilestoneEnvelope } },
              },
              ...errors,
            }
          : { 204: { description: '里程碑已删除' }, ...errors },
    });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/entities/{id}/notes',
    summary: '工作对象笔记',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '笔记列表',
        content: { 'application/json': { schema: workNotesEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/entities/{id}/notes',
    summary: '创建工作对象笔记',
    request: { params: z.object({ id: z.string() }), body: jsonBody(CreateWorkNoteSchema) },
    responses: {
      201: {
        description: '笔记已创建',
        content: { 'application/json': { schema: workNoteEnvelope } },
      },
      ...errors,
    },
  });
  for (const method of ['patch', 'delete'] as const)
    registry.registerPath({
      method,
      path: '/api/v1/work/entities/{entityId}/notes/{noteId}',
      summary: method === 'patch' ? '更新工作对象笔记' : '删除工作对象笔记',
      request: {
        params: z.object({ entityId: z.string(), noteId: z.string() }),
        body: jsonBody(
          method === 'patch'
            ? UpdateWorkNoteSchema
            : UpdateWorkNoteSchema.pick({ expectedVersion: true }),
        ),
      },
      responses:
        method === 'patch'
          ? {
              200: {
                description: '笔记已更新',
                content: { 'application/json': { schema: workNoteEnvelope } },
              },
              ...errors,
            }
          : { 204: { description: '笔记已删除' }, ...errors },
    });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/work/entities/{id}/attachments',
    summary: '工作对象附件',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '附件列表',
        content: { 'application/json': { schema: linkedAttachmentsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/entities/{id}/attachments',
    summary: '关联工作对象附件',
    request: { params: z.object({ id: z.string() }), body: jsonBody(LinkAttachmentSchema) },
    responses: { 204: { description: '附件已关联' }, ...errors },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/work/entities/{id}/attachments/{attachmentId}',
    summary: '取消工作对象附件关联',
    request: { params: z.object({ id: z.string(), attachmentId: z.string() }) },
    responses: { 204: { description: '附件关联已取消' }, ...errors },
  });
  for (const endpoint of [
    { path: '/api/v1/life/overview', summary: '生活综合驾驶舱' },
    { path: '/api/v1/life/statistics', summary: '生活范围统计' },
  ] as const)
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { query: LifeRangeQuerySchema },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: lifeOverviewEnvelope } },
        },
      },
    });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/shopping/items',
    summary: '待购清单',
    request: { query: z.object({ status: ShoppingStatusSchema.optional() }) },
    responses: {
      200: {
        description: '待购清单',
        content: { 'application/json': { schema: shoppingItemsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/shopping/items',
    summary: '创建待购项',
    request: { body: jsonBody(CreateShoppingItemSchema) },
    responses: {
      201: {
        description: '待购项已创建',
        content: { 'application/json': { schema: shoppingItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/life/shopping/items/{id}',
    summary: '更新待购项',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateShoppingItemSchema) },
    responses: {
      200: {
        description: '待购项已更新',
        content: { 'application/json': { schema: shoppingItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/life/shopping/items/{id}',
    summary: '删除待购项',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateShoppingItemSchema.pick({ expectedVersion: true })),
    },
    responses: { 204: { description: '待购项已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/shopping/items/{id}/purchase',
    summary: '完成购买并记账',
    request: { params: z.object({ id: z.string() }), body: jsonBody(PurchaseShoppingItemSchema) },
    responses: {
      201: {
        description: '购买已完成',
        content: { 'application/json': { schema: purchaseRecordEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/shopping/purchases',
    summary: '购买历史',
    request: { query: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }) },
    responses: {
      200: {
        description: '购买历史',
        content: { 'application/json': { schema: purchaseRecordsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/budgets',
    summary: '预算列表',
    request: { query: LifeRangeQuerySchema },
    responses: {
      200: {
        description: '预算列表',
        content: { 'application/json': { schema: budgetsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/budgets',
    summary: '创建预算',
    request: { body: jsonBody(CreateBudgetSchema) },
    responses: {
      201: {
        description: '预算已创建',
        content: { 'application/json': { schema: budgetEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    { path: '/api/v1/life/diet/recipes', summary: '食谱列表', schema: recipesEnvelope },
    { path: '/api/v1/life/diet/meal-plans', summary: '餐食计划', schema: mealPlansEnvelope },
    { path: '/api/v1/life/diet/meals', summary: '餐食记录', schema: mealRecordsEnvelope },
    { path: '/api/v1/life/diet/hydration', summary: '饮水记录', schema: hydrationRecordsEnvelope },
    { path: '/api/v1/life/diet/preferences', summary: '饮食偏好', schema: preferencesEnvelope },
  ] as const)
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      ...(endpoint.path === '/api/v1/life/diet/meals'
        ? { request: { query: MealRecordFiltersSchema } }
        : endpoint.path === '/api/v1/life/diet/hydration'
          ? { request: { query: DateRangeFilterSchema } }
          : {}),
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
      },
    });
  for (const endpoint of [
    {
      path: '/api/v1/life/diet/recipes',
      summary: '创建食谱',
      body: CreateRecipeSchema,
      schema: recipeEnvelope,
    },
    {
      path: '/api/v1/life/diet/meal-plans',
      summary: '创建餐食计划',
      body: CreateMealPlanSchema,
      schema: mealPlanEnvelope,
    },
    {
      path: '/api/v1/life/diet/meals',
      summary: '记录餐食',
      body: CreateMealSchema,
      schema: mealRecordEnvelope,
    },
    {
      path: '/api/v1/life/diet/hydration',
      summary: '记录饮水',
      body: CreateHydrationSchema,
      schema: hydrationRecordEnvelope,
    },
    {
      path: '/api/v1/life/diet/preferences',
      summary: '创建饮食偏好',
      body: CreateDietaryPreferenceSchema,
      schema: preferenceEnvelope,
    },
  ] as const)
    registry.registerPath({
      method: 'post',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { body: jsonBody(endpoint.body) },
      responses: {
        201: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
        ...errors,
      },
    });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/life/diet/recipes/{id}',
    summary: '更新食谱',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateRecipeSchema) },
    responses: {
      200: {
        description: '食谱已更新',
        content: { 'application/json': { schema: recipeEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/life/diet/recipes/{id}',
    summary: '删除食谱',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateRecipeSchema.pick({ expectedVersion: true })),
    },
    responses: { 204: { description: '食谱已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/life/diet/meal-plans/{id}',
    summary: '更新餐食计划',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateMealPlanSchema) },
    responses: {
      200: {
        description: '餐食计划已更新',
        content: { 'application/json': { schema: mealPlanEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    {
      path: '/api/v1/life/diet/meals/{id}',
      summary: '更新餐食记录',
      deleted: '餐食记录已删除',
      body: UpdateMealSchema,
      deleteBody: UpdateMealSchema.pick({ expectedVersion: true }),
      schema: mealRecordEnvelope,
    },
    {
      path: '/api/v1/life/diet/hydration/{id}',
      summary: '更新饮水记录',
      deleted: '饮水记录已删除',
      body: UpdateHydrationSchema,
      deleteBody: UpdateHydrationSchema.pick({ expectedVersion: true }),
      schema: hydrationRecordEnvelope,
    },
    {
      path: '/api/v1/life/diet/preferences/{id}',
      summary: '更新饮食偏好',
      deleted: '饮食偏好已删除',
      body: UpdateDietaryPreferenceSchema,
      deleteBody: UpdateDietaryPreferenceSchema.pick({ expectedVersion: true }),
      schema: preferenceEnvelope,
    },
  ] as const) {
    registry.registerPath({
      method: 'patch',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { params: z.object({ id: z.string() }), body: jsonBody(endpoint.body) },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
        ...errors,
      },
    });
    registry.registerPath({
      method: 'delete',
      path: endpoint.path,
      summary: endpoint.deleted,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(endpoint.deleteBody),
      },
      responses: { 204: { description: endpoint.deleted }, ...errors },
    });
  }
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/life/diet/meal-plans/{id}',
    summary: '删除餐食计划',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdateMealPlanSchema.pick({ expectedVersion: true })),
    },
    responses: { 204: { description: '餐食计划已删除' }, ...errors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/life/diet/meal-plans/{id}/complete',
    summary: '完成餐食计划',
    request: { params: z.object({ id: z.string() }), body: jsonBody(CompleteMealPlanSchema) },
    responses: {
      201: {
        description: '餐食记录已生成',
        content: { 'application/json': { schema: mealRecordEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/life/diet/nutrition-summary',
    summary: '营养汇总',
    request: { query: LifeRangeQuerySchema },
    responses: {
      200: {
        description: '营养汇总',
        content: { 'application/json': { schema: lifeOverviewEnvelope } },
      },
    },
  });
  for (const endpoint of [
    { path: '/api/v1/life/fitness/exercises', summary: '动作库', schema: exercisesEnvelope },
    { path: '/api/v1/life/fitness/plans', summary: '训练计划', schema: workoutPlansEnvelope },
    { path: '/api/v1/life/fitness/sessions', summary: '训练记录', schema: workoutSessionsEnvelope },
    {
      path: '/api/v1/life/fitness/body-measurements',
      summary: '身体指标',
      schema: bodyMeasurementsEnvelope,
    },
    {
      path: '/api/v1/life/fitness/personal-records',
      summary: '个人纪录',
      schema: personalRecordsEnvelope,
    },
    { path: '/api/v1/life/fitness/recovery', summary: '恢复状态', schema: recoveryRecordsEnvelope },
  ] as const)
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      ...(endpoint.path === '/api/v1/life/fitness/sessions' ||
      endpoint.path === '/api/v1/life/fitness/body-measurements'
        ? { request: { query: DateRangeFilterSchema } }
        : {}),
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
      },
    });
  for (const endpoint of [
    {
      path: '/api/v1/life/fitness/exercises',
      summary: '创建动作',
      body: CreateExerciseSchema,
      schema: exerciseEnvelope,
    },
    {
      path: '/api/v1/life/fitness/plans',
      summary: '创建训练计划',
      body: CreateWorkoutPlanSchema,
      schema: workoutPlanEnvelope,
    },
    {
      path: '/api/v1/life/fitness/sessions',
      summary: '记录训练',
      body: CreateWorkoutSessionSchema,
      schema: workoutSessionEnvelope,
    },
    {
      path: '/api/v1/life/fitness/body-measurements',
      summary: '记录身体指标',
      body: CreateBodyMeasurementSchema,
      schema: bodyMeasurementEnvelope,
    },
    {
      path: '/api/v1/life/fitness/personal-records',
      summary: '创建个人纪录',
      body: CreatePersonalRecordSchema,
      schema: personalRecordEnvelope,
    },
    {
      path: '/api/v1/life/fitness/recovery',
      summary: '记录恢复状态',
      body: CreateRecoverySchema,
      schema: recoveryRecordEnvelope,
    },
  ] as const)
    registry.registerPath({
      method: 'post',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { body: jsonBody(endpoint.body) },
      responses: {
        201: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
        ...errors,
      },
    });

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/life/fitness/plans/{id}',
    summary: '更新训练计划',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateWorkoutPlanSchema) },
    responses: {
      200: {
        description: '训练计划已更新',
        content: { 'application/json': { schema: workoutPlanEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    {
      path: '/api/v1/life/fitness/exercises/{id}',
      summary: '更新动作',
      deleted: '动作已删除',
      body: UpdateExerciseSchema,
      deleteBody: UpdateExerciseSchema.pick({ expectedVersion: true }),
      schema: exerciseEnvelope,
    },
    {
      path: '/api/v1/life/fitness/plans/{id}',
      summary: undefined,
      deleted: '训练计划已删除',
      body: UpdateWorkoutPlanSchema,
      deleteBody: UpdateWorkoutPlanSchema.pick({ expectedVersion: true }),
      schema: workoutPlanEnvelope,
    },
    {
      path: '/api/v1/life/fitness/sessions/{id}',
      summary: '更新训练记录',
      deleted: '训练记录已删除',
      body: UpdateWorkoutSessionSchema,
      deleteBody: UpdateWorkoutSessionSchema.pick({ expectedVersion: true }),
      schema: workoutSessionEnvelope,
    },
    {
      path: '/api/v1/life/fitness/body-measurements/{id}',
      summary: '更新身体指标',
      deleted: '身体指标已删除',
      body: UpdateBodyMeasurementSchema,
      deleteBody: UpdateBodyMeasurementSchema.pick({ expectedVersion: true }),
      schema: bodyMeasurementEnvelope,
    },
    {
      path: '/api/v1/life/fitness/personal-records/{id}',
      summary: '更新个人纪录',
      deleted: '个人纪录已删除',
      body: UpdatePersonalRecordSchema,
      deleteBody: UpdatePersonalRecordSchema.pick({ expectedVersion: true }),
      schema: personalRecordEnvelope,
    },
    {
      path: '/api/v1/life/fitness/recovery/{id}',
      summary: '更新恢复状态',
      deleted: '恢复状态已删除',
      body: UpdateRecoverySchema,
      deleteBody: UpdateRecoverySchema.pick({ expectedVersion: true }),
      schema: recoveryRecordEnvelope,
    },
  ] as const) {
    if (endpoint.summary)
      registry.registerPath({
        method: 'patch',
        path: endpoint.path,
        summary: endpoint.summary,
        request: { params: z.object({ id: z.string() }), body: jsonBody(endpoint.body) },
        responses: {
          200: {
            description: endpoint.summary,
            content: { 'application/json': { schema: endpoint.schema } },
          },
          ...errors,
        },
      });
    registry.registerPath({
      method: 'delete',
      path: endpoint.path,
      summary: endpoint.deleted,
      request: {
        params: z.object({ id: z.string() }),
        body: jsonBody(endpoint.deleteBody),
      },
      responses: { 204: { description: endpoint.deleted }, ...errors },
    });
  }

  registry.registerPath({
    method: 'post',
    path: '/api/v1/plans/{id}/set-progress',
    summary: '切换计划手动或自动进度',
    request: { params: z.object({ id: z.string() }), body: jsonBody(SetProgressRequestSchema) },
    responses: {
      200: {
        description: '计划进度已更新',
        content: { 'application/json': { schema: planEnvelope } },
      },
      ...errors,
    },
  });
  for (const endpoint of [
    { path: '/api/v1/plans/views/kanban', summary: '计划看板投影', schema: kanbanEnvelope },
    { path: '/api/v1/plans/views/calendar', summary: '计划日历投影', schema: calendarEnvelope },
    {
      path: '/api/v1/plans/views/timeline',
      summary: '计划时间轴投影',
      schema: planTimelineEnvelope,
    },
    { path: '/api/v1/plans/views/goal-tree', summary: '目标树投影', schema: goalTreeEnvelope },
  ] as const) {
    registry.registerPath({
      method: 'get',
      path: endpoint.path,
      summary: endpoint.summary,
      request: { query: PlanningQuerySchema },
      responses: {
        200: {
          description: endpoint.summary,
          content: { 'application/json': { schema: endpoint.schema } },
        },
      },
    });
  }

  registry.registerPath({
    method: 'get',
    path: '/api/v1/system/status',
    summary: '获取本地系统状态',
    responses: {
      200: {
        description: '当前系统状态',
        content: { 'application/json': { schema: systemStatusEnvelope } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/system/diagnostics',
    summary: '获取脱敏诊断信息',
    description:
      '返回版本、Schema、数据目录标识、后台任务、磁盘与脱敏后的日志尾部；不包含个人内容与密钥。',
    responses: {
      200: {
        description: '诊断信息',
        content: { 'application/json': { schema: diagnosticInfoEnvelope } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/system/diagnostics:export',
    summary: '导出诊断包',
    description: '将脱敏后的诊断信息与日志打包为 ZIP，存放在数据目录缓存中并返回路径。',
    responses: {
      200: {
        description: '诊断包路径',
        content: { 'application/json': { schema: diagnosticExportEnvelope } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/v1/quick-capture',
    summary: '快捷记录',
    request: { body: jsonBody(QuickCaptureRequestSchema) },
    responses: {
      201: {
        description: '已记录',
        content: { 'application/json': { schema: inboxItemEnvelope } },
      },
      503: {
        description: 'AI 不可用',
        content: { 'application/problem+json': { schema: problemDetails } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/inbox',
    summary: '收集箱列表',
    request: { query: z.object({ status: InboxStatusSchema.optional() }) },
    responses: {
      200: {
        description: '收集箱列表',
        content: { 'application/json': { schema: inboxItemsEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/inbox/{id}',
    summary: '收集箱详情',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '收集箱详情',
        content: { 'application/json': { schema: inboxItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/v1/inbox/{id}',
    summary: '修改收集内容',
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateInboxItemRequestSchema) },
    responses: {
      200: {
        description: '内容已更新',
        content: { 'application/json': { schema: inboxItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/inbox/{id}:process-manually',
    summary: '手动拆分收集内容',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(ProcessInboxManuallyRequestSchema),
    },
    responses: {
      200: {
        description: '已完成拆分',
        content: { 'application/json': { schema: inboxItemEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/inbox/{id}:process-with-ai',
    summary: '使用 AI 处理收集内容',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      503: {
        description: 'AI 不可用',
        content: { 'application/problem+json': { schema: problemDetails } },
      },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/inbox/{id}:archive',
    summary: '归档收集内容',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(ArchiveInboxItemRequestSchema),
    },
    responses: {
      200: {
        description: '已归档',
        content: { 'application/json': { schema: inboxItemEnvelope } },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/drafts/{draftKey}',
    summary: '读取表单草稿',
    request: { params: z.object({ draftKey: z.string() }) },
    responses: {
      200: {
        description: '草稿或空值',
        content: { 'application/json': { schema: draftEnvelope } },
      },
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/v1/drafts/{draftKey}',
    summary: '自动保存表单草稿',
    request: { params: z.object({ draftKey: z.string() }), body: jsonBody(SaveDraftRequestSchema) },
    responses: {
      200: {
        description: '草稿已保存',
        content: { 'application/json': { schema: draftEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/drafts/{draftKey}',
    summary: '清除表单草稿',
    request: { params: z.object({ draftKey: z.string() }) },
    responses: { 204: { description: '草稿已清除' } },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/work/entities/{entityId}/notes/{noteId}:convert-preview',
    summary: '预览笔记模式转换',
    request: {
      params: z.object({ entityId: z.string(), noteId: z.string() }),
      body: jsonBody(ConvertNotePreviewRequestSchema),
    },
    responses: {
      200: {
        description: '转换预览',
        content: { 'application/json': { schema: convertNotePreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/search',
    summary: '全局关键词搜索',
    request: {
      query: z.object({
        q: z.string(),
        entityType: z.string().optional(),
        module: z.string().optional(),
        categoryId: z.string().optional(),
        status: z.string().optional(),
        tagId: z.string().optional(),
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
      }),
    },
    responses: {
      200: {
        description: '搜索结果',
        content: { 'application/json': { schema: searchResultsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/search/rebuild',
    summary: '重建搜索投影',
    responses: {
      200: {
        description: '重建完成',
        content: { 'application/json': { schema: rebuildSearchEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/entities/{id}/versions',
    summary: '对象版本历史',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: '版本列表',
        content: { 'application/json': { schema: entityVersionsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/entities/{id}/versions/{version}:restore-preview',
    summary: '恢复指定对象版本预览',
    request: {
      params: z.object({ id: z.string(), version: z.coerce.number().int().positive() }),
      body: jsonBody(VersionRestorePreviewRequestSchema),
    },
    responses: {
      200: {
        description: '确认预览',
        content: { 'application/json': { schema: confirmationPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/change-sets',
    summary: '最近操作',
    responses: {
      200: {
        description: '变更集列表',
        content: { 'application/json': { schema: changeSetsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/recycle-bin',
    summary: '回收站',
    responses: {
      200: {
        description: '软删除对象',
        content: { 'application/json': { schema: recycleItemsEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/recycle-bin/{id}:restore',
    summary: '恢复软删除对象',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(RestoreRecycleItemRequestSchema),
    },
    responses: {
      200: { description: '已恢复', content: { 'application/json': { schema: mutationEnvelope } } },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/recycle-bin/{id}:purge-preview',
    summary: '永久删除预览',
    request: { params: z.object({ id: z.string() }), body: jsonBody(PurgePreviewRequestSchema) },
    responses: {
      200: {
        description: '确认预览',
        content: { 'application/json': { schema: confirmationPreviewEnvelope } },
      },
      ...errors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/confirmations/{id}:execute',
    summary: '执行高风险操作',
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(ExecuteConfirmationRequestSchema),
    },
    responses: {
      200: {
        description: '执行完成',
        content: { 'application/json': { schema: mutationEnvelope } },
      },
      ...errors,
    },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: '个人生活助手 API',
      version: '0.1.0',
      description: '本地优先个人生活助手的稳定终端契约。',
    },
    servers: [{ url: 'http://127.0.0.1:{port}', variables: { port: { default: '43120' } } }],
  });
};
