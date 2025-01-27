import blitzPlugin from '@blitz/eslint-plugin';
import { jsFileExtensions } from '@blitz/eslint-plugin/dist/configs/javascript.js';
import { getNamingConventionRule, tsFileExtensions } from '@blitz/eslint-plugin/dist/configs/typescript.js';

export default [
  {
    ignores: ['**/dist', '**/node_modules', '**/.wrangler', '**/bolt/build', '**/.history'],
  },
  ...blitzPlugin.configs.recommended(),
  {
    rules: {
      // 기본 규칙 비활성화
      '@blitz/catch-error-name': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@blitz/comment-syntax': 'off',
      '@blitz/block-scope-case': 'off',

      // 코드 스타일 규칙
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
      'quote-props': ['error', 'as-needed'],

      // prettier와 충돌하는 규칙들 비활성화
      'array-bracket-spacing': 'off',
      'object-curly-spacing': 'off',
      'object-curly-newline': 'off',
      'comma-dangle': 'off',
      indent: 'off',
      semi: 'off',
      'space-before-function-paren': 'off',
      'no-trailing-spaces': 'off',

      // 주석 관련 규칙 비활성화
      'multiline-comment-style': 'off',
      'spaced-comment': 'off',
      'lines-around-comment': 'off',

      // 유지할 중요 규칙들
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-eval': 'error',
      'consistent-return': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      ...getNamingConventionRule({}, true),
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: [...tsFileExtensions, ...jsFileExtensions, '**/*.tsx'],
    ignores: ['functions/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../'],
              message: "Relative imports are not allowed. Please use '~/' instead.",
            },
          ],
        },
      ],
    },
  },
];
