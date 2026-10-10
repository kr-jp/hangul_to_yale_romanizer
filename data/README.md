# data/

## syllable-freq.json

Yale→ハングル変換（ビームサーチ）で使う頻度データです。

| キー | 内容 |
|---|---|
| `u` | 音節ユニグラム（log10 確率、全 11,172 音節） |
| `b` | 語内の音節バイグラム（log10 確率、上位 50,000） |
| `w` | 2〜3 音節の単語（log10 確率、上位 12,000 語。変換器が参照するのは 2・3 音節の並びだけ） |

### 出典

文語と口語のどちらにも偏らないよう、2 つのコーパスを混ぜています。

1. **韓国語版ウィキペディア** — [kowikitext](https://github.com/lovit/kowikitext)（lovit）の [`kowikitext.20200920.v2`](https://github.com/lovit/kowikitext/releases/tag/kowikitext.20200920.v2) リリースの train 分割（`kowikitext_20200920.train.zip`）
   - 元データ: [韓国語版ウィキペディアのダンプ](https://dumps.wikimedia.org/kowiki/)（2020-09-20 時点）© ウィキペディアの執筆者
   - ライセンス: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)（kowikitext、および当時のウィキペディア本文）
2. **映画・ドラマの字幕** — [FrequencyWords](https://github.com/hermitdave/FrequencyWords) © Hermit Dave の `content/2018/ko/ko_full.txt`
   - 元データ: [OpenSubtitles2018](https://opus.nlpl.eu/OpenSubtitles2018.php)（OPUS）の韓国語字幕コーパス
   - ライセンス: コンテンツは [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（リポジトリのコード部分は MIT）

### 加工内容

[`scripts/gen_syllable_freq.py`](../scripts/gen_syllable_freq.py) で生成しています（同じ入力からは常に同じファイルができます）。

1. ウィキペディア本文はハングルの連続部分（見出し行を除く）、字幕は単語頻度リストのハングル部分を語として数える
2. コーパスごとに音節・語内バイグラム・2〜6 音節語の頻度を集計し、まれな項目（バイグラム 2 回未満・語 3 回未満）を除く
3. 2 つのコーパスをそれぞれ合計 1 に正規化して等しい重みで混ぜ、log10 確率に変換して上位の項目を残す

```sh
python3 scripts/gen_syllable_freq.py   # 元データを ~/.cache/hangul-yale-freq にダウンロード（ウィキは約 490MB）
python3 scripts/gen_syllable_freq.py --wiki kowikitext_20200920.train.zip --subs ko_full.txt
```

### 精度

ハングル → Yale → ハングルの往復で、語（空白区切り）単位の正答率を測りました（括弧内は 5 候補以内に正解がある割合）。

| データ | 文語（KorNLI） | 口語（NSMC 映画レビュー） | ウィキペディア（学習に使っていない記事） |
|---|---|---|---|
| 以前の版（字幕 5 万語のみ） | 96.07%（99.9） | 94.19%（99.8） | 93.47%（99.8） |
| 現在の版 | 97.38%（100.0） | 95.54%（99.9） | 96.94%（99.9） |

形態素ごとにハイフンで区切った言語学の例文では、区切りの中が短いため、どのデータでもほぼ正しく変換されます（自作の例文による回帰テスト: `tests/y2h-examples.test.js`）。

### ライセンス

`syllable-freq.json` は上記 2 つのコンテンツの翻案物（Adapted Material）として **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)** で提供します。CC BY-SA 3.0 は翻案物を同じ要素を持つ後続バージョン（4.0）で提供することを認めているため、2 つの出典を組み合わせて 4.0 で提供できます。リポジトリのソースコード（MIT License）とはライセンスが異なります。

頻度データを差し替える場合は、元データのライセンスが再配布・翻案を許可しているか、また CC BY-SA 4.0 との組み合わせに問題がないかを事前に確認してください。
