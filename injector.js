(function() {
    'use strict';
    if (window.HRIDOY_TERMINATOR_V10_FIX) return;
    window.HRIDOY_TERMINATOR_V10_FIX = true;

    const PARAMS = { deep: 0, god: 0, echo: 0, crush: 0, noise: 0, vol: 1.0 };

    const WORKLET_CODE = `
        class TerminatorEngine extends AudioWorkletProcessor {
            constructor() {
                super();
                this.echoBuf = new Float32Array(96000); 
                this.ptr = 0;
            }
            process(inputs, outputs, p) {
                const input = inputs[0];
                const output = outputs[0];
                if (!input || !input[0] || input[0].length === 0) return true;

                for (let i = 0; i < input[0].length; i++) {
                    let s = input[0][i];

                    if (p.noise[0] > 0.5 && Math.abs(s) < 0.015) s = 0;
                    if (p.deep[0] > 0.5) s = Math.sin(s * 1.6) * 0.8 + s * 0.3;
                    if (p.echo[0] > 0.5) {
                        let d = this.echoBuf[(this.ptr - 8000 + 96000) % 96000];
                        s = s * 0.5 + d * 0.5;
                        this.echoBuf[this.ptr] = s;
                        this.ptr = (this.ptr + 1) % 96000;
                    }
                    if (p.crush[0] > 0.5) s = Math.round(s * 8) / 8;

                    let g = p.vol[0] * (p.god[0] > 0.5 ? 100.0 : 1.0); 
                    s *= g;
                    s = Math.tanh(s);

                    output[0][i] = s;
                    if (output[1]) output[1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('terminator-engine', TerminatorEngine);
    `;

    // FORCE INJECTION: ডিসকর্ডকে বাধ্য করা আমাদের ইঞ্জিন ব্যবহার করতে
    const NativeAudio = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = function() {
        const ctx = new NativeAudio({ latencyHint: 'interactive', sampleRate: 44100 });
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        ctx.audioWorklet.addModule(URL.createObjectURL(blob)).then(() => {
            window.node = new AudioWorkletNode(ctx, 'terminator-engine', { parameterData: PARAMS });
            console.log("HRIDOY ENGINE INJECTED");
        });
        window.DiscordCtx = ctx;
        return ctx;
    };

    const createUI = () => {
        const gui = document.createElement('div');
        gui.id = "h-gui";
        gui.style = "position:fixed; top:50px; right:10px; z-index:999999; background:#0a0000; border:2px solid #f00; padding:15px; border-radius:10px; width:200px; font-family:monospace; color:#f00; box-shadow:0 0 20px #f00; touch-action:none; cursor:move;";
        gui.innerHTML = `
            <div id="h-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #400; padding-bottom:5px;">
                <span style="font-weight:bold; font-size:12px;">HRIDOY PRO V10</span>
                <button id="h-min" style="background:none; border:1px solid #f00; color:#f00; width:22px; height:22px; font-weight:bold;">—</button>
            </div>
            <div id="h-body">
                <div style="margin-bottom:10px; font-size:10px;">POWER: <span id="v-txt">1x</span>
                    <input type="range" id="v-sld" min="1" max="100" value="1" style="width:100%; accent-color:#f00;">
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                    <button id="b-noise" class="t-btn">NOISE</button>
                    <button id="b-deep" class="t-btn">DEEP</button>
                    <button id="b-echo" class="t-btn">ECHO</button>
                    <button id="b-crush" class="t-btn">CRUSH</button>
                </div>
                <button id="b-god" class="t-btn" style="width:100%; margin-top:10px; background:#400; height:40px; font-size:12px;">GOD MODE [OFF]</button>
            </div>
            <style>
                .t-btn { background:#111; border:1px solid #600; color:#f00; padding:8px; font-size:9px; cursor:pointer; font-weight:bold; text-transform:uppercase; }
                .active { background:#f00 !important; color:#000 !important; box-shadow:0 0 10px #f00; }
            </style>
        `;
        document.body.appendChild(gui);

        // DRAGGABLE LOGIC (বামে-ডানে সরানোর জন্য)
        let isDragging = false, offset = { x: 0, y: 0 };
        gui.addEventListener('touchstart', (e) => {
            isDragging = true;
            offset.x = e.touches[0].clientX - gui.offsetLeft;
            offset.y = e.touches[0].clientY - gui.offsetTop;
        });
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            gui.style.left = (e.touches[0].clientX - offset.x) + 'px';
            gui.style.top = (e.touches[0].clientY - offset.y) + 'px';
            gui.style.right = 'auto'; // সরাতে গেলে রাইট লক ছাড়তে হবে
        });
        document.addEventListener('touchend', () => isDragging = false);

        // Minimize Logic
        const minBtn = document.getElementById('h-min'), body = document.getElementById('h-body');
        let isMin = false;
        minBtn.onclick = () => {
            isMin = !isMin;
            body.style.display = isMin ? 'none' : 'block';
            minBtn.innerText = isMin ? '+' : '—';
            gui.style.width = isMin ? '110px' : '200px';
        };

        const sld = document.getElementById('v-sld');
        sld.oninput = (e) => {
            const v = parseFloat(e.target.value);
            document.getElementById('v-txt').innerText = v + "x";
            if(window.node) window.node.parameters.get('vol').setTargetAtTime(v, window.DiscordCtx.currentTime, 0.1);
        };

        const setup = (id, p) => {
            const b = document.getElementById(id);
            b.onclick = () => {
                const val = b.classList.toggle('active') ? 1 : 0;
                if(id === 'b-god') b.innerText = `GOD MODE [${val ? 'ON' : 'OFF'}]`;
                if(window.node) window.node.parameters.get(p === 'god' ? 'god' : p).setValueAtTime(val, window.DiscordCtx.currentTime);
            };
        };
        ['noise','deep','echo','crush','god'].forEach(k => setup('b-'+k, k));
    };

    setTimeout(createUI, 4000);
})();
