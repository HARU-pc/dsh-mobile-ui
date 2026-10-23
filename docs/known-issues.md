# 既知の問題

対象: `lib/client.js`（ブランチ `chore/dev-infra` 時点）、`@deepseek-ai/dsh-web-app` 0.2.0-rc.2。
各項目は GitHub issue に転記する前提の草稿で、転記したら issue 番号を追記する（public リポジトリのため、起票は承認後に行う）。
特記のない限り、コードと DSH 配布物を読んで導いた推定であり、実機では観測していない。

**モバイルへの影響の目安**: iPhone のソフトウェアキーボードには Escape キーが無い。そのため Escape 起点の問題（KI-1、KI-7）は、
外付けキーボード（iPad の Magic Keyboard、Bluetooth キーボードなど）を使うときだけ起きる。

| ID | 概要 | 影響範囲 | 状態 |
|---|---|---|---|
| KI-1 | Escape で閉じた後、フォーカスが FAB に戻らない | 外付けキーボード | 未着手 |
| KI-2 | ピンチズームで `#root` の高さが縮む | KI-8 次第 | 保留 |
| KI-3 | reduced-motion 設定でも閉じるアニメーションが残る | 視差効果を減らす設定の利用者 | 未着手 |
| KI-4 | iPad 横（≥1024px）ではスワイプが効かない | iPad | 検討中 |
| KI-5 | モーダルなど前面の UI 上のスワイプが、背後のレイアウトを操作する | スマホ | 未着手 |
| KI-6 | coarse 判定へ戻ったとき、キーボード追従の高さを再計算しない | ほぼ無し | 記録のみ |
| KI-7 | ドロワーとモーダルが同時に開いた状態で Escape を押すと、両方とも閉じる | 外付けキーボード | 未着手 |
| KI-8 | ピンチによる拡大縮小が効かない | iPhone PWA（実機で報告あり） | 未着手 |

## KI-1 Escape で閉じた後、フォーカスが FAB に戻らない（旧 Q1）

- **現象（推定）**: `onKeyDown` は、`toggle()` の直後に同期的に `fab.focus()` を呼ぶ（[client.js](../lib/client.js) の Escape ハンドラ）。
  FAB は `body[data-dsh-mobile-sidebar=closed]` のときだけ表示されるが、この属性は MutationObserver のコールバックで後から更新される。
  したがって `focus()` を呼んだ時点の FAB はまだ `display:none` で、フォーカスできない。さらに、閉じたドロワーは inert になるため、
  フォーカスの行き先は UA 次第になる。
- **期待**: 閉じた後、フォーカスが FAB に移る。
- **修正案**: `syncState()` を先に同期的に呼んでから `focus()` する。または `requestAnimationFrame` の後で focus する。
- **テスト**: happy-dom は `display:none` の要素でも focus できてしまう可能性があるため、検査の方法を併せて検討する。

## KI-2 ピンチズームで `#root` の高さが縮む（旧 Q3）

- **現象（推定）**: `visualViewport.resize` は scale を区別せず、`--dsh-mobile-vvh` に `visualViewport.height` を入れる。
  倍率 2 なら、レイアウト座標上の `#root` の高さは半分になる。
- **状態**: KI-8（そもそもピンチが効かない）を直すまでは発生しない。KI-8 を直すときに同時に扱う。
- **修正案**: `vv.scale` が 1 から十分に離れている間は更新しない。またはキーボードによる縮みだけを反映する。

## KI-3 reduced-motion 設定でも閉じるアニメーションが残る（旧 Q6）

- **現象（CSS の読解による）**: 閉時のセレクタ `[data-sidebar-collapsed]:has(> [data-rightbar-col])>:first-child` の詳細度は (0,3,0) で、
  reduced-motion 側の `:has(> [data-rightbar-col])>:first-child` の (0,2,0) より高い。このため、閉じるときは `transition:transform .25s, visibility 0s .25s` が残る。
- **修正案**: reduced-motion 側に、閉時のセレクタと同じ詳細度のルールを追加する。
- **テスト**: happy-dom の CSS カスケードで、computed の `transition` を検査できるか確認する。

## KI-4 iPad 横（≥1024px）ではスワイプが効かない（旧 Q4）

- **現状**: スワイプは `(max-width:1023px) and (pointer:coarse)` の範囲でしか動かない。そのため、iPad 横では右パネルから「戻る」スワイプが無い。
  768–1023px（iPad 縦）で有効なスワイプは、右パネルを畳む操作だけである。
- **状態**: 検討中。iPad 実機での確認が未実施のため、必要かどうかを判断できていない。確認する点は次の 3 つ。
  1. 横向きで、右パネルの閉じるボタンだけで不便がないか。
  2. 縦向きで「戻る」スワイプが動くか。
  3. DSH 標準のレール表示とスワイプが衝突しないか。

## KI-5 前面 UI 上のスワイプが背後のレイアウトを操作する（旧 Q7）

- **現象（推定）**: touch のリスナーは起点の要素を限定していない。pointerdown 側の「frame 外は触らない」ガードが touch 側には無い。
  再現例: 幅 390px の coarse 端末で、`document.body` へ portal された Modal 上を (20,100)→(100,100) と単指でなぞる。
  背後の右パネルが展開中ならそれが畳まれ、そうでなければ背後のサイドバーが開く。
- **修正案**: touchstart で起点が frame 外なら候補にしない（pointerdown と同じ境界にそろえる）。
  これは軽微な修正で、テストも書ける（`harness.mjs` に portal 要素を足す）。

## KI-6 coarse 判定へ戻ったとき、キーボード追従の高さを再計算しない（旧 Q9）

- **現象**: `(pointer:coarse)` の change を監視していない。coarse → fine → coarse と切り替わる間に visualViewport の高さが変わると、
  次の resize まで古い高さが `#root` に残る。
- **モバイルへの影響の評価**: iPhone では primary pointer が常に coarse なので、この経路は起きない。
  iPad にトラックパッド付きキーボードをつないだときに `(pointer:coarse)` が変わるかどうかは未確認（推定では変わらない）。
  幅の変化（回転）では `vv.resize` も発火するため、高さは更新される。結論として、実用上の影響はほぼ無いと判断し、記録だけにとどめる。
- Escape との関係: 無い（KI-1・KI-7 とは独立した問題）。

## KI-7 ドロワーとモーダルが同時に開いた状態で Escape を押すと、両方とも閉じる（旧 Q8）

- **現象（推定）**: DSH の `Modal`（primitives 0.2.0-rc.2 の `useModalLayer`）は、document の keydown で Escape を処理する。
  このとき `preventDefault()` は呼ぶが、`stopPropagation()` は呼ばない。本プラグインの keydown リスナーは `defaultPrevented` を見ないので、
  ドロワーも閉じる。ただし Modal のリスナーが後に登録されて後に実行される場合は、`defaultPrevented` を見ても防げない。
- **修正案**: `event.defaultPrevented` を確認する。あわせて、`[aria-modal=true]` が存在する間は Escape を無視する。
- **影響**: 外付けキーボードのときだけ起きる。

## KI-8 ピンチによる拡大縮小が効かない（旧 Q5）

- **観測**: オーナーが iPhone PWA の実機で「ピンチ操作での拡大縮小がそもそも効かない」と報告した（2026-10-24）。
  これは spec.md と README の「iOS は手動ピンチでは maximum-scale を無視する」という前提と食い違う。
- **原因の仮説（未検証）**:
  1. 本プラグインが viewport meta に付ける `maximum-scale=1`。iOS がこれを無視するのは Safari のタブでの話で、
     ホーム画面の Web アプリ（standalone）では尊重される可能性がある。
     WebKit の埋め込み向け API には、作者の指定を上書きするかどうかの設定 `ignoresViewportScaleLimits`（既定は false）がある
     （[Apple Developer: ignoresViewportScaleLimits](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/ignoresviewportscalelimits)、2026-10-24 web_fetch で取得）。
     つまり「無視するかどうかはブラウザ側の設定次第」であり、standalone での既定値は一次資料で確認できていない。
  2. DSH 本体のアプリ外枠（`#root` の固定高さ、`overflow:hidden` など）。DSH の index.html の viewport は
     `width=device-width, initial-scale=1` だけで、ズームを禁止していない（dsh-web-frontend 0.2.0-rc.2 の dist/index.html）。
- **切り分け**: `cordis.patch.yml` からプラグインを外して再読込し、ピンチが効くかを試す。効けば仮説 1 になる。
- **修正案**: `maximum-scale=1` をやめる。フォーカス時の自動ズームは、入力 16px 化のルールだけで防げる見込み。
  修正後は KI-2 が顕在化するため、同時に扱う。
