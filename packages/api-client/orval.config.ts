import { defineConfig } from 'orval';

/** Generates from the running API when API_SPEC_URL is set, otherwise from the committed snapshot. */
const input = { target: process.env.API_SPEC_URL ?? './openapi.snapshot.json' };

export default defineConfig({
  erp: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/mutator.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
        query: { signal: true },
      },
    },
  },
  erpZod: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
    },
  },
});
