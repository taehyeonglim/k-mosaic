# 보안 정책

## 범위

K-MOSAIC은 정적 사이트입니다. 런타임 서버·데이터베이스·사용자 계정이 없고, 배포 산출물에는 API 키가 없습니다. 관련된 보안 위험은 주로 다음과 같습니다.

- KOSIS OpenAPI 키가 저장소·빌드 산출물·로그에 노출되는 경우
- 의존성 취약점 (Dependabot이 주간 점검)
- 배포된 페이지에 스크립트가 주입될 수 있는 경로

## 제보

취약점은 공개 이슈 대신 GitHub의 **[비공개 취약점 제보](https://github.com/taehyeonglim/k-mosaic/security/advisories/new)** 로 알려 주세요. 확인 후 가능한 한 빨리 답변드립니다.

## 키가 노출되었다면

키 노출은 이력 재작성보다 **즉시 재발급**이 우선입니다 ([KOSIS OpenAPI 관리](https://kosis.kr/openapi/)). 정적 배포라 재발급이 서비스에 영향을 주지 않습니다. 점검 절차는 [docs/operations.md §4](docs/operations.md#4-보안)를 보세요.
