// ESLint v9 flat config, replacing the legacy .eslintrc.json (which Next 16
// no longer supports via `next lint`). Equivalent to the previous
// `next/core-web-vitals` extends, expressed as flat-config rule sets.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/.temp/**',
      // Design package — JSX prototypes loaded via Babel-standalone, used
      // only as visual reference. Not production code; not part of the
      // build. Linting them produces noise (undeclared globals, etc.).
      'docs/design/**',
      // Template-shipped shadcn/ui components and hooks predate
      // ESLint v9 + react-hooks/purity rules. Touching them risks
      // breaking the components; updates come from re-running
      // `npx shadcn@latest add`. PROJ-1 doesn't own this code.
      'src/components/ui/**',
      'src/hooks/use-toast.ts',
    ],
  },
];

export default config;
