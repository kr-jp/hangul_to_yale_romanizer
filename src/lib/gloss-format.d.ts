// gloss-format.js 타입 경계 선언 (설계 문서 §2.3 — converter 패턴과 동일)
import type { Example, OutputFormat } from './types';

export interface GlossedExample extends Example {
  gloss?: string[];
}

export function attachGlosses(
  examples: Example[],
  lines: string[],
  glosses: ReadonlyMap<string, string[]>,
): GlossedExample[];

export function exampleHasGloss(ex: GlossedExample): boolean;

export function hasAnyGloss(examples: GlossedExample[]): boolean;

export function formatGlossedOutput(
  examples: GlossedExample[],
  format: OutputFormat,
  o?: { numbered?: boolean },
): string;

export function formatSingleGlossedExample(
  tokens: string[],
  romas: string[],
  gloss: string[] | undefined,
  format: OutputFormat,
  o?: { numbered?: boolean; exampleIndex?: number },
): string;
