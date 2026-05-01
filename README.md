# Hangul ↔ Yale Romanizer
<p align="center">
  <img src="assets/logo/han_y.png" width="160" alt="Hangul ↔ Yale Romanizer logo">
</p>

## 概要

ハングルとイェール式ローマ字(Yale Romanization)を相互に変換します。

主な機能:
- 入力したハングルをイェール式ローマ字に自動変換
- イェール式ローマ字からハングルへの逆変換（ビームサーチDPによる確率的変換）
- 原文（ハングル）とイェール式ローマ字を上下に並べて表示
- 変換履歴を`localStorage`に最大10個まで保存
- 字母区切り文字を挿入可能
- ハングル字母とそれに対応するイェール式表記を参照可能

---

## 使い方
- インターネットに接続可能な環境では[ウェブアプリケーション](https://hangul-yale-romanizer.netlify.app/)に接続

- ローカルで動かす場合はリポジトリをクローンし、ローカルサーバー経由で開いてください:
  ```bash
  python3 -m http.server 8080
  # または
  npm run dev
  ```
  ブラウザで http://localhost:8080 にアクセス。
  ※ ES Modules を使用しているため、`index.html` を直接開く（`file://`）方式では動作しません。

---

## 開発

### テスト

変換ロジックの単体テストを Node 標準の test runner で実行できます（依存パッケージなし、Node 18+）。

```bash
npm test
# または
node --test tests/
```

---

## Yale → ハングル変換について

### 曖昧性の問題

イェール式ローマ字は、一つのローマ字列が複数のハングル音節列に対応する場合があります。例えば `cenel` は「저널」にも「전얼」にも解釈できます。この曖昧性を解消するため、本ツールでは統計的手法を用いています。

### 変換アルゴリズム

1. 入力されたYale文字列を `.` や `-` で区切り、各セグメントに対して可能な音節分割をすべて列挙します（DAGグラフの構築）。
2. **ビームサーチDP**（ビーム幅 K=5）により、以下のスコアを組み合わせて最適な音節列を選択します:
   - **ユニグラムスコア**: 各音節の出現頻度
   - **バイグラムスコア**: 隣接する音節ペアの共起頻度
   - **単語ボーナス**: 辞書に登録された2〜6音節の単語に対する追加スコア

### 精度と限界

変換精度はコーパスのカバレッジに依存します。以下のような場合、誤変換が生じる可能性があります:

- コーパスに含まれない低頻度語（例: 専門用語、外来語）
- バイグラム・単語辞書のいずれにも登録されていない語の組み合わせ

誤変換が生じた場合は、`.` や `-` を入力して音節境界を明示することで、正しい変換結果を得ることができます（例: `ce.nel` → 저널）。

---

## 出力形式

論文・ドキュメントへの貼り付けを想定した4種類の出力形式に対応しています。出力形式は変換結果コピーボタンの右側のチップで切り替え可能です（選択は次回起動時にも保持）。

### Plain
従来通りの素のテキスト出力。コピー時は半角空白がタブに置換されます（Wordでのグロス作成用）。

### Gloss (Leipzig Glossing Rules — TSV)
原文と変換結果を上下2行に並べ、語ごとにタブで区切ります。「例文番号」スイッチをONにすると `(1) (2) (3)…` の通し番号が付与されます。

```
(1)	한국어를	공부	한다
   	hankwuk-elul	kongpwu	hanta
```

### LaTeX (`gb4e` 形式)
言語学論文で標準的に使われる `gb4e` パッケージの構文で出力します。`\trans` 行は空欄なので訳文を後から挿入してください。

```latex
\begin{exe}
\ex
\gll 한국어를 공부 한다 \\
     hankwuk-elul kongpwu hanta \\
\trans `'
\end{exe}
```

### Markdown 表
GitHub・Notion・Obsidian にそのまま貼り付け可能な表形式。例文ごとに表を分割します（語数が異なる例文を1つの表に合わせるとカラム数が合わないため）。

```markdown
| 한국어를 | 공부 | 한다 |
|---|---|---|
| hankwuk-elul | kongpwu | hanta |
```

---

## コピー機能
- 「変換結果コピー」ボタンを押すと、「変換結果」に表示されている内容を、半角空白の代わりに「タブ」を挿入してコピーします。
- 半角空白を保持したままコピーをするには、「変換結果」にある内容をドラッグ＆ドロップすることで、コピーできます。
- 「ハングルと並べて見る」に表示されている内容は、例文をクリックすると、「タブ」を挿入してコピーします。

「半角空白」の代わりに「タブ」を挿入している理由は、Wordなどで[グロス](https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%AD%E3%82%B9_(%E8%A8%80%E8%AA%9E%E5%AD%A6))を付けるときに、複数行の調整が便利だからです。

<p align="center">
  <img src="assets/screenshots/gloss.png" alt="グロス作成の例">
</p>

---

## スクリーンショット
<p align="center">
  <img src="assets/screenshots/screencapture.png" alt="Hangul ↔ Yale Romanizer スクリーンショット">
</p>

---

## データソース

Yale→ハングル変換の頻度データ (`data/syllable-freq.json`) は、以下のデータから生成されています:

- **[Hermit Dave / FrequencyWords](https://github.com/hermitdave/FrequencyWords)** by Hermit Dave
  - コンテンツライセンス: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  - データソース: [OpenSubtitles](https://www.opensubtitles.org/) 2018 Korean corpus (`ko_*.txt` 파일 기반)

頻度データには、ユニグラム（音節頻度）、バイグラム（音節ペア頻度）、および単語頻度（2〜6音節）が含まれています。

---

## 参考プロジェクト

このプロジェクトは、MIT licenseで公開されている以下のプロジェクトを参考にしています:

- **[asaokitan / hangul2yale](https://github.com/asaokitan/hangul2yale)** by 淺尾 仁彦
- **[stannam / hangul_to_ipa](https://github.com/stannam/hangul_to_ipa)** by Stanley Nam
---