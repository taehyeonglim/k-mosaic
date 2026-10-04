import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { redact } from './redact.js';
import { SourceMetaSchema, type SourceMeta } from '../../src/lib/schema/index.js';

// data/metadata/sources.v1.json 은 다문화학생·외국인 유학생 두 데이터셋의 출처를 함께 담는다.
// build 스크립트가 자기 데이터셋 항목만으로 파일을 덮어쓰면 다른 데이터셋의 출처가 사라진다.
// 항상 기존 항목과 병합하고, 검증을 통과한 뒤에만 기록한다 (CLAUDE.md 금지 #10).

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readSourceEntries(path: string): SourceMeta[] {
  if (!existsSync(path)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`출처 메타데이터를 읽을 수 없습니다: ${message}`));
  }
  const entries = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.sources)
      ? raw.sources
      : [];
  return entries.map((entry, index) => {
    const parsed = SourceMetaSchema.safeParse(entry);
    if (!parsed.success)
      throw new Error(redact(`기존 출처 메타데이터 ${index}건이 올바르지 않습니다.`));
    return parsed.data;
  });
}

/** tableId 가 같은 항목은 교체하고, 새 항목은 뒤에 붙인다. 기존 순서를 보존한다. */
export function mergeSourceEntries(
  existing: readonly SourceMeta[],
  updates: readonly SourceMeta[],
): SourceMeta[] {
  const updateById = new Map(updates.map((entry) => [entry.tableId, entry]));
  const merged = existing.map((entry) => updateById.get(entry.tableId) ?? entry);
  for (const entry of updates) {
    if (!merged.some((candidate) => candidate.tableId === entry.tableId)) merged.push(entry);
  }
  for (const entry of merged) {
    if (!SourceMetaSchema.safeParse(entry).success)
      throw new Error(redact(`출처 메타데이터 검증 실패: ${entry.tableId}`));
  }
  return merged;
}

/** 파일 최상위 retrievedAt 은 항목 조회일 중 가장 최근 값이다 — 기록 순서와 무관하게 결정적이다. */
export function writeSourceMetadata(path: string, entries: readonly SourceMeta[]): void {
  const retrievedAt = entries
    .map((entry) => entry.retrievedAt)
    .sort()
    .at(-1);
  if (retrievedAt === undefined) throw new Error(redact('기록할 출처 메타데이터가 없습니다.'));
  writeFileSync(
    path,
    `${redact(JSON.stringify({ schemaVersion: 1, retrievedAt, sources: entries }, null, 2))}\n`,
    'utf8',
  );
}
