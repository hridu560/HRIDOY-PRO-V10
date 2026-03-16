(function() {
    'use strict';

    if (window.HRIDOY_PRO_FINAL_V10) return;
    window.HRIDOY_PRO_FINAL_V10 = true;

    const PARAMS = { gain: 1.0, rageGain: 0, presence: 0, turbo: false, noise: 1, deep: 0 };

    const WORKLET_CODE = `
        class TerminatorEngine extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'gain', defaultValue: 1.0 },
                    { name: 'rage', defaultValue: 0.0 },
                    { name: 'presence', defaultValue: 0.0 },
                    { name: 'deep', defaultValue: 0.0 },
                    { name: 'noise', defaultValue: 1.0 }
                ];
            }
            constructor() { 
                super(); 
                this.phase = 0;
            }
            process(inputs, outputs, parameters) {
                const input = inputs[0];
                const output = outputs[0];
                if (!input || !input[0]) return true;

                const gain = parameters.gain[0];
                const rage = parameters.rage[0];
                const pres = parameters.presence[0];
                const deep = parameters.deep[0];
                const noise = parameters.noise[0];

                for (let i = 0; i < input[0].length; i++) {
                    let s = input[0][i];

                    // Noise Killer Logic
                    if (noise > 0.5 && Math.abs(s) < 0.012) s = 0;

                    // Deep Voice Shift
                    if (deep > 0.5) {
                        this.phase += 0.5;
                        let idx = Math.floor(this.phase) % input[0].length;
                        s = input[0][idx];
                    }

                    // Presence & Power Boost
                    if (pres > 0) s += (s * pres * 0.4);
                    let multiplier = gain * (1 + (rage * 15));
                    s *= multiplier;

                    // Brickwall Limiter
                    s = Math.tanh(s * 1.3);
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
        ctx.audioWorklet.addModule(url).then(() => UI.setStat("SYSTEM ARMED"));
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
            p.get('gain').setTargetAtTime(PARAMS.turbo ? 400 : PARAMS.gain, t, 0.05);
            p.get('rage').setTargetAtTime(PARAMS.turbo ? 800 : PARAMS.rageGain, t, 0.05);
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
                <div id="h-drag" style="padding:10px; background:#000; display:flex; justify-content:space-between; border-bottom:1px solid #f00; cursor:move;">
                    <span style="font-weight:900; color:#f00;">HRIDOY PRO <span style="color:#fff">V10.2</span></span>
                    <div id="h-min" style="cursor:pointer; color:#f00; font-weight:bold;">−</div>
                </div>
                <div id="h-body" style="padding:15px; background:#050000;">
                    <div class="h-c"><span>GAIN (100X)</span><input type="range" id="gain" min="1" max="250" value="1"></div>
                    <div class="h-c"><span>RAGE</span><input type="range" id="rageGain" min="0" max="1000" value="0"></div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button id="btn-deep">DEEP: OFF</button>
                        <button id="btn-noise" style="background:#f00; color:#000;">NOISE: ON</button>
                    </div>
                    <button id="h-turbo" style="width:100%; margin-top:10px; background:#300; border:1px solid #f00; height:45px; font-weight:bold; color:#f00;">TERMINATOR MODE</button>
                    <div id="h-st" style="font-size:8px; text-align:center; margin-top:10px; color:#555;">STATUS: READY</div>
                </div>
            `;
            document.body.appendChild(container);
            this.css(); this.bind(); this.drag(container);
        },
        setStat(t) { document.getElementById('h-st').innerText = "STATUS: " + t; },
        bind() {
            const body = document.getElementById('h-body');
            const ui = document.getElementById('h-ui');
            document.getElementById('h-min').onclick = () => {
                const isMin = body.style.display === 'none';
                body.style.display = isMin ? 'block' : 'none';
                document.getElementById('h-min').innerText = isMin ? '−' : '+';
                ui.style.width = isMin ? '220px' : '140px';
            };
            document.getElementById('h-turbo').onclick = (e) => {
                PARAMS.turbo = !PARAMS.turbo;
                e.target.style.background = PARAMS.turbo ? "#f00" : "#300";
                e.target.style.color = PARAMS.turbo ? "#000" : "#f00";
                Core.update();
            };
            document.getElementById('btn-deep').onclick = (e) => {
                PARAMS.deep = PARAMS.deep === 1 ? 0 : 1;
                e.target.style.background = PARAMS.deep ? "#f00" : "#111";
                e.target.style.color = PARAMS.deep ? "#000" : "#f00";
                e.target.innerText = "DEEP: " + (PARAMS.deep ? "ON" : "OFF");
                Core.update();
            };
            document.getElementById('btn-noise').onclick = (e) => {
                PARAMS.noise = PARAMS.noise === 1 ? 0 : 1;
                e.target.style.background = PARAMS.noise ? "#f00" : "#111";
                e.target.style.color = PARAMS.noise ? "#000" : "#f00";
                e.target.innerText = "NOISE: " + (PARAMS.noise ? "ON" : "OFF");
                Core.update();
            };
            ['gain', 'rageGain'].forEach(id => {
                document.getElementById(id).oninput = (e) => {
                    PARAMS[id] = parseFloat(e.target.value); Core.update();
                };
            });
        },
        css() {
            const s = document.createElement('style');
            s.textContent = `
                #h-ui { position: fixed; top: 100px; left: 20px; width: 220px; background: #000; border: 2px solid #f00; border-radius: 4px; z-index: 999999; font-family: monospace; color: white; box-shadow: 0 0 20px rgba(255,0,0,0.5); touch-action: none; }
                .h-c { margin-bottom: 12px; }
                .h-c span { display: block; font-size: 8px; color: #f44; margin-bottom: 4px; font-weight:bold; }
                input[type=range] { width: 100%; accent-color: #f00; }
                button { background: #111; color: #f00; border: 1px solid #600; padding: 8px; font-size: 9px; cursor: pointer; font-weight: bold; }
            `;
            document.head.appendChild(s);
        },
        drag(el) {
            let dragging = false, offset = { x: 0, y: 0 };
            const header = document.getElementById('h-drag');
            const move = (e) => {
                if (dragging) {
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    el.style.left = (clientX - offset.x) + 'px';
                    el.style.top = (clientY - offset.y) + 'px';
                }
            };
            const start = (e) => {
                dragging = true;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                offset.x = clientX - el.offsetLeft;
                offset.y = clientY - el.offsetTop;
            };
            header.addEventListener('mousedown', start);
            header.addEventListener('touchstart', start);
            document.addEventListener('mousemove', move);
            document.addEventListener('touchmove', move);
            document.addEventListener('mouseup', () => dragging = false);
            document.addEventListener('touchend', () => dragging = false);
        }
    };

    setTimeout(() => UI.init(), 1000);
})();ntY; };
            document.onmousemove = e => { if(dragging){ el.style.left = (e.clientX + offset.x) + 'px'; el.style.top = (e.clientY + offset.y) + 'px'; }};
            document.onmouseup = () => dragging = false;
        }
    };

    setTimeout(() => UI.init(), 1000);
})();
