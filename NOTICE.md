# NOTICE

## このリポジトリのライセンス

| 対象 | ライセンス |
|---|---|
| ソースコード（下記以外のすべて） | MIT License — [LICENSE](LICENSE) © 2025-2026 Seo Mincheol |
| 頻度データ `data/syllable-freq.json` | CC BY-SA 4.0 — [data/README.md](data/README.md) |

## 頻度データの出典

`data/syllable-freq.json` は次の 2 つを加工して作成しました。加工内容は [data/README.md](data/README.md) を参照してください。

- **韓国語版ウィキペディア**（© ウィキペディアの執筆者、[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)）— [kowikitext](https://github.com/lovit/kowikitext)（lovit）が 2020-09-20 のダンプから作成したテキストを使用
- **[FrequencyWords](https://github.com/hermitdave/FrequencyWords)**（© Hermit Dave、コンテンツは [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)）— OpenSubtitles2018 に基づく韓国語単語頻度リスト `ko_full.txt`

## 同梱しているオープンソースソフトウェア

ビルドしたウェブアプリには React、Radix UI、lucide-react、sonner、Tailwind CSS などのパッケージが含まれます（MIT / ISC / Apache-2.0 / 0BSD）。各パッケージのライセンス全文は、ビルド時に `scripts/gen-third-party-licenses.mjs` が `third-party-licenses.txt` として生成し、アプリと一緒に配信します（フッターのリンクから参照可能）。

## フォント

Inter、JetBrains Mono、Noto Sans KR、Noto Sans JP を Google Fonts から読み込んでいます（SIL Open Font License 1.1）。フォントファイル自体はこのリポジトリに含まれていません。

## 参考にしたプロジェクト

実装はこのリポジトリ独自のものですが、以下のプロジェクトを参考にしました（いずれも MIT License）。

- [asaokitan/hangul2yale](https://github.com/asaokitan/hangul2yale) — Copyright (c) 2013 asaokitan
- [stannam/hangul_to_ipa](https://github.com/stannam/hangul_to_ipa) — Copyright (c) 2022 stannam
