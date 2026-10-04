# 시·도 행정경계 GeoJSON 출처와 가공 기록

## 산출물

- 파일: `public/geo/sido.geo.json`
- 형식: GeoJSON `FeatureCollection`, WGS84 경위도 좌표(EPSG:4326)
- Feature 수: 17개
- 파일 크기: 118,376 bytes (150,000 bytes 이하)
- 좌표 소수점: 최대 4자리
- 재생성: `pnpm geo:build` (`tsx scripts/geo/build-sido-geojson.mjs`) — 같은 원본이면 바이트 단위로 같은 파일이 나온다

## 출처와 라이선스

| 항목                 | 내용                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 원자료 기관          | 통계청 통계지리정보서비스(SGIS)                                                                                                                                                                                                          |
| 원자료 안내          | [SGIS](https://sgis.kostat.go.kr)                                                                                                                                                                                                        |
| 가공 데이터 저장소   | [vuski/admdongkor](https://github.com/vuski/admdongkor)                                                                                                                                                                                  |
| 사용한 원본          | [`ver20260401/HangJeongDong_ver20260401.geojson`](https://raw.githubusercontent.com/vuski/admdongkor/ce1e6fad5a6ac9066078b08e666d364da5f96b1f/ver20260401/HangJeongDong_ver20260401.geojson)                                             |
| 고정 commit          | `ce1e6fad5a6ac9066078b08e666d364da5f96b1f`                                                                                                                                                                                               |
| 원본 취득일          | 2026-08-05 (Asia/Seoul)                                                                                                                                                                                                                  |
| 원본 SHA-256         | `6a63d079ba8af4701ab200ad0b54ebdea8689808b6e0e9f17973b9ba7883dc6a`                                                                                                                                                                       |
| 원자료 라이선스      | 공공누리 제1유형(KOGL Type 1, 출처표시)                                                                                                                                                                                                  |
| 가공 데이터 라이선스 | Creative Commons Attribution 4.0 International (CC BY 4.0), SPDX `CC-BY-4.0`                                                                                                                                                             |
| 라이선스 원문        | [`LICENSE-DATA`](https://github.com/vuski/admdongkor/blob/ce1e6fad5a6ac9066078b08e666d364da5f96b1f/LICENSE-DATA), [KOGL 제1유형](https://www.kogl.or.kr/info/licenseType1.do), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

`vuski/admdongkor`의 데이터 라이선스에 따라 SGIS 출처표시 의무를 유지하고, 저장소가 추가·가공한 부분은 CC BY 4.0으로 표시한다. `southkorea/southkorea-maps`는 사용하지 않았다.

### 출처표시 문구

아래 문구는 원문 그대로 복사해 사용할 수 있다.

```text
본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.
```

지도 하단에 사용할 짧은 표기는 다음과 같다.

```text
행정경계: 통계청 통계지리정보서비스(SGIS) — 공공누리 제1유형
가공: vuski/admdongkor — CC BY 4.0
```

## 원본 버전 선택

`ver20260701`은 2026-07-01 광주광역시와 전라남도가 전남광주통합특별시로 통합된 뒤의 16개 시도 자료다. 프로젝트의 고정 `regionCode` 체계는 17개 시도를 요구하므로, 통합 직전이며 해당 체계를 모두 포함하는 최신 원본 버전 `ver20260401`을 사용했다.

원본의 SGIS 계열 시도 필드는 강원특별자치도와 전북특별자치도에 각각 `51`, `52`를 사용한다. 산출물의 조인 키는 프로젝트의 [행정표준코드 매핑](../src/lib/constants/regions.ts)을 따르므로 이름으로 매핑해 `42`, `45`를 부여했다. 좌표나 경계를 수작업으로 만들거나 수정하지 않았다.

## 재현 가능한 가공 절차

`scripts/geo/build-sido-geojson.mjs`가 원본을 임시 디렉터리에 다운로드한 뒤 다음 과정을 수행한다.

1. `mapshaper@0.7.51`로 `fields=sido` 기준 `dissolve`하여 행정동 3,558개를 시도 단위로 병합한다. `sidonm`을 보존한다.
2. 분리된 도서 폴리곤을 개별 형상으로 `explode`한다.
3. 다음 파라미터로 단순화한다.

   ```text
   -simplify 0.35% weighted weighting=0.7 keep-shapes
   -o format=geojson precision=0.0001 fix-geometry
   ```

4. 단순화된 Polygon 부품을 시도명별로 다시 묶어 17개 Feature를 만들고, 다음 속성만 부여한다.

   ```json
   { "regionCode": "2자리 문자열", "nameKo": "시도 정식명", "nameEn": "영문명" }
   ```

   단순화 후 다시 기하를 dissolve하지 않고 부품을 MultiPolygon으로 재조합한 것은, 작은 도서가 인접 부품으로 합쳐지거나 사라지는 것을 막기 위해서다. dissolve 전·후 분리 폴리곤 수를 스크립트가 비교 검증한다.

## 17개 regionCode 매핑

| regionCode | nameKo         | nameEn    |
| ---------- | -------------- | --------- |
| `11`       | 서울특별시     | Seoul     |
| `26`       | 부산광역시     | Busan     |
| `27`       | 대구광역시     | Daegu     |
| `28`       | 인천광역시     | Incheon   |
| `29`       | 광주광역시     | Gwangju   |
| `30`       | 대전광역시     | Daejeon   |
| `31`       | 울산광역시     | Ulsan     |
| `36`       | 세종특별자치시 | Sejong    |
| `41`       | 경기도         | Gyeonggi  |
| `42`       | 강원특별자치도 | Gangwon   |
| `43`       | 충청북도       | Chungbuk  |
| `44`       | 충청남도       | Chungnam  |
| `45`       | 전북특별자치도 | Jeonbuk   |
| `46`       | 전라남도       | Jeonnam   |
| `47`       | 경상북도       | Gyeongbuk |
| `48`       | 경상남도       | Gyeongnam |
| `50`       | 제주특별자치도 | Jeju      |

검증한 코드 집합은 다음과 같다.

```text
{11,26,27,28,29,30,31,36,41,42,43,44,45,46,47,48,50}
```

## 검증 결과

2026-08-05에 빌드 스크립트와 독립 Node 검사를 실행했다.

| 검사             | 결과                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Feature 수       | 17개 통과                                                               |
| regionCode 집합  | 요구 집합과 정확히 일치                                                 |
| 중복 regionCode  | 0개 통과                                                                |
| geometry 타입    | Polygon 또는 MultiPolygon만 존재                                        |
| 좌표 범위        | 경도 `124.6112..131.8713`, 위도 `33.1125..38.6096` — 요구 범위 내       |
| 최대 소수점 자리 | 4자리                                                                   |
| 도서 보존        | 울릉군/독도 포함 경상북도 6개 Polygon 부품, 제주 30개 Polygon 부품 보존 |
| 결과 파일 크기   | 118,376 bytes 통과                                                      |
