import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REGIONS } from '../probe/regions.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_PATH = join(ROOT, 'public/geo/sido.geo.json');
const SOURCE_VERSION = 'ver20260401';
const SOURCE_COMMIT = 'ce1e6fad5a6ac9066078b08e666d364da5f96b1f';
const SOURCE_URL = `https://raw.githubusercontent.com/vuski/admdongkor/${SOURCE_COMMIT}/${SOURCE_VERSION}/HangJeongDong_${SOURCE_VERSION}.geojson`;
const MAPSHAPER_VERSION = '0.7.51';
const SIMPLIFY_PERCENTAGE = '0.35%';
const SIMPLIFY_WEIGHTING = '0.7';
const COORDINATE_PRECISION = '0.0001';
const MAX_BYTES = 150_000;
const COORDINATE_TOLERANCE = 0.02;
const REGION_BY_NAME = new Map(REGIONS.map((region) => [region.officialKo, region]));
const EXPECTED_CODES = new Set(REGIONS.map((region) => region.code));

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function collectCoordinates(geometry) {
  const coordinates = [];
  const visit = (value) => {
    assertCondition(Array.isArray(value) && value.length > 0, '빈 좌표 배열이 있습니다.');
    if (typeof value[0] === 'number') {
      assertCondition(value.length >= 2, '좌표 쌍에 경도 또는 위도가 없습니다.');
      assertCondition(
        Number.isFinite(value[0]) && Number.isFinite(value[1]),
        '유한하지 않은 좌표가 있습니다.',
      );
      coordinates.push([value[0], value[1]]);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  return coordinates;
}

function geometryPartCount(geometry) {
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.length;
  }
  throw new Error(`지원하지 않는 geometry 타입입니다: ${geometry.type}`);
}

function geometryBounds(geometry) {
  const points = collectCoordinates(geometry);
  return [
    Math.min(...points.map(([longitude]) => longitude)),
    Math.min(...points.map(([, latitude]) => latitude)),
    Math.max(...points.map(([longitude]) => longitude)),
    Math.max(...points.map(([, latitude]) => latitude)),
  ];
}

function featureBounds(features) {
  const bounds = features.map((feature) => geometryBounds(feature.geometry));
  return [
    Math.min(...bounds.map(([minLongitude]) => minLongitude)),
    Math.min(...bounds.map(([, minLatitude]) => minLatitude)),
    Math.max(...bounds.map(([, , maxLongitude]) => maxLongitude)),
    Math.max(...bounds.map(([, , , maxLatitude]) => maxLatitude)),
  ];
}

function probeCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function resolveMapshaper() {
  const localVersion = probeCommand('mapshaper', ['-v']);
  if (localVersion === MAPSHAPER_VERSION) {
    console.log(`mapshaper ${localVersion} 사용`);
    return { command: 'mapshaper', args: [] };
  }

  if (probeCommand('npx', ['--version'])) {
    if (localVersion) {
      console.warn(
        `로컬 mapshaper ${localVersion} 대신 mapshaper ${MAPSHAPER_VERSION}을 npx로 사용합니다.`,
      );
    }
    return {
      command: 'npx',
      args: ['--yes', '--package', `mapshaper@${MAPSHAPER_VERSION}`, 'mapshaper'],
    };
  }

  if (localVersion) {
    console.warn(
      `mapshaper ${localVersion}을 사용합니다. 재현성을 위해 ${MAPSHAPER_VERSION}을 권장합니다.`,
    );
    return { command: 'mapshaper', args: [] };
  }

  throw new Error(
    `mapshaper CLI를 찾을 수 없습니다. Node.js/npm을 설치한 뒤 ` +
      `npm install --global mapshaper@${MAPSHAPER_VERSION} 또는 npx를 사용할 수 있는 환경에서 다시 실행하세요.`,
  );
}

function runMapshaper(runner, args) {
  execFileSync(runner.command, [...runner.args, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

async function downloadSource(tempDirectory) {
  const response = await fetch(SOURCE_URL);
  assertCondition(response.ok, `원본 다운로드 실패: ${response.status} ${response.statusText}`);

  const body = Buffer.from(await response.arrayBuffer());
  const sourcePath = join(tempDirectory, `${SOURCE_VERSION}.geojson`);
  await writeFile(sourcePath, body);

  return {
    sourcePath,
    source: JSON.parse(body.toString('utf8')),
    sha256: createHash('sha256').update(body).digest('hex'),
  };
}

function reassembleSidoFeatures(simplifiedParts) {
  assertCondition(
    simplifiedParts.type === 'FeatureCollection',
    '단순화 결과가 FeatureCollection이 아닙니다.',
  );

  const groups = new Map();
  for (const feature of simplifiedParts.features) {
    assertCondition(
      feature.geometry?.type === 'Polygon',
      'explode 이후 Polygon이 아닌 geometry가 있습니다.',
    );
    const nameKo = feature.properties?.sidonm;
    assertCondition(REGION_BY_NAME.has(nameKo), `알 수 없는 시도명입니다: ${nameKo}`);
    const parts = groups.get(nameKo) ?? [];
    parts.push(feature.geometry.coordinates);
    groups.set(nameKo, parts);
  }

  assertCondition(
    groups.size === REGIONS.length,
    `시도 그룹 수가 ${REGIONS.length}개가 아닙니다: ${groups.size}`,
  );
  for (const nameKo of groups.keys()) {
    assertCondition(REGION_BY_NAME.has(nameKo), `예상하지 않은 시도 그룹입니다: ${nameKo}`);
  }

  return {
    type: 'FeatureCollection',
    features: REGIONS.map((region) => {
      const coordinates = groups.get(region.officialKo);
      assertCondition(coordinates?.length > 0, `${region.officialKo} geometry가 없습니다.`);
      return {
        type: 'Feature',
        properties: {
          regionCode: region.code,
          nameKo: region.officialKo,
          nameEn: region.en,
        },
        geometry:
          coordinates.length === 1
            ? { type: 'Polygon', coordinates: coordinates[0] }
            : { type: 'MultiPolygon', coordinates },
      };
    }),
  };
}

function validatePartPreservation(dissolved, simplifiedParts) {
  const before = new Map(
    dissolved.features.map((feature) => [
      feature.properties?.sidonm,
      geometryPartCount(feature.geometry),
    ]),
  );
  const after = new Map();
  for (const feature of simplifiedParts.features) {
    const nameKo = feature.properties?.sidonm;
    after.set(nameKo, (after.get(nameKo) ?? 0) + 1);
  }

  assertCondition(
    before.size === REGIONS.length,
    `dissolve 결과 시도 수가 ${REGIONS.length}개가 아닙니다.`,
  );
  assertCondition(after.size === before.size, '단순화 과정에서 시도 그룹이 변경되었습니다.');
  for (const [nameKo, partCount] of before) {
    assertCondition(
      after.get(nameKo) === partCount,
      `${nameKo} 도서/분리 폴리곤 수가 보존되지 않았습니다.`,
    );
  }
}

function validateProtectedIslands(collection, source) {
  const ulleungFeatures = source.features.filter(
    (feature) => feature.properties?.sggnm === '울릉군',
  );
  assertCondition(ulleungFeatures.length > 0, '원본에서 울릉군 geometry를 찾지 못했습니다.');
  const ulleungBounds = featureBounds(ulleungFeatures);
  const gyeongbuk = collection.features.find((feature) => feature.properties?.regionCode === '47');
  const gyeongbukPoints = collectCoordinates(gyeongbuk.geometry);
  assertCondition(
    Math.max(...gyeongbukPoints.map(([longitude]) => longitude)) >=
      ulleungBounds[2] - COORDINATE_TOLERANCE,
    '독도 경계가 단순화 결과에 보존되지 않았습니다.',
  );
  assertCondition(
    gyeongbukPoints.some(
      ([longitude, latitude]) =>
        longitude <= ulleungBounds[0] + COORDINATE_TOLERANCE &&
        latitude >= ulleungBounds[1] - COORDINATE_TOLERANCE &&
        latitude <= ulleungBounds[3] + COORDINATE_TOLERANCE,
    ),
    '울릉도 경계가 단순화 결과에 보존되지 않았습니다.',
  );

  const jejuFeatures = source.features.filter(
    (feature) => feature.properties?.sidonm === '제주특별자치도',
  );
  const jeju = collection.features.find((feature) => feature.properties?.regionCode === '50');
  const sourceBounds = featureBounds(jejuFeatures);
  const outputBounds = geometryBounds(jeju.geometry);
  assertCondition(
    outputBounds[0] <= sourceBounds[0] + COORDINATE_TOLERANCE,
    '제주 서쪽 끝이 보존되지 않았습니다.',
  );
  assertCondition(
    outputBounds[1] <= sourceBounds[1] + COORDINATE_TOLERANCE,
    '제주 남쪽 끝이 보존되지 않았습니다.',
  );
  assertCondition(
    outputBounds[2] >= sourceBounds[2] - COORDINATE_TOLERANCE,
    '제주 동쪽 끝이 보존되지 않았습니다.',
  );
  assertCondition(
    outputBounds[3] >= sourceBounds[3] - COORDINATE_TOLERANCE,
    '제주 북쪽 끝이 보존되지 않았습니다.',
  );
}

export function validateSidoGeoJson(collection, source, dissolved, simplifiedParts) {
  assertCondition(
    collection.type === 'FeatureCollection',
    '산출물이 FeatureCollection이 아닙니다.',
  );
  assertCondition(
    collection.features.length === REGIONS.length,
    `Feature 수가 ${REGIONS.length}개가 아닙니다.`,
  );

  const codes = collection.features.map((feature) => feature.properties?.regionCode);
  assertCondition(new Set(codes).size === codes.length, '중복 regionCode가 있습니다.');
  assertCondition(
    new Set(codes).size === EXPECTED_CODES.size && codes.every((code) => EXPECTED_CODES.has(code)),
    `regionCode 집합이 일치하지 않습니다: ${codes.join(',')}`,
  );

  for (const feature of collection.features) {
    const region = REGIONS.find((candidate) => candidate.code === feature.properties?.regionCode);
    assertCondition(region, `알 수 없는 regionCode입니다: ${feature.properties?.regionCode}`);
    assertCondition(
      feature.properties.nameKo === region.officialKo,
      `${region.code} nameKo가 일치하지 않습니다.`,
    );
    assertCondition(
      feature.properties.nameEn === region.en,
      `${region.code} nameEn이 일치하지 않습니다.`,
    );
    assertCondition(
      feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon',
      `${region.code} geometry 타입이 Polygon/MultiPolygon이 아닙니다.`,
    );

    for (const [longitude, latitude] of collectCoordinates(feature.geometry)) {
      assertCondition(
        longitude >= 124 && longitude <= 132 && latitude >= 33 && latitude <= 39,
        `${region.code} 좌표가 검증 범위를 벗어났습니다: ${longitude},${latitude}`,
      );
    }
  }

  validatePartPreservation(dissolved, simplifiedParts);
  validateProtectedIslands(collection, source);
  return {
    featureCount: collection.features.length,
    codes: [...codes].sort(),
    bbox: featureBounds(collection.features),
  };
}

export async function buildSidoGeoJson() {
  const runner = resolveMapshaper();
  const tempDirectory = await mkdtemp(join(tmpdir(), 'k-mosaic-sido-'));

  try {
    const { sourcePath, source, sha256 } = await downloadSource(tempDirectory);
    const dissolvedPath = join(tempDirectory, 'dissolved.geojson');
    const simplifiedPartsPath = join(tempDirectory, 'simplified-parts.geojson');

    console.log(`원본 다운로드: ${SOURCE_VERSION} (${sha256})`);
    runMapshaper(runner, [
      '--quiet',
      '-i',
      sourcePath,
      '-dissolve',
      'fields=sido',
      'copy-fields=sidonm',
      '-o',
      dissolvedPath,
      'format=geojson',
      `precision=${COORDINATE_PRECISION}`,
      'fix-geometry',
    ]);
    runMapshaper(runner, [
      '--quiet',
      '-i',
      dissolvedPath,
      '-explode',
      '-simplify',
      SIMPLIFY_PERCENTAGE,
      'weighted',
      `weighting=${SIMPLIFY_WEIGHTING}`,
      'keep-shapes',
      '-o',
      simplifiedPartsPath,
      'format=geojson',
      `precision=${COORDINATE_PRECISION}`,
      'fix-geometry',
    ]);

    const dissolved = await readJson(dissolvedPath);
    const simplifiedParts = await readJson(simplifiedPartsPath);
    const output = reassembleSidoFeatures(simplifiedParts);
    const summary = validateSidoGeoJson(output, source, dissolved, simplifiedParts);
    const encoded = `${JSON.stringify(output)}\n`;
    const bytes = Buffer.byteLength(encoded);
    assertCondition(
      bytes <= MAX_BYTES,
      `최종 파일 크기가 ${MAX_BYTES}바이트를 초과했습니다: ${bytes}`,
    );

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, encoded, 'utf8');
    const writtenBytes = (await stat(OUTPUT_PATH)).size;
    assertCondition(writtenBytes === bytes, '최종 파일 크기 확인이 일치하지 않습니다.');

    console.log(`생성 완료: ${OUTPUT_PATH} (${writtenBytes} bytes)`);
    console.log(`검증 완료: ${summary.featureCount} features, bbox=${summary.bbox.join(',')}`);
    return { ...summary, bytes: writtenBytes, sourceSha256: sha256 };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  buildSidoGeoJson().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
