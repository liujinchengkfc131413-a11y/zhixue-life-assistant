import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from './openapi.js';

describe('M7 Provider OpenAPI contract', () => {
  it('documents every implemented Provider configuration route', () => {
    const document = buildOpenApiDocument();
    const paths = document.paths ?? {};
    expect(paths['/api/v1/ai/providers']?.get).toBeDefined();
    expect(paths['/api/v1/ai/providers']?.post).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}']?.patch).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}']?.delete).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}/credential']?.put).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}/credential']?.delete).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}:verify']?.post).toBeDefined();
    expect(paths['/api/v1/ai/providers/{id}:set-default']?.post).toBeDefined();
  });
});
