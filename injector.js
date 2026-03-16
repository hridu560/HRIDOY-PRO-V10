(function() {
    'use strict';

    if (window.HRIDOY_PRO_TERMINATOR_V10) return;
    window.HRIDOY_PRO_TERMINATOR_V10 = true;

    // Premium Parameters with Extreme Gain
    const PARAMS = { gain: 1.0, rageGain: 0, saturation: 0, presence: 0, turbo: false, noise: 1, deep: 0 };

    const WORKLET_CODE = `
        class TerminatorEngine extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'gain', defaultValue: 1.0 },
                    { name: 'rage', defaultValue: 0.0 },
                    { name: 'saturate', defaultValue: 0.0 },
                    { name: 'presence', defaultValue: 0.0 },
                    { name: 'deep', defaultValue: 0.0 },
                    { name: 'noise', defaultValue: 1.0 }
                ];
            }
            constructor() { super(); this.echoBuf = new Float32Array(96000); this.ptr = 0; }
            process(inputs, outputs, parameters) {
                const input = inputs[0];
                const output = outputs[0];
                if (!input || !input[0]) return true;

                const gain = parameters.gain[0];
                const rage = parameters.rage[0];
                const sat = parameters.saturate[0];
                const pres = parameters.presence[0];
                const deep = parameters.deep[0];
                const noise = parameters.noise[0];

                for (let i = 0; i < input[0].length; i++) {
                    let s = input[0][i];

                    // 1. Noise Killer (Silent background)
                    if (noise > 0.5 && Math.abs(s) < 0.012) s = 0;

                    // 2. Deep Demon (Bass Aggression)
                    if (deep > 0.5) s = Math.sin(s * 1.6) * 0.8 + s * 0.4;

                    // 3. Presence (Makes you "Closer" and Sharper)
                    if (pres > 0) s += (s * pres * 0.5);

                    // 4. Extreme Gain Stage (The Hardest Boost - 100x Potential)
                    // Hridoy Pro Special: Combined Gain + Rage
                    let multiplier = gain * (1 + (rage * 15));
                    s *= multiplier;

                    // 5. Aura Saturation (Fills the frequency)
                    if (sat > 0) s = Math.atan(s * sat) * 1.5;

                    // 6. Brutal Brickwall Limiter (The Loudest possible)
                    s = Math.tanh(s * 1.5);
                    s = Math.max(-0.999, Math.min(0.999, s));

                    output[0][i] = s;
                    if (output[1]) output[1][i] = s;
                }
                return true;
            }
        }
        registerProcessor('terminator-engine', TerminatorEngine);
    `;

    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = function(...args) {
        const ctx = new NativeAudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
        window.DiscordContext = ctx;
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        ctx.audioWorklet.addModule(url).then(() => UI.setStat("TERMINATOR ACTIVE"));
        return ctx;
    };

    const Core = {
        node: null,
        async build(stream) {
            const ctx = window.DiscordContext;
            if(!ctx) return stream;
            if(ctx.state === 'suspended') await ctx.resume();
            const source = ctx.createMediaStreamSource(stream);
            const dest = ctx.createMediaStreamDestination();
            try {
                this.node = new AudioWorkletNode(ctx, 'terminator-engine');
                this.update();
                source.connect(this.node);
                this.node.connect(dest);
                return dest.stream;
            } catch (e) { return stream; }
        },
        update() {
            if (!this.node) return;
            const p = this.node.parameters;
            const t = window.DiscordContext.currentTime;
            
            p.get('gain').setTargetAtTime(PARAMS.turbo ? 500 : PARAMS.gain, t, 0.05);
            p.get('rage').setTargetAtTime(PARAMS.turbo ? 1000 : PARAMS.rageGain, t, 0.05);
            p.get('saturate').setTargetAtTime(PARAMS.saturation, t, 0.05);
            p.get('presence').setTargetAtTime(PARAMS.presence, t, 0.05);
            p.get('deep').setTargetAtTime(PARAMS.deep, t, 0.05);
            p.get('noise').setTargetAtTime(PARAMS.noise, t, 0.05);
        }
    };

    navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints.audio) {
            constraints.audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
        }
        const rawStream = await Object.getPrototypeOf(navigator.mediaDevices).getUserMedia.call(navigator.mediaDevices, constraints);
        return await Core.build(rawStream);
    };

    const UI = {
        init() {
            const container = document.createElement('div');
            container.id = 'h-ui';
            container.innerHTML = `
                <div id="h-drag" style="padding:12px; background:#000; display:flex; justify-content:space-between; border-bottom:1px solid #f00; cursor:move;">
                    <span style="font-weight:900; color:#f00; text-shadow:0 0 5px #f00;">HRIDOY PRO <span style="color:#fff">V10</span></span>
                    <div id="h-min" style="cursor:pointer; color:#f00; font-weight:bold;">−</div>
                </div>
                <div id="h-body" style="padding:15px; background:#050000;">
                    <div class="h-c"><span>GOD GAIN (100X)</span><input type="range" id="gain" min="1" max="250" value="1"></div>
                    <div class="h-c"><span>RAGE OVERDRIVE</span><input type="range" id="rageGain" min="0" max="1000" value="0"></div>
                    <div class="h-c"><span>MIC PRESENCE</span><input type="range" id="presence" min="0" max="100" value="0"></div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:10px;">
                        <button id="btn-deep">DEEP</button>
                        <button id="btn-noise" style="background:#f00; color:#000;">NOISE</button>
                    </div>
                    <button id="h-turbo" style="width:100%; margin-top:10px; background:#300; border:1px solid #f00; height:45px; font-weight:bold; color:#f00;">TERMINATOR MODE</button>
                    <div id="h-st" style="font-size:8px; text-align:center; margin-top:10px; color:#555;">STATUS: STANDBY</div>
                </div>
            `;
            document.body.appendChild(container);
            this.css();
            this.bind();
            this.drag(container);
        },
        setStat(t) { document.getElementById('h-st').innerText = "STATUS: " + t; },
        bind() {
            const body = document.getElementById('h-body');
            const ui = document.getElementById('h-ui');
            document.getElementById('h-min').onclick = () => {
                const isMin = body.style.display === 'none';
                body.style.display = isMin ? 'block' : 'none';
                document.getElementById('h-min').innerText = isMin ? '−' : '+';
                ui.style.width = isMin ? '240px' : '150px';
            };
            document.getElementById('h-turbo').onclick = (e) => {
                PARAMS.turbo = !PARAMS.turbo;
                e.target.style.background = PARAMS.turbo ? "#f00" : "#300";
                e.target.style.color = PARAMS.turbo ? "#000" : "#f00";
                e.target.innerText = PARAMS.turbo ? "CRITICAL OVERLOAD" : "TERMINATOR MODE";
                Core.update();
            };
            document.getElementById('btn-deep').onclick = (e) => {
                PARAMS.deep = PARAMS.deep === 1 ? 0 : 1;
                e.target.style.background = PARAMS.deep ? "#f00" : "#111";
                e.target.style.color = PARAMS.deep ? "#000" : "#f00";
                Core.update();
            };
            ['gain', 'rageGain', 'presence'].forEach(id => {
                document.getElementById(id).oninput = (e) => {
                    PARAMS[id] = parseFloat(e.target.value);
                    Core.update();
                };
            });
        },
        css() {
            const s = document.createElement('style');
            s.textContent = `
                #h-ui { position: fixed; top: 100px; left: 50px; width: 240px; background: #000; border: 2px solid #f00; border-radius: 5px; z-index: 999999; font-family: monospace; color: white; box-shadow: 0 0 25px rgba(255,0,0,0.4); touch-action: none; }
                .h-c { margin-bottom: 12px; }
                .h-c span { display: block; font-size: 9px; color: #f44; margin-bottom: 5px; font-weight:bold; }
                input[type=range] { width: 100%; accent-color: #f00; cursor: pointer; }
                button { background: #111; color: #f00; border: 1px solid #600; padding: 8px; font-size: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; }
            `;
            document.head.appendChild(s);
        },
        drag(el) {
            let dragging = false, offset = { x: 0, y: 0 };
            const header = document.getElementById('h-drag');
            header.addEventListener('touchstart', (e) => {
                dragging = true;
                offset.x = e.touches[0].clientX - el.offsetLeft;
                offset.y = e.touches[0].clientY - el.offsetTop;
            });
            document.addEventListener('touchmove', (e) => {
                if (dragging) {
                    el.style.left = (e.touches[0].clientX - offset.x) + 'px';
                    el.style.top = (e.touches[0].clientY - offset.y) + 'px';
                }
            });
            document.addEventListener('touchend', () => dragging = false);
            // Desktop Drag
            header.onmousedown = e => { dragging = true; offset.x = el.offsetLeft - e.clientX; offset.y = el.offsetTop - e.clientY; };
            document.onmousemove = e => { if(dragging){ el.style.left = (e.clientX + offset.x) + 'px'; el.style.top = (e.clientY + offset.y) + 'px'; }};
            document.onmouseup = () => dragging = false;
        }
    };

    setTimeout(() => UI.init(), 1000);
})();
