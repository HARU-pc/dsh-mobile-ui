# dsh-mobile-ui 仕様

対象: `lib/client.js`（コミット 74cd779 時点）、`@deepseek-ai/dsh-web-app` 0.2.0-rc.2（web プロファイル）。
本書は現在の仕様の正本である。決定の経緯は [ADR](adr/README.md) にあり、本書には書き写さない。
実装と ADR から確認した内容だけを載せる。未確定の挙動は「未確定」と明記し、[§9](#9-未確定事項確認質問) に確認質問として挙げる。

## 1. スコープ

DSH Web GUI をスマホ・タブレットで使うためのローカル client プラグイン。DSH 本体のコードは変更しない。
次の 4 系統の介入を行う。

| 系統 | 有効条件 | 節 |
|---|---|---|
| ドロワー化レイアウト・FAB・バックドロップ・Escape | `PHONE`（§2） | §4 |
| スワイプジェスチャ | `COARSE`（§2）。動作ごとに `PHONE` も要る | §5 |
| キーボード追従・入力 16px | `COARSE` | §6 |
| viewport meta の書換 | 常時（幅・ポインタで分けない） | §6 |
| セーフエリア padding | 幅 ≤1023px かつ `display-mode` が standalone / fullscreen | §6 |

## 2. 用語と判定条件

| 名前 | 定義 | 根拠 |
|---|---|---|
| `PHONE` | `(max-width:767px)` | [client.js:11-13](../lib/client.js#L11-L13) |
| `COARSE` | `(max-width:1023px) and (pointer:coarse)` | [client.js:15](../lib/client.js#L15) |
| frame | `[data-rightbar-col]` 要素の親（DSH AppFrame の grid 要素） | [client.js:125](../lib/client.js#L125) |
| sidebarCol | frame の先頭の子要素 | [client.js:25](../lib/client.js#L25)、[client.js:148](../lib/client.js#L148) |
| 開／閉 | frame に `data-sidebar-collapsed` が無ければ開、あれば閉。frame が無ければ常に閉として扱う | [client.js:126-129](../lib/client.js#L126-L129) |
| 右パネル展開 | `ctx.sidebarRight.isExpanded()` が true | [client.js:272](../lib/client.js#L272) |

768–1023px は DSH 本体の狭幅挙動（<1024px でレール化し、トグルでオーバーレイ展開）に任せ、本プラグインはレイアウトを変えない。

## 3. 依存する外部契約

本プラグインは、DSH の次の契約だけに依存する。ハッシュ化クラス名や内部ストアには依存しない（ADR-20261023-1720）。

| 契約 | 提供元（0.2.0-rc.2 で確認） | 用途 |
|---|---|---|
| `data-rightbar-col` 属性。親が frame であること | ui-layout `RightbarColumn` | frame の特定 |
| frame の子の順序が sidebarCol → centerCol → rightbarCol であること | ui-layout `AppFrame`（DocumentTitle は DOM を出さない） | sidebarCol の特定・grid 自動配置 |
| `data-sidebar-collapsed`（閉時のみ付く） | ui-layout `AppFrame` | 開閉状態の観測 |
| `data-side`（frame 直下の DragHandle） | ui-layout `DragHandle` | 非表示にする対象 |
| `data-lexical-editor` | チャット入力欄 | 16px 化の対象 |
| `ctx.layout.toggleSidebar()` | ui-layout `LayoutController`。<1024px では `narrowExpanded` を反転する | 開閉の唯一の操作経路 |
| `ctx.sidebarRight.isExpanded()` / `toggleExpanded()` | ui-sidebar-right。`isExpanded` は画面上のサーフェスが無ければ false | 右パネルを畳む |

不変条件 `SafeDegrade`（範囲限定）: `data-rightbar-col` が無くなって frame を特定できない場合、frame 用の CSS（ドロワー・バックドロップ・列）は一致しなくなる。JS 側は `body[data-dsh-mobile-sidebar=none]` となり、FAB は表示されない（[client.js:145](../lib/client.js#L145)）。
これは全面的な無介入への復帰ではない。次の介入は残る。
- `#root` の高さ、入力 16px、セーフエリア、viewport meta（frame に依存しない）
- スワイプ: frame が無くても isOpen()=false なので、右スワイプで `toggleSidebar()` を呼びうる

子の順序だけが変わった場合は CSS が一致し続け、別の先頭要素を fixed／inert にする。この場合は劣化ではなく誤作動になる。

## 4. ドロワー（`PHONE` のとき）

### 4.1 レイアウト（CSS、[client.js:19-45](../lib/client.js#L19-L45)）
- frame の `grid-template-columns` を `minmax(0,1fr) 0px 0px !important` にする。DSH がインライン style で指定する値より優先される。
- sidebarCol を `position:fixed`、幅 `min(85vw,300px)`、`z-index:60` のドロワーにする。grid のフローから外れるため、centerCol が第 1 列に入る。
- 閉時は `translateX(-110%)` と `visibility:hidden` で画面外へ出す。transition は .25s。`prefers-reduced-motion:reduce` で transition を無効にするのは開く側だけで、閉じる側は詳細度の差で .25s のまま残る（[KI-3](known-issues.md)）。
- 開時は frame の `::after` を `z-index:59`、`rgba(0,0,0,.35)` の全面バックドロップとして表示する。
- frame 直下の `[data-side]`（列リサイズ用ハンドル）を非表示にする。

### 4.2 状態同期（[client.js:142-169](../lib/client.js#L142-L169)）
MutationObserver が文書全体の childList と `data-sidebar-collapsed` の変化を監視し、そのたびに次を同期する。`PHONE` の変化時にも同期する。

| 出力 | 値 |
|---|---|
| `body[data-dsh-mobile-sidebar]` | frame 無し → `none`、開 → `open`、閉 → `closed` |
| FAB の `aria-expanded` | 開なら `"true"` |
| sidebarCol の `inert` | `PHONE ∧ 閉` のときだけ true |

### 4.3 操作
すべての開閉は `ctx.layout.toggleSidebar()` を呼んで行う。プラグインは開閉状態を自分で持たない。

| 入力 | 条件 | 結果 | 根拠 |
|---|---|---|---|
| FAB の click | FAB は `PHONE ∧ body=closed` のときだけ表示される | トグル（開く） | [client.js:47-55](../lib/client.js#L47-L55)、[client.js:174-177](../lib/client.js#L174-L177) |
| pointerdown（capture 段階） | `PHONE ∧ 開`、かつ target が sidebarCol 外・FAB 外・frame 内 | `preventDefault` と `stopPropagation` の後にトグル（閉じる） | [client.js:184-199](../lib/client.js#L184-L199) |
| keydown `Escape` | `PHONE ∧ 開` | トグル（閉じる）し、`fab.focus()` を呼ぶ | [client.js:205-210](../lib/client.js#L205-L210) |

不変条件 `BackdropOnlyInsideFrame`: frame 外の target（`document.body` 直下へ portal される Modal やメニューなど）への pointerdown では、ドロワーを閉じない。

## 5. スワイプ（`COARSE` のとき）

document 上の passive な `touchstart` / `touchend` / `touchcancel` で判定する。`preventDefault` は呼ばないため、ネイティブのスクロールを妨げない（ADR-20261023-1750）。

### 5.1 候補の確定（touchstart、[client.js:235-253](../lib/client.js#L235-L253)）
- 候補になるのは、`COARSE` かつ単指で、`textarea,input,[contenteditable=true]` の外から始まったタッチだけ。
- 開始時に、起点座標、`edge = x ≤ 28`、横スクロール祖先の有無、全祖先が左端にあるか（`scrollLeft ≤ 0`）を記録する。
  横スクロール祖先とは、`scrollWidth > clientWidth+1` かつ `overflow-x` が `auto` / `scroll` の祖先要素を指す（body は含まない）。
- `touchcancel` が来たら候補を破棄する。

### 5.2 判定（touchend、[client.js:254-287](../lib/client.js#L254-L287)）
`dx`、`dy` は終了点と開始点の差で、途中の軌跡は見ない。上から順に評価し、最初に該当した行で決まる。

| # | 条件 | 結果 |
|---|---|---|
| 1 | 候補なし、または `changedTouches` が 1 本でない | 何もしない |
| 2 | 空でないテキスト選択がある | 何もしない |
| 3 | `|dx| < 60` または `|dx| < 2|dy|` | 何もしない |
| 4 | `dx > 0`、横スクロール祖先あり、かつ一部が左端にない | 何もしない |
| 5a | `dx > 0`、`PHONE ∧ 開` | 何もしない（ドロワーの背後は見えないため。ADR-20261024-0420） |
| 5 | `dx > 0`、右パネル展開中 | `edge` なら `toggleExpanded()`（チャットへ戻る）。`edge` でなければ何もしない |
| 6 | `dx > 0`、`x > innerWidth/2` | 何もしない |
| 7 | `dx > 0` | `PHONE ∧ 閉` ならトグル（開く）。それ以外は何もしない |
| 8 | `dx < 0`、横スクロール祖先あり | 何もしない |
| 9 | `dx < 0` | `PHONE ∧ 開` ならトグル（閉じる）。それ以外は何もしない |

名前付き不変条件（§8 のテストで検査する）:
- `OpenOnlyWhenClosedPhone`: サイドバーを開くのは `PHONE ∧ 閉 ∧ x ≤ innerWidth/2` のときだけ。
- `CollapseOnlyFromEdge`: 右パネルを畳むのは起点 `x ≤ 28` のときだけ。
- `RightPanelFirst`: 右パネル展開中の右スワイプは、サイドバーを開かない（表の行 5 で終わる。ADR-20261023-1750 の優先順位）。
- `DrawerShadowsRightPanel`: `PHONE` でドロワーが開いている間、右スワイプは右パネルを畳まない（行 5a。ADR-20261024-0420）。

帰結として、768–1023px の coarse 端末（iPad 縦など）で有効なスワイプは、右パネルを畳む操作（行 5）だけになる。1024px 以上から始めたタッチはスワイプにならない（[KI-4](known-issues.md)）。`COARSE` と `PHONE` を検査する時点は異なる。`COARSE` は touchstart 時だけ、`PHONE` は touchend 時に検査する。

起点の要素は限定しない。frame 外（`document.body` へ portal されたモーダルなど）から始まったタッチも判定対象になる（[KI-5](known-issues.md)）。

## 6. viewport・キーボード・セーフエリア

- **viewport meta**（[client.js:95-103](../lib/client.js#L95-L103)）: `meta[name=viewport]` があれば、content を `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content` に置き換える。元の値は dispose 時に戻す。meta が無い場合は新規作成しない。この書換は幅にもポインタにも依存しない。
- **visualViewport 追従**（ADR-20261024-0450）: effect 登録直後に 1 回、その後は `visualViewport` の `resize`（キーボードの出入り）と `scroll`（パン）のたびに、`COARSE` なら次を設定する。
  - `--dsh-mobile-vvh` = `round(visualViewport.height)px`
  - `--dsh-mobile-vvtop` = `round(max(0, visualViewport.offsetTop))px`

  `COARSE` 下では `#root` を `position:fixed; left:0; right:0; top:var(--dsh-mobile-vvtop,0px); height:var(--dsh-mobile-vvh,100%)` とし、`html,body` を `overflow:hidden; overscroll-behavior:none` にする。
  変数が未設定の場合は、上端 0・高さ 100% にフォールバックする。ページ（window）はスクロールさせない。
  不変条件 `RootTracksVisualViewport`: `COARSE` の間に更新処理（起動時・resize・scroll）が走った直後は、`#root` が visual viewport の見えている範囲と（丸め誤差を除いて）重なる。遷移中や、KI-6 の経路では保証しない。
  `COARSE` の change は監視しないため、条件を外れた間も変数は前の値のまま残る（[KI-6](known-issues.md)）。
- **入力 16px**（`COARSE`、[client.js:62](../lib/client.js#L62)）: checkbox / radio 以外の input、textarea、select、`[data-lexical-editor]`、`[contenteditable=true]` に `font-size:16px !important` を指定する。iOS のフォーカス時自動ズームを抑止するためで、meta の `maximum-scale=1` との二重の対策になる。
- **セーフエリア**（[client.js:65-67](../lib/client.js#L65-L67)）: 幅 ≤1023px で standalone / fullscreen 表示のとき、`#root` の上下左右に `env(safe-area-inset-*)` の padding を付ける。ドロワーと FAB は個別に inset を考慮する。

## 7. ライフサイクル

- すべての介入は 1 つの `ctx.effect` の中で登録する。dispose 時は登録と逆の順に撤去する（[client.js:300-302](../lib/client.js#L300-L302)）。撤去するのは、style タグ、meta の元値、CSS 変数、FAB、body 属性、inert、全リスナー、observer。
- `style[data-plugin-css="dsh-mobile-ui/override.css"]` が既にあれば、style タグを重ねて挿入しない。この場合、既存のタグは本 effect の撤去対象にならない。
- 撤去手段は、`cordis.patch.yml` の insert を削除することと、ページを再読込すること（README）。

## 8. 検証状況

- 実機: iPhone PWA で、レイアウト、ドロワー、キーボード、ズーム、スワイプ（ADR の検証欄）をユーザーが確認した。iPad と Android は未確認。
- モデル検査: §5.2 の判定表を写した純粋関数で、同値類と境界の直積 2160 件を全列挙した。対象は `x ∈ {0,28,29,195,196}`（幅 390）、`dx ∈ {±59,±60}`、`dy ∈ {0,30,31}` と各状態フラグ。不変条件 3 件に反例は無かった（行 5a の追加前のモデル）。これは手で抽象化したモデルに対する結果であり、コードの証明ではない。スクリプトは `tmp/spec-review/swipe-enum.mjs` にあり、コミットしない。
- 自動テスト: `npm test`（node:test + happy-dom、ADR-20261024-0410）。各テストは名前の `[§n]` で本書の節に対応する。
  CI は `.github/workflows/test.yml`。手順は [development.md](development.md)。

## 9. 既知の問題・未確定事項

2026-10-24 のレビューで挙げた確認質問 Q1–Q9 は、オーナーの回答に従って次のように扱う。未解決のものは
[known-issues.md](known-issues.md) が正本で、本書の記述は修正されるまで現行の挙動を表す。

| 旧 ID | 扱い |
|---|---|
| Q1, Q3, Q6, Q8 | 既知の問題として記録した（KI-1〜KI-3, KI-7） |
| Q2 | 意図しない挙動だったため修正した（§5.2 行 5a、ADR-20261024-0420） |
| Q4 | 検討中（KI-4。iPad 実機で未確認） |
| Q5 | 実機では「ピンチによる拡大縮小がそもそも効かない」と報告された（KI-8） |
| Q7 | 既知の問題（KI-5） |
| Q9 | 影響の評価を記録した（KI-6） |
