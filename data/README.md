# data/

## syllable-freq.json

Yale→ハングル変換（ビームサーチ）で使う頻度データです。

| キー | 内容 |
|---|---|
| `u` | 音節ユニグラム（log10 確率） |
| `b` | 語内の音節バイグラム（log10 確率、出現 2 回以上） |
| `w` | 2〜6 音節の単語（log10 確率、上位 6,000 語） |

### 出典

- **[FrequencyWords](https://github.com/hermitdave/FrequencyWords)** © Hermit Dave — `content/2018/ko/ko_50k.txt`
  - コンテンツのライセンス: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（リポジトリのコード部分は MIT）
  - 元データ: [OpenSubtitles2018](https://opus.nlpl.eu/OpenSubtitles2018.php)（OPUS）の韓国語字幕コーパス

### 加工内容

[`scripts/gen_syllable_freq.py`](../scripts/gen_syllable_freq.py) で、上記の単語頻度リストから音節単位の頻度を集計し、log10 確率に変換・閾値で絞り込みました。

### ライセンス

`syllable-freq.json` は上記コンテンツの翻案物（Adapted Material）として **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)** で提供します。リポジトリのソースコード（MIT License）とはライセンスが異なります。

頻度データを差し替える場合は、元データのライセンスが再配布・翻案を許可しているか、また CC BY-SA 4.0 との組み合わせに問題がないかを事前に確認してください。
