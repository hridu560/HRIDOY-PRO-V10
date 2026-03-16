(function() {
    'use strict';
    if (window.HRIDOY_FAST_LOAD) return;
    window.HRIDOY_FAST_LOAD = true;

    const PARAMS = { gain: 1.0, rageGain: 0, turbo: false, noise: 1, deep: 0 };

    const WORKLET_CODE = `
        class FastTerminator extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'gain', defaultValue: 1.0 },
                    { name: 'rage', defaultValue: 0.0 },
                    { name: 'deep', defaultValue: 0.0 },
                    { name: 'noise', defaultValue: 1.0 }
                ];
            }
            constructor() { super(); this.phase = 0; }
            process(inputs, outputs, p) {
                const input = inputs[0];
                const output = outputs[0];
                if (!input || !input[0]) return true;

                for (let i = 0; i < input[0].length; i++) {
                    let s = input[0][i];
                    if (p.noise[0] > 0.5 && Math.abs(s) < 0.012) s = 0;
                    if (p.deep[0] > 0.5) {
                        this.phase += 0.5;
                        s = input[0][Math.floor(this.phase) % input[0].length];
                    }
                    s *= p.gain[0] * (1 + (p.rage[0] * 15));
                    s = Math.tanh(s * 1.3);
                    output[0][i] = s;
                    if (output[1]) output[1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('fast-terminator', FastTerminator);
    `;

    const NativeAudio = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = function() {
        const ctx = new NativeAudio({ latencyHint: 'interactive', sampleRate: 44100 });
        window.DiscordContext = ctx;
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        ctx.audioWorklet.addModule(URL.createObjectURL(blob));
        return ctx;
    };

    const Core = {
        node: null,
        async build(stream) {
            const ctx = window.DiscordContext;
            if(!ctx) return stream;
            const source = ctx.createMediaStreamSource(stream);
            const dest = ctx.createMediaStreamDestination();
            this.node = new AudioWorkletNode(ctx, 'fast-terminator');
            this.update();
            source.connect(this.node);
            this.node.connect(dest);
            return dest.stream;
        },
        update() {
            if (!this.node) return;
            const p = this.node.parameters, t = window.DiscordContext.currentTime;
            p.get('gain').setTargetAtTime(PARAMS.turbo ? 400 : PARAMS.gain, t, 0.05);
            p.get('rage').setTargetAtTime(PARAMS.turbo ? 800 : PARAMS.rageGain, t, 0.05);
            p.get('deep').setTargetAtTime(PARAMS.deep, t, 0.05);
            p.get('noise').setTargetAtTime(PARAMS.noise, t, 0.05);
        }
    };

    navigator.mediaDevices.getUserMedia = async (c) => {
        const raw = await Object.getPrototypeOf(navigator.mediaDevices).getUserMedia.call(navigator.mediaDevices, c);
        return c.audio ? await Core.build(raw) : raw;
    };

    const UI = {
        init() {
            const div = document.createElement('div');
            div.id = 'h-ui';
            div.innerHTML = `
                <div id="h-drag" style="padding:10px; background:#000; display:flex; justify-content:space-between; border-bottom:1px solid #f00; cursor:move;">
                    <span style="font-weight:bold; color:#f00; font-size:12px;">HRIDOY PRO FAST</span>
                    <div id="h-min" style="cursor:pointer; color:#f00;">—</div>
                </div>
                <div id="h-body" style="padding:12px; background:#050000;">
                    <input type="range" id="gain" min="1" max="250" value="1" style="width:100%; accent-color:#f00;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:10px;">
                        <button id="btn-deep" class="b">DEEP</button>
                        <button id="btn-noise" class="b" style="background:#f00; color:#000;">NOISE</button>
                    </div>
                    <button id="h-turbo" style="width:100%; margin-top:8px; background:#300; border:1px solid #f00; height:35px; color:#f00; font-weight:bold;">TERMINATOR MODE</button>
                </div>
                <style>
                    #h-ui { position: fixed; top: 100px; left: 20px; width: 190px; background: #000; border: 2px solid #f00; z-index: 999999; font-family: monospace; touch-action: none; box-shadow: 0 0 15px #f00; }
                    .b { background: #111; color: #f00; border: 1px solid #600; padding: 6px; font-size: 10px; cursor: pointer; }
                </style>
            `;
            document.body.appendChild(div);
            this.bind(div);
        },
        bind(el) {
            const body = document.getElementById('h-body');
            document.getElementById('h-min').onclick = () => body.style.display = body.style.display === 'none' ? 'block' : 'none';
            document.getElementById('btn-deep').onclick = (e) => {
                PARAMS.deep = PARAMS.deep ? 0 : 1;
                e.target.style.background = PARAMS.deep ? "#f00" : "#111";
                e.target.style.color = PARAMS.deep ? "#000" : "#f00";
                Core.update();
            };
            document.getElementById('btn-noise').onclick = (e) => {
                PARAMS.noise = PARAMS.noise ? 0 : 1;
                e.target.style.background = PARAMS.noise ? "#f00" : "#111";
                e.target.style.color = PARAMS.noise ? "#000" : "#f00";
                Core.update();
            };
            document.getElementById('h-turbo').onclick = (e) => {
                PARAMS.turbo = !PARAMS.turbo;
                e.target.style.background = PARAMS.turbo ? "#f00" : "#300";
                e.target.style.color = PARAMS.turbo ? "#000" : "#f00";
                Core.update();
            };
            document.getElementById('gain').oninput = (e) => { PARAMS.gain = parseFloat(e.target.value); Core.update(); };
            
            // Fast Drag Logic
            let d = false, ox, oy;
            const h = document.getElementById('h-drag');
            const s = (e) => { d = true; const c = e.touches ? e.touches[0] : e; ox = c.clientX - el.offsetLeft; oy = c.clientY - el.offsetTop; };
            const m = (e) => { if(d) { const c = e.touches ? e.touches[0] : e; el.style.left = (c.clientX - ox) + 'px'; el.style.top = (c.clientY - oy) + 'px'; }};
            h.onmousedown = s; h.ontouchstart = s;
            document.onmousemove = m; document.ontouchmove = m;
            document.onmouseup = () => d = false; document.ontouchend = () => d = false;
        }
    };

    // লোড টাইম কমানোর জন্য ১ সেকেন্ড পরেই প্যানেল আসবে
    setTimeout(() => UI.init(), 1000);
})();     }
    };

    setTimeout(() => UI.init(), 1000);
})();ntY; };
            document.onmousemove = e => { if(dragging){ el.style.left = (e.clientX + offset.x) + 'px'; el.style.top = (e.clientY + offset.y) + 'px'; }};
            document.onmouseup = () => dragging = false;
        }
    };

    setTimeout(() => UI.init(), 1000);
})();
