(function() {
    'use strict';
    if (window.HRIDOY_PREMIUM_ACTIVE) return;
    window.HRIDOY_PREMIUM_ACTIVE = true;

    // Independent Parameters
    const PARAMS = { 
        master: 1.0, 
        deep: 0.0, 
        noise: 0.0, 
        turbo: false 
    };

    const WORKLET_CODE = `
        class HridoyPremiumEngine extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'master', defaultValue: 1.0 },
                    { name: 'deep', defaultValue: 0.0 },
                    { name: 'noise', defaultValue: 0.0 }
                ];
            }
            constructor() { 
                super(); 
                this.buf = new Float32Array(16384);
                this.ptr = 0;
            }
            process(inputs, outputs, p) {
                const input = inputs[0][0];
                const output = outputs[0][0];
                if (!input) return true;

                for (let i = 0; i < input.length; i++) {
                    let s = input[i];

                    // Noise Module (Independent Power)
                    if (p.noise[0] > 0) {
                        const threshold = p.noise[0] * 0.06;
                        if (Math.abs(s) < threshold) s = 0;
                    }

                    // Deep Demon Module (Independent Power)
                    if (p.deep[0] > 0) {
                        this.buf[this.ptr] = s;
                        let offset = 1.2 + (p.deep[0] * 1.8); 
                        s = this.buf[Math.floor(this.ptr / offset)]; 
                        this.ptr = (this.ptr + 1) % 16384;
                    }

                    // Master Gain Power
                    s *= p.master[0];

                    // High-End Limiter (No Distortion)
                    s = Math.tanh(s * 1.2);
                    s = Math.max(-0.99, Math.min(0.99, s));

                    output[i] = s;
                    if (outputs[0][1]) outputs[0][1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('premium-engine', HridoyPremiumEngine);
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
            this.node = new AudioWorkletNode(ctx, 'premium-engine');
            this.update();
            source.connect(this.node);
            this.node.connect(dest);
            return dest.stream;
        },
        update() {
            if (!this.node) return;
            const p = this.node.parameters, t = window.DiscordContext.currentTime;
            p.get('master').setTargetAtTime(PARAMS.turbo ? 350 : PARAMS.master, t, 0.05);
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
            div.id = 'h-premium-ui';
            div.style = "position:fixed; top:50px; left:15px; width:230px; background:#000; border:1px solid #0f0; z-index:999999; font-family:sans-serif; color:#0f0; box-shadow:0 0 20px rgba(0,255,0,0.4); border-radius:10px; overflow:hidden;";
            div.innerHTML = `
                <div id="h-drag" style="padding:15px; background:#0f0; color:#000; font-weight:900; cursor:move; display:flex; justify-content:space-between; font-size:12px; letter-spacing:1px;">
                    <span>HRIDOY PRO V12.5</span>
                    <span id="h-min" style="cursor:pointer;">[—]</span>
                </div>
                <div id="h-body" style="padding:20px; display:flex; flex-direction:column; gap:20px; background:linear-gradient(180deg, #000 0%, #050505 100%);">
                    
                    <div class="control-group">
                        <label>MASTER POWER: <span id="m-val">1x</span></label>
                        <input type="range" id="m-range" min="1" max="150" value="1">
                    </div>

                    <div class="control-group">
                        <label>DEEP INTENSITY: <span id="d-val">0</span></label>
                        <input type="range" id="d-range" min="0" max="10" step="0.1" value="0">
                        <button id="d-btn" class="p-btn">DEEP MODULE: OFF</button>
                    </div>

                    <div class="control-group">
                        <label>NOISE FILTER: <span id="n-val">0</span></label>
                        <input type="range" id="n-range" min="0" max="10" step="0.1" value="0">
                        <button id="n-btn" class="p-btn">NOISE KILL: OFF</button>
                    </div>

                    <button id="h-turbo" class="turbo-btn">INITIALIZE GOD MODE</button>
                    
                    <div style="font-size:9px; color:#050; text-align:center; border-top:1px solid #111; padding-top:10px;">PREMIUM HARDCORE ENGINE ACTIVE</div>
                </div>
                <style>
                    .control-group { display:flex; flex-direction:column; gap:8px; }
                    .control-group label { font-size:10px; font-weight:bold; color:#0a0; }
                    input[type=range] { accent-color:#0f0; cursor:pointer; background:#111; height:4px; border-radius:2px; }
                    .p-btn { background:#000; border:1px solid #0f0; color:#0f0; padding:8px; font-size:9px; cursor:pointer; border-radius:4px; font-weight:bold; transition:0.3s; }
                    .turbo-btn { background:#010; border:2px solid #0f0; color:#0f0; padding:12px; font-weight:900; cursor:pointer; border-radius:6px; font-size:11px; box-shadow:0 0 10px rgba(0,255,0,0.2); }
                    .active { background:#0f0 !important; color:#000 !important; box-shadow:0 0 15px #0f0; }
                </style>
            `;
            document.body.appendChild(div);
            this.bind();
        },
        bind() {
            const el = document.getElementById('h-premium-ui');
            const body = document.getElementById('h-body');
            
            // Slider Listeners
            document.getElementById('m-range').oninput = (e) => { 
                PARAMS.master = parseFloat(e.target.value); 
                document.getElementById('m-val').innerText = e.target.value + "x"; 
                Core.update(); 
            };
            document.getElementById('d-range').oninput = (e) => { 
                PARAMS.deep = parseFloat(e.target.value); 
                document.getElementById('d-val').innerText = e.target.value; 
                Core.update(); 
            };
            document.getElementById('n-range').oninput = (e) => { 
                PARAMS.noise = parseFloat(e.target.value); 
                document.getElementById('n-val').innerText = e.target.value; 
                Core.update(); 
            };

            // Button Listeners
            document.getElementById('d-btn').onclick = (e) => {
                const on = e.target.classList.toggle('active');
                e.target.innerText = on ? "DEEP MODULE: ONLINE" : "DEEP MODULE: OFF";
                if(!on) { PARAMS.deep = 0; document.getElementById('d-range').value = 0; document.getElementById('d-val').innerText = "0"; }
                Core.update();
            };
            document.getElementById('n-btn').onclick = (e) => {
                const on = e.target.classList.toggle('active');
                e.target.innerText = on ? "NOISE KILL: ONLINE" : "NOISE KILL: OFF";
                if(!on) { PARAMS.noise = 0; document.getElementById('n-range').value = 0; document.getElementById('n-val').innerText = "0"; }
                Core.update();
            };
            document.getElementById('h-turbo').onclick = (e) => {
                PARAMS.turbo = !PARAMS.turbo;
                e.target.classList.toggle('active');
                e.target.innerText = PARAMS.turbo ? "GOD MODE: ACTIVE (350X)" : "INITIALIZE GOD MODE";
                Core.update();
            };

            // Minimize
            document.getElementById('h-min').onclick = () => {
                body.style.display = body.style.display === 'none' ? 'flex' : 'none';
            };

            // Premium Drag Logic
            let d = false, ox, oy;
            const h = document.getElementById('h-drag');
            h.onmousedown = (e) => { d = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; };
            document.onmousemove = (e) => { if(d) { el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; }};
            document.onmouseup = () => d = false;
        }
    };

    setTimeout(() => UI.init(), 1000);
})();
