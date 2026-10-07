'use strict';

/**
 * debugger/conditions.js
 *
 * Evaluates an .evs condition (the text between if( and )) against the
 * current memory, for the editor's "this branch runs" hints while stopped.
 * Pure: operand values come from `resolve(operand) -> Promise<number | undefined>`.
 *
 * Grammar (loosest first): ||  &&  |  &  == !=  < > <= >=  !x  (x)  operand.
 * Operands: numbers (0x1F, 0d31, 31), True / False, ENUM.NAME (memory or
 * constant), memory literals (<0x0ADA>, (Byte) <0x0ADA>, <0x28FA, 0x10>),
 * arg[0x02]. Anything else (calls, is, entity fields) makes the result
 * undefined: no hint rather than a wrong one.
 */

// Memory literals before operators: "(Byte) <0x0ADA>" is not a parenthesis, "<0x..>" not a comparison.
const TOKEN = /\s*(?:(\((?:Byte|Word)\)\s*<[^>]*>|<\s*0x[0-9a-fA-F]+\s*(?:,\s*(?:0x[0-9a-fA-F]+|\d+)\s*)?>)|(\|\||&&|==|!=|<=|>=|[|&<>!()])|(0x[0-9a-fA-F]+|0d\d+|\d+)|(True|False)|([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*|arg\[\s*(?:0x[0-9a-fA-F]+|\d+)\s*\]))/y;

function tokenize(text) {
    const tokens = [];
    TOKEN.lastIndex = 0;
    let at = 0;
    while (at < text.length) {
        if (!text.slice(at).trim()) break;
        TOKEN.lastIndex = at;
        const m = TOKEN.exec(text);
        if (!m) return null;
        at = TOKEN.lastIndex;
        if (m[1]) tokens.push({ operand: m[1].replace(/\s+/g, ' ') });
        else if (m[2]) tokens.push({ op: m[2] });
        else if (m[3]) tokens.push({ value: /^0x/i.test(m[3]) ? parseInt(m[3], 16) : parseInt(m[3].replace(/^0d/i, ''), 10) });
        else if (m[4]) tokens.push({ value: m[4] === 'True' ? 1 : 0 });
        else tokens.push({ operand: m[5] });
    }
    return tokens;
}

const LEVELS = [['||'], ['&&'], ['|'], ['&'], ['==', '!='], ['<', '>', '<=', '>=']];

function apply(op, a, b) {
    switch (op) {
        case '||': return a || b ? 1 : 0;
        case '&&': return a && b ? 1 : 0;
        case '|': return a | b;
        case '&': return a & b;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        default: return a >= b ? 1 : 0;
    }
}

/** Evaluate tokens whose operands are already values; throws on malformed input. */
function evaluateTokens(tokens) {
    let i = 0;
    const level = depth => {
        if (depth === LEVELS.length) return unary();
        let left = level(depth + 1);
        while (i < tokens.length && LEVELS[depth].includes(tokens[i].op)) {
            const op = tokens[i++].op;
            left = apply(op, left, level(depth + 1));
        }
        return left;
    };
    const unary = () => {
        const token = tokens[i++];
        if (!token) throw new Error('unexpected end');
        if (token.op === '!') return unary() ? 0 : 1;
        if (token.op === '(') {
            const value = level(0);
            if (!tokens[i] || tokens[i++].op !== ')') throw new Error('missing )');
            return value;
        }
        if (token.value === undefined) throw new Error('unexpected ' + token.op);
        return token.value;
    };
    const value = level(0);
    if (i !== tokens.length) throw new Error('trailing tokens');
    return value;
}

/** true / false, or undefined when some part cannot be known. */
async function evaluateCondition(text, resolve) {
    const tokens = tokenize(String(text));
    if (!tokens || !tokens.length) return undefined;
    for (const token of tokens) {
        if (token.operand === undefined) continue;
        const value = await resolve(token.operand);
        if (value === undefined || value === null) return undefined;
        token.value = value;
    }
    try {
        return evaluateTokens(tokens) !== 0;
    } catch (_) {
        return undefined;
    }
}

/**
 * The condition of an if / else if / while line: { kind, negated, text }, or
 * null. Only conditions that close on the same line.
 */
function conditionOf(line) {
    const m = line.match(/^\s*(\}\s*)?(else\s+if|if|while)(!?)\s*\(/);
    if (!m) return null;
    let depth = 1;
    const start = m[0].length;
    for (let i = start; i < line.length; i++) {
        if (line[i] === '(') depth++;
        else if (line[i] === ')' && --depth === 0) {
            return { kind: m[2].replace(/\s+/g, ' '), negated: m[3] === '!', text: line.slice(start, i), end: i + 1 };
        }
    }
    return null;
}

module.exports = { evaluateCondition, conditionOf, tokenize };
