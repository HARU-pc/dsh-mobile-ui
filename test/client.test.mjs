// docs/spec.md の契約（§4 ドロワー、§5 スワイプ判定表、§6 viewport、§7 ライフサイクル）を検査する。
// 見出しの [§n] は spec の節番号。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mount, swipe } from "./harness.mjs";

const open = async (h) => { h.ctx.layout.toggleSidebar(); await h.flush(); };

test("[§4.2] body 属性・inert・aria-expanded が開閉に同期する", async () => {
	const h = mount();
	await h.flush();
	const fab = h.document.querySelector(".dsh-mobile-ui-fab");
	assert.equal(h.document.body.dataset.dshMobileSidebar, "closed");
	assert.equal(h.el("side").inert, true);
	await open(h);
	assert.equal(h.document.body.dataset.dshMobileSidebar, "open");
	assert.equal(h.el("side").inert, false);
	assert.equal(fab.getAttribute("aria-expanded"), "true");
	h.close();
});

test("[§4.2] PHONE でなければ閉でも inert にしない", async () => {
	const h = mount({ width: 900 });
	await h.flush();
	assert.equal(h.el("side").inert, false);
	h.close();
});

test("[§3 SafeDegrade] frame が無ければ body=none で FAB 非表示", async () => {
	const h = mount({ withFrame: false });
	await h.flush();
	assert.equal(h.document.body.dataset.dshMobileSidebar, "none");
	h.close();
});

test("[§4.1] PHONE ではサイドバーが fixed のドロワー、DragHandle 非表示", async () => {
	const h = mount();
	const cs = h.window.getComputedStyle(h.el("side"));
	assert.equal(cs.position, "fixed");
	assert.equal(h.window.getComputedStyle(h.el("handle")).display, "none");
	h.close();
});

test("[§4.3] FAB click で開く", async () => {
	const h = mount();
	h.document.querySelector(".dsh-mobile-ui-fab").click();
	await h.flush();
	assert.equal(h.document.body.dataset.dshMobileSidebar, "open");
	h.close();
});

test("[§4.3] バックドロップ相当（frame 内・drawer 外）の pointerdown で閉じ、drawer 内では閉じない", async () => {
	const h = mount();
	await open(h);
	h.el("side-btn").dispatchEvent(new h.window.PointerEvent("pointerdown", { bubbles: true }));
	assert.equal(h.calls.toggleSidebar, 1);
	h.el("msg").dispatchEvent(new h.window.PointerEvent("pointerdown", { bubbles: true }));
	assert.equal(h.calls.toggleSidebar, 2);
	h.close();
});

test("[§4.3 BackdropOnlyInsideFrame] frame 外（portal）の pointerdown では閉じない", async () => {
	const h = mount();
	await open(h);
	const portal = h.document.createElement("div");
	h.document.body.append(portal);
	portal.dispatchEvent(new h.window.PointerEvent("pointerdown", { bubbles: true }));
	assert.equal(h.calls.toggleSidebar, 1);
	h.close();
});

test("[§4.3] Escape で閉じる（PHONE・開のみ）", async () => {
	const h = mount();
	h.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key: "Escape" }));
	assert.equal(h.calls.toggleSidebar, 0);
	await open(h);
	h.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { key: "Escape" }));
	assert.equal(h.calls.toggleSidebar, 2);
	h.close();
});

// ---- §5.2 スワイプ判定表 ----
test("[§5.2 行7 OpenOnlyWhenClosedPhone] 左半分起点の右スワイプで開き、右半分起点では開かない", async () => {
	const h = mount();
	swipe(h, h.el("msg"), [196, 300], [300, 300]);
	assert.equal(h.calls.toggleSidebar, 0);
	swipe(h, h.el("msg"), [195, 300], [300, 300]);
	assert.equal(h.calls.toggleSidebar, 1);
	h.close();
	// PHONE 外（iPad 縦相当の coarse 768/900px）ではサイドバーを操作しない。
	for (const width of [768, 900]) {
		const t = mount({ width });
		swipe(t, t.el("msg"), [10, 300], [120, 300]);
		assert.equal(t.calls.toggleSidebar, 0, `width=${width}`);
		t.close();
	}
	const edge = mount({ width: 767 });
	swipe(edge, edge.el("msg"), [10, 300], [120, 300]);
	assert.equal(edge.calls.toggleSidebar, 1, "width=767 は PHONE");
	edge.close();
});

test("[§5.2 行3] 閾値: |dx|=59 や縦優勢は無視", async () => {
	const h = mount();
	swipe(h, h.el("msg"), [10, 300], [69, 300]);
	swipe(h, h.el("msg"), [10, 300], [70, 331]);
	assert.equal(h.calls.toggleSidebar, 0);
	swipe(h, h.el("msg"), [10, 300], [70, 330]);
	assert.equal(h.calls.toggleSidebar, 1);
	h.close();
});

test("[§5.2 行5 CollapseOnlyFromEdge] 右パネル展開中は左端28px起点だけ畳む", async () => {
	const h = mount();
	h.setRightExpanded(true);
	swipe(h, h.el("msg"), [29, 300], [120, 300]);
	assert.deepEqual(h.calls, { toggleSidebar: 0, toggleExpanded: 0 });
	swipe(h, h.el("msg"), [28, 300], [120, 300]);
	assert.deepEqual(h.calls, { toggleSidebar: 0, toggleExpanded: 1 });
	h.close();
});

test("[§5.2 行9] 左スワイプで開いているサイドバーを閉じる", async () => {
	const h = mount();
	await open(h);
	swipe(h, h.el("side-btn"), [250, 300], [100, 300]);
	assert.equal(h.calls.toggleSidebar, 2);
	h.close();
});

test("[§5.1] 編集領域起点・COARSE 外はスワイプにしない", async () => {
	const h = mount();
	swipe(h, h.el("ta"), [10, 300], [120, 300]);
	assert.equal(h.calls.toggleSidebar, 0);
	h.close();
	const d = mount({ coarse: false });
	swipe(d, d.el("msg"), [10, 300], [120, 300]);
	assert.equal(d.calls.toggleSidebar, 0);
	d.close();
});

test("[§5.2 行4/8] 横スクロール祖先: 左端なら右スワイプ可、スクロール済みなら不可、左スワイプは常に不可", async () => {
	const h = mount();
	const inner = h.el("hscroll").firstElementChild;
	// happy-dom はレイアウトしないので、スクロール可能な寸法を与える。
	Object.defineProperty(h.el("hscroll"), "scrollWidth", { value: 400 });
	Object.defineProperty(h.el("hscroll"), "clientWidth", { value: 100 });
	swipe(h, inner, [10, 300], [120, 300]);
	assert.equal(h.calls.toggleSidebar, 1, "左端なら開く");
	await h.flush();
	swipe(h, inner, [250, 300], [100, 300]);
	assert.equal(h.calls.toggleSidebar, 1, "左スワイプは横スクロールに譲る");
	h.ctx.layout.toggleSidebar(); // 閉に戻す
	h.el("hscroll").scrollLeft = 50;
	swipe(h, inner, [10, 300], [120, 300]);
	assert.equal(h.calls.toggleSidebar, 2, "スクロール済みでは開かない");
	h.close();
});

// ---- §6 / §7 ----
test("[§6] viewport meta を書換え、dispose で元に戻す", async () => {
	const h = mount();
	const meta = h.document.querySelector("meta[name=viewport]");
	assert.match(meta.getAttribute("content"), /viewport-fit=cover/);
	h.dispose();
	assert.equal(meta.getAttribute("content"), "width=device-width, initial-scale=1");
	h.close();
});

test("[§6] visualViewport の高さを --dsh-mobile-vvh に流す（COARSE のみ）", async () => {
	const h = mount();
	h.visualViewport.height = 500.4;
	h.visualViewport.dispatchEvent(new h.window.Event("resize"));
	assert.equal(h.document.documentElement.style.getPropertyValue("--dsh-mobile-vvh"), "500px");
	h.close();
	// fine pointer・1024px 以上では、起動時も resize 時も変数を設定せず scrollTo も呼ばない。
	for (const opt of [{ coarse: false }, { width: 1024 }]) {
		const t = mount(opt);
		let scrolled = 0;
		t.window.scrollTo = () => { scrolled++; };
		Object.defineProperty(t.window, "scrollY", { value: 10, configurable: true });
		t.visualViewport.height = 400;
		t.visualViewport.dispatchEvent(new t.window.Event("resize"));
		assert.equal(t.document.documentElement.style.getPropertyValue("--dsh-mobile-vvh"), "", JSON.stringify(opt));
		assert.equal(scrolled, 0, JSON.stringify(opt));
		t.close();
	}
	// COARSE ならスクロールを原点へ戻す。
	const c = mount();
	let scrolled = 0;
	c.window.scrollTo = () => { scrolled++; };
	Object.defineProperty(c.window, "scrollY", { value: 10, configurable: true });
	c.visualViewport.dispatchEvent(new c.window.Event("resize"));
	assert.equal(scrolled, 1);
	c.close();
});

test("[§7] dispose ですべての DOM 介入を撤去する", async () => {
	const h = mount();
	await h.flush();
	h.dispose();
	const d = h.document;
	assert.equal(d.querySelector("style[data-plugin=dsh-mobile-ui]"), null);
	assert.equal(d.querySelector(".dsh-mobile-ui-fab"), null);
	assert.equal(d.body.dataset.dshMobileSidebar, undefined);
	assert.equal(d.documentElement.style.getPropertyValue("--dsh-mobile-vvh"), "");
	assert.equal(h.el("side").inert, false);
	swipe(h, h.el("msg"), [10, 300], [120, 300]);
	assert.equal(h.calls.toggleSidebar, 0, "リスナーも外れる");
	h.close();
});

test("[§5.2 行5a DrawerShadowsRightPanel] ドロワー表示中の右スワイプは背後の右パネルを畳まない（Q2）", async () => {
	const h = mount();
	await open(h);
	h.setRightExpanded(true);
	swipe(h, h.el("side-btn"), [0, 300], [120, 300]);
	assert.deepEqual(h.calls, { toggleSidebar: 1, toggleExpanded: 0 });
	h.close();
});
