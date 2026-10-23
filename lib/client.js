window.__ModuleLoader__.load({
	id: "dsh-mobile-ui",
	factory: (require) => {
		var module = { exports: {} };
		// ADR-20261023-1720: スマホ・タブレット対応はローカル client プラグインで行う。
		// セレクタはビルドごとに変わるハッシュ化クラス名を使わず、安定した data 属性と
		// DOM 構造（frame = [data-rightbar-col] の親、sidebar = frame の先頭子要素）に依存する。
		// 壊れた場合は media query ごと効かなくなり従来表示へ劣化する（安全側）。

		/** 狭幅 drawer 化の境界。768px 以上（iPad 縦）は既存の narrow 挙動（<1024 で rail 化）に任せる。 */
		const PHONE_MAX = 767;
		/** スマホ CSS と同じ条件の JS 側ゲート。 */
		const PHONE_QUERY = `(max-width:${PHONE_MAX}px)`;
		/** キーボード追従（visualViewport）を有効にする条件。タブレットも含める。 */
		const COARSE_QUERY = "(max-width:1023px) and (pointer:coarse)";

		const css = [
			// ---- スマホ幅: 3 カラム grid を 1 カラム化し、サイドバーを fixed の drawer にする ----
			`@media ${PHONE_QUERY}{`,
			// frame のインライン style（gridTemplateColumns）より !important が勝つ。
			// sidebarCol は下で position:fixed（grid フロー外）になるため、残る in-flow の
			// centerCol が第 1 列（1fr）、rightbarCol が第 2 列（0px）に自動配置される。
			// center の minmax(400px,1fr) 由来の横はみ出しをここで断つ。
			":has(> [data-rightbar-col]){grid-template-columns:minmax(0,1fr) 0px 0px !important;}",
			":has(> [data-rightbar-col])>:first-child{",
			"position:fixed;top:0;bottom:0;left:0;width:min(85vw,300px);z-index:60;",
			"background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base,#fff));",
			"border-right:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.15));",
			"box-shadow:0 0 24px rgba(0,0,0,.25);",
			"transform:translateX(0);transition:transform .25s ease;",
			"box-sizing:border-box;overflow:hidden;",
			"padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);",
			"}",
			// data-sidebar-collapsed は AppFrame が frame 要素に付ける（narrow では「閉」が既定）。
			"[data-sidebar-collapsed]:has(> [data-rightbar-col])>:first-child{transform:translateX(-110%);box-shadow:none;visibility:hidden;transition:transform .25s ease,visibility 0s .25s;}",
			// バックドロップは frame の ::after として drawer（z-index:60）と同じ重なり環境に置く。
			// body 直下の要素だと frame 側の stacking context 次第で drawer の背面に回れないため。
			// クリック処理は document の pointerdown リスナーが行う（擬似要素はターゲットにならず frame が受ける）。
			":has(> [data-rightbar-col]):not([data-sidebar-collapsed])::after{content:\"\";position:fixed;inset:0;z-index:59;background:rgba(0,0,0,.35);}",
			// カラムリサイズ用 DragHandle（frame 直下の [data-side]）はタッチでは使わない。
			":has(> [data-rightbar-col])>[data-side]{display:none;}",
			"}",
			`@media ${PHONE_QUERY} and (prefers-reduced-motion:reduce){`,
			":has(> [data-rightbar-col])>:first-child{transition:none;}",
			"}",
			// ---- drawer を開く FAB。狭幅かつ閉時のみ表示（body 属性は JS が同期する） ----
			".dsh-mobile-ui-fab{display:none;}",
			`@media ${PHONE_QUERY}{`,
			"body[data-dsh-mobile-sidebar=closed] .dsh-mobile-ui-fab{display:flex;position:fixed;z-index:55;",
			"left:calc(env(safe-area-inset-left) + 10px);top:calc(env(safe-area-inset-top) + 8px);",
			"width:36px;height:36px;border-radius:10px;align-items:center;justify-content:center;",
			"background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#444);",
			"border:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.15));box-shadow:0 2px 8px rgba(0,0,0,.12);",
			"padding:0;cursor:pointer;}",
			"}",
			// ---- キーボード重なり対策: visualViewport の実高さに #root を合わせる（JS が変数を更新） ----
			`@media ${COARSE_QUERY}{`,
			"#root{height:var(--dsh-mobile-vvh,100%);}",
			// iOS はフォーカスした編集領域の font-size が 16px 未満だと自動ズームする。
			// 入力系全般に 16px を保証する（viewport の maximum-scale=1 と二重の対策。
			// iOS は手動ピンチでは maximum-scale を無視するため拡大操作は妨げない）。
			"textarea,select,input:not([type=checkbox]):not([type=radio]),[data-lexical-editor],[contenteditable=true]{font-size:16px !important;}",
			"}",
			// ---- PWA（standalone / fullscreen）でのセーフエリア確保（viewport-fit=cover 前提、横向きも） ----
			"@media (max-width:1023px) and (display-mode:standalone),(max-width:1023px) and (display-mode:fullscreen){",
			"#root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);box-sizing:border-box;}",
			"}"
		].join("");

		module.exports.name = "dsh-mobile-ui";
		// ctx.layout（dsh-client-ui-layout）と ctx.sidebarRight（dsh-client-ui-sidebar-right）、
		// どちらも reflect.provide される公開サービスを待つ。
		module.exports.inject = ["layout", "sidebarRight"];
		module.exports.apply = function apply(ctx) {
			ctx.effect(() => {
				const disposers = [];

				// -- CSS 注入も effect の寿命に合わせる（fiber 停止時に完全へ戻すため） --
				const tagId = "dsh-mobile-ui/override.css";
				if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					const tag = document.createElement("style");
					tag.dataset.plugin = "dsh-mobile-ui";
					tag.dataset.pluginCss = tagId;
					tag.textContent = css;
					document.head.appendChild(tag);
					disposers.push(() => {
						tag.remove();
					});
				}

				const phoneMedia = window.matchMedia(PHONE_QUERY);
				const coarseMedia = window.matchMedia(COARSE_QUERY);

				// -- viewport meta: フォーカスズーム抑止・ノッチ対応・(対応環境では)キーボードで縮むレイアウト --
				const meta = document.querySelector("meta[name=viewport]");
				if (meta !== null) {
					const previous = meta.getAttribute("content");
					meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content");
					disposers.push(() => {
						if (previous === null) meta.removeAttribute("content");
						else meta.setAttribute("content", previous);
					});
				}

				// -- visualViewport 追従: iOS PWA はキーボードで layout viewport を縮めないため、
				//    実際に見えている高さを CSS 変数に流し、#root の高さに使う。モバイル条件下のみ。 --
				const vv = window.visualViewport;
				if (vv !== undefined && vv !== null) {
					const onResize = () => {
						if (!coarseMedia.matches) return;
						document.documentElement.style.setProperty("--dsh-mobile-vvh", `${Math.round(vv.height)}px`);
						// キーボード出現時に iOS がページ全体をずらす（visualViewport が pan する）
						// ことがあるため原点へ戻す。デスクトップでは coarseMedia が外れるので走らない。
						if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
					};
					onResize();
					vv.addEventListener("resize", onResize);
					disposers.push(() => {
						vv.removeEventListener("resize", onResize);
						document.documentElement.style.removeProperty("--dsh-mobile-vvh");
					});
				}

				// -- drawer 開閉: frame の data-sidebar-collapsed を観測して body 属性・inert・aria を同期 --
				const findFrame = () => document.querySelector("[data-rightbar-col]")?.parentElement ?? null;
				const isOpen = () => {
					const frame = findFrame();
					return frame !== null && !frame.hasAttribute("data-sidebar-collapsed");
				};

				const fab = document.createElement("button");
				fab.type = "button";
				fab.className = "dsh-mobile-ui-fab";
				fab.setAttribute("aria-label", "Open sidebar");
				fab.setAttribute("aria-expanded", "false");
				fab.innerHTML = "<svg width='18' height='18' viewBox='0 0 18 18' aria-hidden='true'><path d='M2 4.5h14M2 9h14M2 13.5h14' stroke='currentColor' stroke-width='1.6' stroke-linecap='round'/></svg>";
				document.body.append(fab);
				disposers.push(() => {
					fab.remove();
				});

				const syncState = () => {
					const frame = findFrame();
					const open = frame !== null && !frame.hasAttribute("data-sidebar-collapsed");
					document.body.dataset.dshMobileSidebar = frame === null ? "none" : open ? "open" : "closed";
					fab.setAttribute("aria-expanded", String(open));
					// 画面外へ出した drawer にフォーカスが入らないよう、スマホ幅の閉時だけ inert にする。
					const sidebarCol = frame?.firstElementChild ?? null;
					if (sidebarCol !== null && "inert" in sidebarCol) sidebarCol.inert = phoneMedia.matches && !open;
				};
				const observer = new MutationObserver(syncState);
				observer.observe(document.documentElement, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ["data-sidebar-collapsed"]
				});
				syncState();
				const onMediaChange = () => {
					syncState();
				};
				phoneMedia.addEventListener("change", onMediaChange);
				disposers.push(() => {
					phoneMedia.removeEventListener("change", onMediaChange);
					observer.disconnect();
					delete document.body.dataset.dshMobileSidebar;
					const sidebarCol = findFrame()?.firstElementChild ?? null;
					if (sidebarCol !== null && "inert" in sidebarCol) sidebarCol.inert = false;
				});

				const toggle = () => {
					ctx.layout.toggleSidebar();
				};
				const onFabClick = () => {
					toggle();
				};
				fab.addEventListener("click", onFabClick);
				disposers.push(() => {
					fab.removeEventListener("click", onFabClick);
				});

				// バックドロップ（frame の ::after）へのタップで閉じる。擬似要素はイベントターゲットに
				// ならないため、開時に drawer と FAB の外で始まったポインタ操作を「backdrop 相当」として扱う。
				const onPointerDown = (event) => {
					if (!phoneMedia.matches || !isOpen()) return;
					const frame = findFrame();
					const sidebarCol = frame?.firstElementChild ?? null;
					const target = event.target;
					if (!(target instanceof Node)) return;
					if (sidebarCol !== null && sidebarCol.contains(target)) return;
					if (fab.contains(target)) return;
					// ::after より上（z-index 60 超）のオーバーレイ（メニュー等）内のタップは除外:
					// backdrop 直撃は frame 自身か centerCol 配下に当たるので、frame の外は触らない。
					if (frame !== null && !frame.contains(target)) return;
					event.preventDefault();
					event.stopPropagation();
					toggle();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				disposers.push(() => {
					document.removeEventListener("pointerdown", onPointerDown, true);
				});

				// Escape（iPad の外付けキーボード等）で閉じ、フォーカスを FAB へ戻す。
				const onKeyDown = (event) => {
					if (event.key !== "Escape" || !phoneMedia.matches || !isOpen()) return;
					toggle();
					fab.focus();
				};
				document.addEventListener("keydown", onKeyDown);
				disposers.push(() => {
					document.removeEventListener("keydown", onKeyDown);
				});

				// -- スワイプジェスチャ（ADR-20261023-1750）--
				//  * 左端からの右スワイプ: 右パネル表示中はチャットへ戻る（toggleExpanded で畳む）、
				//    そうでなければサイドバーを開く（スマホ幅のみ）。iOS の「戻る」操作に揃える。
				//  * 左スワイプ: 開いているサイドバーを閉じる（スマホ幅のみ）。
				// preventDefault しない passive 監視なので、スクロールとは共存する。
				// diff 等の横スクロール領域との衝突は「左端起点」と可視スクロール祖先ガードで避ける。
				const EDGE_PX = 28;
				const SWIPE_MIN_DX = 60;
				/** タッチ起点の水平スクロール可能な祖先を列挙する（横スクロール操作との衝突判定用）。 */
				const horizontalScrollers = (start) => {
					const found = [];
					for (let el = start; el !== null && el !== document.body; el = el.parentElement) {
						if (el.scrollWidth > el.clientWidth + 1) {
							const overflowX = getComputedStyle(el).overflowX;
							if (overflowX === "auto" || overflowX === "scroll") found.push(el);
						}
					}
					return found;
				};
				let swipe = null;
				const onTouchStart = (event) => {
					swipe = null;
					if (!coarseMedia.matches || event.touches.length !== 1) return;
					const t = event.touches[0];
					const target = event.target;
					const el = target instanceof Element ? target : null;
					// 編集領域内の操作（テキスト選択・カーソル移動）はスワイプ候補にしない。
					if (el !== null && el.closest("textarea,input,[contenteditable=true]") !== null) return;
					// 横スクロール祖先の有無と位置は開始時に確定する（操作中の DOM 変化・スクロールに左右されない）。
					const scrollers = el !== null ? horizontalScrollers(el) : [];
					swipe = {
						x: t.clientX,
						y: t.clientY,
						edge: t.clientX <= EDGE_PX,
						scroller: scrollers.length > 0,
						// 全スクローラが左端にある = 右スワイプしても何もスクロールしない状態。
						scrollerAtLeft: scrollers.every((s) => s.scrollLeft <= 0)
					};
				};
				const onTouchEnd = (event) => {
					const start = swipe;
					swipe = null;
					if (start === null || event.changedTouches.length !== 1) return;
					// 長押し等でテキスト選択が生じていたら、選択ハンドルのドラッグとみなして中止。
					const selection = document.getSelection();
					if (selection !== null && !selection.isCollapsed) return;
					const t = event.changedTouches[0];
					const dx = t.clientX - start.x;
					const dy = t.clientY - start.y;
					// 水平方向が支配的な一定距離以上の移動だけをスワイプとみなす。
					if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 2) return;
					if (dx > 0) {
						// 右スワイプ: 横スクロール祖先（diff 等）があっても、全部が左端
						// （scrollLeft=0、右スワイプでは何もスクロールしない）なら「戻る」を許す。
						// 左端に達していない＝実スクロールが起きたはずなので発火しない。
						if (start.scroller && !start.scrollerAtLeft) return;
						// 右パネルから「戻る」は左端起点に限定（パネル内コンテンツの横パンと区別するため）。
						if (ctx.sidebarRight.isExpanded()) {
							if (!start.edge) return;
							ctx.sidebarRight.toggleExpanded();
							return;
						}
						// サイドバー（一覧）を開くのは画面左半分の起点まで許容する
						// （ADR-20261024-0210。横スクロール・選択・編集領域のガードは通過済み）。
						if (start.x > window.innerWidth / 2) return;
						if (phoneMedia.matches && !isOpen()) toggle();
						return;
					}
					// 左スワイプ: 開いているサイドバーを閉じる。横スクロール操作とは衝突させない。
					if (start.scroller) return;
					if (!phoneMedia.matches || !isOpen()) return;
					toggle();
				};
				const onTouchCancel = () => {
					swipe = null;
				};
				document.addEventListener("touchstart", onTouchStart, { passive: true });
				document.addEventListener("touchend", onTouchEnd, { passive: true });
				document.addEventListener("touchcancel", onTouchCancel, { passive: true });
				disposers.push(() => {
					document.removeEventListener("touchstart", onTouchStart);
					document.removeEventListener("touchend", onTouchEnd);
					document.removeEventListener("touchcancel", onTouchCancel);
				});

				return () => {
					for (const dispose of disposers.reverse()) dispose();
				};
			}, "mobile-ui: viewport + drawer chrome");
		};
		return module.exports;
	}
});
