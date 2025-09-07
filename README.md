# Hangul → Yale Romanizer
<p align="center">
  <img src="assets/logo/han_y.png" width="160" alt="Hangul → Yale Romanizer logo">
</p>

## 概要

ハングルをイェール式ローマ字(Yale Romanization)に変換します。

主な機能:
- 入力したハングルをイェール式ローマ字に自動変換
- 原文（ハングル）とイェール式ローマ字を上下に並べて表示
- 変換履歴を`localStorage`に最大10個まで保存
- 字母区切り文字を挿入可能
- ハングル字母とそれに対応するイェール式表記を参照可能
---

## 使い方
- インターネットに接続可能な環境では[ウェブアプリケーション](https://hangul-yale-romanizer.netlify.app/)に接続

- インターネットに接続できない環境では、ファイルをローカルにダウンロードし、`index.html`を開くことですぐに利用可能

---

## コピー機能
- 「変換結果コピー」ボタンを押すと、「変換結果」に表示されている内容を、半角空白の代わりに「タブ」を挿入してコピーします。
- 半角空白を保持したままコピーをするには、「変換結果」にある内容をドラッグ＆ドロップすることで、コピーできます。
- 「ハングルと並べて見る」に表示されている内容は、例文をクリックすると、「タブ」を挿入してコピーします。

「半角空白」の代わりに「タブ」を挿入している理由は、Wordなどで[グロス](https://ja.wikipedia.org/wiki/%E3%82%B0%E3%83%AD%E3%82%B9_(%E8%A8%80%E8%AA%9E%E5%AD%A6))を付けるときに、複数行の調整が便利だからです。

<p align="center">
  <img src="assets/screenshots/gloss.png" alt="Hangul → Yale Romanizer logo">
</p>

---

## スクリーンショット
<p align="center">
  <img src="assets/screenshots/screencapture.png" alt="Hangul → Yale Romanizer logo">
</p>
 
---

## 参考プロジェクト

このプロジェクトは、MIT licenseで公開されている以下のプロジェクトを参考にしています:

- [asaokitan/hangul2yale](https://github.com/asaokitan/hangul2yale)
- [stannam/hangul_to_ipa](https://github.com/stannam/hangul_to_ipa)
---