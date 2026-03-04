#!/usr/bin/env python3
"""
韓国語の音節頻度データを生成するスクリプト。
- ユニグラム: log10(確率) の辞書
- バイグラム: log10(確率) の辞書（重み付きスコアリング用）
- 単語辞書: 2~6音節単語の log10(確率) （ビームサーチ単語ボーナス用）

出力形式:
{
  "u": {"이":-1.46, ...},    // ユニグラム (~1,400エントリ)
  "b": {"한국":-2.85, ...},  // バイグラム log10(確率) (~22,000エントリ)
  "w": {"작업":-3.2, ...}    // 単語辞書 log10(確率) (~8,000エントリ)
}
"""

import json
import math
import sys
import urllib.request
from collections import Counter

HANGUL_START = 0xAC00
HANGUL_END = 0xD7A3

def is_hangul_syllable(ch):
    return HANGUL_START <= ord(ch) <= HANGUL_END

def download_frequency_list():
    url = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_50k.txt"
    print(f"다운로드 중: {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8")
    words = []
    for line in text.strip().split("\n"):
        parts = line.strip().split()
        if len(parts) >= 2:
            words.append((parts[0], int(parts[1])))
    print(f"다운로드 완료: {len(words)}개 단어", file=sys.stderr)
    return words

def compute_frequencies(words):
    uni_count = Counter()
    bi_count = Counter()
    uni_total = 0

    for word, freq in words:
        syls = [ch for ch in word if is_hangul_syllable(ch)]
        for syl in syls:
            uni_count[syl] += freq
            uni_total += freq
        for i in range(len(syls) - 1):
            bi_count[syls[i] + syls[i + 1]] += freq

    # 유니그램: log10(확률)
    uni_freq = {}
    for syl, count in uni_count.items():
        uni_freq[syl] = round(math.log10(count / uni_total), 3)

    # 바이그램: 출현 횟수 >= 2인 것만 유지 (노이즈 제거)
    # log10(확률)로 저장 (중량 스코어링용)
    bi_total = sum(c for c in bi_count.values())
    bi_freq = {}
    for bg, count in bi_count.items():
        if count >= 2:
            bi_freq[bg] = round(math.log10(count / bi_total), 3)

    # 단어 빈도: 2~6음절 한글 단어 (빈도 >= 3)
    word_count = Counter()
    for word, freq in words:
        syls = [ch for ch in word if is_hangul_syllable(ch)]
        if 2 <= len(syls) <= 6:
            word_count[''.join(syls)] += freq

    word_total = sum(word_count.values())
    word_freq = {}
    for w, count in word_count.items():
        if count >= 3:
            word_freq[w] = round(math.log10(count / word_total), 3)

    # 파일 크기 제한: 상위 8000개만 유지
    MAX_WORD_ENTRIES = 6000
    sorted_words_all = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    if len(sorted_words_all) > MAX_WORD_ENTRIES:
        sorted_words_all = sorted_words_all[:MAX_WORD_ENTRIES]
    word_freq_final = dict(sorted_words_all)

    print(f"유니그램: {len(uni_freq)}종", file=sys.stderr)
    print(f"바이그램: {len(bi_freq)}종 (freq>=2, 전체 {len(bi_count)}종)", file=sys.stderr)
    print(f"단어사전: {len(word_freq_final)}종 (freq>=3, 상위 {MAX_WORD_ENTRIES}개)", file=sys.stderr)

    return uni_freq, bi_freq, bi_count, word_freq_final

def main():
    words = download_frequency_list()
    uni_freq, bi_freq, bi_count, word_freq = compute_frequencies(words)

    # 결합 출력
    sorted_uni = dict(sorted(uni_freq.items(), key=lambda x: x[1], reverse=True))
    sorted_bi = dict(sorted(bi_freq.items(), key=lambda x: x[1], reverse=True))
    output = {
        "u": sorted_uni,
        "b": sorted_bi,
        "w": word_freq
    }

    output_path = sys.argv[1] if len(sys.argv) > 1 else "data/syllable-freq.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    import os
    size = os.path.getsize(output_path)
    print(f"\n출력: {output_path}", file=sys.stderr)
    print(f"파일 크기: {size:,} bytes ({size/1024:.1f} KB)", file=sys.stderr)
    print(f"  유니그램: {len(sorted_uni)}개", file=sys.stderr)
    print(f"  바이그램: {len(sorted_bi)}개", file=sys.stderr)
    print(f"  단어사전: {len(word_freq)}개", file=sys.stderr)
    if size > 500 * 1024:
        print(f"  경고: 파일 크기 {size:,} bytes > 500KB 제한!", file=sys.stderr)

    # VCV 검증 (중량 바이그램)
    print("\n=== VCV 검증 (중량 바이그램) ===", file=sys.stderr)
    PENALTY_UNI = -8.0
    W_BI = 0.7             # 바이그램 가중치
    BI_MISS_BASE = -13.0   # 미등록 바이그램 기본 페널티
    BI_MISS = W_BI * BI_MISS_BASE

    test_cases = [
        ("hankwukenun", [
            ("한국어는 (정답)", ["한","국","어","는"]),
            ("한구거는 (오답)", ["한","구","거","는"]),
        ]),
        ("salangi", [
            ("사랑이 (정답)", ["사","랑","이"]),
            ("사란기 (오답)", ["사","란","기"]),
        ]),
        ("phulppulilo", [
            ("풀뿌리로 (정답)", ["풀","뿌","리","로"]),
            ("풀뿔이로 (오답)", ["풀","뿔","이","로"]),
        ]),
        ("enei", [
            ("어네이 (greedy)", ["어","네","이"]),
            ("언어이? (coda n)", ["언","어","이"]),
            ("어너이 (greedy)", ["어","너","이"]),
        ]),
    ]

    for yale, candidates in test_cases:
        print(f"\n{yale}:", file=sys.stderr)
        for label, syls in candidates:
            uni_score = sum(uni_freq.get(s, PENALTY_UNI) for s in syls)
            bi_score = 0
            for i in range(len(syls) - 1):
                bg = syls[i] + syls[i + 1]
                bf = bi_freq.get(bg)
                bi_score += (W_BI * bf) if bf is not None else BI_MISS
            total = uni_score + bi_score
            bi_detail = []
            for i in range(len(syls) - 1):
                bg = syls[i] + syls[i + 1]
                bf = bi_freq.get(bg)
                score = (W_BI * bf) if bf is not None else BI_MISS
                bi_detail.append(f"{bg}:{score:.3f}({bi_count.get(bg,0)})")
            print(f"  {label}: uni={uni_score:.3f} bi={bi_score:.3f} total={total:.3f}  [{', '.join(bi_detail)}]", file=sys.stderr)

if __name__ == "__main__":
    main()
