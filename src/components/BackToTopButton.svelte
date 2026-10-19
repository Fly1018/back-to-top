<script lang="ts">
    interface Props {
        state: {
            visible: boolean;
            left: number;
            top: number;
            label: string;
        };
        onClick?: () => void;
    }

    let { state, onClick }: Props = $props();
</script>

<button
    type="button"
    class="b3-back-to-top"
    class:b3-back-to-top--visible={state.visible}
    style={`left:${state.left}px;top:${state.top}px;`}
    aria-label={state.label}
    title={state.label}
    aria-hidden={state.visible ? "false" : "true"}
    tabindex="-1"
    onclick={() => onClick?.()}
    onmousedown={(event) => event.preventDefault()}
>
    <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
        <path
            d="M8 13V4M3.6 8.4 8 4l4.4 4.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    </svg>
</button>

<style>
    .b3-back-to-top {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 52px;
        height: 52px;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 50%;
        background-color: #3575f0;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(53, 117, 240, 0.35);
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateY(6px);
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease, background-color 0.18s ease;
        -webkit-app-region: no-drag;
    }

    .b3-back-to-top--visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0);
    }

    .b3-back-to-top--visible:hover {
        background-color: #2c63d4;
    }

    .b3-back-to-top:focus-visible {
        outline: 2px solid var(--b3-theme-primary);
        outline-offset: 2px;
    }

    .b3-back-to-top svg {
        display: block;
        width: 22px;
        height: 22px;
    }

    @media (prefers-reduced-motion: reduce) {
        .b3-back-to-top {
            transition: none;
        }
    }
</style>
