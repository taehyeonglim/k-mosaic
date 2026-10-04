// KOSIS 는 쿼리스트링으로 인증하므로 요청 URL·오류 메시지에 키가 섞일 수 있다.
// 로그·에러·파일에 쓰는 모든 문자열은 이 함수를 거친다 (CLAUDE.md 금지 #2).

const REDACTED = '***REDACTED***';

export function redact(s: unknown): string {
  const value = String(s);
  const key = process.env.KOSIS_API_KEY;
  return key ? value.split(key).join(REDACTED) : value;
}
