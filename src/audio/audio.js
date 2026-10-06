// Audio Manager using Web Audio API and Kenney Sound Assets

class SoundManager {
    constructor() {
        if (typeof window !== 'undefined' && window.__gameSoundManager) {
            return window.__gameSoundManager;
        }
        this.ctx = null;
        this.buffers = {};
        this.enabled = true;
        this.musicEnabled = true;
        this.masterVolume = 0.8;
        this.musicVolume = 0.35;
        this.sounds = {
            blaster: 'assets/sounds/blaster.ogg',
            repeater: 'assets/sounds/blaster_repeater.ogg',
            enemyAttack: 'assets/sounds/enemy_attack.ogg',
            enemyDestroy: 'assets/sounds/enemy_destroy.ogg',
            enemyHurt: 'assets/sounds/enemy_hurt.ogg',
            jump: 'assets/sounds/jump_a.ogg',
            land: 'assets/sounds/land.ogg',
            step: 'assets/sounds/walking.ogg',
            switchWeapon: 'assets/sounds/weapon_change.ogg'
        };
        this.isMusicPlaying = false;
        this.musicInterval = null;
        if (typeof window !== 'undefined') {
            window.__gameSoundManager = this;
        }
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        if (typeof window === 'undefined') return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicVolume;
        this.musicGain.connect(this.masterGain);

        // Mở khóa tự động Web Audio khi có tương tác đầu tiên của người dùng
        const unlock = () => {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('click', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('click', unlock, { once: true });

        this.loadAllSounds();
    }

    resume() {
        if (!this.ctx) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    async loadAllSounds() {
        for (const [key, path] of Object.entries(this.sounds)) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (err) {
                console.warn(`Could not load audio [${key}] from ${path}:`, err);
            }
        }
    }

    play(name, options = {}) {
        if (!this.enabled) return null;
        if (!this.ctx) this.init();
        this.resume();
        if (!this.ctx) return null;

        const buffer = this.buffers[name];
        if (!buffer) return null;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        const vol = (options.volume !== undefined ? options.volume : 1.0);
        gainNode.gain.value = vol;

        const pitchVariation = options.pitchVariation !== undefined ? options.pitchVariation : 0.08;
        const rate = (options.rate !== undefined ? options.rate : 1.0) + (Math.random() - 0.5) * pitchVariation;
        source.playbackRate.value = Math.max(0.5, Math.min(2.0, rate));

        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(0);
        return source;
    }

    playShot(weaponType = 'blaster') {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        this.resume();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const type = (weaponType || 'blaster').toLowerCase();

        // Cấu hình âm thanh chuyên biệt theo từng dòng súng: trầm ấm, uy lực, triệt tiêu dải treble chói tai
        let config = {
            bassStart: 130,
            bassEnd: 38,
            bassDuration: 0.12,
            bassVolume: 0.46,
            noiseFreq: 920,
            noiseBandwidth: 1.8,
            noiseDuration: 0.08,
            noiseVolume: 0.26,
            sampleRate: 0.68,
            sampleVolume: 0.32,
            lowpassCutoff: 1800
        };

        if (type.includes('repeater') || type.includes('storm') || type.includes('ak47') || type.includes('rifle')) {
            // Súng trường / súng liên thanh: tiếng đầm, nhịp nổ dứt khoát, bass chắc, bắn liên thanh không bị mỏi tai
            config = {
                bassStart: 115,
                bassEnd: 40,
                bassDuration: 0.09,
                bassVolume: 0.42,
                noiseFreq: 820,
                noiseBandwidth: 2.0,
                noiseDuration: 0.065,
                noiseVolume: 0.22,
                sampleRate: 0.70,
                sampleVolume: 0.28,
                lowpassCutoff: 1550
            };
        } else if (type.includes('scatter') || type.includes('nova') || type.includes('shotgun')) {
            // Shotgun: tiếng nổ bùng cực kỳ uy lực, sub-bass dày sâu rung chuyển
            config = {
                bassStart: 105,
                bassEnd: 28,
                bassDuration: 0.22,
                bassVolume: 0.62,
                noiseFreq: 700,
                noiseBandwidth: 2.2,
                noiseDuration: 0.13,
                noiseVolume: 0.38,
                sampleRate: 0.56,
                sampleVolume: 0.36,
                lowpassCutoff: 1350
            };
        } else if (type.includes('sniper') || type.includes('railgun')) {
            // Súng ngắm: tiếng nổ vang trầm dội, lực đập mạnh mẽ
            config = {
                bassStart: 145,
                bassEnd: 26,
                bassDuration: 0.28,
                bassVolume: 0.68,
                noiseFreq: 880,
                noiseBandwidth: 1.6,
                noiseDuration: 0.15,
                noiseVolume: 0.42,
                sampleRate: 0.52,
                sampleVolume: 0.42,
                lowpassCutoff: 1450
            };
        }

        // TẦNG 1: SUB-BASS THUMP (Cú đấm trầm ấm - loại bỏ hoàn toàn cảm giác chói tai, tạo độ nặng vật lý)
        try {
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sine';
            const pitchShift = (Math.random() - 0.5) * 6;
            osc.frequency.setValueAtTime(config.bassStart + pitchShift, t);
            osc.frequency.exponentialRampToValueAtTime(config.bassEnd, t + config.bassDuration);

            oscGain.gain.setValueAtTime(config.bassVolume, t);
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + config.bassDuration);

            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + config.bassDuration);
        } catch {}

        // TẦNG 2: MECHANICAL NOISE CRACK (Tiếng nổ đanh cơ học qua bộ lọc Bandpass cắt sạch dải treble the thé)
        try {
            const bufferSize = Math.floor(this.ctx.sampleRate * config.noiseDuration);
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
            }
            const noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(config.noiseFreq, t);
            noiseFilter.Q.setValueAtTime(config.noiseBandwidth, t);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(config.noiseVolume, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + config.noiseDuration);

            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noiseSource.start(t);
        } catch {}

        // TẦNG 3: SAMPLE LAYER QUA BỘ LỌC LOWPASS (Hạ pitch sâu và cắt hoàn toàn tần số cao >1.8kHz)
        const bufferName = (type.includes('repeater') || type.includes('storm')) ? 'repeater' : 'blaster';
        const sampleBuffer = this.buffers[bufferName];
        if (sampleBuffer) {
            try {
                const sampleSource = this.ctx.createBufferSource();
                sampleSource.buffer = sampleBuffer;
                sampleSource.playbackRate.value = config.sampleRate + (Math.random() - 0.5) * 0.04;

                const lpFilter = this.ctx.createBiquadFilter();
                lpFilter.type = 'lowpass';
                lpFilter.frequency.setValueAtTime(config.lowpassCutoff, t);

                const sampleGain = this.ctx.createGain();
                sampleGain.gain.setValueAtTime(config.sampleVolume, t);
                sampleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

                sampleSource.connect(lpFilter);
                lpFilter.connect(sampleGain);
                sampleGain.connect(this.masterGain);
                sampleSource.start(t);
                sampleSource.stop(t + 0.14);
            } catch {}
        }
    }

    playHitMarker(isCrit = false) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Synth crisp hit beep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isCrit ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(isCrit ? 1400 : 950, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isCrit ? 600 : 400, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(isCrit ? 0.35 : 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playShieldDamage() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playPickup(type = 'health') {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = type === 'health' ? 523.25 : type === 'shield' ? 659.25 : 783.99;
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // Tiếng cạch kim loại giòn rụm khi súng kẹt đạn (Jam Click)
    playJamClick() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.04);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.04);
    }

    // Tiếng kéo khóa nòng cơ khí kép clack-clack khi thông nòng thành công (Clear Jam)
    playClearJam() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        [0, 0.12].forEach((offset, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(idx === 0 ? 440 : 660, t + offset);
            osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 220 : 330, t + offset + 0.07);

            gain.gain.setValueAtTime(0.45, t + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t + offset);
            osc.stop(t + offset + 0.07);
        });
    }

    // Tiếng đạn va đập vào tấm giáp cứng (Armor Deflection / Ricochet)
    playArmorDeflect() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200 + Math.random() * 300, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.09);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    // Tiếng tiêm thuốc hồi sinh lực (Medkit)
    playMedkit() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.linearRampToValueAtTime(700, t + 0.25);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
    }

    // Tiếng nạp pin khiên (Shield Battery)
    playShieldBattery() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.32);
    }

    // Tiếng sột soạt lục lọi túi đồ và hòm (Search Rustle Sound)
    playSearchSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.18;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 + Math.random() * 400, t);
        filter.Q.setValueAtTime(2.5, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
    }

    // Tiếng nhận diện thành công vật phẩm (Item Reveal Chime)
    playItemRevealSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1174.66, t); // Nốt D6
        osc.frequency.exponentialRampToValueAtTime(1760.00, t + 0.14); // Nốt A6

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.22);
    }

    // Tiếng chuyển đổi vật phẩm nhanh giữa 2 kho đồ (Loot Transfer)
    playLootTransferSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    // Tiếng động cơ máy bay gầm rú trên bầu trời với Stereo Panning từ trái sang phải
    playAirdropPlaneSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const duration = 4.2;

        // Âm trầm động cơ phản lực tần số thấp
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(65, t);
        osc.frequency.linearRampToValueAtTime(85, t + duration * 0.45);
        osc.frequency.linearRampToValueAtTime(55, t + duration);

        // Lọc qua lowpass để tạo độ đục như máy bay trên tầng mây cao
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, t);
        filter.frequency.linearRampToValueAtTime(420, t + duration * 0.45);
        filter.frequency.linearRampToValueAtTime(220, t + duration);

        // Stereo Panning từ loa trái sang loa phải
        let panner = null;
        if (this.ctx.createStereoPanner) {
            panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(-0.95, t);
            panner.pan.linearRampToValueAtTime(0.95, t + duration);
        }

        // Âm lượng tăng dần khi tới gần đỉnh đầu rồi giảm dần khi bay xa
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.48, t + duration * 0.4);
        gain.gain.linearRampToValueAtTime(0.001, t + duration);

        osc.connect(filter);
        if (panner) {
            filter.connect(panner);
            panner.connect(gain);
        } else {
            filter.connect(gain);
        }
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + duration);
    }

    // Procedural Cyberpunk Bass & Synth Music Track
    startMusic() {
        if (!this.musicEnabled || this.isMusicPlaying || !this.ctx) return;
        this.resume();
        this.isMusicPlaying = true;

        const bpm = 124;
        const stepTime = (60 / bpm) / 4; // 16th note
        let step = 0;

        const bassNotes = [36, 36, 48, 36, 41, 36, 44, 43]; // MIDI notes (C2, etc.)
        const leadNotes = [60, 63, 67, 70, 72, 70, 67, 63];

        const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled || !this.ctx) return;
            const t = this.ctx.currentTime;

            // Kick drum on beats 0, 4, 8, 12
            if (step % 4 === 0) {
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(130, t);
                kickOsc.frequency.exponentialRampToValueAtTime(35, t + 0.1);
                kickGain.gain.setValueAtTime(0.4, t);
                kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                kickOsc.connect(kickGain);
                kickGain.connect(this.musicGain);
                kickOsc.start(t);
                kickOsc.stop(t + 0.15);
            }

            // Hi-hat on every off-beat
            if (step % 2 === 1) {
                const bSize = this.ctx.sampleRate * 0.03;
                const buffer = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bSize * 0.3));
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const noiseFilter = this.ctx.createBiquadFilter();
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.value = 7000;
                const hGain = this.ctx.createGain();
                hGain.gain.value = 0.08;
                noise.connect(noiseFilter);
                noiseFilter.connect(hGain);
                hGain.connect(this.musicGain);
                noise.start(t);
            }

            // Bass pulse
            if (step % 2 === 0) {
                const noteIdx = Math.floor(step / 2) % bassNotes.length;
                const freq = midiToFreq(bassNotes[noteIdx]);
                const bOsc = this.ctx.createOscillator();
                const bFilter = this.ctx.createBiquadFilter();
                const bGain = this.ctx.createGain();

                bOsc.type = 'sawtooth';
                bOsc.frequency.setValueAtTime(freq, t);

                bFilter.type = 'lowpass';
                bFilter.frequency.setValueAtTime(600, t);
                bFilter.frequency.exponentialRampToValueAtTime(200, t + 0.12);

                bGain.gain.setValueAtTime(0.22, t);
                bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

                bOsc.connect(bFilter);
                bFilter.connect(bGain);
                bGain.connect(this.musicGain);
                bOsc.start(t);
                bOsc.stop(t + 0.14);
            }

            // Arpeggio synth lead
            if (step % 4 === 2) {
                const lIdx = Math.floor(step / 4) % leadNotes.length;
                const freq = midiToFreq(leadNotes[lIdx]);
                const lOsc = this.ctx.createOscillator();
                const lGain = this.ctx.createGain();
                lOsc.type = 'square';
                lOsc.frequency.setValueAtTime(freq, t);
                lGain.gain.setValueAtTime(0.07, t);
                lGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
                lOsc.connect(lGain);
                lGain.connect(this.musicGain);
                lOsc.start(t);
                lOsc.stop(t + 0.2);
            }

            step = (step + 1) % 32;
        }, stepTime * 1000);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.isMusicPlaying = false;
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return this.musicEnabled;
    }

    toggleAudio() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopMusic();
        } else if (this.musicEnabled) {
            this.startMusic();
        }
        return this.enabled;
    }

    // Tiếng cơ khí khóa chốt khi lắp phụ kiện vào súng (Satisfying Weapon Modding Clack)
    playAttachmentEquip() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        // Chuỗi âm thanh 2 nấc cơ khí: lẫy trượt + khóa chốt kim loại
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(540, t);
        osc1.frequency.exponentialRampToValueAtTime(180, t + 0.05);
        gain1.gain.setValueAtTime(0.4, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start(t);
        osc1.stop(t + 0.05);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(880, t + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(320, t + 0.12);
        gain2.gain.setValueAtTime(0.45, t + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start(t + 0.05);
        osc2.stop(t + 0.12);
    }

    // Tiếng lẫy trượt mở chốt khi tháo phụ kiện khỏi súng
    playAttachmentDetach() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.exponentialRampToValueAtTime(680, t + 0.08);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    // Tiếng kéo khóa túi Balo quân dụng Tactical (Zipper sound)
    playBackpackToggle(isOpen = true) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isOpen ? 1800 : 2400, t);
        filter.frequency.exponentialRampToValueAtTime(isOpen ? 2800 : 1400, t + 0.12);
        filter.Q.setValueAtTime(3.0, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
    }

    // Tiếng di chuyển hoặc gắp vật phẩm trong lưới
    playItemMove() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620, t);
        osc.frequency.exponentialRampToValueAtTime(840, t + 0.05);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }
}

export const sounds = (typeof window !== 'undefined' && window.__gameSoundManager)
    ? window.__gameSoundManager
    : new SoundManager();
