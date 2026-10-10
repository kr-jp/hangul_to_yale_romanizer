#!/usr/bin/env python3
"""
Yale→ハングル変換（ビームサーチ）で使う音節頻度データ data/syllable-freq.json を生成する。

出典（どちらも CC BY-SA。詳しくは data/README.md）
  1. 韓国語版ウィキペディア — kowikitext 20200920 v2 の train 分割 (lovit/kowikitext, CC BY-SA 3.0)
  2. 映画・ドラマの字幕 — FrequencyWords 2018 ko_full (hermitdave/FrequencyWords, コンテンツ CC BY-SA 4.0)
2 つのコーパスをそれぞれ合計 1 に正規化し、同じ比重で混ぜる（文語・口語のどちらにも偏らないように）。

出力形式（値はすべて log10 確率）:
{
  "u": {"이":-1.46, ...},    // 音節ユニグラム（全音節）
  "b": {"한국":-2.85, ...},  // 語内の音節バイグラム（上位 50,000）
  "w": {"작업":-3.2, ...}    // 2〜3 音節の単語（上位 12,000。変換器が参照するのは 2〜3 音節だけ）
}

使い方:
  python3 scripts/gen_syllable_freq.py [--wiki kowikitext_20200920.train.zip] [--subs ko_full.txt] [-o 出力パス]
  ファイルを指定しなければダウンロードする（ウィキは約 490MB、~/.cache/hangul-yale-freq に保存）。
  同じ入力からは常に同じファイルができる（集計順・同順位の並びも入力順で決まる）。
"""

import argparse
import collections
import gzip
import json
import math
import os
import re
import shutil
import sys
import urllib.request
import zipfile

WIKI_URL = ('https://github.com/lovit/kowikitext/releases/download/'
            'kowikitext.20200920.v2/kowikitext_20200920.train.zip')
SUBS_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_full.txt'

N_BIGRAM = 50_000
N_WORD = 12_000
WORD_MAX_LEN = 3  # 변환기(y2h.js)의 단어 보너스는 2·3음절 창만 본다
BIGRAM_MIN = 2    # 각 코퍼스에서 2회 미만 바이그램은 노이즈로 제거
WORD_MIN = 3      # 각 코퍼스에서 3회 미만 단어는 제거

HANGUL = re.compile('[가-힣]+')


def fetch(url, cache_dir):
    """url을 cache_dir에 내려받고 경로를 돌려준다 (이미 있으면 재사용)."""
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, url.rsplit('/', 1)[-1])
    if not os.path.exists(path):
        print(f'다운로드: {url}', file=sys.stderr)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp, open(path + '.part', 'wb') as f:
            shutil.copyfileobj(resp, f, 1 << 20)
        os.replace(path + '.part', path)
    return path


def subtitle_counts(path):
    """FrequencyWords 목록 → 어절(한글 부분)별 빈도."""
    c = collections.Counter()
    with open(path, encoding='utf-8') as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2:
                syls = ''.join(HANGUL.findall(parts[0]))
                if syls:
                    c[syls] += int(parts[1])
    return c


def wiki_counts(zip_path):
    """kowikitext → 한글 연속 구간별 빈도 (' = 제목 = ' 줄은 제외)."""
    c = collections.Counter()
    with zipfile.ZipFile(zip_path) as z:
        with z.open(z.namelist()[0]) as f:
            for i, raw in enumerate(f):
                line = raw.decode('utf-8', 'ignore')
                if line.startswith(' = '):
                    continue
                c.update(HANGUL.findall(line))
                if i % 2_000_000 == 0:
                    print(f'  위키 {i:,}줄', file=sys.stderr)
    return c


def tables(words):
    """어절 빈도 → (유니그램, 어절 내 바이그램, 2~6음절 단어) 빈도. 코퍼스별 하한으로 거른다."""
    uni = collections.Counter()
    bi = collections.Counter()
    wc = collections.Counter()
    for w, n in words.items():
        for ch in w:
            uni[ch] += n
        for i in range(len(w) - 1):
            bi[w[i:i + 2]] += n
        if 2 <= len(w) <= 6:
            wc[w] += n
    bi = collections.Counter({k: v for k, v in bi.items() if v >= BIGRAM_MIN})
    wc = collections.Counter({k: v for k, v in wc.items() if v >= WORD_MIN})
    return uni, bi, wc


def mix(*weighted):
    """각 표를 합계 1로 정규화한 뒤 가중 합산."""
    out = collections.Counter()
    for c, weight in weighted:
        total = sum(c.values())
        for k, v in c.items():
            out[k] += weight * v / total
    return out


def to_json(uni, bi, wc):
    ut = sum(uni.values())
    u = {k: round(math.log10(v / ut), 3) for k, v in uni.most_common()}
    bt = sum(bi.values())
    b = {k: round(math.log10(v / bt), 3) for k, v in bi.most_common(N_BIGRAM)}
    words = [(k, v) for k, v in wc.most_common() if len(k) <= WORD_MAX_LEN][:N_WORD]
    wt = sum(wc.values())
    w = {k: round(math.log10(v / wt), 3) for k, v in words}
    return {'u': u, 'b': b, 'w': w}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--wiki', help='kowikitext_20200920.train.zip (없으면 다운로드)')
    ap.add_argument('--subs', help='FrequencyWords ko_full.txt (없으면 다운로드)')
    ap.add_argument('--cache-dir', default=os.path.expanduser('~/.cache/hangul-yale-freq'))
    ap.add_argument('-o', '--output', default='data/syllable-freq.json')
    args = ap.parse_args()

    wiki_path = args.wiki or fetch(WIKI_URL, args.cache_dir)
    subs_path = args.subs or fetch(SUBS_URL, args.cache_dir)

    print('집계 중 (위키는 수 분 걸림)...', file=sys.stderr)
    wiki = tables(wiki_counts(wiki_path))
    subs = tables(subtitle_counts(subs_path))
    mixed = [mix((wiki[i], 0.5), (subs[i], 0.5)) for i in range(3)]
    data = to_json(*mixed)

    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(raw)
    size = len(raw.encode('utf-8'))
    gz = len(gzip.compress(raw.encode('utf-8')))
    print(f'출력: {args.output}  {size / 1024:,.0f} KB (gzip {gz / 1024:,.0f} KB)  '
          f'u={len(data["u"]):,} b={len(data["b"]):,} w={len(data["w"]):,}', file=sys.stderr)


if __name__ == '__main__':
    main()
