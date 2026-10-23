# 自動テストは node:test + happy-dom で lib/client.js を直接読み込む

- Status: accepted
- Date: 2026-10-24
- Task: T308

## Context

これまで自動テストが無く、検証は iPhone 実機での目視だけだった。docs/spec.md の契約（判定表・状態同期・dispose）を
回帰から守りたい。プラグインは DSH の ModuleLoader 経由でブラウザ上でだけ動き、ビルド工程を持たない。

## 選択肢

1. node:test + happy-dom（devDependency 1 個）。ModuleLoader と ctx は偽装する。
2. node:test + jsdom。
3. Playwright で実ブラウザ（Chromium）。

## 評価基準

プラグインが依存する DOM 機能を環境が提供すること（`:has()` を含む CSS カスケード、`@media` の評価、matchMedia、
`inert`、Touch/TouchEvent、MutationObserver）。加えて、依存の数と CI の所要時間。

## 結果（比較実験、tmp で実施。2026-10-24、happy-dom 20.14.6 / jsdom 27.4.0 / Node 24.22.1）

| 機能 | happy-dom | jsdom |
|---|---|---|
| `:has()` の querySelector と、それを使ったカスケード | ○ | ○ |
| `@media (max-width)` を CSS カスケードで評価 | ○（幅 390 で適用） | ×（幅 1024 固定で不適用） |
| matchMedia | ○（pointer 特性は評価しないため差替え） | × 未実装 |
| `inert` プロパティ | ○ | × |
| Touch コンストラクタ | ○ | × |
| visualViewport | × | × |

## 決定

選択肢 1。visualViewport と、matchMedia の pointer 判定は、ハーネス（test/harness.mjs）で差し替える。

## 理由

- jsdom は matchMedia・inert・Touch が無く、差し替えが多い。PHONE 幅の CSS も評価できない。
- Playwright は実ブラウザの忠実度が最も高いが、ブラウザのダウンロードと CI 時間が要る。そのうえ iOS Safari / PWA 固有の挙動
  （visualViewport、キーボード、ピンチ）は Chromium では再現できないため、実機確認は残る。今回は判定ロジックと DOM 契約の
  回帰防止が目的なので見送る。iOS 固有の問題を扱う段階になったら再検討する。
- 制限: happy-dom はレイアウトしない。scrollWidth などの寸法はテストで与える。transition や視覚の検証はできない。

## 検証

- 18 テストが通過。変異 8 種（端 28→40px、半分→全幅、frame 外ガード削除、inert 条件変更、style 撤去削除、開く側の PHONE 条件削除、visualViewport の COARSE 条件削除、ドロワー表示中ガード削除）が
  それぞれ 1 件以上のテストを赤にすることを確認した（2026-10-24）。
