(function() {
    'use strict';
    if (window.HRIDOY_PRO_TERMINATOR) return;
    window.HRIDOY_PRO_TERMINATOR = true;

    const PARAMS = { deep: 0, god: 0, echo: 0, crush: 0, noise: 0, vol: 1.0 };

    const WORKLET_CODE = `
        class TerminatorEngine extends AudioWorkletProcessor {
            constructor() {
                super();
                this.echoBuf = new Float32Array(96000); 
                this.ptr = 0;
            }
            process(inputs, outputs, p) {
                const input = inputs[0][0];
                const output = outputs[0][0];
                if (!input) return true;

                for (let i = 0; i < input.length; i++) {
                    let s = input[i];

                    // 1. NOISE KILLER (Premium Silence)
                    if (p.noise[0] > 0.5 && Math.abs(s) < 0.012) s = 0;

                    // 2. DEEP DEMON (Bass Aggression)
                    if (p.deep[0] > 0.5) {
                        s = Math.sin(s * 1.5) * 0.8 + s * 0.4;
                    }

                    // 3. METALLIC ECHO
                    if (p.echo[0] > 0.5) {
                        let d = this.echoBuf[(this.ptr - 7000 + 96000) % 96000];
                        s = s * 0.6 + d * 0.5;
                        this.echoBuf[this.ptr] = s;
                        this.ptr = (this.ptr + 1) % 96000;
                    }

                    // 4. BIT CRUSH (Digital Distortion)
                    if (p.crush[0] > 0.5) {
                        s = Math.round(s * 10) / 10;
                    }

                    // 5. GOD MODE OVERDRIVE (The Hardest Boost - 80x Power)
                    let g = p.vol[0] * (p.god[0] > 0.5 ? 80.0 : 1.0);
                    s *= g;

                    // 6. SOFT TANH LIMITER (Loud but not broken)
                    s = Math.tanh(s * 1.2);

                    output[i] = s;
                    if (outputs[0][1]) outputs[0][1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('terminator-engine', TerminatorEngine);
    `;

    const NativeAudio = window.AudioContext;
    window.AudioContext = function() {
        const ctx = new NativeAudio({ latencyHint: 'interactive' });
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        ctx.audioWorklet.addModule(URL.createObjectURL(blob)).then(() => {
            window.node = new AudioWorkletNode(ctx, 'terminator-engine', { parameterData: PARAMS });
        });
        window.DiscordCtx = ctx;
        return ctx;
    };

    const createUI = () => {
        const gui = document.createElement('div');
        gui.style = "position:fixed; top:20px; right:20px; z-index:999999; background:linear-gradient(180deg, #0d0000, #000); border:1px solid #ff0000; padding:20px; border-radius:12px; width:220px; box-shadow: 0 0 30px #f00; font-family:sans-serif; color:#f00;";
        gui.innerHTML = `
            <div style="text-align:center; font-size:18px; font-weight:900; letter-spacing:1.5px; margin-bottom:10px; text-shadow:0 0 10px #f00;">HRIDOY TERMINATOR</div>
            <div style="text-align:center; font-size:9px; color:#500; margin-bottom:15px; text-transform:uppercase;">Dominance Protocol V10</div>
            
            <div style="margin-bottom:15px; border-bottom:1px solid #300; padding-bottom:10px;">
                <label style="font-size:10px; color:#ff4d4d;">POWER GAIN: <span id="v-txt">1x</span></label>
                <input type="range" id="v-sld" min="1" max="100" value="1" style="width:100%; accent-color:#f00; margin-top:8px;">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                <button id="b-noise" class="t-btn">NOISE</button>
                <button id="b-deep" class="t-btn">DEEP</button>
                <button id="b-echo" class="h-btn">ECHO</button>
                <button id="b-crush" class="h-btn">CRUSH</button>
            </div>
            <button id="b-god" class="t-btn" style="width:100%; margin-top:10px; background:#400; font-size:13px; font-weight:bold; height:50px; border:1px solid #f00; color:#fff;">GOD MODE [OFF]</button>

            <style>
                .t-btn, .h-btn { background:#050505; border:1px solid #400; color:#f00; padding:10px; border-radius:5px; font-size:10px; font-weight:bold; cursor:pointer; transition:0.2s; }
                .active { background:#f00 !important; color:#000 !important; box-shadow: 0 0 15px #f00; border-color:#fff !important; }
            </style>
        `;
        document.body.appendChild(gui);

        const sld = document.getElementById('v-sld');
        sld.oninput = (e) => {
            const v = parseFloat(e.target.value);
            document.getElementById('v-txt').innerText = v + "x";
            if(window.node) window.node.parameters.get('vol').setTargetAtTime(v, window.DiscordCtx.currentTime, 0.1);
        };

        const setup = (id, p) => {
            const b = document.getElementById(id);
            b.onclick = () => {
                PARAMS[p] = PARAMS[p] === 1 ? 0 : 1;
                b.classList.toggle('active');
                if(id === 'b-god') b.innerText = `GOD MODE [${PARAMS[p] ? 'ON' : 'OFF'}]`;
                if(window.node) window.node.parameters.get(p === 'god' ? 'god' : p).setValueAtTime(PARAMS[p], window.DiscordCtx.currentTime);
            };
        };

        ['noise','deep','echo','crush','god'].forEach(k => setup(k === 'echo' || k === 'crush' ? 'b-'+k : 'b-'+k, k));
    };

    setTimeout(createUI, 4000);
})();