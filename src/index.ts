import { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import BackToTopButton from "@/components/BackToTopButton.svelte";
import { buttonState } from "@/button-state.svelte";
import "./index.scss";

const SHOW_THRESHOLD = 300;
const BUTTON_SIZE = 52;
const MARGIN = 20;
const EDGE_GAP = 6;
const NON_EDITOR = ".b3-dialog, .block__popover, .search__preview, .protyle-preview";

export default class BackToTop extends Plugin {
    private disposed = false;
    private container: HTMLDivElement | null = null;
    private component: ReturnType<typeof mount> | null = null;
    private visible = false;
    private frame = 0;
    private scrolling = false;
    private scrollTimer = 0;
    private scrollTarget: HTMLElement | null = null;
    private currentScroller: HTMLElement | null = null;
    private interactedProtyle: HTMLElement | null = null;
    private observedProtyle: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private lastLeft = -1;
    private lastTop = -1;

    onload() {
        this.disposed = false;
        this.eventBus.on("loaded-protyle" as any, this.handleProtyleChange);
        this.eventBus.on("switch-protyle", this.handleProtyleChange);
        this.eventBus.on("destroy-protyle", this.handleProtyleDestroy);
    }

    onLayoutReady() {
        if (!this.disposed && !this.component) {
            this.mount();
        }
    }

    private mount() {
        buttonState.label = (this.i18n && this.i18n.backToTop) || "Back to top";
        this.container = document.createElement("div");
        this.container.className = "b3-back-to-top-root";
        document.body.appendChild(this.container);
        this.component = mount(BackToTopButton, {
            target: this.container,
            props: {
                state: buttonState,
                onClick: () => this.scrollToTop(),
            },
        });

        document.addEventListener("scroll", this.handleScroll, true);
        document.addEventListener("pointerdown", this.handlePointerDown, true);
        document.addEventListener("focusin", this.handleFocusIn, true);
        document.addEventListener("click", this.handleDocumentClick, true);
        window.addEventListener("resize", this.handleResize);
        this.observeLayout();
        this.schedule();
    }

    private handleScroll = (event: Event) => {
        if (this.disposed) return;
        const target = event.target as HTMLElement | null;
        if (target?.nodeType === 1 && target.closest) {
            const protyle = target.closest(".protyle") as HTMLElement | null;
            if (protyle && this.isEditorProtyle(protyle)) {
                this.interactedProtyle = protyle;
            }
        }
        this.schedule();
    };

    private handlePointerDown = (event: Event) => {
        if (this.disposed) return;
        const target = event.target as HTMLElement | null;
        if (target?.nodeType === 1 && target.closest) {
            const protyle = target.closest(".protyle") as HTMLElement | null;
            if (protyle && this.isEditorProtyle(protyle)) {
                this.interactedProtyle = protyle;
            }
        }
        this.schedule();
    };

    private handleFocusIn = () => {
        if (!this.disposed) this.schedule();
    };

    private handleResize = () => this.schedule();
    private handleDocumentClick = () => this.schedule();
    private handleScrollEnd = () => this.endScroll();

    private handleProtyleChange = (event: any) => {
        if (this.disposed) return;
        const instance = event?.detail?.protyle;
        const element = (instance?.element || instance) as HTMLElement | null;
        if (element?.nodeType === 1 && element.isConnected && this.isEditorProtyle(element)) {
            this.interactedProtyle = element;
        } else if (this.interactedProtyle && !this.interactedProtyle.isConnected) {
            this.interactedProtyle = null;
        }
        if (this.scrolling && (!this.scrollTarget || !this.scrollTarget.isConnected)) {
            this.endScroll();
        }
        this.schedule();
    };

    private handleProtyleDestroy = (event: any) => {
        if (this.disposed) return;
        const instance = event?.detail?.protyle;
        const element = (instance?.element || instance) as HTMLElement | null;
        if (this.interactedProtyle && (!element || this.interactedProtyle === element)) {
            this.interactedProtyle = null;
        }
        if (this.scrolling && (!this.scrollTarget || !this.scrollTarget.isConnected)) {
            this.endScroll();
        }
        this.schedule();
    };

    private observeLayout() {
        if (typeof ResizeObserver === "undefined") return;
        try {
            this.resizeObserver = new ResizeObserver(() => this.schedule());
            const container = document.querySelector(".layout__center") || document.body;
            this.resizeObserver.observe(container);
        } catch (error) {
            this.resizeObserver = null;
        }
    }

    private observeProtyle(protyle: HTMLElement) {
        if (!this.resizeObserver || this.observedProtyle === protyle) return;
        try {
            if (this.observedProtyle) this.resizeObserver.unobserve(this.observedProtyle);
            this.resizeObserver.observe(protyle);
            this.observedProtyle = protyle;
        } catch (error) {
            this.observedProtyle = null;
        }
    }

    private schedule() {
        if (this.disposed || this.frame) return;
        this.frame = window.requestAnimationFrame(() => {
            this.frame = 0;
            this.update();
        });
    }

    private isEditorProtyle(protyle: HTMLElement | null): protyle is HTMLElement {
        if (!protyle || !protyle.isConnected) return false;
        if (protyle.closest(NON_EDITOR)) return false;
        const rect = protyle.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
    }

    private getEditor(): HTMLElement | null {
        const editors: HTMLElement[] = [];
        const centerEditors: HTMLElement[] = [];
        document.querySelectorAll<HTMLElement>(".protyle").forEach((protyle) => {
            if (!this.isEditorProtyle(protyle)) return;
            editors.push(protyle);
            if (protyle.closest(".layout__center")) centerEditors.push(protyle);
        });
        const pool = centerEditors.length ? centerEditors : editors;
        if (!pool.length) return null;
        if (this.interactedProtyle && pool.includes(this.interactedProtyle)) {
            return this.interactedProtyle;
        }
        const active = document.activeElement;
        if (active) {
            const focused = pool.find((protyle) => protyle.contains(active));
            if (focused) return focused;
        }
        return pool[0];
    }

    private findScroller(protyle: HTMLElement): HTMLElement | null {
        const start = protyle.querySelector<HTMLElement>(".protyle-wysiwyg") ||
            protyle.querySelector<HTMLElement>(".protyle-content") || protyle;
        let fallback: HTMLElement | null = null;
        for (let element: HTMLElement | null = start; element; element = element.parentElement) {
            if (element.scrollHeight > element.clientHeight + 1) {
                const overflowY = window.getComputedStyle(element).overflowY;
                if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
                    return element;
                }
                if (!fallback) fallback = element;
            }
            if (element === protyle) break;
        }
        return fallback || protyle.querySelector<HTMLElement>(".protyle-content") || null;
    }

    private update() {
        if (this.disposed || !this.component || this.scrolling) return;
        const protyle = this.getEditor();
        if (!protyle) {
            this.interactedProtyle = null;
            this.hide();
            return;
        }
        this.interactedProtyle = protyle;
        this.observeProtyle(protyle);
        const scroller = this.findScroller(protyle);
        this.currentScroller = scroller;
        if (scroller && scroller.scrollTop > SHOW_THRESHOLD) {
            this.show(protyle);
        } else {
            this.hide();
        }
    }

    private show(protyle: HTMLElement) {
        const rect = protyle.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) {
            this.hide();
            return;
        }
        const left = Math.round(Math.max(
            EDGE_GAP,
            Math.min(rect.right - MARGIN - BUTTON_SIZE, window.innerWidth - BUTTON_SIZE - EDGE_GAP),
        ));
        const top = Math.round(Math.max(
            EDGE_GAP,
            Math.min(rect.bottom - MARGIN - BUTTON_SIZE, window.innerHeight - BUTTON_SIZE - EDGE_GAP),
        ));
        if (left !== this.lastLeft) {
            buttonState.left = left;
            this.lastLeft = left;
        }
        if (top !== this.lastTop) {
            buttonState.top = top;
            this.lastTop = top;
        }
        if (!this.visible) {
            this.visible = true;
            buttonState.visible = true;
        }
    }

    private hide() {
        if (!this.visible) return;
        this.visible = false;
        buttonState.visible = false;
    }

    private scrollToTop(event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.disposed || this.scrolling) return;
        const protyle = this.getEditor();
        const scroller = (protyle && this.findScroller(protyle)) || this.currentScroller;
        if (!scroller || !scroller.isConnected) return;
        this.currentScroller = scroller;
        this.scrolling = true;
        this.hide();
        this.scrollTarget = scroller;
        if (this.scrollTimer) window.clearTimeout(this.scrollTimer);
        this.scrollTimer = window.setTimeout(() => this.endScroll(), 1500);
        try {
            scroller.addEventListener("scrollend", this.handleScrollEnd);
        } catch (error) {
            // scrollend is optional
        }
        try {
            scroller.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            scroller.scrollTop = 0;
            this.endScroll();
        }
    }

    private endScroll() {
        if (this.scrollTimer) {
            window.clearTimeout(this.scrollTimer);
            this.scrollTimer = 0;
        }
        if (this.scrollTarget) {
            try {
                this.scrollTarget.removeEventListener("scrollend", this.handleScrollEnd);
            } catch (error) {
                // ignore
            }
            this.scrollTarget = null;
        }
        if (!this.scrolling) return;
        this.scrolling = false;
        this.schedule();
    }

    onunload() {
        this.disposed = true;
        if (this.frame) {
            window.cancelAnimationFrame(this.frame);
            this.frame = 0;
        }
        if (this.scrollTimer) {
            window.clearTimeout(this.scrollTimer);
            this.scrollTimer = 0;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this.scrollTarget) {
            try {
                this.scrollTarget.removeEventListener("scrollend", this.handleScrollEnd);
            } catch (error) {
                // ignore
            }
            this.scrollTarget = null;
        }
        this.eventBus.off("loaded-protyle" as any, this.handleProtyleChange);
        this.eventBus.off("switch-protyle", this.handleProtyleChange);
        this.eventBus.off("destroy-protyle", this.handleProtyleDestroy);
        document.removeEventListener("scroll", this.handleScroll, true);
        document.removeEventListener("pointerdown", this.handlePointerDown, true);
        document.removeEventListener("focusin", this.handleFocusIn, true);
        document.removeEventListener("click", this.handleDocumentClick, true);
        window.removeEventListener("resize", this.handleResize);
        if (this.app) {
            unmount(this.component);
            this.component = null;
        }
        this.container?.remove();
        this.container = null;
        this.visible = false;
        this.interactedProtyle = null;
        this.observedProtyle = null;
        this.currentScroller = null;
    }
}
