const routeByEntityType: Readonly<Record<string, string>> = {
  TASK: '/',
  EVENT: '/',
  GOAL: '/plans-goals',
  PLAN: '/plans-goals',
  SELF_MEDIA_CONTENT: '/work/self-media',
  DEV_PROJECT: '/work/development',
  DEV_FEATURE: '/work/development',
  DEV_DEFECT: '/work/development',
  REPOSITORY_LINK: '/work/development',
  DEV_PROJECT_MILESTONE: '/work/development',
  LEARNING_RESOURCE: '/work/learning',
  LEARNING_SESSION: '/work/learning',
  NOTE: '/work',
  SHOPPING_ITEM: '/life/shopping',
  PURCHASE_RECORD: '/life/shopping',
  BUDGET: '/life/shopping',
  RECIPE: '/life/diet',
  MEAL_PLAN: '/life/diet',
  MEAL_RECORD: '/life/diet',
  HYDRATION_RECORD: '/life/diet',
  DIETARY_PREFERENCE: '/life/diet',
  EXERCISE: '/life/fitness',
  WORKOUT_PLAN: '/life/fitness',
  WORKOUT_SESSION: '/life/fitness',
  BODY_MEASUREMENT: '/life/fitness',
  PERSONAL_RECORD: '/life/fitness',
  RECOVERY_RECORD: '/life/fitness',
  ENTERTAINMENT_ITEM: '/life/entertainment',
  ENTERTAINMENT_SESSION: '/life/entertainment',
  ENTERTAINMENT_EXPENSE: '/life/entertainment',
  TRIP_DETAILS: '/life/entertainment',
  INBOX_ITEM: '/inbox',
  ATTACHMENT: '/data-management',
};

export const buildEntityDetailHref = (
  entityType: string,
  entityId: string,
  owner?: { readonly entityType: string; readonly entityId: string },
): string => {
  if (entityType === 'CHAT_SESSION')
    return `/assistant?${new URLSearchParams({ sessionId: entityId }).toString()}`;
  if (entityType === 'NOTE' && owner !== undefined) {
    const route = routeByEntityType[owner.entityType] ?? '/work';
    const search = new URLSearchParams({
      entityType: owner.entityType,
      entityId: owner.entityId,
      noteId: entityId,
    });
    return `${route}?${search.toString()}`;
  }
  const route =
    entityType === 'CHAT_MESSAGE'
      ? '/assistant'
      : (routeByEntityType[entityType] ?? '/data-management');
  const search = new URLSearchParams({ entityType, entityId });
  return `${route}?${search.toString()}`;
};

export interface EntityDetailTarget {
  readonly entityType: string;
  readonly entityId: string;
  readonly noteId?: string;
}

export const readEntityDetailTarget = (search: string): EntityDetailTarget | undefined => {
  const parameters = new URLSearchParams(search);
  const entityType = parameters.get('entityType')?.trim();
  const entityId = parameters.get('entityId')?.trim();
  const noteId = parameters.get('noteId')?.trim();
  return entityType && entityId
    ? { entityType, entityId, ...(noteId ? { noteId } : {}) }
    : undefined;
};
