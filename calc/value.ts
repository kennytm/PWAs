type Serialized = number | null | '-inf' | 'inf' | readonly ['Q', number, number];

function abs(n: bigint): bigint {
    return n < 0n ? -n : n;
}

export function deserializeValue(json: Serialized): Value {
    if (json === null) {
        return new FloatValue(NaN);
    } else if (json === '-inf') {
        return new FloatValue(-Infinity);
    } else if (json === 'inf') {
        return new FloatValue(Infinity);
    } else if (typeof json === 'number') {
        return new FloatValue(json);
    } else {
        return new RatioValue(BigInt(json[1]), BigInt(json[2]));
    }
}

export interface Value {
    toNumber(): number;
    serialize(): Serialized;

    neg(): Value;
    sqrt(): Value;
    reciprocal(): Value;

    add(rhs: Value): Value;
    sub(rhs: Value): Value;
    mul(rhs: Value): Value;
    div(rhs: Value): Value;
    pow(rhs: Value): Value;
}

export class RatioValue implements Value {
    private readonly num: bigint;
    // note: we require denominator > 0
    private readonly den: bigint;

    constructor(num: bigint, den: bigint = 1n) {
        this.num = num;
        this.den = den;
    }

    public static readonly ZERO = new RatioValue(0n, 1n);
    public static readonly ONE = new RatioValue(1n, 1n);
    public static readonly TEN = new RatioValue(10n, 1n);

    static ofFraction(num: bigint, den: bigint): Value {
        if (num === 0n) {
            return RatioValue.ZERO;
        }
        let x = abs(num);
        let y = den;
        while (y !== 0n) {
            [x, y] = [y, x % y];
        }
        num /= x;
        den /= x;
        // we give up trying to represent the fraction as a ratio if the numerator or denominator is too large.
        if (abs(num) > Number.MAX_SAFE_INTEGER || den > Number.MAX_SAFE_INTEGER) {
            return new FloatValue(Number(num) / Number(den));
        }
        return new RatioValue(num, den);
    }

    public static parse(s: string): Value {
        const dotIndex = s.indexOf('.');
        const decimalPlaces = dotIndex < 0 ? 0 : s.length - dotIndex - 1;
        const rawDigits = s.replace('.', '');
        const num = BigInt(rawDigits);
        const den = 10n ** BigInt(decimalPlaces);
        return RatioValue.ofFraction(num, den);
    }

    toNumber(): number {
        return Number(this.num) / Number(this.den);
    }

    toFloatValue(): FloatValue {
        return new FloatValue(this.toNumber());
    }

    serialize(): Serialized {
        return ['Q', Number(this.num), Number(this.den)];
    }

    neg(): Value {
        return new RatioValue(-this.num, this.den);
    }
    sqrt(): Value {
        return this.toFloatValue().sqrt();
    }
    reciprocal(): Value {
        if (this.num === 0n) {
            return this.toFloatValue().reciprocal();
        } else if (this.num < 0n) {
            return new RatioValue(-this.den, -this.num);
        } else {
            return new RatioValue(this.den, this.num);
        }
    }

    add(rhs: Value): Value {
        if (rhs instanceof RatioValue) {
            const newNum = this.num * rhs.den + rhs.num * this.den;
            const newDen = this.den * rhs.den;
            return RatioValue.ofFraction(newNum, newDen);
        } else {
            return this.toFloatValue().add(rhs);
        }
    }
    sub(rhs: Value): Value {
        if (rhs instanceof RatioValue) {
            const newNum = this.num * rhs.den - rhs.num * this.den;
            const newDen = this.den * rhs.den;
            return RatioValue.ofFraction(newNum, newDen);
        } else {
            return this.toFloatValue().sub(rhs);
        }
    }
    mul(rhs: Value): Value {
        if (rhs instanceof RatioValue) {
            const newNum = this.num * rhs.num;
            const newDen = this.den * rhs.den;
            return RatioValue.ofFraction(newNum, newDen);
        } else {
            return this.toFloatValue().mul(rhs);
        }
    }
    div(rhs: Value): Value {
        if (rhs instanceof RatioValue && rhs.num !== 0n) {
            let newNum = this.num * rhs.den;
            let newDen = this.den * rhs.num;
            if (newDen < 0n) {
                newNum = -newNum;
                newDen = -newDen;
            }
            return RatioValue.ofFraction(newNum, newDen);
        } else {
            return this.toFloatValue().div(rhs);
        }
    }
    pow(rhs: Value): Value {
        if (rhs instanceof RatioValue && rhs.den === 1n) {
            if (rhs.num === 0n) {
                // x^0 === 1 for any x, including 0
                return RatioValue.ONE;
            } else if (this.num === 0n) {
                // 0^n === 0 for n > 0, infinity for n < 0.
                return rhs.num > 0n ? this : new FloatValue(Infinity);
            }
            // |p^n| > MAX <=> |p| > MAX^(1/n)
            const exp = abs(rhs.num);
            const safeMax = Number.MAX_SAFE_INTEGER ** (1 / Number(exp));
            if (abs(this.num) < safeMax && this.den < safeMax) {
                let newNum = this.num ** exp;
                let newDen = this.den ** exp;
                if (rhs.num < 0n) {
                    [newNum, newDen] = [newDen, newNum];
                    if (newDen < 0n) {
                        newNum = -newNum;
                        newDen = -newDen;
                    }
                }
                return new RatioValue(newNum, newDen);
            }
        }
        return this.toFloatValue().pow(rhs);
    }
}

export class FloatValue implements Value {
    private readonly value: number;

    public constructor(value: number) {
        this.value = value;
    }

    toNumber(): number {
        return this.value;
    }

    serialize(): Serialized {
        if (Number.isNaN(this.value)) {
            return null;
        } else if (this.value === Infinity) {
            return 'inf';
        } else if (this.value === -Infinity) {
            return '-inf';
        } else {
            return this.value;
        }
    }

    neg(): Value {
        return new FloatValue(-this.value);
    }
    sqrt(): Value {
        return new FloatValue(Math.sqrt(this.value));
    }
    reciprocal(): Value {
        return new FloatValue(1 / this.value);
    }

    add(rhs: Value): Value {
        return new FloatValue(this.value + rhs.toNumber());
    }
    sub(rhs: Value): Value {
        return new FloatValue(this.value - rhs.toNumber());
    }
    mul(rhs: Value): Value {
        return new FloatValue(this.value * rhs.toNumber());
    }
    div(rhs: Value): Value {
        return new FloatValue(this.value / rhs.toNumber());
    }
    pow(rhs: Value): Value {
        return new FloatValue(this.value ** rhs.toNumber());
    }
}
