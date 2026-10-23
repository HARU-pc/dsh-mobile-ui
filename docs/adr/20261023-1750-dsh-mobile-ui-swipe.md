# dsh-mobile-ui のスワイプは document の passive touch 監視で実装する

- Status: accepted
- Date: 2026-10-23
- Task: T302（T301 / ADR-20261023-1720 の継続）

## Context

スマホでのサイドバー呼出と、右パネル（ファイル変更確認等）からチャットへ戻る操作に
スワイプが欲しい。iOS PWA（standalone/fullscreen）ではブラウザの画面端「戻る」
ジェスチャが無いため、アプリ側で提供する必要がある。

## 選択肢

1. **document への passive な touchstart/touchend 監視 + 公開サービス呼出**:
   preventDefault せず、終了時に距離・方向・起点で判定して
   `ctx.layout.toggleSidebar()` / `ctx.sidebarRight.toggleExpanded()` を呼ぶ。
2. **追従アニメーション付きドラッグ（pointermove で transform を直接操作）**:
   体感は良いが、React 管理下の要素への transform 介入と grid 再計算の競合、
   preventDefault による既存スクロールへの影響があり、ローカルオーバーレイの
   範囲を超える。

## 決定

選択肢 1。判定は touchend 一発（dx ≥ 60px かつ水平優勢 2:1）。

誤発火対策:
- 右スワイプ「戻る」は左端 28px 起点に限定
- 横スクロール可能な祖先（diff 等）をもつタッチは touchstart 時に判定して全方向除外
- 編集領域（textarea/input/contenteditable）内の開始は候補にしない
- touchend 時に非折り畳みのテキスト選択があれば中止（選択ハンドルのドラッグ）
- 優先順位: 右パネル表示中（isExpanded）はまず右パネルを畳む → 次にサイドバーを開く

## 理由

- 選択肢 2 の追従はオーナー（AppFrame/sidebar-right）の実装詳細に踏み込み、
  ADR-20261023-1720 が定めた「安定 data 属性と公開サービスのみに依存する」境界を破る。
- passive 監視はスクロール・慣性・ネイティブ操作を一切妨げず、壊れても
  「スワイプが効かない」だけに劣化する（安全側）。
- 独立レビュー（gpt-6.1-sol、workflow 経由）の指摘 2 件（横スクロールガードの
  右スワイプ側適用漏れ、非編集テキスト選択の除外漏れ）を修正採用済み。

## 検証

- iPhone PWA 実機: 左端右スワイプでサイドバー開、左スワイプで閉、
  右パネル（ファイル変更確認）表示中の左端右スワイプでチャットへ戻ることを確認後に accepted。
- 2026-10-23: ユーザーが iPhone PWA 実機でスワイプ動作を確認（「うごいた」）。閾値
  （端 28px / 距離 60px）への不満報告なし。
