import type { paths } from '@life-assistant/contracts/generated';
import createClient from 'openapi-fetch';

import { getCsrfToken } from './session.js';

export const apiClient = createClient<paths>({ baseUrl: '' });

apiClient.use({
  async onRequest({ request }) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      request.headers.set('x-csrf-token', await getCsrfToken());
    }
    return request;
  },
});
