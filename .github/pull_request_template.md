## 무엇을 왜 바꿨나요


## 검증


## 체크리스트

- [ ] `pnpm typecheck && pnpm lint && pnpm test` 통과
- [ ] 데이터를 바꿨다면 `pnpm data:validate && pnpm data:validate-foreign` 통과, 검증 결과를 본문에 첨부
- [ ] 화면 문구는 `src/content/ko.ts`를 거쳤다 (JSX 한글 리터럴 없음)
- [ ] 연도·수치를 코드·테스트에 리터럴로 두지 않았다
- [ ] 결측을 0으로 대체하지 않았다 · 지역은 `regionCode`로 조인했다
- [ ] 윤리 요구사항: 경고색 없음 · "전국 값" 표기 · 순위≠우열 안내 · 결측은 사선 패턴
- [ ] 키·요청 URL 전문을 로그나 파일에 남기지 않았다
