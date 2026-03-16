(function() {
    'use strict';
    if (window.HRIDOY_ENDGAME_V10) return;
    window.HRIDOY_ENDGAME_V10 = true;

    const PARAMS = { gain: 1.0, turbo: false, noise: 0, deep: 0 };

    const WORKLET_CODE = `
        class HridoyEndGame extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'gain', defaultValue: 1.0 },
                    { name: 'deep', defaultValue: 0.0 },
                    { name: 'noise', defaultValue: 0.0 }
                ];
            }
            constructor() { 
                super(); 
                this.buffer = new Float32Array(4096);
                this.ptr = 0;
            }
            process(inputs, outputs, p) {
                const input = inputs[0][0];
                const output = outputs[0][0];
                if (!input) return true;

                for (let i = 0; i < input.length; i++) {
                    let s = input[i];

                    // 1. INDEPENDENT NOISE KILLER (Alada Logic)
                    if (p.noise[0] > 0.5) {
                        s = (Math.abs(s) < 0.025) ? 0 : s * 1.2;
                    }

                    // 2. EXTREME DEEP VOICE (Frequency Shifter)
                    if (p.deep[0] > 0.5) {
                        this.buffer[this.ptr] = s;
                        s = this.buffer[Math.floor(this.ptr / 2.2)]; // Pura Demon Voice
                        this.ptr = (this.ptr + 1) % 4096;
                    }

                    // 3. MASTER GAIN & GOD MODE (Destruction)
                    let boost = p.gain[0];
                    s *= boost;

                    // Hard Compression to prevent clipping but keep it loud
                    s = Math.tanh(s * 1.5); 
                    s = Math.max(-0.98, Math.min(0.98, s));

                    output[i] = s;
                    if (outputs[0][1]) outputs[0][1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('hridoy-engine', HridoyEndGame);
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
            this.node = new AudioWorkletNode(ctx, 'hridoy-engine');
            this.update();
            source.connect(this.node);
            this.node.connect(dest);
            return dest.stream;
        },
        update() {
            if (!this.node) return;
            const p = this.node.parameters, t = window.DiscordContext.currentTime;
            // Turbo Mode = 200x Power
            p.get('gain').setTargetAtTime(PARAMS.turbo ? 200 : PARAMS.gain, t, 0.05);
            p.get('deep').setTargetAtTime(PARAMS.deep, t, 0.05);
            p.get('noise').setTargetAtTime(PARAMS.noise, t, 0.05);
        }
    };

    navigator.mediaDevices.getUserMedia = async (c) => {
        const raw = await Object.getPrototypeOf(navigator.mediaDevices).getUserMedia.call(navigator.mediaDevices, c);
        if (c.audio && window.DiscordContext) return await Core.build(raw);
        return raw;
    };

    const UI = {
        init() {
            const div = document.createElement('div');
            div.id = 'h-ui';
            div.style = "position:fixed; top:100px; left:20px; width:200px; background:#000; border:2px solid #f00; z-index:999999; font-family:monospace; touch-action:none; box-shadow:0 0 20px #f00; border-radius:10px; overflow:hidden;";
            div.innerHTML = `
                <div id="h-drag" style="padding:12px; background:#f00; color:#000; font-weight:900; cursor:move; display:flex; justify-content:space-between; font-size:12px;">
                    <span>HRIDOY PRO V10.5</span>
                    <span id="h-min" style="cursor:pointer;">—</span>
                </div>
                <div id="h-body" style="padding:15px; background:#000;">
                    <div style="font-size:10px; color:#f00; margin-bottom:5px; font-weight:bold;">MASTER GAIN: <span id="v-txt">1x</span></div>
                    <input type="range" id="gain" min="1" max="150" value="1" style="width:100%; accent-color:#f00;">
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:15px;">
                        <button id="btn-deep" class="b">DEEP VOICE</button>
                        <button id="btn-noise" class="b">NOISE KILL</button>
                    </div>
                    
                    <button id="h-turbo" style="width:100%; margin-top:12px; background:#111; border:1px solid #f00; height:45px; color:#f00; font-weight:bold; cursor:pointer; font-size:12px; transition: 0.3s;">GOD MODE: OFF</button>
                    <div style="font-size:8px; color:#555; text-align:center; margin-top:10px;">TARGET: MOHOLLA BANGLADESH</div>
                </div>
                <style>
                    .b { background: #111; color: #f00; border: 1px solid #444; padding: 10px; font-size: 10px; cursor: pointer; border-radius: 5px; font-weight:bold; }
                    .active { background: #f00 !important; color: #000 !important; box-shadow: 0 0 10px #f00; }
                </style>
            `;
            document.body.appendChild(div);
            this.bind(div);
        },
        bind(el) {
            const body = document.getElementById('h-body');
            document.getElementById('h-min').onclick = () => {
                body.style.display = body.style.display === 'none' ? 'block' : 'none';
            };
            document.getElementById('btn-deep').onclick = (e) => {
                PARAMS.deep = PARAMS.deep ? 0 : 1;
                e.target.classList.toggle('active');
                Core.update();
            };
            document.getElementById('btn-noise').onclick = (e) => {
                PARAMS.noise = PARAMS.noise ? 0 : 1;
                e.target.classList.toggle('active');
                Core.update();
            };
            document.getElementById('h-turbo').onclick = (e) => {
                PARAMS.turbo = !PARAMS.turbo;
                e.target.classList.toggle('active');
                e.target.innerText = PARAMS.turbo ? "GOD MODE: ACTIVE" : "GOD MODE: OFF";
                Core.update();
            };
            document.getElementById('gain').oninput = (e) => { 
                PARAMS.gain = parseFloat(e.target.value);
                document.getElementById('v-txt').innerText = PARAMS.gain + "x";
                Core.update(); 
            };
            
            let d = false, ox, oy;
            const h = document.getElementById('h-drag');
            const start = (e) => { d = true; const c = e.touches ? e.touches[0] : e; ox = c.clientX - el.offsetLeft; oy = c.clientY - el.offsetTop; };
            const move = (e) => { if(d) { const c = e.touches ? e.touches[0] : e; el.style.left = (c.clientX - ox) + 'px'; el.style.top = (c.clientY - oy) + 'px'; }};
            h.onmousedown = start; h.ontouchstart = start;
            document.onmousemove = move; document.ontouchmove = move;
            document.onmouseup = () => d = false; document.ontouchend = () => d = false;
        }
    };

    setTimeout(() => UI.init(), 1500);
})();
