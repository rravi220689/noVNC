/**
 * noVNC Mobile & Desktop Touch/Mouse Enhanced Pointer System
 * Copyright (c) 2026 rravi220689
 */

import UI from "./ui.js";

class NoVNCMobileEnhancements {
    constructor() {
        this.activeModifiers = {
            ctrl: false,
            alt: false,
            shift: false,
            win: false
        };
        this.pointerMode = "touch"; // 'touch' (direct tap) or 'trackpad' (relative mouse)
        this.rightClickNext = false;
        this.dragLock = false;
        this.virtualMousePos = { x: 400, y: 300 };
        this.lastTouchPos = null;
        this.toastTimeout = null;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Touch/i.test(navigator.userAgent) || (window.innerWidth <= 850);
        this.init();
    }

    init() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.setup());
        } else {
            this.setup();
        }
        this.setupRFBListeners();
    }

    setup() {
        // 1. Toast Container
        if (!document.getElementById("vnc_enh_toast")) {
            const toast = document.createElement("div");
            toast.id = "vnc_enh_toast";
            toast.innerHTML = '<span id="vnc_enh_toast_icon">📋</span> <span id="vnc_enh_toast_msg"></span>';
            document.body.appendChild(toast);
        }

        // 2. Trackpad Virtual Cursor Indicator
        if (!document.getElementById("vnc_enh_virtual_cursor")) {
            const cursor = document.createElement("div");
            cursor.id = "vnc_enh_virtual_cursor";
            document.body.appendChild(cursor);
        }

        // 3. Mobile View Quick Control Bar (top-right, subtle, touch-optimized)
        this.injectMobileControlBar();

        // 4. Create Virtual Keyboard Overlay (hidden until triggered)
        this.injectVirtualKeyboard();

        // 5. Create Mobile Native Soft Keyboard Capture Input
        this.injectMobileCaptureInput();

        // 6. Attach Sidebar Button Handlers & Pointer Handlers
        this.attachSidebarHandlers();
        this.setupTrackpadTouchHandlers();

        console.log("[noVNC Mobile Enhancements] Loaded (Touch & Mouse mode ready for mobile).");
    }

    injectMobileControlBar() {
        if (document.getElementById("vnc_mobile_pointer_bar")) return;

        const bar = document.createElement("div");
        bar.id = "vnc_mobile_pointer_bar";
        bar.innerHTML = [
            '<button class="mobile-bar-btn primary" id="mbar_btn_mode" title="Switch Touch / Mouse Mode">📱 Touch</button>',
            '<div class="mobile-bar-divider"></div>',
            '<button class="mobile-bar-btn" id="mbar_btn_rc" title="Next Tap = Right Click">🖱️ R</button>',
            '<button class="mobile-bar-btn" id="mbar_btn_drag" title="Hold to Drag (Drag Lock)">🔒</button>',
            '<button class="mobile-bar-btn" id="mbar_btn_wup" title="Scroll Wheel Up">▲</button>',
            '<button class="mobile-bar-btn" id="mbar_btn_wdn" title="Scroll Wheel Down">▼</button>',
            '<div class="mobile-bar-divider"></div>',
            '<button class="mobile-bar-btn" id="mbar_btn_kbd" title="Toggle On-Screen Keyboard">⌨️</button>'
        ].join("");

        // On desktop with large screen, keep hidden unless mobile viewport
        if (!this.isMobile && window.innerWidth > 850) {
            bar.style.display = "none";
        }

        window.addEventListener("resize", () => {
            const isSmall = window.innerWidth <= 850;
            bar.style.display = isSmall ? "flex" : "none";
        });

        document.body.appendChild(bar);

        // Mobile Bar Button Events
        document.getElementById("mbar_btn_mode").addEventListener("click", () => {
            if (this.pointerMode === "touch") {
                this.setPointerMode("trackpad");
            } else {
                this.setPointerMode("touch");
            }
        });

        document.getElementById("mbar_btn_rc").addEventListener("click", () => {
            this.rightClickNext = !this.rightClickNext;
            document.getElementById("mbar_btn_rc").classList.toggle("active", this.rightClickNext);
            const sideRc = document.getElementById("btn_click_right");
            if (sideRc) sideRc.classList.toggle("primary", this.rightClickNext);
            this.showToast(this.rightClickNext ? "Right Click Ready (Tap screen)" : "Right Click Cancelled", "🖱️");
        });

        document.getElementById("mbar_btn_drag").addEventListener("click", () => {
            this.toggleDragLock();
        });

        document.getElementById("mbar_btn_wup").addEventListener("click", () => {
            this.sendMouseWheel(-1);
        });

        document.getElementById("mbar_btn_wdn").addEventListener("click", () => {
            this.sendMouseWheel(1);
        });

        document.getElementById("mbar_btn_kbd").addEventListener("click", () => {
            const vkb = document.getElementById("vnc_enh_vkeyboard");
            if (vkb) vkb.classList.toggle("visible");
        });
    }

    setPointerMode(mode) {
        this.pointerMode = mode;
        const isTrackpad = (mode === "trackpad");

        // Update Mobile Bar
        const mBtn = document.getElementById("mbar_btn_mode");
        if (mBtn) {
            mBtn.textContent = isTrackpad ? "🖱️ Mouse" : "📱 Touch";
            mBtn.classList.toggle("primary", !isTrackpad);
            mBtn.classList.toggle("active", isTrackpad);
        }

        // Update Sidebar Panel
        const btnTouch = document.getElementById("btn_mode_touch");
        const btnTrackpad = document.getElementById("btn_mode_trackpad");
        if (btnTouch) btnTouch.classList.toggle("primary", !isTrackpad);
        if (btnTrackpad) btnTrackpad.classList.toggle("primary", isTrackpad);

        // Update Virtual Cursor Visibility
        const cursorEl = document.getElementById("vnc_enh_virtual_cursor");
        if (cursorEl) {
            cursorEl.style.display = isTrackpad ? "block" : "none";
        }

        this.showToast(isTrackpad ? "🖱️ Trackpad / Mouse Mode Active" : "📱 Direct Touch Mode Active", isTrackpad ? "🖱️" : "📱");
    }

    toggleDragLock() {
        this.dragLock = !this.dragLock;
        const mDrag = document.getElementById("mbar_btn_drag");
        if (mDrag) mDrag.classList.toggle("active", this.dragLock);

        const sDrag = document.getElementById("btn_drag_lock");
        if (sDrag) sDrag.classList.toggle("primary", this.dragLock);

        if (UI.rfb) {
            const mask = this.dragLock ? 0x1 : 0x0;
            UI.rfb._sendMouse(Math.round(this.virtualMousePos.x), Math.round(this.virtualMousePos.y), mask);
        }
        this.showToast(this.dragLock ? "🔒 Drag Locked (Left Click Held)" : "🔓 Drag Released", "🔒");
    }

    injectVirtualKeyboard() {
        if (document.getElementById("vnc_enh_vkeyboard")) return;

        const vkb = document.createElement("div");
        vkb.id = "vnc_enh_vkeyboard";

        const header = document.createElement("div");
        header.className = "vkeyboard-header";
        header.innerHTML = [
            '<span class="vkeyboard-title">On-Screen Keyboard</span>',
            '<div style="display:flex; gap:5px;">',
                '<button class="noVNC_enh_btn" id="vkb_btn_cad">CAD</button>',
                '<button class="noVNC_enh_btn" id="vkb_btn_wind">Win+D</button>',
                '<button class="noVNC_enh_btn" id="vkb_btn_winr">Win+R</button>',
                '<button class="vkeyboard-close" id="vkb_btn_close">✕</button>',
            '</div>'
        ].join("");
        vkb.appendChild(header);

        // Row definitions: [displayLabel, keyNameOrMod, classExtra, isMod, elementId]
        const keyboardRows = [
            // Function Row
            [
                ["Esc", "Escape", "fn"], ["F1", "F1", "fn"], ["F2", "F2", "fn"], ["F3", "F3", "fn"],
                ["F4", "F4", "fn"], ["F5", "F5", "fn"], ["F6", "F6", "fn"], ["F7", "F7", "fn"],
                ["F8", "F8", "fn"], ["F9", "F9", "fn"], ["F10", "F10", "fn"], ["F11", "F11", "fn"],
                ["F12", "F12", "fn"], ["Del", "Delete", "fn"]
            ],
            // Number Row
            [
                ["`", "`"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"],
                ["5", "5"], ["6", "6"], ["7", "7"], ["8", "8"], ["9", "9"],
                ["0", "0"], ["-", "-"], ["=", "="], ["⌫", "Backspace", "wide fn"]
            ],
            // QWERTY Row 1
            [
                ["Tab", "Tab", "wide fn"], ["Q", "q"], ["W", "w"], ["E", "e"], ["R", "r"],
                ["T", "t"], ["Y", "y"], ["U", "u"], ["I", "i"], ["O", "o"],
                ["P", "p"], ["[", "["], ["]", "]"], ["\\", "\\"]
            ],
            // QWERTY Row 2
            [
                ["Caps", "CapsLock", "wide mod", false, "vkb_key_caps"],
                ["A", "a"], ["S", "s"], ["D", "d"], ["F", "f"], ["G", "g"],
                ["H", "h"], ["J", "j"], ["K", "k"], ["L", "l"], [";", ";"],
                ["'", "'"], ["↵ Enter", "Enter", "extra-wide fn"]
            ],
            // QWERTY Row 3
            [
                ["Shift", "shift", "wide mod", true, "vkb_key_shift"],
                ["Z", "z"], ["X", "x"], ["C", "c"], ["V", "v"], ["B", "b"],
                ["N", "n"], ["M", "m"], [",", ","], [".", "."], ["/", "/"],
                ["▲", "ArrowUp", "fn"], ["Shift", "ShiftRight", "wide fn"]
            ],
            // Bottom Row
            [
                ["Ctrl", "ctrl", "mod", true, "vkb_key_ctrl"],
                ["⊞", "win", "mod", true, "vkb_key_win"],
                ["Alt", "alt", "mod", true, "vkb_key_alt"],
                ["Space", " ", "space"],
                ["◄", "ArrowLeft", "fn"],
                ["▼", "ArrowDown", "fn"],
                ["►", "ArrowRight", "fn"]
            ]
        ];

        keyboardRows.forEach(row => {
            const rowEl = document.createElement("div");
            rowEl.className = "vkeyboard-row";

            row.forEach(keyDef => {
                const label = keyDef[0];
                const keyVal = keyDef[1];
                const classExtra = keyDef[2] || "";
                const isMod = !!keyDef[3];
                const elId = keyDef[4] || "";

                const keyEl = document.createElement("div");
                keyEl.className = "vkey" + (classExtra ? (" " + classExtra) : "");
                keyEl.textContent = label;
                if (elId) keyEl.id = elId;

                if (isMod) {
                    keyEl.dataset.mod = keyVal;
                } else {
                    keyEl.dataset.key = keyVal;
                }

                keyEl.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMod) {
                        this.toggleModifier(keyVal);
                    } else {
                        this.sendNamedKey(keyVal);
                    }
                });

                rowEl.appendChild(keyEl);
            });

            vkb.appendChild(rowEl);
        });

        document.body.appendChild(vkb);

        document.getElementById("vkb_btn_close").addEventListener("click", () => {
            vkb.classList.remove("visible");
        });
        document.getElementById("vkb_btn_cad").addEventListener("click", () => this.sendCAD());
        document.getElementById("vkb_btn_wind").addEventListener("click", () => this.sendShortcut("win", "d"));
        document.getElementById("vkb_btn_winr").addEventListener("click", () => this.sendShortcut("win", "r"));
    }

    injectMobileCaptureInput() {
        if (document.getElementById("vnc_enh_mobile_capture")) return;

        const input = document.createElement("input");
        input.id = "vnc_enh_mobile_capture";
        input.type = "text";
        input.autocapitalize = "off";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.style.cssText = "position:absolute; opacity:0.01; height:1px; width:1px; left:-9999px; top:-9999px; pointer-events:none;";
        document.body.appendChild(input);

        input.addEventListener("input", () => {
            const val = input.value;
            if (val) {
                this.typeStringIntoRemote(val);
                input.value = "";
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") {
                this.sendNamedKey("Backspace");
            } else if (e.key === "Enter") {
                this.sendNamedKey("Enter");
            } else if (e.key === "Tab") {
                this.sendNamedKey("Tab");
                e.preventDefault();
            }
        });
    }

    attachSidebarHandlers() {
        // --- 1. Touch & Mouse Pointer Mode Toggle ---
        const pointerBtn = document.getElementById("noVNC_pointer_mode_button");
        const pointerPanel = document.getElementById("noVNC_pointer_mode_panel");
        if (pointerBtn && pointerPanel) {
            pointerBtn.addEventListener("click", () => {
                const isOpen = pointerPanel.classList.contains("noVNC_open");
                document.querySelectorAll(".noVNC_panel").forEach(p => p.classList.remove("noVNC_open"));
                if (!isOpen) {
                    pointerPanel.classList.add("noVNC_open");
                }
            });
        }

        // Mode Switchers: Touch vs Trackpad
        const btnTouch = document.getElementById("btn_mode_touch");
        const btnTrackpad = document.getElementById("btn_mode_trackpad");

        if (btnTouch) {
            btnTouch.addEventListener("click", () => this.setPointerMode("touch"));
        }
        if (btnTrackpad) {
            btnTrackpad.addEventListener("click", () => this.setPointerMode("trackpad"));
        }

        // Mouse Action Buttons
        const btnLeft = document.getElementById("btn_click_left");
        const btnRight = document.getElementById("btn_click_right");
        const btnMiddle = document.getElementById("btn_click_middle");
        const btnWheelUp = document.getElementById("btn_wheel_up");
        const btnWheelDown = document.getElementById("btn_wheel_down");
        const btnDragLock = document.getElementById("btn_drag_lock");

        if (btnLeft) {
            btnLeft.addEventListener("click", () => {
                this.sendMouseClick(1);
                this.showToast("Left Click", "🖱️");
            });
        }

        if (btnRight) {
            btnRight.addEventListener("click", () => {
                this.rightClickNext = !this.rightClickNext;
                btnRight.classList.toggle("primary", this.rightClickNext);
                const mRc = document.getElementById("mbar_btn_rc");
                if (mRc) mRc.classList.toggle("active", this.rightClickNext);
                this.showToast(this.rightClickNext ? "Right Click Ready (Tap screen)" : "Right Click Cancelled", "🖱️");
            });
        }

        if (btnMiddle) {
            btnMiddle.addEventListener("click", () => {
                this.sendMouseClick(2);
                this.showToast("Middle Click", "🖱️");
            });
        }

        if (btnWheelUp) {
            btnWheelUp.addEventListener("click", () => this.sendMouseWheel(-1));
        }

        if (btnWheelDown) {
            btnWheelDown.addEventListener("click", () => this.sendMouseWheel(1));
        }

        if (btnDragLock) {
            btnDragLock.addEventListener("click", () => this.toggleDragLock());
        }

        // --- 2. Virtual Keyboard Toggle Button ---
        const vkeyBtn = document.getElementById("noVNC_vkey_button");
        if (vkeyBtn) {
            vkeyBtn.addEventListener("click", () => {
                const vkb = document.getElementById("vnc_enh_vkeyboard");
                if (vkb) {
                    vkb.classList.toggle("visible");
                    if (vkb.classList.contains("visible")) {
                        this.showToast("On-Screen Keyboard Opened", "⌨️");
                    }
                }
            });
        }

        // --- 3. Mobile Soft Keyboard Button ---
        const mobileKeyBtn = document.getElementById("noVNC_keyboard_button");
        if (mobileKeyBtn) {
            mobileKeyBtn.addEventListener("click", () => {
                const capture = document.getElementById("vnc_enh_mobile_capture");
                if (capture) {
                    capture.focus();
                    this.showToast("Mobile keyboard active. Type to send!", "📱");
                }
            });
        }

        // --- 4. Sidebar Clipboard Buttons ---
        const qPasteBtn = document.getElementById("noVNC_quick_paste_button");
        if (qPasteBtn) {
            qPasteBtn.addEventListener("click", () => this.handleQuickPaste());
        }

        const qCopyBtn = document.getElementById("noVNC_quick_copy_button");
        if (qCopyBtn) {
            qCopyBtn.addEventListener("click", () => this.handleQuickCopy());
        }

        const sendTextBtn = document.getElementById("noVNC_send_text_button");
        if (sendTextBtn) {
            sendTextBtn.addEventListener("click", () => {
                const text = document.getElementById("noVNC_clipboard_text")?.value;
                if (text) {
                    this.typeStringIntoRemote(text);
                    this.showToast("⌨️ Typing text into remote window...", "⌨️");
                } else {
                    this.showToast("Clipboard text box is empty", "⚠️");
                }
            });
        }

        const pasteLocalBtn = document.getElementById("noVNC_paste_local_button");
        if (pasteLocalBtn) {
            pasteLocalBtn.addEventListener("click", async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    const area = document.getElementById("noVNC_clipboard_text");
                    if (area) {
                        area.value = text;
                        if (UI.rfb) UI.rfb.clipboardPasteFrom(text);
                        this.showToast("📥 Device clipboard loaded", "📥");
                    }
                } catch (err) {
                    this.showToast("⚠️ Permission denied by browser", "⚠️");
                }
            });
        }

        const clearBtn = document.getElementById("noVNC_clipboard_clear_button");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                const area = document.getElementById("noVNC_clipboard_text");
                if (area) area.value = "";
            });
        }
    }

    /* --- Trackpad / Relative Mouse Touch Listeners --- */
    setupTrackpadTouchHandlers() {
        const container = document.getElementById("noVNC_container") || document.body;
        const cursorEl = document.getElementById("vnc_enh_virtual_cursor");

        container.addEventListener("touchstart", (e) => {
            if (this.pointerMode !== "trackpad" || !UI.rfb) return;
            if (e.touches.length === 1) {
                this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: false });

        container.addEventListener("touchmove", (e) => {
            if (this.pointerMode !== "trackpad" || !UI.rfb || !this.lastTouchPos) return;

            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const dx = (touch.clientX - this.lastTouchPos.x) * 1.5;
                const dy = (touch.clientY - this.lastTouchPos.y) * 1.5;

                this.virtualMousePos.x = Math.max(0, this.virtualMousePos.x + dx);
                this.virtualMousePos.y = Math.max(0, this.virtualMousePos.y + dy);
                this.lastTouchPos = { x: touch.clientX, y: touch.clientY };

                // Update on-screen cursor
                if (cursorEl) {
                    cursorEl.style.left = touch.clientX + "px";
                    cursorEl.style.top = touch.clientY + "px";
                }

                // Send VNC mouse movement
                const mask = this.dragLock ? 0x1 : 0x0;
                UI.rfb._sendMouse(Math.round(this.virtualMousePos.x), Math.round(this.virtualMousePos.y), mask);
            }
        }, { passive: false });

        container.addEventListener("touchend", (e) => {
            if (this.pointerMode !== "trackpad" || !UI.rfb) return;
            this.lastTouchPos = null;

            if (this.rightClickNext) {
                this.sendMouseClick(4);
                this.rightClickNext = false;
                const btnRight = document.getElementById("btn_click_right");
                if (btnRight) btnRight.classList.remove("primary");
                const mRc = document.getElementById("mbar_btn_rc");
                if (mRc) mRc.classList.remove("active");
                this.showToast("Right Click Performed", "🖱️");
            }
        });
    }

    sendMouseClick(buttonNum) {
        if (!UI.rfb) return;
        let mask = 0x1;
        if (buttonNum === 2) mask = 0x2; // Middle
        if (buttonNum === 4) mask = 0x4; // Right

        const x = Math.round(this.virtualMousePos.x);
        const y = Math.round(this.virtualMousePos.y);

        UI.rfb._sendMouse(x, y, mask);
        setTimeout(() => {
            const releaseMask = this.dragLock ? 0x1 : 0x0;
            UI.rfb._sendMouse(x, y, releaseMask);
        }, 50);
    }

    sendMouseWheel(direction) {
        if (!UI.rfb) return;
        const x = Math.round(this.virtualMousePos.x);
        const y = Math.round(this.virtualMousePos.y);
        const mask = direction < 0 ? 0x8 : 0x10; // 0x8 = Wheel Up, 0x10 = Wheel Down

        UI.rfb._sendMouse(x, y, mask);
        setTimeout(() => {
            UI.rfb._sendMouse(x, y, 0x0);
        }, 40);
        this.showToast(direction < 0 ? "▲ Scroll Up" : "▼ Scroll Down", "📜");
    }

    /* --- Modifier Handling --- */
    toggleModifier(mod) {
        if (!this.activeModifiers.hasOwnProperty(mod)) return;
        this.activeModifiers[mod] = !this.activeModifiers[mod];
        const active = this.activeModifiers[mod];

        const vkbBtn = document.getElementById("vkb_key_" + mod);
        if (vkbBtn) vkbBtn.classList.toggle("active", active);

        if (UI.rfb) {
            let keysym = null;
            let code = null;
            if (mod === "ctrl")  { keysym = 0xffe3; code = "ControlLeft"; }
            if (mod === "alt")   { keysym = 0xffe9; code = "AltLeft"; }
            if (mod === "shift") { keysym = 0xffe1; code = "ShiftLeft"; }
            if (mod === "win")   { keysym = 0xffeb; code = "MetaLeft"; }

            if (keysym) {
                UI.rfb.sendKey(keysym, code, active);
            }
        }

        this.showToast(mod.toUpperCase() + (active ? " LATCHED (ON)" : " RELEASED (OFF)"), active ? "🔒" : "🔓");
    }

    releaseAllModifiers() {
        for (const mod of Object.keys(this.activeModifiers)) {
            if (this.activeModifiers[mod]) {
                this.toggleModifier(mod);
            }
        }
    }

    /* --- Key & Keystroke Sending --- */
    sendNamedKey(keyName) {
        if (!UI.rfb) return;

        const keyMap = {
            "Escape": { sym: 0xff1b, code: "Escape" },
            "Tab": { sym: 0xff09, code: "Tab" },
            "Enter": { sym: 0xff0d, code: "Enter" },
            "Backspace": { sym: 0xff08, code: "Backspace" },
            "Delete": { sym: 0xffff, code: "Delete" },
            "ArrowUp": { sym: 0xff52, code: "ArrowUp" },
            "ArrowDown": { sym: 0xff54, code: "ArrowDown" },
            "ArrowLeft": { sym: 0xff51, code: "ArrowLeft" },
            "ArrowRight": { sym: 0xff53, code: "ArrowRight" },
            "CapsLock": { sym: 0xffe5, code: "CapsLock" },
            "ShiftRight": { sym: 0xffe2, code: "ShiftRight" },
            "F1": { sym: 0xffbe, code: "F1" },
            "F2": { sym: 0xffbf, code: "F2" },
            "F3": { sym: 0xffc0, code: "F3" },
            "F4": { sym: 0xffc1, code: "F4" },
            "F5": { sym: 0xffc2, code: "F5" },
            "F6": { sym: 0xffc3, code: "F6" },
            "F7": { sym: 0xffc4, code: "F7" },
            "F8": { sym: 0xffc5, code: "F8" },
            "F9": { sym: 0xffc6, code: "F9" },
            "F10": { sym: 0xffc7, code: "F10" },
            "F11": { sym: 0xffc8, code: "F11" },
            "F12": { sym: 0xffc9, code: "F12" }
        };

        if (keyMap[keyName]) {
            const { sym, code } = keyMap[keyName];
            UI.rfb.sendKey(sym, code, true);
            setTimeout(() => UI.rfb.sendKey(sym, code, false), 30);
        } else if (keyName.length === 1) {
            const charCode = keyName.charCodeAt(0);
            UI.rfb.sendKey(charCode, null, true);
            setTimeout(() => UI.rfb.sendKey(charCode, null, false), 30);
        }

        if (this.activeModifiers.shift) {
            this.toggleModifier("shift");
        }
    }

    sendShortcut(modName, keyChar) {
        if (!UI.rfb) return;
        this.toggleModifier(modName);
        setTimeout(() => {
            this.sendNamedKey(keyChar);
            setTimeout(() => this.releaseAllModifiers(), 50);
        }, 30);
    }

    sendCAD() {
        if (!UI.rfb) return;
        UI.rfb.sendCtrlAltDel();
        this.showToast("Sent Ctrl+Alt+Del", "⚡");
    }

    typeStringIntoRemote(str) {
        if (!UI.rfb || !str) return;
        let delay = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            setTimeout(() => {
                if (char === "\n" || char === "\r") {
                    UI.rfb.sendKey(0xff0d, "Enter", true);
                    UI.rfb.sendKey(0xff0d, "Enter", false);
                } else if (char === "\t") {
                    UI.rfb.sendKey(0xff09, "Tab", true);
                    UI.rfb.sendKey(0xff09, "Tab", false);
                } else {
                    const code = char.charCodeAt(0);
                    UI.rfb.sendKey(code, null, true);
                    UI.rfb.sendKey(code, null, false);
                }
            }, delay);
            delay += 15;
        }
    }

    /* --- Clipboard Integration --- */
    async handleQuickPaste() {
        if (!UI.rfb) {
            this.showToast("⚠️ Not connected to remote desktop", "⚠️");
            return;
        }

        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                this.showToast("Clipboard is empty", "📋");
                return;
            }

            UI.rfb.clipboardPasteFrom(text);
            const area = document.getElementById("noVNC_clipboard_text");
            if (area) area.value = text;

            UI.rfb.sendKey(0xffe3, "ControlLeft", true);
            setTimeout(() => {
                UI.rfb.sendKey(0x0076, "KeyV", true);
                UI.rfb.sendKey(0x0076, "KeyV", false);
                setTimeout(() => {
                    UI.rfb.sendKey(0xffe3, "ControlLeft", false);
                    this.showToast("📋 Pasted into remote desktop!", "📋");
                }, 40);
            }, 30);

        } catch (err) {
            console.warn("[noVNC] Async Clipboard read failed:", err);
            const clipBtn = document.getElementById("noVNC_clipboard_button");
            if (clipBtn) clipBtn.click();
            this.showToast("Paste text into sidebar box", "📋");
        }
    }

    handleQuickCopy() {
        if (!UI.rfb) return;

        UI.rfb.sendKey(0xffe3, "ControlLeft", true);
        setTimeout(() => {
            UI.rfb.sendKey(0x0063, "KeyC", true);
            UI.rfb.sendKey(0x0063, "KeyC", false);
            setTimeout(() => {
                UI.rfb.sendKey(0xffe3, "ControlLeft", false);
                this.showToast("📄 Remote selection copied (Ctrl+C)", "📄");
            }, 40);
        }, 30);
    }

    setupRFBListeners() {
        window.addEventListener("load", () => {
            if (UI.rfb) {
                UI.rfb.addEventListener("clipboard", async (e) => {
                    const text = e.detail?.text;
                    if (text) {
                        const area = document.getElementById("noVNC_clipboard_text");
                        if (area) area.value = text;
                        if (navigator.clipboard?.writeText) {
                            try {
                                await navigator.clipboard.writeText(text);
                                this.showToast("📄 Remote clipboard copied to device!", "📄");
                            } catch (err) {
                                // Focus restriction
                            }
                        }
                    }
                });
            }
        });
    }

    showToast(message, icon = "ℹ️") {
        const toast = document.getElementById("vnc_enh_toast");
        const iconEl = document.getElementById("vnc_enh_toast_icon");
        const msgEl = document.getElementById("vnc_enh_toast_msg");

        if (!toast || !msgEl) return;
        iconEl.textContent = icon;
        msgEl.textContent = message;

        toast.classList.add("show");
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    }
}

// Auto-instantiate
const mobileEnhancements = new NoVNCMobileEnhancements();
export default mobileEnhancements;
