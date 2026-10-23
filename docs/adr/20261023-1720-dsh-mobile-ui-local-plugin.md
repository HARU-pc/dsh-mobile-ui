# DSH Web のスマホ対応をローカル client プラグイン（CSS/DOM オーバーライド）で行う

- Status: accepted
- Date: 2026-10-23
- Task: T301

## Context

DSH Web GUI（@deepseek-ai/dsh-web-frontend 0.2.0-rc.2）は iPhone PWA / iPad での利用時に
(1) 右パネルのトラック最小幅 400px 由来の横はみ出し、(2) 狭幅でサイドバーが中央を圧迫
（darwin ホストでは collapsedWidth=0 のため開閉手段もほぼ無い）、(3) iOS でキーボードが
入力欄に重なる・フォーカス時に自動ズームする、という問題がある。ビルド済み dist の CSS には
幅ベースの media query が無く（prefers-reduced-motion のみ）、モバイル対応は未実装。

## 選択肢

1. **ローカル client プラグイン**（dsh-font-ja と同方式）: data 属性・DOM 構造だけに依存する
   CSS 注入 + viewport meta 書換 + visualViewport 追従 + ctx.layout.toggleSidebar() を呼ぶ
   FAB/バックドロップ。再ビルド不要、`profiles/web/cordis.patch.yml` に insert。
2. **upstream ソースの fork・再ビルド**: AppFrame 等を直接修正。根本対応できるが、
   checkout はグローバル pnpm 配下の配布物で、更新ごとに patch 維持と再ビルドが必要。

## 評価基準

- 今の URL（dsh web 稼働中サーバ）へリロードだけで反映できること
- DSH のバージョン更新（クラスハッシュ変化）に対する耐性
- 失敗時に insert 1 行の削除で完全に戻せること

## 決定

選択肢 1（ローカル client プラグイン dsh-mobile-ui）。

セレクタはハッシュ化クラス名を避け、安定した data 属性（`data-rightbar-col`、
`data-sidebar-collapsed`、`data-side`、`data-lexical-editor`）と構造（frame =
`[data-rightbar-col]` の親、sidebar = その first-child）だけに依存する。
状態連携は公開サービス `ctx.layout`（LayoutController.toggleSidebar）経由とし、
内部ストアへは触れない。

主な介入:
- `max-width: 767px` でサイドバーを fixed のドロワー化（grid フロー外へ出し、残る in-flow の
  center が第 1 列 `minmax(0,1fr)` に自動配置される。横はみ出し解消）、リサイズハンドル非表示
- バックドロップは frame の `::after`（z-index 59、drawer は 60）として同一 stacking context に
  置き、閉操作は document の pointerdown 捕捉で代行。FAB は閉時のみ表示し、
  `ctx.layout.toggleSidebar()`（公開サービス）を呼ぶ。閉時は sidebarCol を inert 化、Escape で閉
- viewport meta に `maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content`
  を設定し、入力系（input/textarea/select/lexical/contenteditable）を 16px に
  （iOS フォーカスズームの二重対策）
- visualViewport の実高さを `--dsh-mobile-vvh` に反映し、`(max-width:1023px) and (pointer:coarse)`
  下の #root の高さに使用（iOS PWA でキーボードがレイアウトをリサイズしない問題の補正）。
  JS 側も同条件の matchMedia でゲートし、デスクトップではスクロール補正を行わない
- standalone/fullscreen 表示での safe-area padding（上下左右）
- CSS 注入を含むすべての DOM 介入を ctx.effect の dispose で撤去する

## 理由

- 比較実験は 2 案の実装コスト差が大きく同条件比較が不能なため、構成事実で代替する:
  fork 案は配布物（pnpm global 配下）の再ビルド経路を新設する必要があり、
  「リロードだけで反映」「insert 1 行で撤去」を満たさない。
- :has() と data 属性セレクタは iOS 15.4+ で利用可能。非対応環境では media query ごと
  効かず従来表示に劣化する（安全側）。
- 既知の制約: DOM 構造（first-child = sidebarCol）への依存は将来の AppFrame 変更で壊れうる。
  壊れた場合も従来表示に戻るだけで機能喪失はない。maximum-scale=1 は Android の
  ピンチズームを制限する（iOS はアクセシビリティ上書きで無視）。

## 検証

- iPhone PWA / iPad 実機で、横はみ出し解消・ドロワー開閉・キーボード重なり・
  フォーカスズーム抑止を確認後に accepted へ進める。
- 2026-10-23: ユーザーがスマホ実機（iPhone PWA）から DSH Web 経由で動作確認・返信。
  リロードのみで反映されることも同時に確認（patch 層ホットリロード + 対象プラグイン読込）。
