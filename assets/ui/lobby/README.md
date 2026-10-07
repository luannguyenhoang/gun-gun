# Lobby PNG icon pack

- Large `4k/` exports were removed (about 333 MiB). They are recoverable from Git commit `d8c6e84`.
- `runtime/`: tightly cropped PNGs, maximum edge 512 pixels, used by the game.
- `manifest.json`: icon names and original-sheet crop coordinates.
- `source-sheet.png`: the supplied 1024 × 572 reference.
- `transparent-sheet.png`: background extraction produced with the built-in imagegen tool.

These are upscaled assets, not native 4K source detail. The original sheet contains 44 items. `friends-chat` is additionally isolated from the friends button; `weapon` uses the separate pistol reference subsequently supplied by the user (`weapon-reference.png`), with its extracted transparent source in `weapon-transparent.png`. The AI background extraction may subtly reconstruct original edges. Heart and diamond are exported but intentionally not displayed in the lobby.

The HTML keeps accessible text and existing button handlers. Profile photos, account names, coin amounts, room state, and the multiplayer start label remain dynamic. The solo play button uses the supplied baked-in CHƠI artwork.

Regenerate using `node tools/art/extract-lobby-icons.cjs` with `sharp` available in NODE_PATH. This saves runtime PNGs only. Add `--4k` explicitly to recreate 4096px masters; these add about 333 MiB and are not loaded by the game.

## Built-in imagegen prompt

Use case: background-extraction. Edit this single sprite atlas: remove ONLY the beige sheet background to true transparent alpha, including inside the two empty circular frames. Preserve every icon, all 44 objects, exact original positions, shapes, colors, text and layout unchanged. Do not rearrange, add, omit or redesign anything. Keep the original 1024:572 aspect ratio and expand to maximum available resolution (4K width preferred). This is an intermediate transparent atlas for deterministic individual extraction. Text BẠN BÈ and CHƠI must remain exact. Preserve cream fills INSIDE buttons and filled circular avatars; remove beige only in empty circular frames and outside objects.

## Replacement weapon prompt (built-in imagegen)

Isolate the supplied dark brown pistol on transparent alpha. Preserve its right-facing outline, curved slanted grip, trigger guard and transparent trigger hole, stepped rounded barrel, raised sights, flat brown fill and thin dark outline. No redesign, background, shadow, glow or tile. Reconstruct clean edges at high resolution.
