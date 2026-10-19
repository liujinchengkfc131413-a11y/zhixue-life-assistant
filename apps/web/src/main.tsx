import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';

import { AppProviders } from './app/providers.js';
import { router } from './app/router.js';
import './styles/global.css';
import './styles/foundations/tokens.css';
import './styles/foundations/themes.css';
import './styles/foundations/atmosphere.css';
import './styles/foundations/motion.css';
import './styles/components/shell.css';
import './styles/components/controls.css';
import './styles/components/surfaces.css';
import './styles/components/dialogs.css';
import './styles/components/lists.css';
import './styles/components/forms.css';
import './styles/components/states.css';
import './styles/pages/work.css';
import './styles/pages/life.css';
import './styles/pages/vision.css';
import './styles/pages/assistant.css';
import './styles/pages/system.css';

const root = document.querySelector<HTMLDivElement>('#root');

if (root === null) {
  throw new Error('缺少应用根节点。');
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
