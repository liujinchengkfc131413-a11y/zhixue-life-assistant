import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { AppShell } from './app-shell.js';
import { SettingsPage } from '../features/settings/settings-page.js';
import { SetupPage } from '../features/settings/setup-page.js';
import { TodayPage } from '../features/time-system/today-page.js';
import { PlansGoalsPage } from '../features/time-system/plans-goals-page.js';
import { WorkPage } from '../features/work/work-page.js';
import { LifePage } from '../features/life/life-page.js';
import { InboxPage } from '../features/inbox/inbox-page.js';
import { DataManagementPage } from '../features/information/data-management-page.js';
import { AssistantPage } from '../features/assistant/assistant-page.js';
import { RemindersPage } from '../features/reminders/reminders-page.js';

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TodayPage,
});
const workRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work',
  component: WorkPage,
});
const selfMediaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work/self-media',
  component: () => <WorkPage section="self-media" />,
});
const developmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work/development',
  component: () => <WorkPage section="development" />,
});
const learningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work/learning',
  component: () => <WorkPage section="learning" />,
});
const lifeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/life',
  component: LifePage,
});
const shoppingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/life/shopping',
  component: () => <LifePage section="shopping" />,
});
const dietRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/life/diet',
  component: () => <LifePage section="diet" />,
});
const fitnessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/life/fitness',
  component: () => <LifePage section="fitness" />,
});
const entertainmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/life/entertainment',
  component: () => <LifePage section="entertainment" />,
});
const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans-goals',
  component: PlansGoalsPage,
});
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
});
const assistantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/assistant',
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === 'string' ? search.sessionId : undefined,
    runId: typeof search.runId === 'string' ? search.runId : undefined,
  }),
  component: AssistantPage,
});
const dataManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data-management',
  component: DataManagementPage,
});
const remindersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reminders',
  component: RemindersPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  workRoute,
  selfMediaRoute,
  developmentRoute,
  learningRoute,
  lifeRoute,
  shoppingRoute,
  dietRoute,
  fitnessRoute,
  entertainmentRoute,
  plansRoute,
  inboxRoute,
  dataManagementRoute,
  remindersRoute,
  assistantRoute,
  settingsRoute,
  setupRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
