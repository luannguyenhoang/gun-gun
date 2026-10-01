import * as THREE from 'three';
import { LOOT_ITEMS, LOOT_TIERS } from './looting.js?v=22';
import { sounds } from './audio.js';
import { ATTACHMENT_DEFS } from './weapons.js?v=22';

const _tempMateWorldPos = new THREE.Vector3();
const _tempNdc = new THREE.Vector3();

// Cấu hình màu sắc đặc trưng theo từng nhân vật
const CHARACTER_COLORS = {
    soldier: '#22e6a5',
    skeleton: '#ffe06a',
    vampire: '#ff5577'
};

// Hàm trả về chuỗi SVG đại diện cho avatar nhân vật
function getCharacterAvatarSvg(characterId) {
    switch (characterId) {
        case 'skeleton':
            // Biểu tượng khung xương
            return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a8 8 0 0 0-8 8c0 3.2 1.9 6 4.7 7.2l.3 2.8h6l.3-2.8A8 8 0 0 0 20 10a8 8 0 0 0-8-8zm-3 7.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-4.5 7h3v2h-3v-2z"/></svg>`;
        case 'vampire':
            // Biểu tượng ma cà rồng
            return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l-3 4-5-1 2 5-4 2 4 4-2 6 6-3 2 3 2-3 6 3-2-6 4-4-4-2 2-5-5 1-3-4zm0 6a3 3 0 0 1 3 3c0 1.2-.7 2.2-1.7 2.7l.7 2.3-2-.7-2 .7.7-2.3C9.7 13.2 9 12.2 9 11a3 3 0 0 1 3-3z"/></svg>`;
        case 'soldier':
        default:
            // Biểu tượng chiến binh / lính
            return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8 2 4.5 4.5 4 8.5v3c0 4.5 3.5 8 8 8.5 4.5-.5 8-4 8-8.5v-3C19.5 4.5 16 2 12 2zm0 3c2.5 0 5 1.5 5.5 3.5H6.5C7 6.5 9.5 5 12 5zm-6 6.5c0-.8.2-1.5.5-2h11c.3.5.5 1.2.5 2 0 3-2.5 5.5-6 6-3.5-.5-6-3-6-6z"/></svg>`;
    }
}

export class UIManager {
    constructor() {
        this.overheadVitals = document.getElementById('player-overhead-vitals');
        this.healthFill = document.getElementById('health-fill');
        this.healthText = document.getElementById('health-text');
        this.shieldFill = document.getElementById('shield-fill');
        this.shieldText = document.getElementById('shield-text');
        this.staminaFill = document.getElementById('stamina-fill');
        this.staminaText = document.getElementById('stamina-text');

        this.buffDamage = document.getElementById('buff-damage');
        this.buffDamageVal = document.getElementById('buff-damage-val');
        this.buffRapid = document.getElementById('buff-rapid');
        this.buffRapidVal = document.getElementById('buff-rapid-val');
        this.buffMulti = document.getElementById('buff-multi');
        this.buffMultiVal = document.getElementById('buff-multi-val');
        this.buffShield = document.getElementById('buff-shield');
        this.buffShieldVal = document.getElementById('buff-shield-val');
        this.buffCrit = document.getElementById('buff-crit');
        this.buffCritVal = document.getElementById('buff-crit-val');

        this.scoreVal = document.getElementById('score-value');
        this.waveVal = document.getElementById('wave-value');
        this.enemiesVal = document.getElementById('enemies-value');

        this.weaponName = document.getElementById('weapon-name');
        this.upgradeStats = document.getElementById('upgrade-stats');
        this.ammoCurrent = document.getElementById('ammo-current');
        this.ammoMax = document.getElementById('ammo-max');
        this.reloadBar = document.getElementById('reload-progress-bar');
        this.weaponSlots = [
            document.getElementById('slot-1'),
            document.getElementById('slot-2'),
            document.getElementById('slot-3'),
            document.getElementById('slot-4'),
            document.getElementById('slot-5')
        ];
        this.slot1Label = document.getElementById('slot-1-label');
        this.slot3Label = document.getElementById('slot-3-label');
        this.slotMedkitQty = document.getElementById('slot-medkit-qty');
        this.slotShieldQty = document.getElementById('slot-shield-qty');

        this.crosshair = document.getElementById('crosshair');
        this.hitmarker = document.getElementById('hitmarker');
        this.damageVignette = document.getElementById('damage-vignette');
        this.floatingContainer = document.getElementById('floating-numbers');
        this.bannerText = document.getElementById('announcement-banner');
        this.pickupAlert = document.getElementById('pickup-alert');

        // HUD Loading thay đạn ở giữa màn hình và vòng nạp đạn tâm ngắm
        this.centerReload = document.getElementById('hud-center-reload');
        this.centerReloadTitle = document.getElementById('hud-reload-title');
        this.centerReloadPct = document.getElementById('hud-reload-pct');
        this.centerReloadFill = document.getElementById('hud-reload-fill');
        this.centerReloadSub = document.getElementById('hud-reload-sub');
        this.crosshairReloadRing = document.getElementById('crosshair-reload-ring');
        this.crosshairReloadBar = document.getElementById('reload-ring-bar');
        this._reloadRingCircumference = 2 * Math.PI * 22; // Chu vi vòng tròn bán kính 22px (~138.23)
        this._wasReloading = false;
        this._reloadHideTimeout = null;

        this.bossContainer = document.getElementById('boss-health-container');
        this.bossFill = document.getElementById('boss-health-fill');

        this.radarCanvas = document.getElementById('radar-canvas');
        if (this.radarCanvas) {
            this.radarCtx = this.radarCanvas.getContext('2d');
        }

        // Vùng chứa biểu tượng đồng đội ngoài màn hình và danh sách đồng đội
        this.teammateContainer = document.getElementById('teammate-indicators');
        this.teamRoster = document.getElementById('team-roster');
        this.teammateMarkers = new Map();

        // Minimalist Survival Bottom HUD System Elements
        this.thBottomHud = document.getElementById('th-bottom-hud');
        this.thDistVal = document.getElementById('th-dist-val');
        this.thStatusPain = document.getElementById('th-status-pain');
        this.thStatusLight = document.getElementById('th-status-light');
        this.thHealthFill = document.getElementById('th-health-fill');
        this.thHealthVal = document.getElementById('th-health-val');
        this.thCircleWater = document.getElementById('th-circle-water');
        this.thCircleEnergy = document.getElementById('th-circle-energy');
        this.thAmmoCur = document.getElementById('th-ammo-cur');
        this.thAmmoReserve = document.getElementById('th-ammo-reserve');
        this.thActiveSlot = document.getElementById('th-active-slot');
        this.thActiveSilhouette = document.getElementById('th-active-silhouette');

        this.thSlot2 = document.getElementById('th-slot-2');
        this.thSlot3 = document.getElementById('th-slot-3');
        this.thQtyMedkit = document.getElementById('th-qty-medkit');

        // Các thành phần của PUBG Mobile Bottom HUD
        this.pubgGun1Name = document.getElementById('pubg-gun1-name');
        this.pubgGun1Cur = document.getElementById('pubg-gun1-cur');
        this.pubgGun1Res = document.getElementById('pubg-gun1-res');
        this.pubgGun2Name = document.getElementById('pubg-gun2-name');
        this.pubgGun2Cur = document.getElementById('pubg-gun2-cur');
        this.pubgGun2Res = document.getElementById('pubg-gun2-res');
        this.pubgGun2Silhouette = document.getElementById('pubg-gun2-silhouette');

        // Các ô Bom PUBG HUD
        this.thSlotBomb1 = document.getElementById('th-slot-bomb1');
        this.thSlotBomb2 = document.getElementById('th-slot-bomb2');
        this.pubgBomb1Name = document.getElementById('pubg-bomb1-name');
        this.pubgBomb1Qty = document.getElementById('pubg-bomb1-qty');
        this.thBomb1Silhouette = document.getElementById('th-bomb1-silhouette');
        this.pubgBomb2Name = document.getElementById('pubg-bomb2-name');
        this.pubgBomb2Qty = document.getElementById('pubg-bomb2-qty');
        this.thBomb2Silhouette = document.getElementById('th-bomb2-silhouette');

        this.pubgFireModeBadge = document.getElementById('pubg-fire-mode-badge');
        this.pubgFireModeText = document.getElementById('pubg-fire-mode-text');
        this.pubgHpFill = document.getElementById('pubg-hp-fill');
        this.thSlotMelee = document.getElementById('th-slot-melee');
        this.pubgHudHelmet = document.getElementById('pubg-hud-helmet');
        this.pubgHudVest = document.getElementById('pubg-hud-vest');

        // Thanh tiến trình sơ cứu Medkit 5 giây
        this.thMedkitChannel = document.getElementById('th-medkit-channel');
        this.thMedkitCountdown = document.getElementById('th-medkit-countdown');
        this.thMedkitFill = document.getElementById('th-medkit-channel-fill');

        this.bannerTimeout = null;
        this.pickupTimeout = null;

        // Cache dirty check để tối ưu 60 FPS, không gây layout reflow / GC rác
        this._lastPosX = -9999;
        this._lastPosY = -9999;
        this._lastCrossDisplay = null;
        this._lastSpreadGap = -1;
        this._lastHpVal = -1;
        this._lastMaxHp = -1;
        this._lastShVal = -1;
        this._lastMaxSh = -1;
        this._lastStPercent = -1;
        this._lastStText = '';
        this._lastUpgradesKey = '';
        this._lastVignettePulse = null;
        this._lastScore = -1;
        this._lastPhase = -1;
        this._lastEnemies = -1;
        this._lastWeaponId = '';
        this._lastUpgradeStats = '';
        this._lastAmmoCur = -1;
        this._lastAmmoMaxStr = '';
        this._lastReloadKey = '';
        this._lastSlotKey = '';
        this._lastBossVisible = null;
        this._lastBossPct = -1;
        this._lastRosterKey = '';

        // Survival Bottom HUD dirty cache
        this._lastDistVal = '';
        this._lastPainText = '';
        this._lastLightText = '';
        this._lastThHpText = '';
        this._lastThHpPct = -1;
        this._lastAmmoCurText = '';
        this._lastAmmoResText = '';
        this._lastCaliberText = '';
        this._lastActiveWeaponSilh = '';
        this._lastSurvivalSlotKey = '';
        this._thClicksBound = false;

        // Các phần tử giao diện Looting & Airdrop
        this.containerPrompt = document.getElementById('container-prompt');
        this.promptLabel = document.getElementById('prompt-label');

        this.searchProgressContainer = document.getElementById('search-progress-container');
        this.searchContainerName = document.getElementById('search-container-name');
        this.searchCountdown = document.getElementById('search-countdown');
        this.searchMeterFill = document.getElementById('search-meter-fill');

        this.dualInventoryOverlay = document.getElementById('dual-inventory-overlay');
        this.dualInvContainerName = document.getElementById('dual-inv-container-name');
        this.dualInvCloseBtn = document.getElementById('dual-inv-close-btn');
        this.playerCapacityText = document.getElementById('player-capacity-text');
        this.playerGrid = document.getElementById('player-grid');
        this.containerColumnTitle = document.getElementById('container-column-title');
        this.containerCapacityText = document.getElementById('container-capacity-text');
        this.containerGrid = document.getElementById('container-grid');
        this.btnLootAll = document.getElementById('btn-loot-all');
        this.inspectPanel = document.getElementById('item-inspect-panel');
        this.inspectTitle = document.getElementById('inspect-title');
        this.inspectDesc = document.getElementById('inspect-desc');

        this._lootingSystem = null;
        this._currentContainer = null;
        this._currentPlayerInventory = null;
        this._lootEventsBound = false;
        this._dragData = null;
        this._tempContainerWorldPos = new THREE.Vector3();
        this._tempPromptNdc = new THREE.Vector3();
    }

    updateOverheadVitals(player, camera, canvas) {
        if (!this.overheadVitals) return;
        // The local player's DOM meter replaces its small world-space duplicate.
        if (player.healthBar) player.healthBar.group.visible = false;
        const position = _tempMateWorldPos.copy(player.model?.position || player.position);
        position.y += player.healthBar?.offsetY || 2.35;
        _tempNdc.copy(position).project(camera);
        const visible = !player.isDead && _tempNdc.z >= -1 && _tempNdc.z <= 1 && Math.abs(_tempNdc.x) <= 1 && Math.abs(_tempNdc.y) <= 1;
        this.overheadVitals.hidden = !visible;
        if (!visible) return;
        const rect = canvas.getBoundingClientRect();
        this.overheadVitals.style.left = `${rect.left + (_tempNdc.x + 1) * rect.width / 2}px`;
        this.overheadVitals.style.top = `${rect.top + (1 - _tempNdc.y) * rect.height / 2}px`;
        this.overheadVitals.classList.toggle('low-health', player.health <= player.maxHealth * 0.3);
        this.overheadVitals.title = `Máu: ${Math.ceil(player.health)}/${player.maxHealth} · Khiên: ${Math.ceil(player.shield)}/${player.maxShield}`;
    }

    updateStats(player, waveManager, score) {
        // Vị trí con trỏ cộng thêm Cursor Kickback (đẩy trực tiếp tọa độ tâm ngắm trên màn hình)
        const kickX = player.cursorKick ? player.cursorKick.x : 0;
        const kickY = player.cursorKick ? player.cursorKick.y : 0;
        const posX = Math.round(player.pointerScreen.x + kickX);
        const posY = Math.round(player.pointerScreen.y + kickY);

        if (posX !== this._lastPosX || posY !== this._lastPosY) {
            this._lastPosX = posX;
            this._lastPosY = posY;
            if (this.crosshair) {
                this.crosshair.style.left = `${posX}px`;
                this.crosshair.style.top = `${posY}px`;
            }
            if (this.hitmarker) {
                this.hitmarker.style.left = `${posX}px`;
                this.hitmarker.style.top = `${posY}px`;
            }
        }

        const shouldDisplay = player.pointerInCanvas ? '' : 'none';
        if (this._lastCrossDisplay !== shouldDisplay) {
            this._lastCrossDisplay = shouldDisplay;
            if (this.crosshair) this.crosshair.style.display = shouldDisplay;
            if (this.hitmarker) this.hitmarker.style.display = shouldDisplay;
        }

        // Cập nhật nón tản đạn mở rộng / co hẹp trực quan trên Crosshair (chỉ đổi CSS var khi giá trị pixel thay đổi)
        if (this.crosshair) {
            const spreadGap = Math.round(6 + (player.weapons?.currentSpreadDeg || 2) * 3.4);
            if (spreadGap !== this._lastSpreadGap) {
                this._lastSpreadGap = spreadGap;
                this.crosshair.style.setProperty('--spread-gap', `${spreadGap}px`);
            }
        }

        // 1. Health Bar (Đỏ) - Dirty check
        const hpVal = Math.ceil(player.health);
        if (hpVal !== this._lastHpVal || player.maxHealth !== this._lastMaxHp) {
            this._lastHpVal = hpVal;
            this._lastMaxHp = player.maxHealth;
            const hpPercent = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
            if (this.healthFill) this.healthFill.style.width = `${hpPercent}%`;
            if (this.healthText) this.healthText.textContent = `${Math.max(0, hpVal)}`;
        }

        // 2. Shield Bar (Xanh lam) - Dirty check
        const shVal = Math.ceil(player.shield);
        if (shVal !== this._lastShVal || player.maxShield !== this._lastMaxSh) {
            this._lastShVal = shVal;
            this._lastMaxSh = player.maxShield;
            const shPercent = Math.max(0, Math.min(100, (player.shield / player.maxShield) * 100));
            if (this.shieldFill) this.shieldFill.style.width = `${shPercent}%`;
            if (this.shieldText) this.shieldText.textContent = `${shVal} / ${player.maxShield}`;
        }

        // Weapon & Ammo info
        const ammoInfo = player.weapons.getCurrentAmmo();
        const curWeapon = player.weapons.getCurrentWeapon();

        // 3. Stamina / Ammo Bar (Cam - thanh thứ 3) - Dirty check
        let stPercent = 100;
        let stText = 'CẬN CHIẾN';
        if (!curWeapon.isKnife) {
            if (ammoInfo.isReloading) {
                stPercent = Math.max(0, Math.min(100, Math.round(ammoInfo.reloadProgress * 100)));
                stText = `NẠP ĐẠN ${stPercent}%`;
            } else {
                stPercent = Math.max(0, Math.min(100, Math.round((ammoInfo.current / ammoInfo.max) * 100)));
                stText = `BĂNG ĐẠN ${ammoInfo.current}/${ammoInfo.max}`;
            }
        }
        if (stPercent !== this._lastStPercent || stText !== this._lastStText) {
            this._lastStPercent = stPercent;
            this._lastStText = stText;
            if (this.staminaFill) this.staminaFill.style.width = `${stPercent}%`;
            if (this.staminaText) this.staminaText.textContent = stText;
        }

        // 4. Hàng ô Buff RPG - Dirty check
        const upgrades = player.weapons.upgrades;
        const isRegening = player.shieldRegenTimer <= 0 && player.shield < player.maxShield;
        const upgradesKey = `${upgrades.damage}_${upgrades.rapid}_${upgrades.multishot}_${isRegening}_${player.shield >= player.maxShield}_${curWeapon.critMultiplier}_${curWeapon.id}`;
        if (upgradesKey !== this._lastUpgradesKey) {
            this._lastUpgradesKey = upgradesKey;
            if (this.buffDamage) {
                this.buffDamage.classList.toggle('active', upgrades.damage > 0);
                if (this.buffDamageVal) this.buffDamageVal.textContent = `×${player.weapons.damageBoost.toFixed(1)}`;
            }
            if (this.buffRapid) {
                this.buffRapid.classList.toggle('active', upgrades.rapid > 0);
                if (this.buffRapidVal) this.buffRapidVal.textContent = `×${player.weapons.fireRateBoost.toFixed(2)}`;
            }
            if (this.buffMulti) {
                this.buffMulti.classList.toggle('active', upgrades.multishot > 0);
                if (this.buffMultiVal) this.buffMultiVal.textContent = `${player.weapons.beamCount} TIA`;
            }
            if (this.buffShield) {
                this.buffShield.classList.toggle('active', isRegening || player.shield >= player.maxShield);
                if (this.buffShieldVal) this.buffShieldVal.textContent = isRegening ? 'REGEN' : (player.shield >= player.maxShield ? 'FULL' : 'WAIT');
            }
            if (this.buffCrit) {
                this.buffCrit.classList.toggle('active', true);
                if (this.buffCritVal) this.buffCritVal.textContent = `×${(curWeapon.critMultiplier || 2.0).toFixed(1)}`;
            }
        }

        // Low health vignette - Dirty check
        if (this.damageVignette) {
            const shouldPulse = player.health <= 30 && !player.isDead;
            if (shouldPulse !== this._lastVignettePulse) {
                this._lastVignettePulse = shouldPulse;
                if (shouldPulse) {
                    this.damageVignette.classList.add('critical-pulsing');
                } else {
                    this.damageVignette.classList.remove('critical-pulsing');
                }
            }
        }

        // Score & Phase - Dirty check
        if (score !== this._lastScore) {
            this._lastScore = score;
            if (this.scoreVal) this.scoreVal.textContent = score.toLocaleString();
        }
        if (waveManager.currentPhase !== this._lastPhase) {
            this._lastPhase = waveManager.currentPhase;
            if (this.waveVal) this.waveVal.textContent = waveManager.currentPhase;
        }
        const remEnemies = waveManager.getRemainingEnemiesCount();
        if (remEnemies !== this._lastEnemies) {
            this._lastEnemies = remEnemies;
            if (this.enemiesVal) this.enemiesVal.textContent = remEnemies;
        }

        // Hotbar Weapon Title & Ammo - Dirty check
        if (curWeapon.id !== this._lastWeaponId) {
            this._lastWeaponId = curWeapon.id;
            if (this.weaponName) {
                this.weaponName.textContent = curWeapon.name;
                this.weaponName.classList.toggle('rare', !!curWeapon.tier);
            }
        }
        const effective = player.weapons.getModifiedStats(curWeapon);
        const rangeText = curWeapon.isKnife ? 'CẬN CHIẾN' : `TẦM ${effective.maxRange}m${effective.rangeBonusPct > 0 ? ` (+${Math.round(effective.rangeBonusPct * 100)}%)` : ''}`;
        const upgradeStatsStr = `DAME ×${player.weapons.damageBoost.toFixed(1)} · TỐC BẮN ×${player.weapons.fireRateBoost.toFixed(2)} · ${player.weapons.beamCount} TIA · ${rangeText}`;
        if (upgradeStatsStr !== this._lastUpgradeStats) {
            this._lastUpgradeStats = upgradeStatsStr;
            if (this.upgradeStats) this.upgradeStats.textContent = upgradeStatsStr;
        }
        if (ammoInfo.current !== this._lastAmmoCur) {
            this._lastAmmoCur = ammoInfo.current;
            if (this.ammoCurrent) this.ammoCurrent.textContent = ammoInfo.current;
        }
        const ammoMaxStr = ammoInfo.isKnife ? 'CẬN CHIẾN' : `${ammoInfo.max} + ${ammoInfo.reserve}`;
        if (ammoMaxStr !== this._lastAmmoMaxStr) {
            this._lastAmmoMaxStr = ammoMaxStr;
            if (this.ammoMax) this.ammoMax.textContent = ammoMaxStr;
        }

        // Reload progress bar - Cập nhật loading thay đạn ở giữa màn hình và vòng nạp đạn con trỏ ngắm
        const isReloading = !!ammoInfo.isReloading;
        const reloadProgress = Math.max(0, Math.min(1.0, ammoInfo.reloadProgress || 0));
        const reloadPct = Math.round(reloadProgress * 100);
        const reloadKey = `${isReloading}_${reloadPct}`;

        if (reloadKey !== this._lastReloadKey) {
            this._lastReloadKey = reloadKey;

            if (this.reloadBar) {
                if (isReloading) {
                    this.reloadBar.style.width = `${reloadPct}%`;
                    this.reloadBar.classList.add('active');
                } else {
                    this.reloadBar.style.width = '0%';
                    this.reloadBar.classList.remove('active');
                }
            }

            // Xử lý hiển thị Widget Loading thay đạn ở giữa màn hình và vòng quay con trỏ ngắm
            if (isReloading) {
                if (this._reloadHideTimeout) {
                    clearTimeout(this._reloadHideTimeout);
                    this._reloadHideTimeout = null;
                }

                if (this.centerReload) {
                    this.centerReload.style.display = 'block';
                }
                if (this.crosshairReloadRing) {
                    this.crosshairReloadRing.classList.add('active');
                }

                // Cập nhật thanh fill tiến trình
                if (this.centerReloadFill) {
                    this.centerReloadFill.style.width = `${reloadPct}%`;
                }
                if (this.centerReloadPct) {
                    this.centerReloadPct.textContent = `${reloadPct}%`;
                }

                // Cập nhật vòng quay SVG tròn ôm sát con trỏ ngắm
                if (this.crosshairReloadBar) {
                    const offset = this._reloadRingCircumference * (1 - reloadProgress);
                    this.crosshairReloadBar.style.strokeDashoffset = `${offset}px`;
                }

                // Hiệu ứng phân tầng để người chơi biết rõ sắp thay đạn xong chưa:
                // Giai đoạn sắp xong (từ 70% trở lên): đổi màu Cyan neon và nhấp nháy phát xung dồn dập
                if (reloadProgress >= 0.7) {
                    if (this.centerReload) {
                        this.centerReload.classList.add('almost-ready');
                        this.centerReload.classList.remove('ready-burst');
                    }
                    if (this.crosshairReloadRing) {
                        this.crosshairReloadRing.classList.add('almost-ready');
                        this.crosshairReloadRing.classList.remove('ready-burst');
                    }
                    if (this.centerReloadTitle) {
                        this.centerReloadTitle.textContent = 'SẮP THAY XONG!';
                    }
                    if (this.centerReloadSub) {
                        this.centerReloadSub.textContent = 'CHUẨN BỊ SẴN SÀNG';
                    }
                } else {
                    // Giai đoạn đầu (dưới 70%): màu hổ phách/cam neon ấm áp
                    if (this.centerReload) {
                        this.centerReload.classList.remove('almost-ready', 'ready-burst');
                    }
                    if (this.crosshairReloadRing) {
                        this.crosshairReloadRing.classList.remove('almost-ready', 'ready-burst');
                    }
                    if (this.centerReloadTitle) {
                        this.centerReloadTitle.textContent = 'ĐANG THAY ĐẠN...';
                    }
                    if (this.centerReloadSub) {
                        this.centerReloadSub.textContent = 'HÃY CHÚ Ý NÉ ĐÒN';
                    }
                }
            } else if (this._wasReloading) {
                // Vừa thay đạn xong: Kích hoạt hiệu ứng lóe sáng flash hoàn tất (Ready Burst) trong 220ms
                if (this.centerReloadFill) this.centerReloadFill.style.width = '100%';
                if (this.centerReloadPct) this.centerReloadPct.textContent = '100%';
                if (this.centerReloadTitle) this.centerReloadTitle.textContent = 'ĐÃ LÊN ĐẠN!';
                if (this.centerReloadSub) this.centerReloadSub.textContent = 'SẴN SÀNG CHIẾN ĐẤU';

                if (this.centerReload) {
                    this.centerReload.classList.remove('almost-ready');
                    this.centerReload.classList.add('ready-burst');
                }
                if (this.crosshairReloadRing) {
                    this.crosshairReloadRing.classList.remove('almost-ready');
                    this.crosshairReloadRing.classList.add('ready-burst');
                    if (this.crosshairReloadBar) this.crosshairReloadBar.style.strokeDashoffset = '0px';
                }

                if (this._reloadHideTimeout) clearTimeout(this._reloadHideTimeout);
                this._reloadHideTimeout = setTimeout(() => {
                    if (this.centerReload) {
                        this.centerReload.style.display = 'none';
                        this.centerReload.classList.remove('ready-burst', 'almost-ready');
                    }
                    if (this.crosshairReloadRing) {
                        this.crosshairReloadRing.classList.remove('active', 'ready-burst', 'almost-ready');
                        if (this.crosshairReloadBar) {
                            this.crosshairReloadBar.style.strokeDashoffset = `${this._reloadRingCircumference}px`;
                        }
                    }
                    this._reloadHideTimeout = null;
                }, 220);
            }
            this._wasReloading = isReloading;
        }

        // Hotbar 5 Slots Updates - Dirty check
        const medkitQty = player.weapons.inventory?.medkits ?? 0;
        const shieldQty = player.weapons.inventory?.shieldBatteries ?? 0;
        const slotKey = `${player.weapons.currentSlotIndex}_${medkitQty}_${shieldQty}_${player.weapons.weaponSlots[0]?.id}_${player.weapons.weaponSlots[2]?.id}`;
        if (slotKey !== this._lastSlotKey) {
            this._lastSlotKey = slotKey;
            if (this.slot1Label && player.weapons.weaponSlots[0]) {
                this.slot1Label.textContent = player.weapons.weaponSlots[0].name;
            }
            if (this.slot3Label && player.weapons.weaponSlots[2]) {
                this.slot3Label.textContent = player.weapons.weaponSlots[2].name;
            }
            if (this.slotMedkitQty) {
                this.slotMedkitQty.textContent = `x${medkitQty}`;
            }
            if (this.slotShieldQty) {
                this.slotShieldQty.textContent = `x${shieldQty}`;
            }

            this.weaponSlots.forEach((slot, idx) => {
                if (!slot) return;
                if (!slot._clickBound) {
                    slot._clickBound = true;
                    slot.addEventListener('click', () => {
                        player.weapons?.switchWeapon(idx, player);
                    });
                }
                const item = player.weapons.weaponSlots[idx];
                if (!item) return;

                slot.classList.toggle('rare', !!item.tier);
                slot.title = item.name;

                if (idx < 3) {
                    if (idx === player.weapons.currentSlotIndex) {
                        slot.classList.add('active');
                    } else {
                        slot.classList.remove('active');
                    }
                } else {
                    // Ô tiện ích 4 và 5: làm mờ nếu số lượng = 0
                    const count = idx === 3 ? medkitQty : shieldQty;
                    slot.style.opacity = count > 0 ? '1' : '0.45';
                }
            });
        }

        // Boss Health Bar - Dirty check
        const boss = waveManager.getBoss();
        const bossActive = !!(boss && !boss.isDead);
        if (bossActive !== this._lastBossVisible) {
            this._lastBossVisible = bossActive;
            if (this.bossContainer) this.bossContainer.style.display = bossActive ? 'block' : 'none';
        }
        if (bossActive) {
            const bPct = Math.round(Math.max(0, (boss.health / boss.maxHealth) * 100));
            if (bPct !== this._lastBossPct) {
                this._lastBossPct = bPct;
                if (this.bossFill) this.bossFill.style.width = `${bPct}%`;
            }
        }

        // ----------------------------------------------------
        // MINIMALIST SURVIVAL BOTTOM HUD SYSTEM UPDATES (3 CỤM)
        // ----------------------------------------------------
        if (this.thBottomHud) {
            // CỤM 1: Rada khoảng cách, trạng thái đau/nhìn & thanh máu
            let minDist = 14;
            const enemies = waveManager?.enemies;
            if (enemies && enemies.length > 0) {
                let dMin = Infinity;
                for (let i = 0; i < enemies.length; i++) {
                    const en = enemies[i];
                    if (en && !en.isDead) {
                        const d = player.position.distanceTo(en.position);
                        if (d < dMin) dMin = d;
                    }
                }
                if (dMin !== Infinity) minDist = Math.max(1, Math.round(dMin * 1.5));
            }
            const distStr = `${minDist} M`;
            if (distStr !== this._lastDistVal) {
                this._lastDistVal = distStr;
                if (this.thDistVal) this.thDistVal.textContent = distStr;
            }

            const painSec = Math.ceil(player.painTimer || 0);
            const painStr = `Pain ${painSec}s`;
            if (painStr !== this._lastPainText) {
                this._lastPainText = painStr;
                if (this.thStatusPain) {
                    this.thStatusPain.textContent = painStr;
                    this.thStatusPain.style.color = painSec > 0 ? '#ef4444' : '#94a3b8';
                }
            }

            const lightStr = player.isADS ? 'ADS' : 'Light';
            if (lightStr !== this._lastLightText) {
                this._lastLightText = lightStr;
                if (this.thStatusLight) this.thStatusLight.textContent = lightStr;
            }

            const hpFormatted = `${player.health.toFixed(1)} / ${player.maxHealth}`;
            const hpThPct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
            if (hpFormatted !== this._lastThHpText || hpThPct !== this._lastThHpPct) {
                this._lastThHpText = hpFormatted;
                this._lastThHpPct = hpThPct;
                if (this.thHealthFill) this.thHealthFill.style.width = `${hpThPct}%`;
                if (this.thHealthVal) this.thHealthVal.textContent = hpFormatted;
            }

            if (this.thCircleWater) {
                this.thCircleWater.style.opacity = player.shield > 0 ? '1' : '0.55';
            }
            if (this.thCircleEnergy) {
                this.thCircleEnergy.style.opacity = player.isDodging ? '0.5' : '1';
            }

            // CỤM 2: Thông tin đạn và Silhouette cho cả Súng 1 và Súng 2 (Phong cách PUBG Mobile)
            const gun1 = player.weapons?.weaponSlots?.[0];
            const gun2 = player.weapons?.weaponSlots?.[1];
            const ammo1 = player.weapons?.getSlotAmmo ? player.weapons.getSlotAmmo(0) : null;
            const ammo2 = player.weapons?.getSlotAmmo ? player.weapons.getSlotAmmo(1) : null;
            const cSlot = player.weapons?.currentSlotIndex ?? 0;

            // Cập nhật Súng 1 (Súng chính)
            if (gun1) {
                if (this.pubgGun1Name && this._lastGun1Name !== gun1.name) {
                    this._lastGun1Name = gun1.name;
                    this.pubgGun1Name.textContent = gun1.name;
                }
                const cur1 = ammo1 ? String(ammo1.current) : '16';
                const res1 = (ammo1 && ammo1.reserve === Infinity) ? '∞' : (ammo1 ? String(ammo1.reserve) : '∞');
                if (this.pubgGun1Cur && this._lastGun1Cur !== cur1) {
                    this._lastGun1Cur = cur1;
                    this.pubgGun1Cur.textContent = cur1;
                }
                if (this.pubgGun1Res && this._lastGun1Res !== res1) {
                    this._lastGun1Res = res1;
                    this.pubgGun1Res.textContent = res1;
                }
                if (this.thActiveSilhouette && gun1.icon && this._lastActiveWeaponSilh !== gun1.icon) {
                    this._lastActiveWeaponSilh = gun1.icon;
                    const image = document.createElement('img');
                    image.src = gun1.icon;
                    image.alt = gun1.name;
                    image.className = 'pubg-silhouette-img';
                    this.thActiveSilhouette.replaceChildren(image);
                }
            }

            // Cập nhật Súng 2 (Súng phụ)
            if (gun2) {
                if (this.pubgGun2Name && this._lastGun2Name !== gun2.name) {
                    this._lastGun2Name = gun2.name;
                    this.pubgGun2Name.textContent = gun2.name;
                }
                const cur2 = ammo2 ? String(ammo2.current) : '0';
                const res2 = (ammo2 && ammo2.reserve === Infinity) ? '∞' : (ammo2 ? String(ammo2.reserve) : '∞');
                if (this.pubgGun2Cur && this._lastGun2Cur !== cur2) {
                    this._lastGun2Cur = cur2;
                    this.pubgGun2Cur.textContent = cur2;
                }
                if (this.pubgGun2Res && this._lastGun2Res !== res2) {
                    this._lastGun2Res = res2;
                    this.pubgGun2Res.textContent = res2;
                }
                if (this.pubgGun2Silhouette && gun2.icon && this._lastGun2Icon !== gun2.icon) {
                    this._lastGun2Icon = gun2.icon;
                    const image = document.createElement('img');
                    image.src = gun2.icon;
                    image.alt = gun2.name;
                    image.className = 'pubg-silhouette-img';
                    this.pubgGun2Silhouette.replaceChildren(image);
                }
            }

            // Duy trì tương thích ngược cho các phần tử đạn cũ
            const curAmmoStr = curWeapon.isKnife ? '∞' : String(ammoInfo.current);
            const resAmmoStr = curWeapon.isKnife ? '∞' : String(ammoInfo.reserve);
            if (curAmmoStr !== this._lastAmmoCurText || resAmmoStr !== this._lastAmmoResText) {
                this._lastAmmoCurText = curAmmoStr;
                this._lastAmmoResText = resAmmoStr;
                if (this.thAmmoCur) this.thAmmoCur.textContent = curAmmoStr;
                if (this.thAmmoReserve) this.thAmmoReserve.textContent = resAmmoStr;
            }

            // Cập nhật trạng thái đạn và số lượng cho 2 ô bom
            const bomb1 = player.weapons?.weaponSlots?.[2];
            const bomb2 = player.weapons?.weaponSlots?.[3];
            if (bomb1) {
                if (this.pubgBomb1Name && this._lastBomb1Name !== bomb1.name) {
                    this._lastBomb1Name = bomb1.name;
                    this.pubgBomb1Name.textContent = bomb1.name;
                }
                const b1Qty = `x${bomb1.count ?? 0}`;
                if (this.pubgBomb1Qty && this._lastBomb1Qty !== b1Qty) {
                    this._lastBomb1Qty = b1Qty;
                    this.pubgBomb1Qty.textContent = b1Qty;
                }
                if (this.thSlotBomb1) {
                    this.thSlotBomb1.style.opacity = (bomb1.count > 0) ? '1' : '0.45';
                }
            }
            if (bomb2) {
                if (this.pubgBomb2Name && this._lastBomb2Name !== bomb2.name) {
                    this._lastBomb2Name = bomb2.name;
                    this.pubgBomb2Name.textContent = bomb2.name;
                }
                const b2Qty = `x${bomb2.count ?? 0}`;
                if (this.pubgBomb2Qty && this._lastBomb2Qty !== b2Qty) {
                    this._lastBomb2Qty = b2Qty;
                    this.pubgBomb2Qty.textContent = b2Qty;
                }
                if (this.thSlotBomb2) {
                    this.thSlotBomb2.style.opacity = (bomb2.count > 0) ? '1' : '0.45';
                }
            }

            // Cập nhật trạng thái Active và Chế độ bắn (Auto / Single)
            if (this.thActiveSlot) this.thActiveSlot.classList.toggle('active', cSlot === 0);
            if (this.thSlot2) this.thSlot2.classList.toggle('active', cSlot === 1);
            if (this.thSlotBomb1) this.thSlotBomb1.classList.toggle('active', cSlot === 2);
            if (this.thSlotBomb2) this.thSlotBomb2.classList.toggle('active', cSlot === 3);
            if (this.thSlotMelee) this.thSlotMelee.classList.toggle('active', cSlot === 4);

            // Cập nhật Badge Chế độ bắn gắn trên vũ khí đang chọn
            if (this.pubgFireModeBadge && this.pubgFireModeText) {
                this.pubgFireModeBadge.classList.toggle('at-slot-1', cSlot === 0);
                this.pubgFireModeBadge.classList.toggle('at-slot-2', cSlot === 1);
                this.pubgFireModeBadge.style.display = (cSlot >= 2) ? 'none' : 'inline-flex';
                const activeGun = cSlot === 1 ? gun2 : gun1;
                if (activeGun) {
                    this.pubgFireModeText.textContent = activeGun.isAuto ? 'AUTO' : 'SINGLE';
                }
            }

            // Cập nhật Thanh máu PUBG Mobile nằm sát dưới 2 súng
            const hpPct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
            if (this.pubgHpFill) {
                this.pubgHpFill.style.width = `${hpPct}%`;
                this.pubgHpFill.classList.toggle('low-hp', hpPct <= 30);
            }

            // Cập nhật độ bền Giáp & Mũ hiển thị vạch phân đoạn
            if (this.pubgHudHelmet) {
                const helmetBars = this.pubgHudHelmet.querySelectorAll('.pubg-gear-bar-seg');
                const helmetLevel = Math.ceil((player.health / player.maxHealth) * 3);
                helmetBars.forEach((bar, idx) => bar.classList.toggle('active', idx < helmetLevel));
            }
            if (this.pubgHudVest) {
                const vestBars = this.pubgHudVest.querySelectorAll('.pubg-gear-bar-seg');
                const vestLevel = player.maxShield > 0 ? Math.ceil((player.shield / player.maxShield) * 3) : 0;
                vestBars.forEach((bar, idx) => bar.classList.toggle('active', idx < vestLevel));
            }

            // Cập nhật ô vật phẩm hồi máu [5] (Medkit)
            const inv = player.weapons?.inventory || {};
            const isUsingMed = !!player.weapons?.isUsingMedkit;
            if (this.thQtyMedkit) this.thQtyMedkit.textContent = `x${inv.medkits ?? 0}`;
            if (this.thSlot3) {
                this.thSlot3.style.opacity = (inv.medkits > 0) ? '1' : '0.45';
                this.thSlot3.classList.toggle('active', isUsingMed);
            }

            // Hiển thị thanh tiến trình sơ cứu Medkit 5 giây
            if (this.thMedkitChannel) {
                if (player.weapons?.isUsingMedkit) {
                    this.thMedkitChannel.style.display = 'block';
                    const curTime = Math.max(0, player.weapons.medkitTimer);
                    const totalTime = player.weapons.medkitTotalTime || 5.0;
                    const pct = Math.max(0, Math.min(100, (1 - curTime / totalTime) * 100));
                    if (this.thMedkitFill) this.thMedkitFill.style.width = `${pct}%`;
                    if (this.thMedkitCountdown) this.thMedkitCountdown.textContent = `${curTime.toFixed(1)}s`;
                } else {
                    this.thMedkitChannel.style.display = 'none';
                }
            }

            // Gắn sự kiện click đổi vũ khí và sơ cứu trực tiếp
            if (!this._thClicksBound) {
                this._thClicksBound = true;
                if (this.thActiveSlot) this.thActiveSlot.addEventListener('click', () => player.weapons?.switchWeapon(0, player));
                if (this.thSlot2) this.thSlot2.addEventListener('click', () => player.weapons?.switchWeapon(1, player));
                if (this.thSlotBomb1) this.thSlotBomb1.addEventListener('click', () => player.weapons?.switchWeapon(2, player));
                if (this.thSlotBomb2) this.thSlotBomb2.addEventListener('click', () => player.weapons?.switchWeapon(3, player));
                if (this.thSlot3) this.thSlot3.addEventListener('click', () => player.weapons?.startMedkitUse(player));
                if (this.thSlotMelee) this.thSlotMelee.addEventListener('click', () => player.weapons?.switchWeapon(4, player));
            }
        }
    }

    triggerDamageFlash() {
        if (!this.damageVignette) return;
        this.damageVignette.classList.add('hit-flash');
        setTimeout(() => {
            this.damageVignette.classList.remove('hit-flash');
        }, 150);
    }

    triggerHitmarker(isCrit = false) {
        if (!this.hitmarker) return;
        this.hitmarker.className = isCrit ? 'hitmarker crit active' : 'hitmarker active';
        setTimeout(() => {
            this.hitmarker.classList.remove('active');
        }, 120);
    }

    showBanner(text, duration = 3000) {
        if (!this.bannerText) return;
        this.bannerText.textContent = text;
        this.bannerText.classList.add('show');
        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.bannerTimeout = setTimeout(() => {
            this.bannerText.classList.remove('show');
        }, duration);
    }

    showPickupAlert(text) {
        if (!this.pickupAlert) return;
        this.pickupAlert.textContent = text;
        this.pickupAlert.classList.add('show');
        if (this.pickupTimeout) clearTimeout(this.pickupTimeout);
        this.pickupTimeout = setTimeout(() => {
            this.pickupAlert.classList.remove('show');
        }, 1600);
    }

    showDamageNumber(amount, isCrit, worldPos, camera, hitResult = null) {
        if (!this.floatingContainer) return;

        // Giới hạn DOM elements tối đa 20 thẻ để tối ưu hiệu năng Web không lag
        while (this.floatingContainer.children.length >= 20) {
            this.floatingContainer.firstElementChild?.remove();
        }

        const screenPos = worldPos.clone().project(camera);
        if (screenPos.z > 1) return;

        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        const el = document.createElement('div');

        if (hitResult && hitResult.isBlunt) {
            // Sát thương bị giáp cản: Hiện số sát thương giáp + sát thương cùn
            el.className = 'damage-popup armor';
            el.textContent = `GIÁP [-${hitResult.armorDamage}] (${hitResult.healthDamage} HP)`;
        } else {
            // Xuyên giáp hoặc trúng máu trực tiếp
            el.className = isCrit ? 'damage-popup crit' : 'damage-popup';
            const displayDmg = hitResult ? hitResult.healthDamage : Math.round(amount);
            el.textContent = `${displayDmg}${isCrit ? ' HEADSHOT' : ''}`;
        }

        el.style.left = `${x + (Math.random() - 0.5) * 24}px`;
        el.style.top = `${y + (Math.random() - 0.5) * 12}px`;

        this.floatingContainer.appendChild(el);
        setTimeout(() => {
            el.remove();
        }, 800);
    }

    drawRadar(player, enemies, pickups, portals = [], teammates = [], airdropZone = null) {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radarRange = 38;
        const scale = (w * 0.46) / radarRange;

        ctx.clearRect(0, 0, w, h);

        // Radar background ring
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.10)';
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
        ctx.stroke();

        // Cross lines
        ctx.beginPath();
        ctx.moveTo(cx, cy - w * 0.44);
        ctx.lineTo(cx, cy + w * 0.44);
        ctx.moveTo(cx - w * 0.44, cy);
        ctx.lineTo(cx + w * 0.44, cy);
        ctx.stroke();

        const getPx = (x) => cx + x * scale;
        const getPy = (z) => cy + z * scale;

        // Draw 4 Portals
        for (const port of portals) {
            const px = getPx(port.position.x);
            const py = getPy(port.position.z);
            ctx.fillStyle = '#b026ff';
            ctx.shadowColor = '#b026ff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(px, py - 4);
            ctx.lineTo(px + 4, py);
            ctx.lineTo(px, py + 4);
            ctx.lineTo(px - 4, py);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Draw Pickups
        for (const pick of pickups) {
            const px = getPx(pick.mesh.position.x);
            const py = getPy(pick.mesh.position.z);
            ctx.fillStyle = `#${pick.color.toString(16).padStart(6, '0')}`;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Zombies
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const px = getPx(enemy.position.x);
            const py = getPy(enemy.position.z);

            if (enemy.type === 'boss') {
                ctx.fillStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (enemy.type === 'tank' || enemy.type === 'giant') {
                ctx.fillStyle = '#ff8800';
                ctx.shadowColor = '#ff8800';
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.arc(px, py, enemy.type === 'giant' ? 6 : 4.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (enemy.type === 'spitter') {
                ctx.fillStyle = '#99ff22';
                ctx.shadowColor = '#99ff22';
                ctx.shadowBlur = 5;
                ctx.fillRect(px - 3, py - 3, 6, 6);
            } else if (enemy.type === 'sprinter') {
                ctx.fillStyle = '#ffff00';
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#ff2a5f';
                ctx.shadowColor = '#ff2a5f';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(px, py, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // Vẽ vị trí đồng đội trên Radar
        if (Array.isArray(teammates)) {
            for (const mate of teammates) {
                if (!mate || (mate.isDead && !mate.isDowned)) continue;
                const matePos = mate.mesh ? mate.mesh.position : mate.position;
                const px = getPx(matePos.x);
                const py = getPy(matePos.z);

                ctx.save();
                if (mate.isDowned) {
                    ctx.fillStyle = '#ff1744';
                    ctx.shadowColor = '#ff1744';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(px, py, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 8px Rajdhani, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('!', px, py);
                } else {
                    const charColor = CHARACTER_COLORS[mate.characterId] || '#00f0ff';
                    ctx.fillStyle = charColor;
                    ctx.shadowColor = charColor;
                    ctx.shadowBlur = 7;
                    ctx.beginPath();
                    ctx.arc(px, py, 4.8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        // Vẽ vòng tròn vùng tiếp tế Airdrop trên Tactical Radar
        if (airdropZone) {
            const px = getPx(airdropZone.x);
            const py = getPy(airdropZone.z);

            ctx.save();
            const pulse = (Math.sin(Date.now() * 0.008) * 0.4 + 0.6);
            ctx.strokeStyle = `rgba(255, 30, 60, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff1e3c';
            ctx.shadowBlur = 8;

            // Vòng tròn bán kính Drop Zone
            ctx.beginPath();
            const zoneR = Math.max(5, (airdropZone.radius || 4.5) * scale);
            ctx.arc(px, py, zoneR, 0, Math.PI * 2);
            ctx.stroke();

            // Chấm tâm Airdrop
            ctx.fillStyle = '#ff1e3c';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Chữ THÍNH
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px Rajdhani, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('THÍNH', px, py - (zoneR + 2));
            ctx.restore();
        }

        // Player central pointer
        const pPx = getPx(player.position.x);
        const pPy = getPy(player.position.z);
        
        ctx.save();
        ctx.translate(pPx, pPy);
        ctx.rotate(Math.PI - player.aimYaw);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 5);
        ctx.lineTo(4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Tạo phần tử DOM biểu thị đồng đội ngoài màn hình
    createTeammateMarker(id, characterId) {
        if (!this.teammateContainer) return null;

        const el = document.createElement('div');
        el.className = 'teammate-offscreen-marker';
        el.id = `teammate-marker-${id}`;

        // Mũi tên chỉ hướng ra ngoài rìa màn hình
        const arrowWrapper = document.createElement('div');
        arrowWrapper.className = 'indicator-arrow-wrapper';
        const arrow = document.createElement('div');
        arrow.className = 'indicator-arrow';
        arrowWrapper.appendChild(arrow);
        el.appendChild(arrowWrapper);

        // Hộp chứa avatar và các vòng tròn SVG
        const avatarBox = document.createElement('div');
        avatarBox.className = 'indicator-avatar-box';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'indicator-rings');
        svg.setAttribute('viewBox', '0 0 56 56');

        // Vòng nền mờ
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('class', 'ring-bg');
        bgCircle.setAttribute('cx', '28');
        bgCircle.setAttribute('cy', '28');
        bgCircle.setAttribute('r', '22');
        svg.appendChild(bgCircle);

        // Vòng khiên (màu cyan, bán kính 25)
        const shieldCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shieldCircle.setAttribute('class', 'ring-shield');
        shieldCircle.setAttribute('cx', '28');
        shieldCircle.setAttribute('cy', '28');
        shieldCircle.setAttribute('r', '25');
        shieldCircle.setAttribute('stroke-dasharray', '157.08');
        shieldCircle.setAttribute('stroke-dashoffset', '0');
        svg.appendChild(shieldCircle);

        // Vòng máu (màu xanh/cam/đỏ, bán kính 22)
        const healthCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        healthCircle.setAttribute('class', 'ring-health');
        healthCircle.setAttribute('cx', '28');
        healthCircle.setAttribute('cy', '28');
        healthCircle.setAttribute('r', '22');
        healthCircle.setAttribute('stroke-dasharray', '138.23');
        healthCircle.setAttribute('stroke-dashoffset', '0');
        svg.appendChild(healthCircle);

        avatarBox.appendChild(svg);

        // Khung tròn chứa avatar
        const avatarCenter = document.createElement('div');
        avatarCenter.className = 'avatar-center';

        const iconContainer = document.createElement('div');
        iconContainer.className = 'avatar-icon';
        iconContainer.innerHTML = getCharacterAvatarSvg(characterId);
        avatarCenter.appendChild(iconContainer);

        const downedBadge = document.createElement('div');
        downedBadge.className = 'avatar-downed-badge';
        downedBadge.textContent = '!';
        avatarCenter.appendChild(downedBadge);

        avatarBox.appendChild(avatarCenter);
        el.appendChild(avatarBox);

        // Nhãn tên và khoảng cách
        const label = document.createElement('div');
        label.className = 'indicator-label';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'indicator-name';
        label.appendChild(nameSpan);

        const distSpan = document.createElement('span');
        distSpan.className = 'indicator-distance';
        label.appendChild(distSpan);

        el.appendChild(label);

        this.teammateContainer.appendChild(el);

        const markerData = {
            el,
            arrowWrapper,
            arrow,
            healthCircle,
            shieldCircle,
            iconContainer,
            nameSpan,
            distSpan,
            label,
            characterId
        };
        this.teammateMarkers.set(id, markerData);
        return markerData;
    }

    // Cập nhật vị trí và thanh máu tròn cho đồng đội ở rìa màn hình
    updateTeammateIndicators(teammates, localPlayer, camera) {
        if (!this.teammateContainer) return;

        // Tập hợp các ID đồng đội còn hoạt động
        const activeIds = new Set();
        const width = window.innerWidth;
        const height = window.innerHeight;
        const margin = 48;
        const cx = width / 2;
        const cy = height / 2;
        const halfW = cx - margin;
        const halfH = cy - margin;

        const offscreenList = [];

        for (const mate of teammates) {
            if (!mate || (mate.isDead && !mate.isDowned)) continue;
            activeIds.add(mate.id);

            let marker = this.teammateMarkers.get(mate.id);
            if (!marker) {
                marker = this.createTeammateMarker(mate.id, mate.characterId || 'soldier');
                if (!marker) continue;
            }

            // Cập nhật lại biểu tượng nếu nhân vật thay đổi
            if (marker.characterId !== mate.characterId) {
                marker.iconContainer.innerHTML = getCharacterAvatarSvg(mate.characterId);
                marker.characterId = mate.characterId;
            }

            const charColor = CHARACTER_COLORS[mate.characterId] || '#22e6a5';
            marker.el.style.setProperty('--character-color', charColor);
            marker.el.style.setProperty('--indicator-color', mate.isDowned ? '#ff1744' : charColor);

            // Tọa độ thế giới của đồng đội (sử dụng vector tái sử dụng tránh GC)
            const matePos = mate.mesh ? mate.mesh.position : mate.position;
            _tempMateWorldPos.copy(matePos);
            _tempMateWorldPos.y += 1.2;
            _tempNdc.copy(_tempMateWorldPos).project(camera);

            const screenX = (_tempNdc.x * 0.5 + 0.5) * width;
            const screenY = (-_tempNdc.y * 0.5 + 0.5) * height;

            // Kiểm tra xem đồng đội có đang nằm gọn trong màn hình không
            const viewMarginX = 85;
            const viewMarginY = 80;
            const onScreen = (
                screenX >= viewMarginX &&
                screenX <= width - viewMarginX &&
                screenY >= viewMarginY &&
                screenY <= height - viewMarginY &&
                _tempNdc.z >= -1 && _tempNdc.z <= 1
            );

            if (onScreen) {
                // Nếu đồng đội ở trong màn hình, ẩn biểu tượng rìa màn hình
                marker.el.style.display = 'none';
            } else {
                // Nếu đồng đội ở ngoài màn hình, tính toán tọa độ chiếu lên rìa màn hình
                marker.el.style.display = 'block';

                const dx = screenX - cx;
                const dy = screenY - cy;

                const tx = halfW / (Math.abs(dx) || 0.0001);
                const ty = halfH / (Math.abs(dy) || 0.0001);
                const t = Math.min(tx, ty);

                let edgeX = cx + dx * t;
                let edgeY = cy + dy * t;
                const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

                // Tránh che khuất các cụm giao diện cố định ở các góc:
                // Góc dưới phải: Bảng vũ khí & đạn
                if (edgeX > width - 260 && edgeY > height - 165) {
                    if (Math.abs(dx) >= Math.abs(dy)) {
                        edgeX = width - 275;
                    } else {
                        edgeY = height - 175;
                    }
                }
                // Góc trên phải: Radar chiến thuật
                else if (edgeX > width - 190 && edgeY < 200) {
                    if (Math.abs(dx) >= Math.abs(dy)) {
                        edgeX = width - 200;
                    } else {
                        edgeY = 205;
                    }
                }
                // Góc trên trái: Bảng máu và danh sách đồng đội
                else if (edgeX < 300 && edgeY < 330) {
                    if (Math.abs(dx) >= Math.abs(dy)) {
                        edgeX = 310;
                    } else {
                        edgeY = 335;
                    }
                }

                offscreenList.push({
                    marker,
                    mate,
                    matePos,
                    x: edgeX,
                    y: edgeY,
                    angle: angleDeg
                });
            }
        }

        // Tách các biểu tượng nếu bị đè lên nhau ở cùng góc viền
        for (let i = 0; i < offscreenList.length; i++) {
            for (let j = i + 1; j < offscreenList.length; j++) {
                const a = offscreenList[i];
                const b = offscreenList[j];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d < 58) {
                    const nx = (b.x - a.x) || 1;
                    const ny = (b.y - a.y) || 0;
                    const len = Math.hypot(nx, ny) || 1;
                    const shift = (58 - d) / 2;
                    a.x -= (nx / len) * shift;
                    a.y -= (ny / len) * shift;
                    b.x += (nx / len) * shift;
                    b.y += (ny / len) * shift;
                }
            }
        }

        // Cập nhật vị trí, vòng máu tròn và trạng thái cho từng biểu tượng ngoài màn hình
        for (const item of offscreenList) {
            const { marker, mate, matePos, x, y, angle } = item;

            marker.el.style.left = `${Math.round(x)}px`;
            marker.el.style.top = `${Math.round(y)}px`;
            marker.arrowWrapper.style.transform = `rotate(${angle.toFixed(1)}deg)`;

            // Tự động căn chỉnh nhãn để không bao giờ bị cắt mép màn hình
            marker.label.classList.toggle('label-top', y > height - 100);
            marker.label.classList.toggle('label-right', x > width - 75);
            marker.label.classList.toggle('label-left', x < 75);

            // Tính toán lượng máu và khiên
            const maxHp = mate.maxHealth || 100;
            const curHp = Math.max(0, mate.health ?? maxHp);
            const hpRatio = Math.max(0, Math.min(1, curHp / maxHp));

            const maxSh = mate.maxShield || 100;
            const curSh = Math.max(0, mate.shield ?? 0);
            const shRatio = Math.max(0, Math.min(1, curSh / maxSh));

            // Vòng tròn máu: chu vi 138.23
            const hpOffset = 138.23 * (1 - hpRatio);
            marker.healthCircle.style.strokeDashoffset = hpOffset.toFixed(2);

            // Đổi màu theo trạng thái máu
            if (mate.isDowned) {
                marker.healthCircle.style.stroke = '#ff1744';
            } else if (hpRatio > 0.5) {
                marker.healthCircle.style.stroke = '#00ff88';
            } else if (hpRatio > 0.25) {
                marker.healthCircle.style.stroke = '#ffaa00';
            } else {
                marker.healthCircle.style.stroke = '#ff2a5f';
            }

            // Vòng tròn khiên: chu vi 157.08
            const shOffset = 157.08 * (1 - shRatio);
            marker.shieldCircle.style.strokeDashoffset = shOffset.toFixed(2);
            marker.shieldCircle.style.display = curSh > 0 ? 'block' : 'none';

            // Khoảng cách tới đồng đội (mét)
            const dist = Math.max(0, localPlayer.position.distanceTo(matePos));

            marker.nameSpan.textContent = mate.name || 'Đồng đội';

            if (mate.isDowned) {
                marker.el.classList.add('is-downed');
                if (dist <= 2.4) {
                    marker.distSpan.textContent = 'NHẤN E ĐỂ CỨU';
                    marker.distSpan.classList.add('can-revive');
                } else {
                    marker.distSpan.textContent = `HẠ GỤC · ${Math.round(dist)}m`;
                    marker.distSpan.classList.remove('can-revive');
                }
            } else {
                marker.el.classList.remove('is-downed');
                marker.distSpan.textContent = `${Math.round(dist)}m`;
                marker.distSpan.classList.remove('can-revive');
            }
        }

        // Xóa biểu tượng của đồng đội đã thoát hoặc biến mất
        for (const [id, marker] of this.teammateMarkers) {
            if (!activeIds.has(id)) {
                marker.el.remove();
                this.teammateMarkers.delete(id);
            }
        }
    }

    // Cập nhật bảng thông tin danh sách đồng đội trong HUD
    updateTeamRoster(teammates, localPlayer) {
        if (!this.teamRoster) return;
        const validMates = (teammates || []).filter(mate => mate && (!mate.isDead || mate.isDowned));
        if (validMates.length === 0) {
            if (this._lastRosterKey !== 'empty') {
                this._lastRosterKey = 'empty';
                this.teamRoster.style.display = 'none';
            }
            return;
        }

        const rosterKey = validMates.map(m => `${m.id}_${Math.round(m.health || 0)}_${Math.round(m.shield || 0)}_${m.isDowned}_${m.characterId}`).join('|');
        if (rosterKey === this._lastRosterKey) return;
        this._lastRosterKey = rosterKey;

        this.teamRoster.style.display = 'block';

        let html = `<div class="team-roster-title"><span>ĐỒNG ĐỘI</span><span>${validMates.length}</span></div><div class="team-roster-list">`;
        for (const mate of validMates) {
            const charColor = CHARACTER_COLORS[mate.characterId] || '#22e6a5';
            const maxHp = mate.maxHealth || 100;
            const curHp = Math.max(0, mate.health ?? maxHp);
            const hpPct = Math.round((curHp / maxHp) * 100);

            const maxSh = mate.maxShield || 100;
            const curSh = Math.max(0, mate.shield ?? 0);
            const shPct = Math.round((curSh / maxSh) * 100);

            const isDowned = !!mate.isDowned;
            const statusText = isDowned ? 'BỊ HẠ GỤC' : (hpPct <= 30 ? 'NGUY HIỂM' : 'SẴN SÀNG');
            const hpClass = isDowned ? 'danger' : (hpPct <= 30 ? 'danger' : (hpPct <= 60 ? 'warn' : ''));

            html += `
                <div class="team-roster-item ${isDowned ? 'downed' : ''}">
                    <div class="roster-avatar" style="--char-color: ${charColor};">
                        ${getCharacterAvatarSvg(mate.characterId)}
                    </div>
                    <div class="roster-info">
                        <div class="roster-name-row">
                            <span class="roster-name">${mate.name || 'Đồng đội'}</span>
                            <span class="roster-status">${statusText}</span>
                        </div>
                        <div class="roster-bars">
                            ${curSh > 0 ? `<div class="roster-bar-track"><div class="roster-bar-fill shield" style="width: ${shPct}%"></div></div>` : ''}
                            <div class="roster-bar-track"><div class="roster-bar-fill health ${hpClass}" style="width: ${hpPct}%"></div></div>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        this.teamRoster.innerHTML = html;
    }

    // Ẩn tất cả chỉ báo đồng đội ngoài màn hình (dùng khi tạm dừng hoặc kết thúc màn chơi)
    clearTeammateIndicators() {
        for (const marker of this.teammateMarkers.values()) {
            marker.el.style.display = 'none';
        }
    }

    // Hiển thị gợi ý phím [F] tại vị trí 3D của hòm đồ
    showContainerPrompt(label, position, camera) {
        if (!this.containerPrompt) return;
        if (label && this.promptLabel) {
            this.promptLabel.textContent = label;
        }

        if (position && camera) {
            this._tempContainerWorldPos.copy(position);
            this._tempContainerWorldPos.y += 0.8;
            this._tempPromptNdc.copy(this._tempContainerWorldPos).project(camera);

            if (this._tempPromptNdc.z > -1 && this._tempPromptNdc.z < 1) {
                const screenX = (this._tempPromptNdc.x * 0.5 + 0.5) * window.innerWidth;
                const screenY = (-this._tempPromptNdc.y * 0.5 + 0.5) * window.innerHeight;
                this.containerPrompt.style.left = `${Math.round(screenX)}px`;
                this.containerPrompt.style.top = `${Math.round(screenY)}px`;
                this.containerPrompt.style.display = 'flex';
                return;
            }
        }
        this.containerPrompt.style.display = 'none';
    }

    // Ẩn gợi ý mở hòm
    hideContainerPrompt() {
        if (this.containerPrompt) {
            this.containerPrompt.style.display = 'none';
        }
    }

    // Hiển thị thanh tiến trình lục hòm
    showSearchProgress(duration, containerName) {
        if (!this.searchProgressContainer) return;
        if (this.searchContainerName) {
            this.searchContainerName.textContent = containerName ? `ĐANG LỤC SOÁT: ${containerName.toUpperCase()}...` : 'ĐANG LỤC SOÁT...';
        }
        if (this.searchCountdown) {
            this.searchCountdown.textContent = `${duration.toFixed(1)}s`;
        }
        if (this.searchMeterFill) {
            this.searchMeterFill.style.width = '0%';
        }
        this.searchProgressContainer.style.display = 'block';
    }

    // Cập nhật thanh tiến trình lục hòm
    updateSearchProgress(progress, remainingTime) {
        if (!this.searchProgressContainer) return;
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
        if (this.searchMeterFill) {
            this.searchMeterFill.style.width = `${pct}%`;
        }
        if (this.searchCountdown) {
            this.searchCountdown.textContent = `${Math.max(0, remainingTime).toFixed(1)}s`;
        }
    }

    // Ẩn thanh tiến trình lục hòm
    hideSearchProgress() {
        if (this.searchProgressContainer) {
            this.searchProgressContainer.style.display = 'none';
        }
    }

    // =========================================================================
    // 2. GIAO DIỆN NHẶT ĐỒ HÒM PHONG CÁCH PUBG MINI (IN-WORLD CRATE UI)
    // =========================================================================
    th_initPUBGMiniCrateDOM() {
        if (this._pubgMiniCrateInitialized) return;
        this._pubgMiniCrateInitialized = true;
        this.pubgMiniCrate = document.getElementById('pubg-mini-crate');
        this.pubgCrateName = document.getElementById('pubg-crate-name');
        this.pubgCrateItems = document.getElementById('pubg-crate-items');
    }

    showPUBGMiniCrate(container, lootingSystem) {
        this.th_initPUBGMiniCrateDOM();
        if (!this.pubgMiniCrate || !container) return;

        if (this.pubgCrateName) {
            this.pubgCrateName.textContent = (container.name || 'HÒM CHIẾN LỢI PHẨM').toUpperCase();
        }

        this.refreshPUBGMiniCrate(container, lootingSystem);
        this.pubgMiniCrate.style.display = 'flex';
    }

    refreshPUBGMiniCrate(container, lootingSystem) {
        this.th_initPUBGMiniCrateDOM();
        if (!this.pubgCrateItems) return;

        this.pubgCrateItems.innerHTML = '';
        if (!container || !container.slots) return;

        const validItems = [];
        container.slots.forEach((slot, idx) => {
            if (slot && slot.itemId) {
                validItems.push({ ...slot, slotIndex: idx });
            }
        });

        if (validItems.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'pubg-crate-empty';
            emptyEl.style.cssText = 'color:#64748b; font-size:11px; padding:12px; text-align:center; font-family:Rajdhani,sans-serif; letter-spacing:1px;';
            emptyEl.textContent = 'HÒM ĐỒ ĐÃ ĐƯỢC VÉT SẠCH!';
            this.pubgCrateItems.appendChild(emptyEl);
            setTimeout(() => {
                if (this._currentPUBGContainer === container && validItems.length === 0) {
                    lootingSystem?.closeContainerUI();
                }
            }, 600);
            return;
        }

        this._currentPUBGContainer = container;
        const weapons = lootingSystem?.player?.weapons;
        const currentGunIdx = weapons?.currentSlotIndex === 1 ? 1 : 0;
        const currentGunAttach = weapons?.getAttachmentsForGun ? weapons.getAttachmentsForGun(currentGunIdx) : (weapons?.attachments || {});

        validItems.forEach((item, index) => {
            const def = (typeof LOOT_ITEMS !== 'undefined' && LOOT_ITEMS[item.itemId]) || {
                name: item.itemId,
                tier: 1,
                category: 'misc',
                statSummary: ''
            };

            const tier = def.tier || 1;
            const tierColor = def.color || '#94a3b8';
            const row = document.createElement('div');
            row.className = `pubg-crate-row${index === 0 ? ' focused' : ''}`;
            row.style.borderLeftColor = tierColor;

            // Xác định nút hành động thông minh (Smart Action Badge - hoàn toàn typography, không icon)
            let actionBadgeHtml = '';
            if (def.category === 'medical' || item.itemId === 'medkit') {
                actionBadgeHtml = `<span class="pubg-action-btn badge-med">[F] CẤP CỨU</span>`;
            } else if (def.category === 'weapon') {
                actionBadgeHtml = `<span class="pubg-action-btn badge-gun">[F] TRANG BỊ</span>`;
            } else if (def.category === 'attachment') {
                const attachSlot = def.slot;
                const equippedModId = currentGunAttach[attachSlot];
                if (!equippedModId) {
                    actionBadgeHtml = `<span class="pubg-action-btn badge-equip">[F] LẮP NGAY</span>`;
                } else {
                    const equippedTier = (typeof ATTACHMENT_DEFS !== 'undefined' && ATTACHMENT_DEFS[equippedModId]?.tier) || 1;
                    if (tier > equippedTier) {
                        actionBadgeHtml = `<span class="pubg-action-btn badge-swap">[F] NÂNG CẤP</span>`;
                    } else {
                        actionBadgeHtml = `<span class="pubg-action-btn badge-locked">CẤP THẤP HƠN</span>`;
                    }
                }
            } else {
                actionBadgeHtml = `<span class="pubg-action-btn badge-equip">[F] NHẶT</span>`;
            }

            // Tóm tắt chỉ số cực kỳ ngắn gọn, chống tràn chữ
            let statSummary = def.statSummary || '';
            if (!statSummary || statSummary.length > 28) {
                if (def.category === 'attachment') {
                    if (def.flatDmg) statSummary = `+${def.flatDmg} FLAT DMG`;
                    else if (def.slot === 'magazine') statSummary = `+BĂNG ĐẠN & NẠP NHANH`;
                    else if (def.slot === 'optic') statSummary = `+BẠO KÍCH & SÁT THƯƠNG`;
                    else if (def.slot === 'grip') statSummary = `-GIẬT & GOM ĐẠN`;
                } else if (def.category === 'medical') {
                    statSummary = `+50 HP CẤP CỨU`;
                } else if (def.category === 'weapon') {
                    statSummary = `SÚNG HIẾM CẤP ${tier}`;
                }
            }

            row.innerHTML = `
                <div class="pubg-item-left">
                    <span class="pubg-tier-badge" style="background:${tierColor}25; color:${tierColor}; border:1px solid ${tierColor};">T${tier}</span>
                    <div class="pubg-item-details">
                        <span class="pubg-item-name" style="color:${tier >= 3 ? tierColor : '#ffffff'};">${def.name.toUpperCase()}</span>
                        <span class="pubg-item-stat">${statSummary}</span>
                    </div>
                </div>
                <div class="pubg-item-action">
                    ${actionBadgeHtml}
                </div>
            `;

            row.addEventListener('click', () => {
                lootingSystem?.th_smartLootCrate(container, item.slotIndex);
            });

            this.pubgCrateItems.appendChild(row);
        });
    }

    hidePUBGMiniCrate() {
        if (this.pubgMiniCrate) {
            this.pubgMiniCrate.style.display = 'none';
        }
        this._currentPUBGContainer = null;
    }

    // =========================================================================
    // 3. BÁNH XE THAO TÁC NHANH TRONG SUỐT Ở GIỮA MÀN HÌNH (RADIAL MENU)
    // =========================================================================
    th_initRadialMenuDOM() {
        if (this._radialMenuInitialized) return;
        this._radialMenuInitialized = true;
        this.radialOverlay = document.getElementById('radial-menu-overlay');
        this.radialPointerLine = document.getElementById('radial-pointer-line');
        this.radialGunImg = document.getElementById('radial-gun-img');
        this.radialSectors = {
            north: document.getElementById('radial-sector-north'),
            east: document.getElementById('radial-sector-east'),
            south: document.getElementById('radial-sector-south'),
            west: document.getElementById('radial-sector-west')
        };
        this.radialSubs = {
            north: document.getElementById('radial-sub-north'),
            east: document.getElementById('radial-sub-east'),
            south: document.getElementById('radial-sub-south'),
            west: document.getElementById('radial-sub-west')
        };
        this._activeRadialSector = null;

        // Cho phép nhấp chuột trực tiếp vào sector để kích hoạt (Click-to-Select trong Tap Mode)
        Object.entries(this.radialSectors).forEach(([dir, el]) => {
            el?.addEventListener('click', (e) => {
                e.stopPropagation();
                const player = window.game?.player;
                const weapons = player?.weapons;
                this.executeRadialAction(dir, player, weapons);
            });
        });

        // Click ra ngoài vòng tròn để đóng menu
        this.radialOverlay?.addEventListener('click', (e) => {
            if (e.target === this.radialOverlay) {
                this.closeRadialMenuOnly();
            }
        });
    }

    openRadialMenu(player, weapons) {
        this.th_initRadialMenuDOM();
        if (!this.radialOverlay) return;

        // Cập nhật text trạng thái theo thời gian thực (Hoàn toàn typography, không icon)
        if (this.radialSubs.north) {
            const isADS = player?.isADS || player?.th_toggleADS;
            this.radialSubs.north.innerHTML = isADS ? 'NGẮM<br>ĐANG BẬT' : 'NGẮM<br>PHẢN XẠ';
        }

        if (weapons) {
            const currentIdx = weapons.currentSlotIndex === 1 ? 1 : 0;
            const nextIdx = currentIdx === 0 ? 1 : 0;
            const nextGun = weapons.weaponSlots ? weapons.weaponSlots[nextIdx] : null;

            if (this.radialSubs.east) {
                this.radialSubs.east.textContent = nextGun ? `ĐỔI SÚNG: ${nextGun.name.toUpperCase()}` : 'ĐỔI VŨ KHÍ';
            }
            if (this.radialGunImg) {
                this.radialGunImg.src = nextGun?.image || 'assets/previews/kenney-blaster/blaster-a.png';
            }
        }

        if (this.radialSubs.south && weapons) {
            const medkits = weapons.inventory?.medkits || 0;
            this.radialSubs.south.textContent = `CẤP CỨU: +50 HP (${medkits})`;
        }

        if (this.radialSubs.west && weapons) {
            if (weapons.th_overclockActive) {
                this.radialSubs.west.textContent = `ĐANG XẢ (${Math.ceil(weapons.th_overclockTimer)}S)`;
            } else if (weapons.th_overclockCooldown > 0) {
                this.radialSubs.west.textContent = `HỒI: ${Math.ceil(weapons.th_overclockCooldown)}S`;
            } else {
                this.radialSubs.west.textContent = 'XẢ ĐẠN 3S';
            }
        }

        // Reset active highlight và tia laser
        Object.values(this.radialSectors).forEach(sec => sec?.classList.remove('active'));
        this._activeRadialSector = null;
        if (this.radialPointerLine) {
            this.radialPointerLine.style.width = '0px';
        }

        this.radialOverlay.style.display = 'flex';
    }

    updateRadialMenuPointer(screenX, screenY) {
        if (!this.radialOverlay || this.radialOverlay.style.display === 'none') return;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const dx = screenX - centerX;
        const dy = screenY - centerY;
        const dist = Math.hypot(dx, dy);
        const angleRad = Math.atan2(dy, dx);

        // Cập nhật tia Laser chỉ hướng chuột thời gian thực
        if (this.radialPointerLine) {
            if (dist >= 16) {
                const lineLen = Math.min(105, dist);
                this.radialPointerLine.style.width = `${lineLen}px`;
                this.radialPointerLine.style.transform = `rotate(${angleRad}rad)`;
                this.radialPointerLine.style.opacity = '1';
            } else {
                this.radialPointerLine.style.width = '0px';
                this.radialPointerLine.style.opacity = '0';
            }
        }

        // Vùng tâm Deadzone 20px
        if (dist < 20) {
            if (this._activeRadialSector) {
                Object.values(this.radialSectors).forEach(sec => sec?.classList.remove('active'));
                this._activeRadialSector = null;
            }
            return;
        }

        // Tính góc deg (-180 đến 180)
        const angleDeg = angleRad * 180 / Math.PI;

        let selected = null;
        if (angleDeg >= -135 && angleDeg < -45) {
            selected = 'north'; // Hướng Bắc: Kính ngắm ADS (Phím 1)
        } else if (angleDeg >= -45 && angleDeg < 45) {
            selected = 'east';  // Hướng Đông: Đổi súng (Phím 2)
        } else if (angleDeg >= 45 && angleDeg < 135) {
            selected = 'south'; // Hướng Nam: Cấp cứu (Phím 3)
        } else {
            selected = 'west';  // Hướng Tây: Overclock xả đạn (Phím 4)
        }

        if (this._activeRadialSector !== selected) {
            this._activeRadialSector = selected;
            Object.entries(this.radialSectors).forEach(([dir, el]) => {
                if (dir === selected) {
                    el?.classList.add('active');
                } else {
                    el?.classList.remove('active');
                }
            });
        }
    }

    closeRadialMenuOnly() {
        if (this.radialOverlay) {
            this.radialOverlay.style.display = 'none';
        }
        Object.values(this.radialSectors).forEach(sec => sec?.classList.remove('active'));
        this._activeRadialSector = null;
        if (this.radialPointerLine) {
            this.radialPointerLine.style.width = '0px';
        }
        if (window.game?.player) {
            window.game.player.th_isRadialMenuOpen = false;
        }
    }

    executeRadialAction(actionOrDir, player, weapons) {
        this.closeRadialMenuOnly();
        if (!actionOrDir) return;

        // Chuẩn hóa tên action từ hướng hoặc phím số 1-4
        let action = actionOrDir;
        if (action === '1' || action === 'north') action = 'ads';
        else if (action === '2' || action === 'east') action = 'swap_gun';
        else if (action === '3' || action === 'south') action = 'quick_heal';
        else if (action === '4' || action === 'west') action = 'overclock';

        switch (action) {
            case 'ads':
                // 1. Kính ngắm ADS
                if (player) {
                    player.th_toggleADS = !player.th_toggleADS;
                    this.showPickupAlert(player.th_toggleADS ? 'KÍNH NGẮM ADS: BẬT' : 'KÍNH NGẮM ADS: TẮT');
                }
                break;
            case 'swap_gun':
                // 2. Đổi súng chính <-> phụ
                if (weapons) {
                    weapons.th_swapWeapons(this);
                }
                break;
            case 'quick_heal':
                // 3. Bơm máu nhanh cấp cứu
                if (weapons && player) {
                    weapons.th_quickHeal(player, this);
                }
                break;
            case 'overclock':
                // 4. Chế độ bắn tăng cường
                if (weapons) {
                    weapons.th_activateOverclock(this);
                }
                break;
        }
    }

    closeAndExecuteRadialMenu(player, weapons) {
        if (!this.radialOverlay || this.radialOverlay.style.display === 'none') return;
        const chosen = this._activeRadialSector;
        if (chosen) {
            this.executeRadialAction(chosen, player, weapons);
        } else {
            this.closeRadialMenuOnly();
        }
    }

    // =========================================================================
    // HỆ SINH THÁI GIAO DIỆN BALO TÚI ĐỒ [B] & ĐỘ SÚNG (SMART 3-PANEL INVENTORY)
    // =========================================================================
    // =========================================================================
    // HỆ SINH THÁI GIAO DIỆN BALO & NHẶT ĐỒ CHIẾN THUẬT (TACTICAL INVENTORY)
    // =========================================================================
    initSmartInventoryDOM() {
        if (this._smartInvInitialized) return;
        this._smartInvInitialized = true;

        this.smartInvOverlay = document.getElementById('smart-inventory-overlay');
        this.btnInvClose = document.getElementById('btn-inv-close');

        // Cột 1 (Loot Area)
        this.nearbyHeaderTitle = document.getElementById('nearby-header-title');
        this.containerCapacityBadge = document.getElementById('container-capacity-badge');
        this.btnSmartLootAll = document.getElementById('btn-smart-loot-all');
        this.smartContainerGrid = document.getElementById('smart-container-grid');

        // Cột 2 (Loadout & Weapon Modding)
        this.slotHelmet = document.getElementById('slot-helmet');
        this.slotArmor = document.getElementById('slot-armor');
        this.helmetDurabilityFill = document.getElementById('helmet-durability-fill');
        this.helmetDurabilityVal = document.getElementById('helmet-durability-val');
        this.armorDurabilityFill = document.getElementById('armor-durability-fill');
        this.armorDurabilityVal = document.getElementById('armor-durability-val');

        // Khẩu 1 (Primary)
        this.weaponCardPrimary = document.getElementById('weapon-card-primary');
        this.primaryWeaponName = document.getElementById('primary-weapon-name');
        this.primaryWeaponImg = document.getElementById('primary-weapon-img');
        this.primaryAmmoStat = document.getElementById('primary-ammo-stat');

        // Khẩu 2 (Secondary)
        this.weaponCardSecondary = document.getElementById('weapon-card-secondary');
        this.secondaryWeaponName = document.getElementById('secondary-weapon-name');
        this.secondaryWeaponImg = document.getElementById('secondary-weapon-img');
        this.secondaryAmmoStat = document.getElementById('secondary-ammo-stat');

        // 4 Thanh Dynamic Stats
        this.statValDmg = document.getElementById('stat-val-dmg');
        this.statBarDmg = document.getElementById('stat-bar-dmg');
        this.statValAcc = document.getElementById('stat-val-acc');
        this.statBarAcc = document.getElementById('stat-bar-acc');
        this.statValRecoil = document.getElementById('stat-val-recoil');
        this.statBarRecoil = document.getElementById('stat-bar-recoil');
        this.statValReload = document.getElementById('stat-val-reload');
        this.statBarReload = document.getElementById('stat-bar-reload');

        // Cột 3 (Backpack Grid & Quick Filter)
        this.backpackWeightBox = document.getElementById('backpack-weight-box');
        this.duckovWeightText = document.getElementById('duckov-weight-text');
        this.duckovWeightFill = document.getElementById('duckov-weight-fill');
        this.weightOverWarning = document.getElementById('weight-over-warning');
        this.smartBackpackGrid = document.getElementById('smart-backpack-grid');
        this.backpackSlotsCount = document.getElementById('backpack-slots-count');
        this.btnSmartAutoSort = document.getElementById('btn-smart-autosort');
        this.btnTrashDrop = document.getElementById('btn-trash-drop');

        // Bộ lọc nhanh (Quick Filter)
        this._currentBackpackFilter = 'all'; // 'all', 'ammo_gun', 'medical'

        // Khởi tạo TooltipSystem
        this.tooltipSystem = new TooltipSystem();

        this.bindTacticalInventoryEvents();
    }

    bindTacticalInventoryEvents() {
        // Nút đóng giao diện
        this.btnInvClose?.addEventListener('click', () => {
            this._lootingSystem?.closeContainerUI();
        });

        // Nút [SPACE] Nhặt tất cả đồ lân cận vào Balo
        this.btnSmartLootAll?.addEventListener('click', () => {
            this._lootingSystem?.lootAll();
        });

        // Lắng nghe phím Space khi đang mở Balo để Nhặt tất cả
        window.addEventListener('keydown', (e) => {
            if (this.smartInvOverlay && this.smartInvOverlay.style.display !== 'none') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    e.stopPropagation();
                    this._lootingSystem?.lootAll();
                }
            }
        });

        // Nút Auto-sort dồn balo ngăn nắp
        this.btnSmartAutoSort?.addEventListener('click', () => {
            if (this._lootingSystem?.inventory) {
                this._lootingSystem.inventory.autoSort();
                this.refreshSmartInventory();
            }
        });

        // Các tab lọc nhanh: [Tất Cả], [Đạn / Súng], [Y Tế]
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._currentBackpackFilter = tab.getAttribute('data-filter') || 'all';
                sounds.play('switchWeapon', { volume: 0.5, rate: 1.6 });
                this.refreshSmartInventory();
            });
        });

        // Thùng rác vứt đồ ra mặt đất
        if (this.btnTrashDrop) {
            this.btnTrashDrop.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.btnTrashDrop.classList.add('drag-over');
            });
            this.btnTrashDrop.addEventListener('dragleave', () => {
                this.btnTrashDrop.classList.remove('drag-over');
            });
            this.btnTrashDrop.addEventListener('drop', (e) => {
                e.preventDefault();
                this.btnTrashDrop.classList.remove('drag-over');
                if (!this._dragData) return;
                if (this._dragData.side === 'player') {
                    this._lootingSystem?.dropItemFromBackpack(this._dragData.index);
                }
            });
        }

        // Chọn chuyển đổi khẩu súng active khi click vào Thẻ súng
        this.weaponCardPrimary?.addEventListener('click', (e) => {
            // Không kích hoạt nếu bấm trúng ô socket
            if (e.target.closest('.mod-socket-box')) return;
            const weapons = this._lootingSystem?.player?.weapons;
            if (weapons && weapons.currentSlotIndex !== 0) {
                weapons.switchWeapon(0, this._lootingSystem?.player);
                this.refreshSmartInventory();
            }
        });

        this.weaponCardSecondary?.addEventListener('click', (e) => {
            if (e.target.closest('.mod-socket-box')) return;
            const weapons = this._lootingSystem?.player?.weapons;
            if (weapons && weapons.currentSlotIndex !== 1) {
                weapons.switchWeapon(1, this._lootingSystem?.player);
                this.refreshSmartInventory();
            }
        });

        // Gắn listener cho 8 ô socket của cả 2 khẩu súng
        const allSockets = document.querySelectorAll('.mod-socket-box');
        allSockets.forEach(socketEl => {
            const gunIdx = parseInt(socketEl.getAttribute('data-gun') || '0', 10);
            const slotType = socketEl.getAttribute('data-slot');

            // Click vào ô socket: Tháo phụ kiện trả về Balo
            socketEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const weapons = this._lootingSystem?.player?.weapons;
                if (!weapons) return;

                const attachMap = weapons.getAttachmentsForGun(gunIdx);
                if (!attachMap || !attachMap[slotType]) return;

                const removedId = weapons.detachMod(slotType, gunIdx);
                if (removedId) {
                    const added = this._lootingSystem.inventory.addItem(removedId, 1, true);
                    if (added <= 0) {
                        weapons.attachMod(slotType, removedId, gunIdx);
                        this.showPickupAlert('BALO ĐÃ ĐẦY! KHÔNG THỂ THÁO PHỤ KIỆN');
                    } else {
                        sounds.playAttachmentDetach?.();
                        const def = LOOT_ITEMS[removedId];
                        this.showPickupAlert(`ĐÃ THÁO [${def?.name?.toUpperCase() || slotType}] VỀ BALO`);
                    }
                    this.refreshSmartInventory();
                }
            });

            // Drag Over: Nhận phụ kiện kéo tới
            socketEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                socketEl.classList.add('drag-over');
            });

            socketEl.addEventListener('dragleave', () => {
                socketEl.classList.remove('drag-over');
            });

            socketEl.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                socketEl.classList.remove('drag-over');
                this.clearCompatibleHighlights();
                if (!this._dragData) return;

                this.equipAttachmentDirectly(this._dragData, slotType, gunIdx);
            });
        });
    }

    // Làm nổi bật viền xanh lá cho tất cả các socket tương thích với phụ kiện đang cầm
    highlightCompatibleSockets(slotType) {
        if (!slotType) return;
        const matching = document.querySelectorAll(`.mod-socket-box[data-slot="${slotType}"]`);
        matching.forEach(el => el.classList.add('drag-compatible'));
    }

    // Xóa toàn bộ hiệu ứng viền xanh lá khi kết thúc kéo thả
    clearCompatibleHighlights() {
        document.querySelectorAll('.mod-socket-box').forEach(el => {
            el.classList.remove('drag-compatible');
            el.classList.remove('drag-over');
        });
    }

    // Lắp phụ kiện trực tiếp vào khẩu súng và ô socket chỉ định
    equipAttachmentDirectly(dragData, targetSlot, gunIdx = 0) {
        const { side, index, nearbyEntry } = dragData;
        let itemId = null;

        if (side === 'player') {
            const item = this._lootingSystem?.inventory?.slots[index];
            if (item) itemId = item.itemId;
        } else if (side === 'nearby' && nearbyEntry) {
            itemId = nearbyEntry.itemId;
        }

        if (!itemId) return false;
        const def = LOOT_ITEMS[itemId];
        if (!def || def.category !== 'attachment' || def.slot !== targetSlot) {
            this.showPickupAlert(`[${def?.name?.toUpperCase() || itemId}] KHÔNG KHỚP VỚI Ô NÀY!`);
            return false;
        }

        const weapons = this._lootingSystem?.player?.weapons;
        if (!weapons) return false;

        const prevId = weapons.attachMod(targetSlot, itemId, gunIdx);

        // Xử lý nguồn vật phẩm sau khi lắp
        if (side === 'player') {
            if (prevId) {
                this._lootingSystem.inventory.slots[index] = { itemId: prevId, count: 1, revealed: true };
            } else {
                this._lootingSystem.inventory.slots[index] = null;
            }
        } else if (side === 'nearby' && nearbyEntry && nearbyEntry.container) {
            if (prevId) {
                nearbyEntry.container.slots[nearbyEntry.slotIndex] = { itemId: prevId, count: 1, revealed: true };
            } else {
                nearbyEntry.container.slots[nearbyEntry.slotIndex] = null;
            }
            nearbyEntry.container.checkEmpty();
        }

        sounds.playAttachmentEquip?.();
        const gunName = gunIdx === 0 ? 'KHẨU CHÍNH' : 'KHẨU PHỤ';
        this.showPickupAlert(`ĐÃ GẮN [${def.name.toUpperCase()}] VÀO ${gunName}!`);
        this.refreshSmartInventory();
        return true;
    }

    // Thao tác nhanh 1-Click: Chuột phải vào phụ kiện súng -> Tự động quét Khẩu 1 và Khẩu 2
    autoEquipAttachmentFromBackpack(slotIndex) {
        const slot = this._lootingSystem?.inventory?.slots[slotIndex];
        if (!slot) return false;
        const def = LOOT_ITEMS[slot.itemId];
        if (!def || def.category !== 'attachment' || !def.slot) return false;

        const weapons = this._lootingSystem?.player?.weapons;
        if (!weapons) return false;

        // Quét Khẩu 1 trước, nếu trống gắn vào Khẩu 1; nếu Khẩu 1 đã có thì kiểm tra tiếp Khẩu 2
        let targetGunIdx = weapons.findEmptyAttachmentSlot(def.slot);
        if (targetGunIdx === null) {
            // Nếu cả 2 đều đã có phụ kiện ở slot này: Thay thế cho khẩu súng đang cầm (hoặc Khẩu 1)
            targetGunIdx = (weapons.currentSlotIndex === 1) ? 1 : 0;
        }

        const prevId = weapons.attachMod(def.slot, slot.itemId, targetGunIdx);
        if (prevId) {
            this._lootingSystem.inventory.slots[slotIndex] = { itemId: prevId, count: 1, revealed: true };
        } else {
            this._lootingSystem.inventory.slots[slotIndex] = null;
        }

        sounds.playAttachmentEquip?.();
        const targetGunTitle = targetGunIdx === 0 ? 'KHẨU CHÍNH' : 'KHẨU PHỤ';
        this.showPickupAlert(`ĐÃ GẮN [${def.name.toUpperCase()}] VÀO ${targetGunTitle}!`);
        this.refreshSmartInventory();
        return true;
    }

    // Mở Giao diện Balo & Nhặt Đồ Chiến Thuật
    openSmartInventory(playerInventory, container, lootingSystem) {
        this.initSmartInventoryDOM();
        this._lootingSystem = lootingSystem;
        this._currentContainer = container;
        this._currentPlayerInventory = playerInventory;

        if (container) {
            if (this.nearbyHeaderTitle) {
                this.nearbyHeaderTitle.textContent = (container.name || 'HÒM ĐỒ CHIẾN THUẬT').toUpperCase();
            }
        } else {
            if (this.nearbyHeaderTitle) {
                this.nearbyHeaderTitle.textContent = 'VẬT PHẨM LÂN CẬN';
            }
        }

        this.refreshSmartInventory();
        if (this.smartInvOverlay) {
            this._inventoryFocusReturn = document.activeElement;
            this.smartInvOverlay.style.display = 'flex';
            this.smartInvOverlay.setAttribute('role', 'dialog');
            this.smartInvOverlay.setAttribute('aria-modal', 'true');
            this.smartInvOverlay.setAttribute('aria-label', 'Balô và trang bị');
            if (!this._inventoryFocusBound) {
                this._inventoryFocusBound = true;
                this.smartInvOverlay.addEventListener('keydown', event => {
                    if (event.key !== 'Tab') return;
                    const controls = [...this.smartInvOverlay.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')].filter(el => el.getClientRects().length);
                    const first = controls[0], last = controls.at(-1);
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                });
            }
            this.smartInvOverlay.querySelector('.tactical-close-btn, .pubg-close-btn')?.focus();
            sounds.playBackpackToggle(true);
        }
    }

    // Đóng giao diện Balo & Hòm đồ
    closeSmartInventory() {
        if (this.smartInvOverlay && this.smartInvOverlay.style.display !== 'none') {
            this.smartInvOverlay.style.display = 'none';
            this._inventoryFocusReturn?.focus?.();
            sounds.playBackpackToggle(false);
        }
        this.tooltipSystem?.hide();
        this._currentContainer = null;
    }

    // Tương thích ngược: refreshDualInventory trỏ về refreshSmartInventory
    refreshDualInventory() {
        this.refreshSmartInventory();
    }

    // Cập nhật lại toàn bộ giao diện 3 cột công thái học (25% | 45% | 30%)
    refreshSmartInventory() {
        if (!this._currentPlayerInventory) return;
        const player = this._lootingSystem?.player;
        const weapons = player?.weapons;

        // 1. CỘT 1 (25% - LOOT AREA): VẬT PHẨM LÂN CẬN / HÒM ĐỒ
        const nearbyItems = this._lootingSystem?.getNearbyItems ? this._lootingSystem.getNearbyItems() : [];
        if (this.containerCapacityBadge) {
            this.containerCapacityBadge.textContent = `(${nearbyItems.length})`;
        }

        if (this.smartContainerGrid) {
            this.smartContainerGrid.innerHTML = '';
            if (nearbyItems.length === 0) {
                const emptyNotice = document.createElement('div');
                emptyNotice.className = 'tactical-empty-notice';
                emptyNotice.textContent = 'Không có vật phẩm nào ở lân cận';
                this.smartContainerGrid.appendChild(emptyNotice);
            } else {
                nearbyItems.forEach((entry, idx) => {
                    const cardEl = this.createCompactItemRow(entry, idx, 'nearby');
                    this.smartContainerGrid.appendChild(cardEl);
                });
            }
        }

        // 2. CỘT 2 (45% - LOADOUT & WEAPON MODDING): PHÒNG THỦ & 2 KHẨU SÚNG
        // Cập nhật Mũ và Giáp phòng thủ
        if (player) {
            const shieldPct = Math.max(0, Math.min(100, Math.round((player.shield / player.maxShield) * 100)));
            if (this.armorDurabilityFill) this.armorDurabilityFill.style.width = `${shieldPct}%`;
            if (this.armorDurabilityVal) this.armorDurabilityVal.textContent = `${shieldPct}% (${Math.round(player.shield)}/100)`;


            // Mũ bảo vệ FAST-MT
            const helmetPct = Math.max(20, Math.min(100, Math.round((player.health / player.maxHealth) * 100)));
            if (this.helmetDurabilityFill) this.helmetDurabilityFill.style.width = `${helmetPct}%`;
            if (this.helmetDurabilityVal) this.helmetDurabilityVal.textContent = `${helmetPct}% (150/150)`;
        }

        if (weapons) {
            const gun0 = weapons.weaponSlots?.[0];
            const gun1 = weapons.secondaryWeapon;
            const activeIdx = weapons.currentSlotIndex === 1 ? 1 : 0;

            // Đánh dấu thẻ súng đang được kích hoạt (Active Gun Highlight)
            if (this.weaponCardPrimary) {
                this.weaponCardPrimary.classList.toggle('active-gun', activeIdx === 0);
            }
            if (this.weaponCardSecondary) {
                this.weaponCardSecondary.classList.toggle('active-gun', activeIdx === 1);
            }

            // Thẻ súng 1 (Primary)
            if (gun0) {
                if (this.primaryWeaponName) this.primaryWeaponName.textContent = gun0.name.toUpperCase();
                if (gun0.icon && this.primaryWeaponImg) this.primaryWeaponImg.src = gun0.icon;
                const ammoCur = weapons.ammo[gun0.id] ?? gun0.magSize;
                const ammoRes = weapons.reserve[gun0.id] ?? 0;
                if (this.primaryAmmoStat) this.primaryAmmoStat.textContent = `${ammoCur} / ${ammoRes}`;
            }

            // Thẻ súng 2 (Secondary)
            if (gun1) {
                if (this.secondaryWeaponName) this.secondaryWeaponName.textContent = gun1.name.toUpperCase();
                if (gun1.icon && this.secondaryWeaponImg) this.secondaryWeaponImg.src = gun1.icon;
                const ammoCur = weapons.ammo[gun1.id] ?? gun1.magSize;
                const ammoRes = weapons.reserve[gun1.id] ?? 0;
                if (this.secondaryAmmoStat) this.secondaryAmmoStat.textContent = `${ammoCur} / ${ammoRes}`;
            }

            // Cập nhật 4 ô socket của Khẩu 1
            this.updateGunSocketDisplay(0, 'muzzle', 'socket-gun0-muzzle', 'socket-gun0-muzzle-content', '[+] NÒNG');
            this.updateGunSocketDisplay(0, 'optic', 'socket-gun0-optic', 'socket-gun0-optic-content', '[+] KÍNH NGẮM');
            this.updateGunSocketDisplay(0, 'magazine', 'socket-gun0-mag', 'socket-gun0-mag-content', '[+] BĂNG ĐẠN');
            this.updateGunSocketDisplay(0, 'grip', 'socket-gun0-grip', 'socket-gun0-grip-content', '[+] TAY CẦM');

            // Cập nhật 4 ô socket của Khẩu 2
            this.updateGunSocketDisplay(1, 'muzzle', 'socket-gun1-muzzle', 'socket-gun1-muzzle-content', '[+] NÒNG');
            this.updateGunSocketDisplay(1, 'optic', 'socket-gun1-optic', 'socket-gun1-optic-content', '[+] KÍNH NGẮM');
            this.updateGunSocketDisplay(1, 'magazine', 'socket-gun1-mag', 'socket-gun1-mag-content', '[+] BĂNG ĐẠN');
            this.updateGunSocketDisplay(1, 'grip', 'socket-gun1-grip', 'socket-gun1-grip-content', '[+] TAY CẦM');

            // Cập nhật 4 thanh chỉ số thời gian thực theo khẩu súng active
            const activeWeapon = activeIdx === 1 ? gun1 : gun0;
            if (activeWeapon) {
                const effective = weapons.getModifiedStats(activeWeapon, activeIdx);
                const dmgVal = Math.round(effective.damage);
                if (this.statValDmg) this.statValDmg.textContent = dmgVal.toString();
                if (this.statBarDmg) this.statBarDmg.style.width = `${Math.min(100, Math.round((dmgVal / 60) * 100))}%`;

                const spreadScore = Math.max(10, Math.min(100, Math.round(100 - (effective.baseSpreadDegADS * 25))));
                if (this.statValAcc) this.statValAcc.textContent = `${spreadScore}%`;
                if (this.statBarAcc) this.statBarAcc.style.width = `${spreadScore}%`;

                const recoilScore = Math.max(10, Math.min(100, Math.round(100 - (effective.recoilPitch * 1400))));
                if (this.statValRecoil) this.statValRecoil.textContent = `${recoilScore}%`;
                if (this.statBarRecoil) this.statBarRecoil.style.width = `${recoilScore}%`;

                const reloadTime = effective.reloadTime.toFixed(2);
                if (this.statValReload) this.statValReload.textContent = `${reloadTime}s`;
                if (this.statBarReload) this.statBarReload.style.width = `${Math.max(15, Math.min(100, Math.round(100 - (effective.reloadTime * 35))))}%`;
            }
        }

        // 3. CỘT 3 (30% - BACKPACK GRID & QUICK FILTER)
        let totalWeightKg = 20.0; // Trọng lượng cơ bản đồ tác chiến
        const pSlots = this._currentPlayerInventory.slots;
        let pFilled = 0;

        // Tính toán tổng tải trọng và trạng thái quá tải
        pSlots.forEach(slot => {
            if (slot && slot.itemId) {
                pFilled++;
                const def = LOOT_ITEMS[slot.itemId];
                const itemWeight = (def?.size ? def.size[0] * def.size[1] * 2.5 : 1.5) * (slot.count || 1);
                totalWeightKg += itemWeight;
            }
        });

        const curWeightNum = Math.round(totalWeightKg);
        const isOverweight = curWeightNum > 450;

        // Cập nhật trạng thái quá tải cho người chơi
        if (player) {
            player.isOverweight = isOverweight;
        }

        if (this.duckovWeightText) {
            this.duckovWeightText.textContent = `${curWeightNum} / 450 KG`;
        }
        if (this.duckovWeightFill) {
            const pct = Math.min(100, Math.round((curWeightNum / 450) * 100));
            this.duckovWeightFill.style.width = `${pct}%`;
        }
        if (this.backpackWeightBox) {
            this.backpackWeightBox.classList.toggle('overweight', isOverweight);
        }
        if (this.weightOverWarning) {
            this.weightOverWarning.style.display = isOverweight ? 'block' : 'none';
        }
        if (this.backpackSlotsCount) {
            this.backpackSlotsCount.textContent = `${pFilled} / ${pSlots.length}`;
        }

        // Render danh sách Balo dạng Compact List (Cao 48px) có áp dụng Tab Lọc
        if (this.smartBackpackGrid) {
            this.smartBackpackGrid.innerHTML = '';
            let renderedCount = 0;

            pSlots.forEach((slot, slotIdx) => {
                if (!slot || !slot.itemId) return;
                const def = LOOT_ITEMS[slot.itemId];
                if (!this.matchesBackpackFilter(def)) return;


                renderedCount++;
                const cardEl = this.createCompactItemRow(slot, slotIdx, 'player');
                this.smartBackpackGrid.appendChild(cardEl);
            });

            if (renderedCount === 0) {
                const emptyNotice = document.createElement('div');
                emptyNotice.className = 'tactical-empty-notice';
                emptyNotice.textContent = 'Không có vật phẩm trong danh mục này';
                this.smartBackpackGrid.appendChild(emptyNotice);
            }

        }
    }

    // Kiểm tra xem item có thỏa mãn bộ lọc tab Balo đang chọn không
    matchesBackpackFilter(def) {
        if (!def) return false;
        if (this._currentBackpackFilter === 'all') return true;
        if (this._currentBackpackFilter === 'ammo_gun') {
            return def.category === 'ammo' || def.category === 'weapon' || def.category === 'attachment';
        }
        if (this._currentBackpackFilter === 'medical') {
            return def.category === 'medical' || def.category === 'booster';
        }
        return true;
    }

    // Cập nhật nội dung hiển thị của từng ô socket phụ kiện súng
    updateGunSocketDisplay(gunIdx, slotType, boxId, contentId, placeholderLabel) {
        const socketBox = document.getElementById(boxId);
        const socketContent = document.getElementById(contentId);
        if (!socketBox || !socketContent) return;

        const weapons = this._lootingSystem?.player?.weapons;
        const attachMap = weapons?.getAttachmentsForGun?.(gunIdx);
        const currentModId = attachMap ? attachMap[slotType] : null;

        if (currentModId) {
            const def = LOOT_ITEMS[currentModId];
            socketBox.classList.add('socket-filled');
            socketBox.title = `[${def?.name || currentModId}] - Nhấp chuột để tháo phụ kiện về Balo`;

            const imgHtml = def?.iconImage
                ? `<img src="${def.iconImage}" alt="${def.name}">`
                : `<span style="font-size:9px;font-weight:900;color:#38bdf8;">${def?.icon || 'MOD'}</span>`;
            socketContent.innerHTML = imgHtml;
        } else {
            socketBox.classList.remove('socket-filled');
            socketBox.title = `Ô [${placeholderLabel}] còn trống - Kéo phụ kiện vào hoặc Chuột phải từ Balo`;
            socketContent.innerHTML = `<span class="socket-placeholder">${placeholderLabel}</span>`;
        }
    }

    // Thiết kế Thẻ Vật phẩm Tối giản (Compact Item Card - Cao đúng 48px)
    // Tuyệt đối không đưa đoạn văn mô tả vào trực tiếp ô đồ để tránh tốn diện tích
    createCompactItemRow(data, index, side) {
        const card = document.createElement('div');
        const itemId = data.itemId;
        const itemDef = LOOT_ITEMS[itemId] || { name: itemId, rarity: 'common', category: 'item', icon: 'ITM' };

        // Phân loại viền màu theo độ hiếm (Rarity)
        const rarity = itemDef.rarity || 'common';
        card.className = `compact-item-card rarity-${rarity}`;
        card.draggable = true;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${itemDef.name} · ${side === 'nearby' ? 'Nhặt' : 'Dùng hoặc trang bị'}`);
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            card.dispatchEvent(new MouseEvent(side === 'nearby' ? 'click' : 'contextmenu', { bubbles: true }));
        });

        // Số lượng hiển thị góc phải dạng số lớn (vd: x60, x2)
        const countText = data.count && data.count > 1 ? `x${data.count}` : (itemDef.category === 'ammo' ? `x${data.count}` : '');

        // Nhãn phân loại nhỏ (Badge: [PHỤ KIỆN], [ĐẠN], [Y TẾ])
        const catBadgeLabels = {
            attachment: 'PHỤ KIỆN',
            ammo: 'ĐẠN',
            medical: 'Y TẾ',
            weapon: 'SÚNG',
            throwable: 'NÉM',
            scrap: 'VẬT LIỆU'
        };
        const catBadgeClass = `badge-${itemDef.category || 'item'}`;
        const catText = catBadgeLabels[itemDef.category] || (itemDef.category || 'ĐỒ DÙNG').toUpperCase();

        // Icon vuông (40x40px)
        const iconHtml = itemDef.iconImage
            ? `<img src="${itemDef.iconImage}" alt="${itemDef.name}">`
            : `<span class="card-fallback-icon">${itemDef.icon || 'ITM'}</span>`;

        card.innerHTML = `
            <div class="card-icon-box">${iconHtml}</div>
            <div class="card-info-box">
                <div class="card-name-txt">${itemDef.name}</div>
                <div class="card-badge-row">
                    <span class="card-category-badge ${catBadgeClass}">[${catText}]</span>
                </div>
            </div>
            <div class="card-qty-box">${countText}</div>
        `;

        // 3. Hệ thống Tooltip Thông minh (Floating Hover Tooltip)
        card.addEventListener('mouseenter', (e) => {
            const weapons = this._lootingSystem?.player?.weapons;
            this.tooltipSystem?.show(itemDef, e, weapons);
        });
        card.addEventListener('mousemove', (e) => {
            this.tooltipSystem?.updatePosition(e);
        });
        card.addEventListener('mouseleave', () => {
            this.tooltipSystem?.hide();
        });

        // 4. Cơ chế Thao tác Nhanh "1-Click" (Fast Inventory Controls)
        if (side === 'nearby') {
            // [Shift + Chuột trái] hoặc Click trái vào item trong hòm/lân cận:
            // Chuyển ngay lập tức sang Balo nếu còn chỗ
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this._lootingSystem?.lootNearbyItem(data);
            });
        } else if (side === 'player') {
            // Chuột phải vào item trong Balo:
            card.addEventListener('contextmenu', (e) => {
            // Click đúp chuột trái vào item trong Balo: Sử dụng hoặc gắn phụ kiện
            card.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (itemDef.category === 'attachment' && itemDef.slot) {
                    this.autoEquipAttachmentFromBackpack(index);
                } else {
                    this._lootingSystem?.useItem(index);
                }
            });


                e.preventDefault();
                e.stopPropagation();

                // Chuột phải vào Đồ y tế / Nước: Sử dụng ngay lập tức
                if (itemDef.category === 'medical' || itemDef.category === 'booster') {
                    this._lootingSystem?.useItem(index);
                    return;
                }

                // Chuột phải vào Phụ kiện súng (Muzzle, Sight, Mag, Grip):
                // Tự động quét Khẩu 1 và Khẩu 2, nếu khẩu nào trống slot thì chuyển thẳng vào slot đó!
                if (itemDef.category === 'attachment' && itemDef.slot) {
                    this.autoEquipAttachmentFromBackpack(index);
                    return;
                }

                // Vật phẩm khác: thử sử dụng
                this._lootingSystem?.useItem(index);
            });

            // Click chuột trái vào item trong Balo:
            card.addEventListener('click', (e) => {
                e.stopPropagation();

                // [Ctrl + Chuột trái]: Vứt vật phẩm ra đất (Drop Item)
                if (e.ctrlKey) {
                    this._lootingSystem?.dropItemFromBackpack(index);
                    return;
                }

                // [Shift + Chuột trái]:
                // Nếu đang mở Hòm đồ -> Chuyển sang hòm đồ
                // Nếu không mở Hòm đồ -> Tự động gắn lên súng nếu là phụ kiện
                if (e.shiftKey) {
                    if (this._currentContainer && this._currentContainer.isOpen) {
                        this._lootingSystem?.transferItem('player', index);
                    } else if (itemDef.category === 'attachment' && itemDef.slot) {
                        this.autoEquipAttachmentFromBackpack(index);
                    }
                }
            });
        }

        // Kéo thả (Drag & Drop)
        card.addEventListener('dragstart', (e) => {
            this._dragData = { side, index, nearbyEntry: data };
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', `${side}:${index}`);

            // Nếu kéo thả phụ kiện tương thích: Làm sáng viền xanh lá ở các ô socket súng tương ứng!
            if (itemDef.category === 'attachment' && itemDef.slot) {
                this.highlightCompatibleSockets(itemDef.slot);
            }
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            this.clearCompatibleHighlights();
            this._dragData = null;
        });

        return card;
    }

    // Cập nhật tiến trình mở ô bí ẩn
    updateRevealingProgress(slotIndex, progress) {
        const slotEl = document.getElementById(`container-slot-${slotIndex}`);
        if (!slotEl) return;
        slotEl.classList.add('slot-revealing');
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
        slotEl.innerHTML = `<span class="unrevealed-question">?</span><small class="unrevealed-label">${pct}%</small>`;
    }
}

// =========================================================================
// HỆ THỐNG TOOLTIP THÔNG MINH (FLOATING HOVER TOOLTIP COMPONENT)
// =========================================================================
export class TooltipSystem {
    constructor() {
        this.tooltipEl = document.getElementById('tactical-tooltip');
        this.titleEl = document.getElementById('tooltip-item-name');
        this.rarityEl = document.getElementById('tooltip-item-rarity');
        this.catEl = document.getElementById('tooltip-item-cat');
        this.weightEl = document.getElementById('tooltip-item-weight');
        this.compatBox = document.getElementById('tooltip-compat-box');
        this.compatList = document.getElementById('tooltip-compat-list');
        this.effectsEl = document.getElementById('tooltip-item-effects');
        this.descEl = document.getElementById('tooltip-item-desc');
    }

    show(itemDef, mouseEvent = null, weapons = null) {
        if (!this.tooltipEl || !itemDef) return;

        // 1. Tên món đồ & Độ hiếm
        this.titleEl.textContent = (itemDef.name || 'VẬT PHẨM').toUpperCase();
        const rarity = itemDef.rarity || 'common';
        const rarityLabels = {
            common: 'PHỔ THÔNG',
            rare: 'TIÊU CHUẨN',
            epic: 'CAO CẤP',
            legendary: 'HUYỀN THOẠI'
        };
        this.rarityEl.className = `tooltip-rarity-badge badge-${rarity}`;
        this.rarityEl.textContent = rarityLabels[rarity] || 'TIÊU CHUẨN';

        // 2. Thể loại & Trọng lượng
        const catLabels = {
            attachment: 'PHỤ KIỆN SÚNG',
            ammo: 'ĐẠN DỰ TRỮ',
            medical: 'Y TẾ & HỒI PHỤC',
            weapon: 'VŨ KHÍ',
            throwable: 'VẬT NÉM CHIẾN THUẬT',
            scrap: 'VẬT LIỆU CHẾ TẠO'
        };
        this.catEl.textContent = catLabels[itemDef.category] || (itemDef.category || 'ĐỒ DÙNG').toUpperCase();
        const weightKg = (itemDef.size ? itemDef.size[0] * itemDef.size[1] * 2.5 : 1.5).toFixed(1);
        this.weightEl.textContent = `${weightKg} KG`;

        // 3. Danh sách súng tương thích (nếu là phụ kiện)
        if (itemDef.category === 'attachment' && itemDef.slot) {
            this.compatBox.style.display = 'flex';
            this.compatList.textContent = 'BLASTER-X, REPEATER-9, AK-47, AWP SNIPER, SCATTER-V';
        } else {
            this.compatBox.style.display = 'none';
        }

        // 4. Chỉ số tác động định dạng màu (Dấu + xanh lá #22c55e, dấu - đỏ #ef4444)
        let chipsHtml = '';
        if (itemDef.effects) {
            const eff = itemDef.effects;
            if (eff.recoil !== undefined) {
                const pct = Math.round(eff.recoil * 100);
                chipsHtml += pct < 0
                    ? `<span class="effect-stat-chip stat-positive">ĐỘ GIẬT: ${pct}%</span>`
                    : `<span class="effect-stat-chip stat-negative">ĐỘ GIẬT: +${pct}%</span>`;
            }
            if (eff.recovery !== undefined) {
                const pct = Math.round(eff.recovery * 100);
                chipsHtml += pct > 0
                    ? `<span class="effect-stat-chip stat-positive">HỒI TÂM: +${pct}%</span>`
                    : `<span class="effect-stat-chip stat-negative">HỒI TÂM: ${pct}%</span>`;
            }
            if (eff.adsZoom !== undefined && eff.adsZoom > 1) {
                chipsHtml += `<span class="effect-stat-chip stat-positive">TẦM NHÌN: x${eff.adsZoom.toFixed(1)}</span>`;
            }
            if (eff.adsSpread !== undefined) {
                const pct = Math.round(eff.adsSpread * 100);
                chipsHtml += pct < 0
                    ? `<span class="effect-stat-chip stat-positive">ĐỘ CHỤM ADS: +${Math.abs(pct)}%</span>`
                    : `<span class="effect-stat-chip stat-negative">TẢN ĐẠN: +${pct}%</span>`;
            }
            if (eff.reloadTime !== undefined) {
                const pct = Math.round(eff.reloadTime * 100);
                chipsHtml += pct < 0
                    ? `<span class="effect-stat-chip stat-positive">NẠP ĐẠN: ${pct}% (NHANH)</span>`
                    : `<span class="effect-stat-chip stat-negative">NẠP ĐẠN: +${pct}%</span>`;
            }
            if (eff.magBonus !== undefined) {
                chipsHtml += `<span class="effect-stat-chip stat-positive">BĂNG ĐẠN: +${eff.magBonus} VIÊN</span>`;
            }
            if (eff.soundRadius !== undefined) {
                const pct = Math.round(eff.soundRadius * 100);
                chipsHtml += `<span class="effect-stat-chip stat-positive">BÁN KÍNH TIẾNG ỒN: ${pct}%</span>`;
            }
        } else if (itemDef.effect) {
            if (itemDef.effect.amount) {
                chipsHtml += `<span class="effect-stat-chip stat-positive">HỒI PHỤC: +${itemDef.effect.amount} MÁU</span>`;
            }
            if (itemDef.effect.packs) {
                chipsHtml += `<span class="effect-stat-chip stat-positive">+${itemDef.effect.packs} BĂNG ĐẠN DỰ TRỮ</span>`;
            }
            if (itemDef.effect.duration) {
                chipsHtml += `<span class="effect-stat-chip stat-neutral">THỜI LƯỢNG: ${itemDef.effect.duration}s</span>`;
            }
        }

        this.effectsEl.innerHTML = chipsHtml;
        this.descEl.textContent = itemDef.description || itemDef.shortDesc || 'Trang bị chiến thuật dã chiến.';

        this.tooltipEl.style.display = 'flex';
        if (mouseEvent) {
            this.updatePosition(mouseEvent);
        }
    }

    updatePosition(e) {
        if (!this.tooltipEl || this.tooltipEl.style.display === 'none') return;
        const pad = 12;
        const tipWidth = this.tooltipEl.offsetWidth || 260;
        const tipHeight = this.tooltipEl.offsetHeight || 180;
        let left = e.clientX + pad;
        let top = e.clientY + pad;

        if (left + tipWidth > window.innerWidth - 10) {
            left = e.clientX - tipWidth - pad;
        }
        if (top + tipHeight > window.innerHeight - 10) {
            top = window.innerHeight - tipHeight - 10;
        }
        this.tooltipEl.style.left = `${Math.max(10, left)}px`;
        this.tooltipEl.style.top = `${Math.max(10, top)}px`;
    }

    hide() {
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    }
}



