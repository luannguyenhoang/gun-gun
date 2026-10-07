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
        this.musicVolume = 0.4;
        this.sfxVolume = 0.8;
        if (typeof localStorage !== 'undefined') {
            try {
                const savedM = localStorage.getItem('arena_music_volume');
                if (savedM !== null) this.musicVolume = Math.max(0, Math.min(1, parseFloat(savedM)));
                const savedS = localStorage.getItem('arena_sfx_volume');
                if (savedS !== null) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(savedS)));
            } catch {}
        }
        this.sounds = {
            blaster: 'assets/sounds/blaster.ogg',
            repeater: 'assets/sounds/blaster_repeater.ogg',
            enemyAttack: 'assets/sounds/enemy_attack.ogg',
            enemyDestroy: 'assets/sounds/enemy_destroy.ogg',
            enemyHurt: 'assets/sounds/enemy_hurt.ogg',
            jump: 'assets/sounds/jump_a.ogg',
            land: 'assets/sounds/land.ogg',
            step: 'assets/sounds/walking.ogg',
            switchWeapon: 'assets/sounds/weapon_change.ogg',
            // Âm thanh và nhạc nền chiến đấu mới bổ sung
            bgmBattle: 'assets/sounds/freesound_community-battle-march-action-loop-6935.mp3',
            gunM249: 'assets/sounds/freesound_community-069321_light-machine-gun-m249-39814.mp3',
            gunBurst: 'assets/sounds/freesound_community-clean-machine-gun-burst-98224.mp3',
            gunDistance: 'assets/sounds/freesound_community-gun-shots-from-a-distance-8-39860.mp3'
        };
        this.isMusicPlaying = false;
        this.musicInterval = null;
        this.bgmSource = null;
        this.sfxGain = null;
        this.lastHitMarkerTime = 0;
        this.lastEnemyHurtTime = 0;
        this.lastEnemyDeathTime = 0;
        this.shotOffsets = {};
        this.activeShotVoice = null;
        this.continuousFireVoice = null;
        this.continuousFireTimer = null;
        if (typeof window !== 'undefined') {
            window.__gameSoundManager = this;
        }
    }

    get sfxDestination() {
        return this.sfxGain || this.masterGain;
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
        this.musicGain.gain.value = (this.musicEnabled && this.enabled) ? this.musicVolume : 0;
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.enabled ? this.sfxVolume : 0;
        this.sfxGain.connect(this.masterGain);

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

    detectTransients(audioBuffer, minGapSec = 0.11) {
        if (!audioBuffer) return [0];
        try {
            const data = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            const minSamples = Math.floor(minGapSec * sampleRate);
            const windowSize = Math.floor(0.008 * sampleRate); // Cửa sổ ~8ms
            
            let maxEnergy = 0;
            const energies = [];
            for (let i = 0; i < data.length - windowSize; i += windowSize) {
                let sum = 0;
                for (let j = 0; j < windowSize; j++) {
                    sum += Math.abs(data[i + j]);
                }
                const avg = sum / windowSize;
                energies.push({ idx: i, energy: avg });
                if (avg > maxEnergy) maxEnergy = avg;
            }

            const threshold = maxEnergy * 0.35;
            const offsets = [];
            let lastSampleIdx = -minSamples;
            for (const e of energies) {
                if (e.energy > threshold && (e.idx - lastSampleIdx) >= minSamples) {
                    offsets.push(e.idx / sampleRate);
                    lastSampleIdx = e.idx;
                }
            }
            return offsets.length > 0 ? offsets : [0];
        } catch {
            return [0];
        }
    }

    async loadAllSounds() {
        for (const [key, path] of Object.entries(this.sounds)) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;

                // Tự động phân tích các mốc phát súng đơn lẻ từ tệp âm thanh thực tế
                if (key.startsWith('gun')) {
                    this.shotOffsets[key] = this.detectTransients(audioBuffer, key === 'gunDistance' ? 0.35 : 0.12);
                }

                // Nếu tải xong nhạc nền Battle March và trạng thái nhạc đang bật thì kích hoạt phát
                if (key === 'bgmBattle' && this.musicEnabled && this.isMusicPlaying && !this.bgmSource) {
                    this.startMusic();
                }
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

        // Tự động điều hướng âm thanh zombie nhận sát thương và zombie chết sang hệ thống âm học chuyên biệt
        if (name === 'enemyHurt') {
            this.playEnemyHurt(options);
            return null;
        }
        if (name === 'enemyDestroy') {
            this.playEnemyDeath(options);
            return null;
        }

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
        gainNode.connect(this.sfxDestination);

        source.start(0);
        return source;
    }

    // Bắt đầu hoặc duy trì luồng âm thanh xả đạn liên thanh tự nhiên 100% nguyên bản từ tệp MP3
    startContinuousFire(bufferKey = 'gunBurst', volume = 0.92, rate = 1.0) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        // Nếu luồng xả đạn đang chạy với cùng mẫu âm thanh: chỉ cần gia hạn timeout dừng
        if (this.continuousFireVoice && this.continuousFireVoice.bufferKey === bufferKey) {
            this.renewContinuousFireTimeout();
            return;
        }

        // Nếu chuyển sang dòng súng khác, ngắt luồng trước đó ngay
        this.stopContinuousFire(true);

        const buffer = this.buffers[bufferKey] || this.buffers['gunBurst'] || this.buffers['gunM249'] || this.buffers['blaster'];
        if (!buffer) return;

        try {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true; // Phát lặp mượt mà chuỗi đạn xả của tệp gốc
            source.playbackRate.value = rate;

            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(volume, t);

            source.connect(gainNode);
            gainNode.connect(this.sfxDestination);
            source.start(t);

            this.continuousFireVoice = { source, gainNode, bufferKey, volume };
            this.renewContinuousFireTimeout();
        } catch (err) {
            console.warn('Lỗi khi phát luồng âm thanh xả đạn:', err);
        }
    }

    renewContinuousFireTimeout(timeoutMs = 260) {
        if (this.continuousFireTimer) {
            clearTimeout(this.continuousFireTimer);
        }
        // Nếu sau 260ms không có lệnh bắn tiếp theo (người chơi nhả chuột), tự động fade-out và dừng luồng
        this.continuousFireTimer = setTimeout(() => {
            this.stopContinuousFire();
        }, timeoutMs);
    }

    stopContinuousFire(immediate = false) {
        if (this.continuousFireTimer) {
            clearTimeout(this.continuousFireTimer);
            this.continuousFireTimer = null;
        }
        if (this.continuousFireVoice) {
            const { source, gainNode, volume } = this.continuousFireVoice;
            this.continuousFireVoice = null;
            if (this.ctx) {
                const t = this.ctx.currentTime;
                // Đuôi fade-out âm vang tiếng súng tự nhiên (0.28s) khi ngừng bắn
                const fadeTime = immediate ? 0.02 : 0.28;
                try {
                    const curGain = gainNode.gain.value || volume || 0.9;
                    gainNode.gain.cancelScheduledValues(t);
                    gainNode.gain.setValueAtTime(curGain, t);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, t + fadeTime);
                    source.stop(t + fadeTime);
                } catch {}
            }
        }
    }

    stopShot() {
        this.stopContinuousFire();
    }

    playShot(weaponType = 'blaster') {
        if (!this.enabled) return;
        if (!this.ctx) this.init();
        this.resume();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const type = (weaponType || 'blaster').toLowerCase();

        // 1. SÚNG NGẮM SNIPER (bắn phát một uy lực cao): phát độc lập âm vang dội sấm sét
        const isSniper = type.includes('sniper') || type.includes('railgun') || type.includes('blaster_i') || type.includes('sharpshooter');
        if (isSniper) {
            const buffer = this.buffers['gunDistance'] || this.buffers['gunBurst'];
            if (!buffer) return;
            try {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = 0.98;

                const gainNode = this.ctx.createGain();
                gainNode.gain.setValueAtTime(0.98, t);
                gainNode.gain.setValueAtTime(0.98, t + 0.85);
                gainNode.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

                source.connect(gainNode);
                gainNode.connect(this.sfxDestination);
                source.start(t);
                source.stop(t + 1.4);
            } catch {}
            return;
        }

        // 2. TẤT CẢ CÁC KHẨU SÚNG CÒN LẠI (kể cả blaster mặc định, blaster-a, b, c, d, e, rifle, m249...):
        // Áp dụng CƠ CHẾ XẢ ĐẠN NGUYÊN BẢN TỆP MP3, NGỪNG BẮN LÀ FADE OUT ÂM VANG DỪNG LẠI!
        const isHeavy = type.includes('m249') || type.includes('machinegun') || type.includes('repeater') || type.includes('blaster_e');
        const bufferKey = isHeavy ? 'gunM249' : 'gunBurst';
        const rate = (type.includes('scatter') || type.includes('shotgun') || type.includes('blaster_f') || type.includes('blaster_g')) ? 0.88 : 1.0;

        this.startContinuousFire(bufferKey, 0.92, rate);
    }

    playHitMarker(isCrit = false) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        // Chống clipping và dội âm khi đạn shotgun hoặc súng liên thanh chạm nhiều mục tiêu cùng lúc
        if (!isCrit && t - (this.lastHitMarkerTime || 0) < 0.028) {
            return;
        }
        this.lastHitMarkerTime = t;

        if (isCrit) {
            // CRIT / HEADSHOT: Hài âm chuông thanh nhã (Pure Metallic Bell Ding - 2 nốt hòa âm ngọt ngào) + Heavy Impact
            try {
                // Tầng 1: Sub Thump uy lực
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(160, t);
                subOsc.frequency.exponentialRampToValueAtTime(45, t + 0.07);

                subGain.gain.setValueAtTime(0.32, t);
                subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

                subOsc.connect(subGain);
                subGain.connect(this.sfxDestination);
                subOsc.start(t);
                subOsc.stop(t + 0.07);

                // Tầng 2: Chuông kim loại trong trẻo (Pure Sine - hoàn toàn không chói rát như sawtooth cũ)
                const pitches = [1280, 1920];
                pitches.forEach((freq, idx) => {
                    const bellOsc = this.ctx.createOscillator();
                    const bellGain = this.ctx.createGain();
                    bellOsc.type = 'sine';
                    bellOsc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 20, t);

                    const vol = idx === 0 ? 0.22 : 0.14;
                    bellGain.gain.setValueAtTime(vol, t);
                    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

                    bellOsc.connect(bellGain);
                    bellGain.connect(this.sfxDestination);
                    bellOsc.start(t);
                    bellOsc.stop(t + 0.08);
                });
            } catch {}
        } else {
            // BODY HIT: Tiếng "thwack" găm vào da thịt chắc nịch + Click cơ học giòn tan, êm dịu không gắt
            try {
                // Tầng 1: Flesh Thud (Tiếng đạn cắm ngập vào da thịt)
                const thudOsc = this.ctx.createOscillator();
                const thudGain = this.ctx.createGain();
                thudOsc.type = 'sine';
                const startFreq = 220 + (Math.random() - 0.5) * 25;
                thudOsc.frequency.setValueAtTime(startFreq, t);
                thudOsc.frequency.exponentialRampToValueAtTime(60, t + 0.045);

                thudGain.gain.setValueAtTime(0.24, t);
                thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

                thudOsc.connect(thudGain);
                thudGain.connect(this.sfxDestination);
                thudOsc.start(t);
                thudOsc.stop(t + 0.045);

                // Tầng 2: Crisp Impact Transient (Lách cách tinh tế lọc qua Bandpass 1.5kHz)
                const bSize = Math.floor(this.ctx.sampleRate * 0.022);
                const noiseBuf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * (1 - i / bSize);
                }
                const noiseSrc = this.ctx.createBufferSource();
                noiseSrc.buffer = noiseBuf;

                const bpFilter = this.ctx.createBiquadFilter();
                bpFilter.type = 'bandpass';
                bpFilter.frequency.setValueAtTime(1500, t);
                bpFilter.Q.setValueAtTime(2.2, t);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.16, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

                noiseSrc.connect(bpFilter);
                bpFilter.connect(noiseGain);
                noiseGain.connect(this.sfxDestination);
                noiseSrc.start(t);
            } catch {}
        }
    }

    // Tiếng zombie bị thương trầm đục, loại bỏ hoàn toàn dải âm chói tai
    playEnemyHurt(options = {}) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        // Giới hạn tần suất phát âm hurt để tránh ồn ào khi quét đạn diện rộng
        if (t - (this.lastEnemyHurtTime || 0) < 0.075) {
            return;
        }
        this.lastEnemyHurtTime = t;

        const volume = (options.volume !== undefined ? options.volume : 0.45) * 0.7;

        // Âm thanh rên gầm thâm trầm nghẹn họng của xác sống (Visceral Zombie Grunt)
        try {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            // Sóng triangle kết hợp Lowpass lọc hoàn toàn treble >500Hz
            osc.type = 'triangle';
            const baseFreq = 105 + (Math.random() - 0.5) * 30;
            osc.frequency.setValueAtTime(baseFreq, t);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, t + 0.12);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(480, t);
            filter.frequency.exponentialRampToValueAtTime(220, t + 0.12);

            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxDestination);

            osc.start(t);
            osc.stop(t + 0.13);
        } catch {}
    }

    // Tiếng tiêu diệt zombie uy lực, đã tai (3 tầng: Sub-bass + Visceral Gore Crunch + Pop chốt hạ)
    playEnemyDeath(options = {}) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        // Điều tiết khoảng cách nếu nhiều quái chết đồng thời (ví dụ do nổ lựu đạn)
        if (t - (this.lastEnemyDeathTime || 0) < 0.04) {
            return;
        }
        this.lastEnemyDeathTime = t;

        const isBoss = !!options.isBoss || (options.volume && options.volume >= 1.0);
        const duration = isBoss ? 0.32 : 0.18;
        const targetVol = options.volume !== undefined ? options.volume : 0.75;

        // TẦNG 1: SUB-BASS COLLAPSE (Độ nặng thân xác quái vật đổ ập xuống mặt đất)
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const startFreq = isBoss ? 70 : 85;
            const endFreq = isBoss ? 20 : 28;
            osc.frequency.setValueAtTime(startFreq, t);
            osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

            gain.gain.setValueAtTime(Math.min(0.55, targetVol * 0.58), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.sfxDestination);
            osc.start(t);
            osc.stop(t + duration);
        } catch {}

        // TẦNG 2: VISCERAL GORE CRUNCH (Tiếng xương thịt đứt gãy đầm ấm qua Lowpass 700Hz)
        try {
            const bufSize = Math.floor(this.ctx.sampleRate * (duration * 0.85));
            const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.4));
            }
            const noiseSrc = this.ctx.createBufferSource();
            noiseSrc.buffer = noiseBuf;

            const lpFilter = this.ctx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.setValueAtTime(isBoss ? 550 : 720, t);
            lpFilter.Q.setValueAtTime(1.8, t);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(Math.min(0.38, targetVol * 0.42), t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.85);

            noiseSrc.connect(lpFilter);
            lpFilter.connect(noiseGain);
            noiseGain.connect(this.sfxDestination);
            noiseSrc.start(t);
        } catch {}

        // TẦNG 3: SATISFYING KILL CONFIRM POP (Tiếng chốt hạ mục tiêu ngọt ngào, tạo cảm giác thỏa mãn cực cao)
        try {
            const popOsc = this.ctx.createOscillator();
            const popGain = this.ctx.createGain();
            popOsc.type = 'triangle';
            popOsc.frequency.setValueAtTime(320, t);
            popOsc.frequency.exponentialRampToValueAtTime(140, t + 0.055);

            popGain.gain.setValueAtTime(0.24, t);
            popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

            popOsc.connect(popGain);
            popGain.connect(this.sfxDestination);
            popOsc.start(t);
            popOsc.stop(t + 0.055);
        } catch {}
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
            gain.connect(this.sfxDestination);
            osc.start(t + offset);
            osc.stop(t + offset + 0.07);
        });
    }

    // Tiếng đạn va đập vào tấm giáp cứng (Armor Deflection / Ricochet - Đanh thép, chắc nịch, không chói tai)
    playArmorDeflect() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const t = this.ctx.currentTime;
        try {
            // Sóng triangle tần số kim loại đanh chắc + dứt khoát
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            const baseFreq = 780 + Math.random() * 180;
            osc.frequency.setValueAtTime(baseFreq, t);
            osc.frequency.exponentialRampToValueAtTime(260, t + 0.07);

            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

            osc.connect(gain);
            gain.connect(this.sfxDestination);
            osc.start(t);
            osc.stop(t + 0.07);

            // Tiếng clink kim loại đanh gọn
            const clinkOsc = this.ctx.createOscillator();
            const clinkGain = this.ctx.createGain();
            clinkOsc.type = 'sine';
            clinkOsc.frequency.setValueAtTime(1400 + Math.random() * 200, t);
            clinkOsc.frequency.exponentialRampToValueAtTime(700, t + 0.035);

            clinkGain.gain.setValueAtTime(0.18, t);
            clinkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

            clinkOsc.connect(clinkGain);
            clinkGain.connect(this.sfxDestination);
            clinkOsc.start(t);
            clinkOsc.stop(t + 0.035);
        } catch {}
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);

        osc.start(t);
        osc.stop(t + duration);
    }

    // Nhạc nền chiến đấu Battle March Action Loop chất lượng cao
    startMusic() {
        if (!this.musicEnabled || !this.ctx) return;
        this.resume();
        this.isMusicPlaying = true;

        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }

        // Dừng nguồn phát nhạc cũ nếu đang chạy
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
                this.bgmSource.disconnect();
            } catch {}
            this.bgmSource = null;
        }

        const bgmBuffer = this.buffers['bgmBattle'];
        if (bgmBuffer) {
            try {
                const source = this.ctx.createBufferSource();
                source.buffer = bgmBuffer;
                source.loop = true;
                source.connect(this.musicGain);
                source.start(0);
                this.bgmSource = source;
            } catch (err) {
                console.warn('Lỗi khi phát nhạc nền Battle March:', err);
            }
        }
    }

    stopMusic() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
                this.bgmSource.disconnect();
            } catch {}
            this.bgmSource = null;
        }
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.isMusicPlaying = false;
    }

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, parseFloat(val)));
        if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem('arena_music_volume', this.musicVolume.toString()); } catch {}
        }
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime((this.musicEnabled && this.enabled) ? this.musicVolume : 0, this.ctx.currentTime);
        }
        if (this.musicVolume > 0 && this.musicEnabled && this.enabled && !this.bgmSource) {
            this.startMusic();
        }
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, parseFloat(val)));
        if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem('arena_sfx_volume', this.sfxVolume.toString()); } catch {}
        }
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.enabled ? this.sfxVolume : 0, this.ctx.currentTime);
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime((this.musicEnabled && this.enabled) ? this.musicVolume : 0, this.ctx.currentTime);
        }
        if (!this.musicEnabled) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return this.musicEnabled;
    }

    toggleAudio() {
        this.enabled = !this.enabled;
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.enabled ? this.sfxVolume : 0, this.ctx.currentTime);
        }
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime((this.musicEnabled && this.enabled) ? this.musicVolume : 0, this.ctx.currentTime);
        }
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
        gain1.connect(this.sfxDestination);
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
        gain2.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
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
        gain.connect(this.sfxDestination);
        osc.start(t);
        osc.stop(t + 0.05);
    }
}

export const sounds = (typeof window !== 'undefined' && window.__gameSoundManager)
    ? window.__gameSoundManager
    : new SoundManager();
