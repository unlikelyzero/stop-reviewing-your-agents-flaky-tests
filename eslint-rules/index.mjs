import noPageInSpec from './no-page-in-spec.mjs';

/** Local plugin. When a rule has earned it, it moves to eslint-plugin-playwright. */
export default {
  meta: { name: 'eslint-plugin-demo', version: '0.1.0' },
  rules: {
    'no-page-in-spec': noPageInSpec,
  },
};
