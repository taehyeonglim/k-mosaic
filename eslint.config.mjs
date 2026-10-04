import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...nextConfig,
  {
    // 리팩터 뒤 남은 import·타입을 잡는다 (_ 로 시작하는 이름은 의도적 미사용).
    // typescript-eslint 플러그인이 등록된 TS 파일에만 적용한다 (.mjs 에 적용하면 설정 오류).
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // 화면 문구는 src/content/ko.ts 를 거친다 (CLAUDE.md §5). JSX 안의 한글 리터럴을 막는다.
    files: ['src/**/*.tsx'],
    ignores: ['src/content/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[가-힣]/]',
          message: '화면 문구는 src/content/ko.ts 에 두고 참조하세요.',
        },
        {
          selector: 'JSXAttribute > Literal[value=/[가-힣]/]',
          message: '속성 문구(aria-label 등)도 src/content/ko.ts 를 거칩니다.',
        },
        {
          selector: 'JSXExpressionContainer > Literal[value=/[가-힣]/]',
          message: '화면 문구는 src/content/ko.ts 에 두고 참조하세요.',
        },
        {
          selector: 'JSXExpressionContainer TemplateElement[value.raw=/[가-힣]/]',
          message: '템플릿 문구는 src/content/ko.ts 의 {자리표시자} 템플릿으로 두세요.',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default eslintConfig;
