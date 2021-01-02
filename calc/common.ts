const enum AppendResult {
    /** The current token has been replaced in-place. */
    replaced,
    /** Append failed and must be rejected. */
    failed,
    /** The current token is not modified, and a fresh token should be created. */
    createAfter,
    /** Insert the "Ans" token and also create a fresh token. */
    insertAnsAndCreate,
    /** Delete the current token and replace with the fresh one. */
    deleteAndCreate,
    /** Create a fresh token _before_ the current one */
    createBefore,
    /** Delete the current token. */
    backspace,
}

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.';

const enum Precedence {
    eq,
    open,
    add, // +, -
    mul, // *, /
    pow, // ^, E
    unary,
    symbol,
}

const enum BinOp {
    add = '+',
    sub = '−',
    mul = '×',
    div = '÷',
    pow = '^',
    ee = 'E',
}

const enum UnOp {
    reciprocal = '1/𝘹',
    sqrt = '√',
    neg = '±',
}

const enum SymOp {
    ans = 'Ans',
}

/** A token in a formula. */
interface Token {
    /** Append a digit to the token. */
    appendDigit(digit: Digit): AppendResult
    /** Append a binary operator to the token. */
    appendBinary(op: BinOp): AppendResult
    /** Append a unary operator to the token. */
    appendUnary(op: UnOp): AppendResult
    /** Append a symbol to the token. */
    appendSymbol(): AppendResult
    /** Append an open parenthesis '(' to the token. */
    appendOpen(): AppendResult
    /** Append a close parenthesis ')' to the token. */
    appendClose(): AppendResult

    renderInto(result: string[]): void

    precedence(): Precedence
    evaluate(env: Environment, ...args: number[]): number

    serializeTag(): string
    serialize(): any
    deserialize(value: any): void
    clone(): Token
}

/** The number token. */
class NumberToken implements Token {
    static CLASS_NAME = 'n';

    negative: boolean
    number: string

    constructor(init: Digit) {
        this.negative = false;
        this.number = init === '.' ? '0.' : init;
    }

    appendDigit(digit: Digit): AppendResult {
        if (digit === '.') {
            if (/\./.test(this.number)) {
                return AppendResult.failed;
            }
        } else if (this.number === '0') {
            this.number = '';
        }
        this.number += digit;
        return AppendResult.replaced;
    }

    appendBinary(_: BinOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendUnary(op: UnOp): AppendResult {
        if (op === UnOp.neg) {
            this.negative = !this.negative;
            return AppendResult.replaced;
        }
        return AppendResult.createAfter;
    }

    appendSymbol(): AppendResult {
        return AppendResult.deleteAndCreate;
    }

    appendOpen(): AppendResult {
        return AppendResult.createBefore;
    }

    appendClose(): AppendResult {
        return AppendResult.createAfter;
    }

    backspace(): boolean {
        if (this.number.length > 1) {
            this.number = this.number.substr(0, this.number.length - 1);
            return false;
        }
        return true;
    }

    renderInto(result: string[]): void {
        result.push('<span class="number">', this.negative ? '-' : '', this.number, '</span>');
    }

    precedence(): Precedence {
        return Precedence.symbol;
    }
    evaluate(_env: Environment, ..._args: number[]): number {
        const n = parseFloat(this.number);
        return this.negative ? -n : n;
    }

    serializeTag(): string {
        return NumberToken.CLASS_NAME;
    }
    serialize(): any {
        return [this.negative, this.number];
    }

    deserialize(value: any): void {
        this.negative = value[0];
        this.number = value[1];
    }

    clone(): Token {
        const token = new NumberToken('0');
        token.negative = this.negative;
        token.number = this.number;
        return token;
    }
}

/** The binary operator tokens (+, -, *, /, ^, E) */
class BinaryToken implements Token {
    static CLASS_NAME = 'b';

    op: BinOp

    constructor(op: BinOp) {
        this.op = op;
    }

    appendDigit(_: Digit): AppendResult {
        return AppendResult.createAfter;
    }

    appendBinary(op: BinOp): AppendResult {
        this.op = op;
        return AppendResult.replaced;
    }

    appendUnary(_: UnOp): AppendResult {
        return AppendResult.failed;
    }

    appendSymbol(): AppendResult {
        return AppendResult.createAfter;
    }

    appendOpen(): AppendResult {
        return AppendResult.createAfter;
    }

    appendClose(): AppendResult {
        return AppendResult.failed;
    }

    renderInto(result: string[]): void {
        result.push('<span class="operator">', this.op, '</span>');
    }

    precedence(): Precedence {
        switch (this.op) {
            case BinOp.add:
            case BinOp.sub:
                return Precedence.add;
            case BinOp.mul:
            case BinOp.div:
                return Precedence.mul;
            case BinOp.pow:
            case BinOp.ee:
                return Precedence.pow;
        }
    }
    evaluate(_env: Environment, ...args: number[]): number {
        const [left, right] = args;
        switch (this.op) {
            case BinOp.add:
                return left + right;
            case BinOp.sub:
                return left - right;
            case BinOp.mul:
                return left * right;
            case BinOp.div:
                return left / right;
            case BinOp.pow:
                return Math.pow(left, right);
            case BinOp.ee:
                return left * Math.pow(10, right);
        }
    }

    serializeTag(): string {
        return BinaryToken.CLASS_NAME;
    }
    serialize(): any {
        return this.op;
    }
    deserialize(value: any): void {
        this.op = value;
    }

    clone(): Token {
        return new BinaryToken(this.op);
    }
}

/** The unary operator tokens (1/x, sqrt) */
class UnaryToken implements Token {
    static CLASS_NAME = 'u';

    op: UnOp

    constructor(op: UnOp) {
        this.op = op;
    }

    appendDigit(_: Digit): AppendResult {
        return AppendResult.failed;
    }

    appendBinary(_: BinOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendUnary(op: UnOp): AppendResult {
        if (op === this.op) {
            switch (op) {
                case UnOp.neg:
                case UnOp.reciprocal:
                    return AppendResult.backspace;
            }
        }
        return AppendResult.createAfter;
    }

    appendSymbol(): AppendResult {
        return AppendResult.failed;
    }

    appendOpen(): AppendResult {
        return AppendResult.failed;
    }

    appendClose(): AppendResult {
        return AppendResult.createAfter;
    }

    renderInto(result: string[]): void {
        result.push('<span class="operator">', this.op, '</span>');
    }

    precedence(): Precedence {
        return Precedence.unary;
    }
    evaluate(_env: Environment, ...args: number[]): number {
        const x = args[0];
        switch (this.op) {
            case UnOp.reciprocal:
                return 1 / x;
            case UnOp.sqrt:
                return Math.sqrt(x);
            case UnOp.neg:
                return -x;
        }
    }

    serializeTag(): string {
        return UnaryToken.CLASS_NAME;
    }
    serialize(): any {
        return this.op;
    }
    deserialize(value: any): void {
        this.op = value;
    }
    clone(): Token {
        return new UnaryToken(this.op);
    }
}

/** Rearranges the tokens into RPN representation. */
function toRPN(tokens: Token[]): Token[] {
    const result: Token[] = [];
    const ops: Token[] = [];
    for (const token of tokens) {
        const precedence = token.precedence();
        switch (precedence) {
            case Precedence.symbol:
            case Precedence.unary:
                result.push(token);
                break;
            default:
                let op: Token | undefined;
                while ((op = ops.pop())) {
                    if (op.precedence() >= precedence) {
                        result.push(op);
                    } else {
                        ops.push(op);
                        break;
                    }
                }
                ops.push(token);
                break;
        }
    }
    result.push(...ops.reverse());
    return result;
}

class GroupToken implements Token {
    static CLASS_NAME = 'g';

    tokens: Token[]

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    appendDigit(_: Digit): AppendResult {
        return AppendResult.failed;
    }

    appendBinary(_: BinOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendUnary(_: UnOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendSymbol(): AppendResult {
        return AppendResult.failed;
    }

    appendOpen(): AppendResult {
        return AppendResult.failed;
    }

    appendClose(): AppendResult {
        return AppendResult.createAfter;
    }

    renderInto(result: string[]): void {
        result.push('<span class="parenthesis">(</span>');
        for (const token of this.tokens) {
            token.renderInto(result);
        }
        result.push('<span class="parenthesis">)</span>');
    }

    precedence(): Precedence {
        return Precedence.symbol;
    }
    evaluate(env: Environment, ..._args: number[]): number {
        const numbers: number[] = [];
        for (const token of toRPN(this.tokens)) {
            switch (token.precedence()) {
                case Precedence.symbol:
                    numbers.push(token.evaluate(env));
                    break;
                case Precedence.unary:
                    numbers[numbers.length - 1] = token.evaluate(env, numbers[numbers.length - 1]);
                    break;
                default:
                    const args = numbers.splice(numbers.length - 2, 2);
                    numbers.push(token.evaluate(env, ...args));
            }
        }
        return numbers[0];
    }

    serializeTag(): string {
        return GroupToken.CLASS_NAME;
    }
    serialize(): any {
        return this.tokens.map(serializeToken);
    }
    deserialize(value: any): void {
        this.tokens = (value as [string, any][]).map(deserializeToken);
    }
    clone(): Token {
        return new GroupToken(this.tokens.map(t => t.clone()));
    }
}

class SymbolToken implements Token {
    static CLASS_NAME = 's';

    op: SymOp

    constructor(op: SymOp) {
        this.op = op;
    }

    appendDigit(_: Digit): AppendResult {
        return AppendResult.deleteAndCreate;
    }

    appendBinary(_: BinOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendUnary(_: UnOp): AppendResult {
        return AppendResult.createAfter;
    }

    appendSymbol(): AppendResult {
        return AppendResult.deleteAndCreate;
    }

    appendOpen(): AppendResult {
        return AppendResult.createBefore;
    }

    appendClose(): AppendResult {
        return AppendResult.createAfter;
    }

    renderInto(result: string[]): void {
        result.push('<span class="symbol">', this.op, '</span>');
    }

    precedence(): Precedence {
        return Precedence.symbol
    }
    evaluate(env: Environment, ..._args: number[]): number {
        switch (this.op) {
            case SymOp.ans:
                if (env.history.length > 0) {
                    return env.history[env.history.length - 1].ans;
                }
                return 0;
        }
    }

    serializeTag(): string {
        return SymbolToken.CLASS_NAME;
    }
    serialize(): any {
        return this.op;
    }
    deserialize(value: any): void {
        this.op = value;
    }
    clone(): Token {
        return new SymbolToken(this.op);
    }
}

class OpenToken implements Token {
    static CLASS_NAME = 'o';

    appendDigit(_: Digit): AppendResult {
        return AppendResult.createAfter;
    }

    appendBinary(_: BinOp): AppendResult {
        return AppendResult.failed;
    }

    appendUnary(_: UnOp): AppendResult {
        return AppendResult.failed;
    }

    appendSymbol(): AppendResult {
        return AppendResult.createAfter;
    }

    appendOpen(): AppendResult {
        return AppendResult.createAfter;
    }

    appendClose(): AppendResult {
        return AppendResult.failed;
    }

    renderInto(result: string[]): void {
        result.push('<span class="parenthesis">(</span>');
    }

    precedence(): Precedence {
        return Precedence.open;
    }
    evaluate(_env: Environment, ..._args: number[]): number {
        throw new Error('should never evaluate OpenToken');
    }

    serializeTag(): string {
        return OpenToken.CLASS_NAME;
    }
    serialize(): any {
        return null;
    }
    deserialize(_: any): void {
    }
    clone(): Token {
        return this;
    }
}

class EqToken implements Token {
    static CLASS_NAME = 'e';

    appendDigit(_: Digit): AppendResult {
        return AppendResult.createAfter;
    }
    appendBinary(_: BinOp): AppendResult {
        return AppendResult.insertAnsAndCreate;
    }
    appendUnary(_: UnOp): AppendResult {
        return AppendResult.insertAnsAndCreate;
    }
    appendSymbol(): AppendResult {
        return AppendResult.createAfter;
    }
    appendOpen(): AppendResult {
        return AppendResult.createAfter;
    }
    appendClose(): AppendResult {
        return AppendResult.failed;
    }

    renderInto(result: string[]): void {
        result.push('<span class="eq">=</span>');
    }

    precedence(): Precedence {
        return Precedence.eq;
    }
    evaluate(_env: Environment, ..._args: number[]): number {
        throw new Error('should never evaluate EqToken');
    }

    serializeTag(): string {
        return EqToken.CLASS_NAME;
    }
    serialize(): any {
        return null;
    }
    deserialize(_: any): void {
    }
    clone(): Token {
        return this;
    }
}

function serializeToken(token: Token): [string, any] {
    return [token.serializeTag(), token.serialize()];
}

function deserializeToken(json: [string, any]): Token {
    let initToken: Token;
    switch (json[0]) {
        case NumberToken.CLASS_NAME:
            initToken = new NumberToken('0');
            break;
        case BinaryToken.CLASS_NAME:
            initToken = new BinaryToken(BinOp.add);
            break;
        case UnaryToken.CLASS_NAME:
            initToken = new UnaryToken(UnOp.neg);
            break;
        case GroupToken.CLASS_NAME:
            initToken = new GroupToken([]);
            break;
        case SymbolToken.CLASS_NAME:
            initToken = new SymbolToken(SymOp.ans);
            break;
        case OpenToken.CLASS_NAME:
            initToken = new OpenToken();
            break;
        case EqToken.CLASS_NAME:
            initToken = new EqToken();
            break;
        default:
            throw new Error(`cannot serialize token from ${json}`);
    }
    initToken.deserialize(json[1]);
    return initToken;
}

class Formula {
    tokens: Token[]

    constructor() {
        this.tokens = [];
    }

    handleAppendResult(appendResult: AppendResult, newToken: Token) {
        switch (appendResult) {
            case AppendResult.createAfter:
                this.tokens.push(newToken);
                break;
            case AppendResult.insertAnsAndCreate:
                this.tokens.push(new SymbolToken(SymOp.ans), newToken);
                break;
            case AppendResult.deleteAndCreate:
                this.tokens[this.tokens.length - 1] = newToken;
                break;
            case AppendResult.createBefore:
                this.tokens.splice(this.tokens.length - 1, 0, newToken);
                break;
            case AppendResult.backspace:
                this.tokens.pop();
                break;
        }
    }

    appendToLastToken(defaultResult: AppendResult, action: (lastToken: Token) => AppendResult): AppendResult {
        if (this.tokens.length === 0) {
            return defaultResult;
        }
        const token = this.tokens[this.tokens.length - 1];
        const result = action(token);
        if (token instanceof EqToken && result !== AppendResult.failed) {
            this.tokens = [];
        }
        return result;
    }

    appendDigit(digit: Digit) {
        const appendResult = this.appendToLastToken(AppendResult.createAfter, t => t.appendDigit(digit));
        this.handleAppendResult(appendResult, new NumberToken(digit));
    }

    appendBinary(op: BinOp) {
        const appendResult = this.appendToLastToken(AppendResult.insertAnsAndCreate, t => t.appendBinary(op));
        this.handleAppendResult(appendResult, new BinaryToken(op));
    }

    appendUnary(op: UnOp) {
        const appendResult = this.appendToLastToken(AppendResult.insertAnsAndCreate, t => t.appendUnary(op));
        this.handleAppendResult(appendResult, new UnaryToken(op));
    }

    appendSymbol(op: SymOp) {
        const appendResult = this.appendToLastToken(AppendResult.createAfter, t => t.appendSymbol());
        this.handleAppendResult(appendResult, new SymbolToken(op));
    }

    appendOpen() {
        const appendResult = this.appendToLastToken(AppendResult.createAfter, t => t.appendOpen());
        this.handleAppendResult(appendResult, new OpenToken());
    }

    appendClose(): boolean {
        const appendResult = this.appendToLastToken(AppendResult.failed, t => t.appendClose());
        switch (appendResult) {
            case AppendResult.failed:
                return false;
            case AppendResult.createAfter:
                // find the closest '(' and group it as a single token.
                for (let i = this.tokens.length - 1; i >= 0; i--) {
                    if (this.tokens[i] instanceof OpenToken) {
                        const groupToken = new GroupToken(this.tokens.slice(i + 1));
                        this.tokens.splice(i, this.tokens.length - i, groupToken);
                        return true;
                    }
                }
                return false;
            default:
                throw new Error('unknown action for appending `)`');
        }
    }

    backspace() {
        let token = this.tokens.pop();
        if (token instanceof NumberToken) {
            if (!token.backspace()) {
                this.tokens.push(token);
            }
        } else if (token instanceof GroupToken) {
            this.tokens.push(new OpenToken(), ...token.tokens);
        }
    }

    /** render the formula as HTML. */
    renderInto(result: string[]): void {
        for (const token of this.tokens) {
            token.renderInto(result);
        }
    }

    /** Obtains the formula slice to display the partially evaluated result at current cursor */
    partial(): Token[] {
        // determine what to return according to last token.
        //  - symbol => return immediately.
        //  - binary => read the slice until '(' or precedence is < last token
        //  - unary => read slice until first symbol
        //  - open => skip the '(' and look at previous symbol
        //  - eq => return the whole token list.

        let end = this.tokens.length;
        let start = end - 1;
        outside:
        while (start >= 0) {
            const token = this.tokens[start];
            const prec = token.precedence();
            switch (prec) {
                case Precedence.symbol:
                    break outside;
                case Precedence.eq:
                    end--;
                    start = 0;
                    break outside;
                case Precedence.unary:
                    start--;
                    break;
                case Precedence.open:
                    start--;
                    end--;
                    break;
                default:
                    end--;
                    while (start > 0) {
                        if (this.tokens[start - 1].precedence() < prec) {
                            break outside;
                        }
                        start--;
                    }
            }
        }
        if (start < 0) {
            start = 0;
        }
        if (start >= end) {
            return [new NumberToken('0')];
        }

        return this.tokens.slice(start, end);
    }

    appendEq() {
        if (this.appendToLastToken(AppendResult.failed, t => t.appendClose()) !== AppendResult.createAfter) {
            return;
        }
        while (this.appendClose()) { }
        this.tokens.push(new EqToken());
    }

    isComplete(): boolean {
        return this.tokens.length > 0 && this.tokens[this.tokens.length - 1] instanceof EqToken;
    }
}

interface CalcHistory {
    formula: Token[],
    ans: number,
}

const MAX_HISTORY_COUNT = 64;

class Environment {
    historyIndices: number[]
    history: CalcHistory[]
    partialAns: number

    constructor() {
        const historyIndices: number[] = JSON.parse(localStorage.getItem('hI') || '[]');
        const realHistoryIndices: number[] = [];
        const realHistory: CalcHistory[] = [];

        for (const index of historyIndices) {
            const historyJSON = JSON.parse(localStorage.getItem(`hV${index}`) || 'null');
            if (historyJSON instanceof Array) {
                const [formulaJSON, ans] = historyJSON;
                const formula = formulaJSON.map(deserializeToken);
                realHistoryIndices.push(index);
                realHistory.push({ formula, ans });
            }
        }

        this.historyIndices = realHistoryIndices;
        this.history = realHistory;
        this.partialAns = 0;
    }

    saveAns(formula: Token[], ans: number): void {
        let nextHistoryID = 0;
        if (this.historyIndices.length > 0) {
            nextHistoryID = this.historyIndices[this.historyIndices.length - 1] + 1;
        }
        if (this.historyIndices.length >= MAX_HISTORY_COUNT) {
            const deleteID = this.historyIndices.shift();
            this.history.shift();
            localStorage.removeItem(`hV${deleteID}`);
        }
        this.historyIndices.push(nextHistoryID);
        this.history.push({ formula, ans });

        localStorage.setItem(`hV${nextHistoryID}`, JSON.stringify([formula.map(serializeToken), ans]));
        localStorage.setItem('hI', JSON.stringify(this.historyIndices));
    }

    deleteHistory(localIndex: number): void {
        const [index] = this.historyIndices.splice(localIndex, 1);
        this.history.splice(localIndex, 1);

        localStorage.removeItem(`hV${index}`);
        localStorage.setItem('hI', JSON.stringify(this.historyIndices));
    }
}

const NORMAL_NUMBER_FORMAT = new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 20 });

function estimatedWidth(n: string): number {
    let w = 0;
    for (const char of n) {
        switch (char) {
            case ',':
                break;
            case '.':
                w += 15.57;
                break;
            case '-':
                w += 18.65;
                break;
            case '+':
                w += 32.7;
                break;
            default:
                w += 31.15;
                break;
        }
    }
    return w;
}

function $(id: string): HTMLElement {
    return document.getElementById(id)!;
}

document.body.addEventListener('touchmove', (e) => {
    if ($('history-sheet').style.display === 'none') {
        e.preventDefault();
    }
}, { passive: false });

let FORMULA = new Formula();
let ENV = new Environment();

function formatNumber(n: number): string {
    const abs = Math.abs(n);
    return (abs === 0 || abs >= 1e-6 && abs < 1e16) ? NORMAL_NUMBER_FORMAT.format(n) : n.toExponential();
}

function setResultNumber(n: number) {
    const resElem = $('display-result');
    const formatted = formatNumber(n);
    const maxWidth = resElem.clientWidth;
    const estWidth = Math.max(maxWidth, estimatedWidth(formatted));
    resElem.style.transform = `scaleX(${maxWidth / estWidth})`;
    resElem.innerHTML = formatted.replace(/,/g, '<span class="zero-width-comma">,</span>');
}

function refreshDisplay(e: UIEvent): void {
    const result: string[] = [];
    FORMULA.renderInto(result);
    $('display-formula').innerHTML = result.join('');
    const ans = new GroupToken(FORMULA.partial()).evaluate(ENV);
    ENV.partialAns = ans;
    if (FORMULA.isComplete() && (e.target as HTMLElement).id === 'eq') {
        ENV.saveAns(FORMULA.tokens.map(t => t.clone()), ans);
    }
    setResultNumber(ans);
}

function copyText(s: string): void {
    const copyElem = document.createElement('input');
    document.body.appendChild(copyElem);
    copyElem.value = s;
    copyElem.select();
    document.execCommand('copy', false);
    copyElem.remove();
}

$('buttons').onclick = refreshDisplay;
window.onresize = refreshDisplay;

$('n-0').onclick = () => FORMULA.appendDigit('0');
$('n-1').onclick = () => FORMULA.appendDigit('1');
$('n-2').onclick = () => FORMULA.appendDigit('2');
$('n-3').onclick = () => FORMULA.appendDigit('3');
$('n-4').onclick = () => FORMULA.appendDigit('4');
$('n-5').onclick = () => FORMULA.appendDigit('5');
$('n-6').onclick = () => FORMULA.appendDigit('6');
$('n-7').onclick = () => FORMULA.appendDigit('7');
$('n-8').onclick = () => FORMULA.appendDigit('8');
$('n-9').onclick = () => FORMULA.appendDigit('9');
$('dot').onclick = () => FORMULA.appendDigit('.');
$('neg').onclick = () => FORMULA.appendUnary(UnOp.neg);

$('add').onclick = () => FORMULA.appendBinary(BinOp.add);
$('sub').onclick = () => FORMULA.appendBinary(BinOp.sub);
$('mul').onclick = () => FORMULA.appendBinary(BinOp.mul);
$('div').onclick = () => FORMULA.appendBinary(BinOp.div);
$('pow').onclick = () => FORMULA.appendBinary(BinOp.pow);
$('ee').onclick = () => FORMULA.appendBinary(BinOp.ee);

$('reciprocal').onclick = () => FORMULA.appendUnary(UnOp.reciprocal);
$('sqrt').onclick = () => FORMULA.appendUnary(UnOp.sqrt);

$('ans').onclick = () => FORMULA.appendSymbol(SymOp.ans);

$('open').onclick = () => FORMULA.appendOpen();
$('close').onclick = () => FORMULA.appendClose();
$('backspace').onclick = () => FORMULA.backspace();

$('eq').onclick = () => FORMULA.appendEq();

$('ac').onclick = (e) => {
    FORMULA.tokens = [];
    refreshDisplay(e);
};
$('copy').onclick = () => {
    copyText('' + ENV.partialAns);
}

function selectedHistoryItem(): number {
    for (const item of document.getElementsByName('history-item')) {
        const input = item as HTMLInputElement;
        if (input.checked) {
            return +input.value;
        }
    }
    return -1;
}

function closeHistorySheet(): void {
    $('history-sheet').style.display = 'none';
}

function refreshHistoryList(): void {
    const result: string[] = [];
    for (let i = ENV.history.length - 1; i >= 0; i--) {
        const history = ENV.history[i]
        const ii = '' + i;
        result.push(
            '<div class="history-screen"><input type="radio" value="',
            ii,
            '" id="history-item-',
            ii,
            '" name="history-item"><label for="history-item-',
            ii,
            '"><div class="formula">',
        );
        for (const token of history.formula) {
            token.renderInto(result);
        }
        result.push(
            '</div><div class="result">',
            formatNumber(history.ans),
            '</div></label></div>',
        );
    }
    $('history-content').innerHTML = result.join('');
}

$('history').onclick = () => {
    refreshHistoryList();
    $('history-sheet').style.display = 'block';
};
$('use-history-formula').onclick = (e) => {
    const item = selectedHistoryItem();
    if (item >= 0) {
        const history = ENV.history[item];
        FORMULA.tokens = history.formula.map(t => t.clone());
        refreshDisplay(e);
        closeHistorySheet();
    }
};
$('copy-history-value').onclick = () => {
    const item = selectedHistoryItem();
    if (item >= 0) {
        const history = ENV.history[item];
        copyText('' + history.ans);
    }
};
$('delete-history').onclick = () => {
    const item = selectedHistoryItem();
    if (item >= 0) {
        ENV.deleteHistory(item);
        refreshHistoryList();
    }
};

$('close-history').onclick = closeHistorySheet;
