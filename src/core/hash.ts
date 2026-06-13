/**
 * MD5 hash implementation for generating deterministic translation keys.
 * 
 * Why MD5 instead of a simple hash?
 * - 128-bit output = virtually zero collision risk
 * - Widely understood and well-tested algorithm
 * - 32 hex characters is a reasonable key length
 * - Same string → same hash, always (deterministic)
 */

// MD5 per-round shift amounts
const S = new Uint8Array(64);
S[0] = 7; S[1] = 12; S[2] = 17; S[3] = 22;
S[4] = 7; S[5] = 12; S[6] = 17; S[7] = 22;
S[8] = 7; S[9] = 12; S[10] = 17; S[11] = 22;
S[12] = 7; S[13] = 12; S[14] = 17; S[15] = 22;
S[16] = 5; S[17] = 9; S[18] = 14; S[19] = 20;
S[20] = 5; S[21] = 9; S[22] = 14; S[23] = 20;
S[24] = 5; S[25] = 9; S[26] = 14; S[27] = 20;
S[28] = 5; S[29] = 9; S[30] = 14; S[31] = 20;
S[32] = 4; S[33] = 11; S[34] = 16; S[35] = 23;
S[36] = 4; S[37] = 11; S[38] = 16; S[39] = 23;
S[40] = 4; S[41] = 11; S[42] = 16; S[43] = 23;
S[44] = 4; S[45] = 11; S[46] = 16; S[47] = 23;
S[48] = 6; S[49] = 10; S[50] = 15; S[51] = 21;
S[52] = 6; S[53] = 10; S[54] = 15; S[55] = 21;
S[56] = 6; S[57] = 10; S[58] = 15; S[59] = 21;
S[60] = 6; S[61] = 10; S[62] = 15; S[63] = 21;

// Pre-computed K table
const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
}

/**
 * MD5 hash function — produces a 32-character hex string.
 * Deterministic: same input always produces the same output.
 *
 * NOTE: This is NOT suitable for cryptographic purposes.
 * It is used solely for generating deterministic translation keys.
 */
export function md5(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const len = bytes.length;
    const bitLen = len * 8;

    // Calculate padded length: len + 1 (0x80) + padding to 56 mod 64 + 8 bytes length
    let paddedLen = len + 1;
    while (paddedLen % 64 !== 56) paddedLen++;
    paddedLen += 8;

    const padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[len] = 0x80;

    // Append length in bits as little-endian 64-bit
    const dv = new DataView(padded.buffer);
    dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
    dv.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

    // Initialize state
    let a0 = 0x67452301;
    let b0 = 0xEFCDAB89;
    let c0 = 0x98BADCFE;
    let d0 = 0x10325476;

    // Process each 64-byte block
    for (let offset = 0; offset < paddedLen; offset += 64) {
        // Read 16 32-bit words from the block
        const M = new Uint32Array(16);
        for (let j = 0; j < 16; j++) {
            M[j] = dv.getUint32(offset + j * 4, true);
        }

        let A = a0, B = b0, C = c0, D = d0;

        for (let i = 0; i < 64; i++) {
            let F: number;
            let g: number;

            if (i < 16) {
                F = (B & C) | (~B & D);
                g = i;
            } else if (i < 32) {
                F = (D & B) | (~D & C);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                F = B ^ C ^ D;
                g = (3 * i + 5) % 16;
            } else {
                F = C ^ (B | (~D));
                g = (7 * i) % 16;
            }

            F = ((F >>> 0) + (A >>> 0) + (K[i] >>> 0) + (M[g] >>> 0)) >>> 0;
            A = D;
            D = C;
            C = B;
            const rotated = ((F << S[i]) | (F >>> (32 - S[i]))) >>> 0;
            B = (B + rotated) >>> 0;
        }

        a0 = (a0 + A) >>> 0;
        b0 = (b0 + B) >>> 0;
        c0 = (c0 + C) >>> 0;
        d0 = (d0 + D) >>> 0;
    }

    // Produce the final hash value (little-endian)
    const result = new Uint8Array(16);
    const rv = new DataView(result.buffer);
    rv.setUint32(0, a0, true);
    rv.setUint32(4, b0, true);
    rv.setUint32(8, c0, true);
    rv.setUint32(12, d0, true);

    // Convert to hex string
    return Array.from(result)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Extract leading/trailing whitespace from a string,
 * return the trimmed content and whitespace info.
 */
export function extractWhitespace(text: string): { leading: string; trailing: string; trimmed: string } {
    const leadingMatch = text.match(/^(\s*)/);
    const trailingMatch = text.match(/(\s*)$/);

    const leading = leadingMatch ? leadingMatch[1] : '';
    const trailing = trailingMatch ? trailingMatch[1] : '';
    const trimmed = text.trim();

    return { leading, trailing, trimmed };
}

/**
 * Generate a hash for a string, trimming whitespace first.
 * Returns the MD5 hash of the trimmed string.
 */
export function hashString(text: string): string {
    const { trimmed } = extractWhitespace(text);
    return md5(trimmed);
}

/**
 * Reconstruct a translated string with original whitespace preserved.
 */
export function applyWhitespace(translation: string, whitespace: { leading: string; trailing: string }): string {
    return whitespace.leading + translation + whitespace.trailing;
}