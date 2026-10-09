import { expect, test } from 'bun:test';

import { deserializeValue, RatioValue, FloatValue } from "./value";

const MAX_SAFE_INT = new RatioValue(BigInt(Number.MAX_SAFE_INTEGER));

test('class operations preserve their operands', () => {
    const third = RatioValue.ofFraction(2n, 6n);
    const result = third.mul(new RatioValue(3n));
    expect(result).toBeInstanceOf(RatioValue);
    expect(result.toNumber()).toBe(1);
    expect(third.serialize()).toEqual(['Q', 1, 3]);
    expect(RatioValue.ofFraction(-2n, 6n).serialize()).toEqual(['Q', -1, 3]);
});

test('JSON round trips preserve exact and approximate values', () => {
    const values = [
        new RatioValue(7n),
        new RatioValue(-1n, 3n),
        RatioValue.parse('0.1'),
        new FloatValue(Math.sqrt(2)),
        new FloatValue(2 ** 53),
        new FloatValue(NaN),
        new FloatValue(Infinity),
        new FloatValue(-Infinity),
    ];
    for (const value of values) {
        const restored = deserializeValue(JSON.parse(JSON.stringify(value.serialize())));
        expect(restored.toNumber()).toBe(value.toNumber());
        expect(restored.serialize()).toEqual(value.serialize());
    }
    expect(deserializeValue(['Q', 1, 3]).mul(new RatioValue(3n, 1n)).toNumber()).toBe(1);
});

test('decimal and rational arithmetic remains exact', () => {
    // 7 / 100 * 100 = 7
    expect(new RatioValue(7n).div(new RatioValue(100n)).mul(new RatioValue(100n)).toNumber()).toBe(7);
    // 0.1 + 0.2 = 3 / 10
    expect(RatioValue.parse('0.1').add(RatioValue.parse('0.2')).serialize()).toEqual(['Q', 3, 10]);
    // 0.3 - 0.2 = 1 / 10
    expect(RatioValue.parse('0.3').sub(RatioValue.parse('0.2')).serialize()).toEqual(['Q', 1, 10]);
    // 1 / 3 * 3 = 1
    expect(new RatioValue(1n).div(new RatioValue(3n)).mul(new RatioValue(3n)).toNumber()).toBe(1);
    // 1 / 3 + 1 / 6 = 1 / 2
    expect(new RatioValue(1n).div(new RatioValue(3n)).add(new RatioValue(1n).div(new RatioValue(6n))).serialize()).toEqual(['Q', 1, 2]);
    // 1 / (-3 / 2) = -2 / 3
    expect(new RatioValue(1n).div(new RatioValue(-3n).div(new RatioValue(2n))).serialize()).toEqual(['Q', -2, 3]);
    // -(1 / 3) = -1 / 3
    expect(new RatioValue(1n).div(new RatioValue(3n)).neg().serialize()).toEqual(['Q', -1, 3]);
    // 1 / 3 - 1 / 3 = 0
    expect(new RatioValue(1n).div(new RatioValue(3n)).sub(new RatioValue(1n).div(new RatioValue(3n))).toNumber()).toBe(0);

    // we don't care about -0.
    expect(new RatioValue(0n).mul(new RatioValue(-1n)).serialize()).toEqual(['Q', 0, 1]);
    expect(new RatioValue(0n).div(new RatioValue(-1n)).serialize()).toEqual(['Q', 0, 1]);
    expect(new RatioValue(0n).neg().serialize()).toEqual(['Q', 0, 1]);
});

test('integer powers remain exact', () => {
    // (0.1)^2 = 1 / 100
    expect(RatioValue.parse('0.1').pow(new RatioValue(2n)).serialize()).toEqual(['Q', 1, 100]);
    // (2 / 3)^(-3) = 27 / 8
    expect(new RatioValue(2n).div(new RatioValue(3n)).pow(new RatioValue(-3n)).serialize()).toEqual(['Q', 27, 8]);
    // (-2 / 3)^(-3) = -27 / 8
    expect(new RatioValue(-2n).div(new RatioValue(3n)).pow(new RatioValue(-3n)).serialize()).toEqual(['Q', -27, 8]);
    // 7e-2 = 7 / 100
    expect(new RatioValue(7n).mul(new RatioValue(10n).pow(new RatioValue(-2n))).serialize()).toEqual(['Q', 7, 100]);
    // 0^0 = 1
    expect(new RatioValue(0n).pow(new RatioValue(0n)).toNumber()).toBe(1);
    // (-1)^(MAX_SAFE_INTEGER) = -1
    expect(new RatioValue(-1n).pow(new RatioValue(BigInt(Number.MAX_SAFE_INTEGER))).toNumber()).toBe(-1);
});

test('reduction precedes the component limit', () => {
    // (max / 2) * (2 / max) = 1
    expect(MAX_SAFE_INT.div(new RatioValue(2n)).mul(new RatioValue(2n).div(MAX_SAFE_INT)).toNumber()).toBe(1);
    // (max / 2) / (max / 3) = 3 / 2
    expect(MAX_SAFE_INT.div(new RatioValue(2n)).div(MAX_SAFE_INT.div(new RatioValue(3n))).serialize()).toEqual(['Q', 3, 2]);
    // 1 / max + 2 / max = 3 / max
    expect(new RatioValue(1n).div(MAX_SAFE_INT).add(new RatioValue(2n).div(MAX_SAFE_INT)).serialize()).toEqual(['Q', 3, Number.MAX_SAFE_INTEGER]);
    // max / 2 + max / 2 = max
    expect(MAX_SAFE_INT.div(new RatioValue(2n)).add(MAX_SAFE_INT.div(new RatioValue(2n))).toNumber()).toBe(Number.MAX_SAFE_INTEGER);
    // max / 2 - (max - 2) / 2 = 1
    expect(MAX_SAFE_INT.div(new RatioValue(2n)).sub(new RatioValue(BigInt(Number.MAX_SAFE_INTEGER) - 2n).div(new RatioValue(2n))).toNumber()).toBe(1);
    // max / (max - 1) = max / (max - 1)
    expect(MAX_SAFE_INT.div(new RatioValue(BigInt(Number.MAX_SAFE_INTEGER) - 1n)).serialize()).toEqual(['Q', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]);
    expect(RatioValue.parse('0.0000000000000002').serialize()).toEqual(['Q', 1, 5000000000000000]);
    expect(RatioValue.parse('0.0000000000000002220446049250313080847263336181640625').serialize()).toEqual(['Q', 1, 4503599627370496]);
    expect(RatioValue.parse('000.5000000000000000000000000000').serialize()).toEqual(['Q', 1, 2]);
    expect(RatioValue.parse('7.').toNumber()).toBe(7);
});

test('unsafe cross-products never become rounded rational components', () => {
    const left = MAX_SAFE_INT.div(new RatioValue(2n));
    const right = new RatioValue(2n).div(new RatioValue(3n));
    expect(left.add(right).toNumber()).toBe(left.toNumber() + right.toNumber());
    expect(left.mul(right).serialize()).toEqual(['Q', Number.MAX_SAFE_INTEGER, 3]);
    expect(MAX_SAFE_INT.div(new RatioValue(3n)).mul(new RatioValue(2n)).toNumber()).toBe(Number.MAX_SAFE_INTEGER * 2 / 3);
    expect(MAX_SAFE_INT.div(new RatioValue(3n)).div(new RatioValue(2n).div(new RatioValue(5n))).toNumber()).toBe(Number.MAX_SAFE_INTEGER * 5 / 6);
});

test('unsupported values retain floating-point behavior', () => {
    expect(new RatioValue(2n).sqrt().toNumber()).toBe(Math.sqrt(2));
    expect(new RatioValue(2n).pow(new RatioValue(1n, 3n)).toNumber()).toBe(2 ** (1/3));
    expect(MAX_SAFE_INT.mul(new RatioValue(2n)).toNumber()).toBe(Number.MAX_SAFE_INTEGER * 2);
    expect(new RatioValue(2n ** 53n).div(new RatioValue(3n)).toNumber()).toBe(2 ** 53 / 3);
    expect(RatioValue.parse('0.00000000000000011102230246251565404236316680908203125').toNumber()).toBe(2 ** -53);
    expect(new RatioValue(2n).pow(new RatioValue(53n)).toNumber()).toBe(2 ** 53);
    expect(new RatioValue(2n).pow(new RatioValue(10000n)).toNumber()).toBe(Infinity);
    expect(new RatioValue(2n).pow(new RatioValue(-10000n)).toNumber()).toBe(0);
    expect(RatioValue.parse('9007199254740993').toNumber()).toBe(Number('9007199254740993'));
    expect(RatioValue.parse('0.' + '0'.repeat(100) + '1').toNumber()).toBe(1e-101);
    expect(new RatioValue(1n).div(new RatioValue(0n)).toNumber()).toBe(Infinity);
    expect(new RatioValue(-1n).div(new RatioValue(0n)).toNumber()).toBe(-Infinity);
    expect(new RatioValue(1n).div(new RatioValue(0n)).toNumber()).toBe(Infinity);
    expect(new RatioValue(0n).div(new RatioValue(0n)).toNumber()).toBeNaN();
    expect(new RatioValue(-1n).sqrt().toNumber()).toBeNaN();
    expect(new RatioValue(0n).mul(new FloatValue(Infinity)).toNumber()).toBeNaN();
});
