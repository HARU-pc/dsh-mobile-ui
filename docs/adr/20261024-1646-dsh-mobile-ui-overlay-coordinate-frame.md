# body 直下へ portal される固定オーバーレイを #root と同じ座標系へ寄せる

- Status: accepted
- Date: 2026-10-24
- Task: T319（issue #11 / KI-10）

## Context

iPhone PWA の実機で、モデル選択メニュー（DSH の `ModelSelect`。`document.body` へ portal される
`position:fixed` のメニュー）が、キーボード表示中に画面上端の外へ出る不具合が報告された（2026-10-24）。

ADR-20261024-0450 で `#root` を `position:fixed` にし、`top` を `visualViewport.offsetTop`、
`height` を `visualViewport.height` に追従させた。これでアプリ本体は見えている範囲に留まる。
一方、body 直下へ portal される固定オーバーレイは `#root` の外にあり、この補正を受けない。

実機の計測（一時診断バッジ。キーボード表示中）では、次が同時に起きていた。

- アプリ本体（`#root`）は見えている範囲の先頭に正しく居る。
- メニューの `getBoundingClientRect()` は `top = -25`（可視範囲の外）。
- 同じ `top` を持つ一時診断のバッジ（body 直下の `position:fixed`）も上端が欠ける。

DSH の `ModelSelect` は `place()` で `trigger.getBoundingClientRect()` と `window.innerHeight` から
`position:fixed` の `left` / `top` を計算し、`MARGIN = 12` でクランプする。再配置の契機は
`window` の `scroll`（capture）と `resize` だけで、`visualViewport` は購読していない。

## 仮説

iOS はキーボードで visual viewport をパンしている間、`getBoundingClientRect()` を可視範囲（visual viewport）基準で
返すが、`position:fixed` の `top` は layout viewport 基準のまま解釈する。この 2 つの座標系は
`visualViewport.offsetTop` だけ異なる。

そのため、body 直下の固定オーバーレイは、`#root` を補正した後も `offsetTop` の分だけ上へずれる。
DSH の `place()` が可視基準の rect から layout 基準の `top` を計算し、さらに layout 基準の `MARGIN` で
クランプするため、キーボード表示中は offsetTop の分だけずれた位置に確定する。
`window` へ `resize` を再送して `place()` を再実行しても、座標系の混在は残るため直らない
（実機で確認済み）。

## 選択肢

1. body 直下の `position:fixed` 要素を plugin が検出して印を付け、COARSE のあいだ
   `translate: 0 var(--dsh-mobile-vvtop)` で `#root` と同じ補正を与える。
2. メニューの `top` を JavaScript で読み直して `offsetTop` を足す（DSH の再配置のたびに補正し直す）。
3. DSH 本体を変更し、`place()` を `visualViewport` 基準にする（本リポジトリの方針に反する）。
4. キーボードを出さない（粗いポインタでは検索欄へ自動フォーカスしない）。検索の使い勝手を落とす。

## 評価基準

- iPhone PWA で、キーボード表示中もモデル選択メニューが見えている範囲に収まること。
- キーボードを閉じた状態（offsetTop = 0）で見た目が変わらないこと。
- メニューが開いた直後・スクロール中・キーボードの出入りのいずれでも破綻しないこと。
- DSH の配置計算を壊さないこと（トリガーの rect は `#root` の中なので補正の影響を受けない）。
- fine pointer・1024px 以上では何もしないこと（自動テストで確認する）。

## 決定

選択肢 1。あわせて、`visualViewport` の `resize` / `scroll` で可視範囲の丸め値が変わったとき、
`window` へ `resize` を再送して DSH の `place()` を再実行させる（座標系の補正だけでは、
キーボード表示後にトリガーが動いた分の再配置が起きないため）。

対象は `COARSE` のときの body 直下の固定要素で、次を除く。

- `#root`（`top` で別途補正している）。
- layout viewport 全体を覆うレイヤ（`inset:0` の Modal 等）。キーボード表示中のずれは高さの問題で、
  平行移動では直らない。中央寄せを悪化させないため触らない（別問題として残す）。

## 理由

- 印は `data-dsh-mobile-overlay` という安定した属性で付け、対象は「body 直下かつ computed position が
  fixed」という構造だけで決める。hashed class や DSH の内部 API に依存しない（ADR-20261023-1720）。
- `translate` は位置プロパティ（`top` / `left`）を書き換えないため、DSH が `offsetWidth` /
  `offsetHeight` / トリガーの rect から位置を計算する処理と競合しない。
- 2 は DSH の再配置のたびに介入する必要があり、順序（DSH の `setState` と補正の適用）に依存する。
- 3 はこのリポジトリの前提（DSH 本体を変更しない）に反する。上流へは別途報告する。
- 4 は検索の使い勝手を落とし、キーボードを出さない経路でも（外付けキーボードなど）再発しうる。

## 既知のリスク

- `translate` は要素に containing block を作る。body 直下のオーバーレイの中に `position:fixed` の
  子要素があると、その子の基準が変わる。DSH のメニュー・モーダル・トーストでは確認できていない。
- 全画面レイヤ（Modal）は対象外。キーボード表示中にダイアログが可視範囲の中央に来ない問題は残る。
- 対象は body 直下の fixed 要素すべて（全画面レイヤと `#root` を除く）なので、DSH 以外が追加した
  オーバーレイにも適用される。
- offsetLeft（横方向のパン）は補正しない。現在の症状は縦方向のみ。
- `visualViewport` の縮小（キーボード）とパン（offsetTop）を区別しない。ピンチズーム時は KI-2・KI-8 の扱いと合わせて再検討する。
- 印は追加時点の computed position で決める。追加後に fixed になった要素や、非 fixed のラッパー配下の
  fixed 要素は対象にならない。現在の DSH（0.2.0-rc.2）はメニュー等を body 直下へ直接 portal する。

## 検証

- 自動テスト（`npm test`、20 件）: 固定要素に印が付くこと、`#root` と通常フローの要素には付かないこと、
  `COARSE` 外では印も `resize` も出さないこと、CSS の補正規則が `COARSE` の media 内にあること、
  dispose 後に印も `resize` も出ないこと、可視範囲の丸め値が変わったときだけ `resize` を再送することを確認した。
  変異テストで、初期化時の再送、`#root` の除外、observer の disconnect、COARSE ゲート、再送の削除、
  media 内の CSS、旧実装のそれぞれがテストを赤にすることを確認した。
- 実機: 2026-10-24、オーナーが iPhone PWA（キーボード表示中）で次の 2 点を確認し、いずれも OK と回答した。
  1. モデル一覧の検索欄と上端が欠けずに収まる。
  2. 一覧の外側の余白をスクロールしても一覧が上へ逃げない。
- 実機の数値（一時診断。修正前）: キーボード閉 `menu 335..703 / trg 711..739`、
  キーボード開 `menu -25..343 / trg 290..318`。修正後は診断を外しているため数値の再取得はしていない。
