// cli-entry.js
var import_node_readline = require("node:readline");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_child_process = require("node:child_process");
var import_node_os = require("node:os");

// ../robinpath/dist/index.js
var L = class {
  static parseString(e) {
    if (e.startsWith('"') && e.endsWith('"') || e.startsWith("'") && e.endsWith("'") || e.startsWith("`") && e.endsWith("`")) {
      const n = e[0], t = e.slice(1, -1);
      if (n === '"')
        return t.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      if (n === "'")
        return t.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      if (n === "`")
        return t.replace(/\\`/g, "`").replace(/\\\\/g, "\\");
    }
    return e;
  }
  static isString(e) {
    return e.startsWith('"') && e.endsWith('"') || e.startsWith("'") && e.endsWith("'") || e.startsWith("`") && e.endsWith("`");
  }
  static isNumber(e) {
    return /^-?\d+(\.\d+)?$/.test(e);
  }
  static isInteger(e) {
    return /^-?\d+$/.test(e);
  }
  static isVariable(e) {
    if (!e.startsWith("$")) return false;
    if (e.startsWith("$.") || e.startsWith("$[")) {
      const n = e.slice(1);
      return /^(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\])(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\])*$/.test(n);
    }
    if (/^\$\d+/.test(e)) {
      const n = e.slice(1);
      return /^\d+(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\])*$/.test(n);
    }
    return /^\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\])*$/.test(e);
  }
  /**
   * Parse attribute access path from a variable token
   * Returns the base variable name and path segments
   * If name is empty string, it means the last value ($) with attributes
   */
  static parseVariablePath(e) {
    if (!e.startsWith("$"))
      throw new Error(`Invalid variable token: ${e}`);
    const n = e.slice(1), t = [];
    if (n.startsWith(".") || n.startsWith("[")) {
      let u = n, l = 0;
      for (; l < u.length; )
        if (u[l] === ".") {
          l++;
          let p = l;
          for (; l < u.length && (u[l] >= "a" && u[l] <= "z" || u[l] >= "A" && u[l] <= "Z" || u[l] >= "0" && u[l] <= "9" || u[l] === "_"); )
            l++;
          if (l === p)
            throw new Error(`Invalid property access: ${u}`);
          t.push({ type: "property", name: u.substring(p, l) });
        } else if (u[l] === "[")
          if (l++, u[l] === "$") {
            const p = this.parseDynamicKey(u, l);
            t.push(p.segment), l = p.endPos;
          } else {
            let p = l;
            for (; l < u.length && u[l] >= "0" && u[l] <= "9"; )
              l++;
            if (l === p || l >= u.length || u[l] !== "]")
              throw new Error(`Invalid array index: ${u}`);
            t.push({ type: "index", index: parseInt(u.substring(p, l), 10) }), l++;
          }
        else
          throw new Error(`Unexpected character in variable path: ${u.substring(l)}`);
      return { name: "", path: t };
    }
    if (/^\d+/.test(n)) {
      const u = n.match(/^(\d+)/);
      if (!u)
        throw new Error(`Invalid positional parameter: ${n}`);
      const l = u[1];
      let p = n.slice(l.length), c = 0;
      for (; c < p.length; )
        if (p[c] === ".") {
          c++;
          let h = c;
          for (; c < p.length && (p[c] >= "a" && p[c] <= "z" || p[c] >= "A" && p[c] <= "Z" || p[c] >= "0" && p[c] <= "9" || p[c] === "_"); )
            c++;
          if (c === h)
            throw new Error(`Invalid property access: ${p}`);
          t.push({ type: "property", name: p.substring(h, c) });
        } else if (p[c] === "[")
          if (c++, p[c] === "$") {
            const h = this.parseDynamicKey(p, c);
            t.push(h.segment), c = h.endPos;
          } else {
            let h = c;
            for (; c < p.length && p[c] >= "0" && p[c] <= "9"; )
              c++;
            if (c === h || c >= p.length || p[c] !== "]")
              throw new Error(`Invalid array index: ${p}`);
            t.push({ type: "index", index: parseInt(p.substring(h, c), 10) }), c++;
          }
        else
          throw new Error(`Unexpected character in variable path: ${p.substring(c)}`);
      return { name: l, path: t };
    }
    const r = n.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!r)
      throw new Error(`Invalid variable name: ${n}`);
    const o = r[1];
    let s = n.slice(o.length), a = 0;
    for (; a < s.length; )
      if (s[a] === ".") {
        a++;
        let u = a;
        for (; a < s.length && (s[a] >= "a" && s[a] <= "z" || s[a] >= "A" && s[a] <= "Z" || s[a] >= "0" && s[a] <= "9" || s[a] === "_"); )
          a++;
        if (a === u)
          throw new Error(`Invalid property access: ${s}`);
        t.push({ type: "property", name: s.substring(u, a) });
      } else if (s[a] === "[")
        if (a++, s[a] === "$") {
          const u = this.parseDynamicKey(s, a);
          t.push(u.segment), a = u.endPos;
        } else {
          let u = a;
          for (; a < s.length && s[a] >= "0" && s[a] <= "9"; )
            a++;
          if (a === u || a >= s.length || s[a] !== "]")
            throw new Error(`Invalid array index: ${s}`);
          t.push({ type: "index", index: parseInt(s.substring(u, a), 10) }), a++;
        }
      else
        throw new Error(`Unexpected character in variable path: ${s.substring(a)}`);
    return { name: o, path: t };
  }
  /**
   * Parse a dynamic key from inside brackets: [$varName] or [$varName.property]
   * @param str The full string being parsed
   * @param pos Position right after the '$' character
   * @returns The parsed segment and the position after the closing ']'
   */
  static parseDynamicKey(e, n) {
    n++;
    let t = n;
    for (; n < e.length && (e[n] >= "a" && e[n] <= "z" || e[n] >= "A" && e[n] <= "Z" || e[n] >= "0" && e[n] <= "9" || e[n] === "_"); )
      n++;
    if (n === t)
      throw new Error(`Invalid dynamic key: expected variable name after $ at position ${n}`);
    const r = e.substring(t, n), o = [];
    for (; n < e.length && e[n] === "."; ) {
      n++;
      let s = n;
      for (; n < e.length && (e[n] >= "a" && e[n] <= "z" || e[n] >= "A" && e[n] <= "Z" || e[n] >= "0" && e[n] <= "9" || e[n] === "_"); )
        n++;
      if (n === s)
        throw new Error(`Invalid dynamic key: expected property name after '.' at position ${n}`);
      o.push({ type: "property", name: e.substring(s, n) });
    }
    if (n >= e.length || e[n] !== "]")
      throw new Error(`Invalid dynamic key: expected ']' at position ${n}, got '${e[n] || "EOF"}'`);
    return n++, {
      segment: { type: "dynamicKey", variable: r, varPath: o.length > 0 ? o : void 0 },
      endPos: n
    };
  }
  static isLastValue(e) {
    return e === "$" || e.startsWith("$.") || e.startsWith("$[");
  }
  static isPositionalParam(e) {
    return /^\$[0-9]+$/.test(e);
  }
};
function Z(i) {
  return i == null ? false : typeof i == "number" ? i !== 0 : typeof i == "string" ? i.length > 0 : typeof i == "boolean" ? i : true;
}
function Pe(i) {
  return i === null ? "null" : typeof i == "string" ? "string" : typeof i == "number" ? "number" : typeof i == "boolean" ? "boolean" : Array.isArray(i) ? "array" : typeof i == "object" ? "object" : "string";
}
function st(i, e) {
  if (Pe(i) === e)
    return i;
  try {
    switch (e) {
      case "string":
        return i === null ? "null" : typeof i == "object" || Array.isArray(i) ? JSON.stringify(i) : String(i);
      case "number":
        if (i === null) return null;
        if (typeof i == "boolean")
          return i ? 1 : 0;
        if (typeof i == "string") {
          const t = parseFloat(i);
          return isNaN(t) ? null : t;
        }
        return typeof i == "number" ? i : null;
      case "boolean":
        if (i === null) return false;
        if (typeof i == "string") {
          const t = i.toLowerCase().trim();
          return t === "true" || t === "1" || t === "yes" ? true : t === "false" || t === "0" || t === "no" || t === "" ? false : null;
        }
        return typeof i == "number" ? i !== 0 && !isNaN(i) : typeof i == "boolean" ? i : Array.isArray(i) ? i.length > 0 : typeof i == "object" ? Object.keys(i).length > 0 : false;
      case "null":
        return null;
      case "array":
        if (i === null) return [];
        if (Array.isArray(i)) return i;
        if (typeof i == "string")
          try {
            const t = JSON.parse(i);
            if (Array.isArray(t)) return t;
          } catch {
            return i.split("");
          }
        return typeof i == "object" ? Object.values(i) : [i];
      case "object":
        if (i === null) return {};
        if (typeof i == "object" && !Array.isArray(i)) return i;
        if (typeof i == "string")
          try {
            const t = JSON.parse(i);
            if (typeof t == "object" && !Array.isArray(t)) return t;
          } catch {
            return { value: i };
          }
        if (Array.isArray(i)) {
          const t = {};
          return i.forEach((r, o) => {
            t[String(o)] = r;
          }), t;
        }
        return { value: i };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
function ot(i) {
  const e = [];
  let n = {};
  if (i.length > 0) {
    const t = i[i.length - 1];
    if (typeof t == "object" && t !== null && !Array.isArray(t)) {
      const r = Object.keys(t);
      r.some((s) => !/^\d+$/.test(s)) && r.length > 0 ? (n = t, e.push(...i.slice(0, -1))) : e.push(...i);
    } else
      e.push(...i);
  }
  return { positionalArgs: e, namedArgs: n };
}
function at(i) {
  const e = i.match(/at\s+(\d+):(\d+)/);
  return e ? {
    line: parseInt(e[1], 10),
    column: parseInt(e[2], 10)
  } : null;
}
function ut(i) {
  const { codePos: e, code: n, token: t, message: r } = i;
  let o = at(r), s = -1, a = -1;
  e ? (s = e.startRow + 1, o ? a = e.startCol + o.column : a = e.startCol + 1) : t ? (s = t.line, a = t.column + 1) : o && (s = o.line, a = o.column);
  let u = r;
  if (s >= 0 && (a >= 0 ? u += `
  at line ${s}, column ${a}` : u += `
  at line ${s}`), n && s >= 0) {
    const l = n.split(`
`), p = s - 1;
    if (p >= 0 && p < l.length) {
      const c = l[p];
      if (u += `

  ${c}`, a >= 0) {
        const f = Math.max(0, a - 1), m = " ".repeat(Math.min(f, c.length)) + "^";
        u += `
  ${m}`;
      }
      const h = [];
      for (let f = Math.max(0, p - 2); f < Math.min(l.length, p + 3); f++) {
        const m = (f + 1).toString().padStart(3, " "), g = f === p ? ">" : " ";
        h.push(`  ${g}${m} | ${l[f]}`);
      }
      h.length > 0 && (u += `

Context:
` + h.join(`
`));
    }
  }
  return u;
}
function le(i) {
  const e = ut(i), n = new Error(e);
  return n.__formattedMessage = e, n;
}
var d = {
  // Literals
  STRING: "STRING",
  // "hello", 'world', `template`
  NUMBER: "NUMBER",
  // 42, 3.14, -10
  BOOLEAN: "BOOLEAN",
  // true, false
  NULL: "NULL",
  // null
  // Identifiers and Variables
  IDENTIFIER: "IDENTIFIER",
  // funcName, moduleName
  VARIABLE: "VARIABLE",
  // $var, $arr[0], $obj.prop
  KEYWORD: "KEYWORD",
  // if, else, def, do, for, etc.
  // Operators
  ASSIGN: "ASSIGN",
  // =
  PLUS: "PLUS",
  // +
  MINUS: "MINUS",
  // -
  MULTIPLY: "MULTIPLY",
  // *
  DIVIDE: "DIVIDE",
  // /
  MODULO: "MODULO",
  // %
  // Comparison Operators
  EQ: "EQ",
  // ==
  NE: "NE",
  // !=
  GT: "GT",
  // >
  LT: "LT",
  // <
  GTE: "GTE",
  // >=
  LTE: "LTE",
  // <=
  // Logical Operators
  AND: "AND",
  // &&
  OR: "OR",
  // ||
  NOT: "NOT",
  // !
  // Punctuation
  LPAREN: "LPAREN",
  // (
  RPAREN: "RPAREN",
  // )
  LBRACKET: "LBRACKET",
  // [
  RBRACKET: "RBRACKET",
  // ]
  LBRACE: "LBRACE",
  // {
  RBRACE: "RBRACE",
  // }
  COMMA: "COMMA",
  // ,
  COLON: "COLON",
  // :
  DOT: "DOT",
  // .
  // Special
  DECORATOR: "DECORATOR",
  // @decorator
  COMMENT: "COMMENT",
  // # comment
  NEWLINE: "NEWLINE",
  // \n
  EOF: "EOF",
  // End of file
  SUBEXPRESSION_OPEN: "SUBEXPRESSION_OPEN"
  // $( - opening of subexpression
  // Future: INDENT/DEDENT if we need Python-style indentation
  // INDENT: 'INDENT',
  // DEDENT: 'DEDENT',
};
var lt = /* @__PURE__ */ new Set([
  "if",
  "else",
  "elseif",
  "endif",
  "then",
  "do",
  "enddo",
  "with",
  "endwith",
  "def",
  "define",
  "enddef",
  "for",
  "endfor",
  "in",
  "on",
  "endon",
  "return",
  "break",
  "continue",
  "together",
  "endtogether",
  "into",
  "from",
  "to",
  "by",
  "step",
  "key",
  "var",
  "const",
  "log",
  "true",
  "false",
  "null",
  "repeat",
  "iftrue",
  "iffalse",
  "not",
  "and",
  "or",
  "set",
  "as"
]);
var ct = class {
  /**
   * Tokenize entire source code into Token objects
   * This is the new token-stream based approach
   * 
   * @param source - Full source code (multi-line)
   * @returns Array of tokens with position information
   */
  static tokenizeFull(e) {
    const n = [];
    let t = 1, r = 0, o = 0;
    const s = (h, f, m, g, y) => {
      const D = { kind: h, text: f, line: m, column: g, value: y };
      return c && (D.isContinuation = true, c = false), D;
    }, a = (h) => h === " " || h === "	" || h === "\r", u = (h) => h >= "0" && h <= "9", l = (h) => h >= "a" && h <= "z" || h >= "A" && h <= "Z" || h === "_", p = (h) => l(h) || u(h);
    let c = false;
    for (; o < e.length; ) {
      const h = e[o], f = o + 1 < e.length ? e[o + 1] : "";
      if (h === "\\") {
        let m = o + 1;
        for (; m < e.length && a(e[m]); )
          m++;
        if (m < e.length && e[m] === `
`) {
          o = m + 1, t++, r = 0, c = true;
          continue;
        }
      }
      if (h === `
`) {
        n.push(s(d.NEWLINE, `
`, t, r)), o++, t++, r = 0;
        continue;
      }
      if (a(h)) {
        o++, r++;
        continue;
      }
      if (h === "#") {
        const m = r;
        o++, r++;
        let g = "";
        for (; o < e.length && e[o] !== `
`; )
          g += e[o], o++, r++;
        n.push(s(d.COMMENT, "#" + g, t, m, g.trim()));
        continue;
      }
      if (h === '"' || h === "'" || h === "`") {
        const m = r, g = t, y = h;
        let D = "";
        o++, r++;
        let C = false;
        for (; o < e.length; ) {
          const E = e[o];
          if (C) {
            if (y === "`")
              switch (E) {
                case "n":
                  D += `
`;
                  break;
                case "t":
                  D += "	";
                  break;
                case "r":
                  D += "\r";
                  break;
                case "\\":
                  D += "\\";
                  break;
                case "`":
                  D += "`";
                  break;
                case "$":
                  D += "\\$";
                  break;
                case "(":
                  D += "\\(";
                  break;
                case ")":
                  D += "\\)";
                  break;
                default:
                  D += E;
                  break;
              }
            else
              switch (E) {
                case "n":
                  D += `
`;
                  break;
                case "t":
                  D += "	";
                  break;
                case "r":
                  D += "\r";
                  break;
                case "\\":
                  D += "\\";
                  break;
                case '"':
                  D += '"';
                  break;
                case "'":
                  D += "'";
                  break;
                case "`":
                  D += "`";
                  break;
                default:
                  D += E;
                  break;
              }
            C = false, o++, r++;
            continue;
          }
          if (E === "\\") {
            C = true, o++, r++;
            continue;
          }
          if (E === y) {
            o++, r++;
            break;
          }
          if (E === `
`) {
            D += E, o++, t++, r = 0;
            continue;
          }
          D += E, o++, r++;
        }
        const x = y + D + y;
        n.push(s(d.STRING, x, g, m, D));
        continue;
      }
      if (h === "@") {
        const m = r;
        o++, r++;
        let g = "";
        for (; o < e.length && p(e[o]); )
          g += e[o], o++, r++;
        n.push(s(d.DECORATOR, "@" + g, t, m, g));
        continue;
      }
      if (h === "$") {
        const m = r;
        if (o++, r++, o < e.length && e[o] === "(") {
          n.push(s(d.SUBEXPRESSION_OPEN, "$(", t, m)), o++, r++;
          continue;
        }
        let g = "$", y = 0;
        for (; o < e.length; ) {
          const D = e[o];
          if (p(D) || D === ".")
            g += D, o++, r++;
          else if (D === "[")
            y++, g += D, o++, r++;
          else if (D === "]" && y > 0)
            y--, g += D, o++, r++;
          else if (D === "$" && y > 0)
            g += D, o++, r++;
          else
            break;
        }
        n.push(s(d.VARIABLE, g, t, m, g.substring(1)));
        continue;
      }
      if (u(h) || h === "-" && u(f)) {
        const m = r;
        let g = "", y = "";
        if (h === "-" && (g += h, y += h, o++, r++), e[o] === "0" && o + 1 < e.length && (e[o + 1] === "x" || e[o + 1] === "X")) {
          g += e[o] + e[o + 1], y += e[o] + e[o + 1], o += 2, r += 2;
          const C = (E) => /[0-9a-fA-F]/.test(E);
          for (; o < e.length && (C(e[o]) || e[o] === "_"); )
            e[o] !== "_" && (y += e[o]), g += e[o], o++, r++;
          const x = parseInt(y, 16);
          n.push(s(d.NUMBER, g, t, m, x));
          continue;
        }
        for (; o < e.length && (u(e[o]) || e[o] === "_"); )
          e[o] !== "_" && (y += e[o]), g += e[o], o++, r++;
        if (o < e.length && e[o] === "." && o + 1 < e.length && u(e[o + 1]))
          for (g += ".", y += ".", o++, r++; o < e.length && (u(e[o]) || e[o] === "_"); )
            e[o] !== "_" && (y += e[o]), g += e[o], o++, r++;
        if (o < e.length && (e[o] === "e" || e[o] === "E")) {
          const C = o;
          let x = e[o], E = e[o];
          if (o++, r++, o < e.length && (e[o] === "+" || e[o] === "-") && (x += e[o], E += e[o], o++, r++), o < e.length && u(e[o])) {
            for (; o < e.length && (u(e[o]) || e[o] === "_"); )
              e[o] !== "_" && (E += e[o]), x += e[o], o++, r++;
            g += x, y += E;
          } else
            o = C, r = m + g.length;
        }
        const D = parseFloat(y);
        n.push(s(d.NUMBER, g, t, m, D));
        continue;
      }
      if (h === "=" && f === "=") {
        n.push(s(d.EQ, "==", t, r)), o += 2, r += 2;
        continue;
      }
      if (h === "!" && f === "=") {
        n.push(s(d.NE, "!=", t, r)), o += 2, r += 2;
        continue;
      }
      if (h === ">" && f === "=") {
        n.push(s(d.GTE, ">=", t, r)), o += 2, r += 2;
        continue;
      }
      if (h === "<" && f === "=") {
        n.push(s(d.LTE, "<=", t, r)), o += 2, r += 2;
        continue;
      }
      if (h === "&" && f === "&") {
        n.push(s(d.AND, "&&", t, r)), o += 2, r += 2;
        continue;
      }
      if (h === "|" && f === "|") {
        n.push(s(d.OR, "||", t, r)), o += 2, r += 2;
        continue;
      }
      switch (h) {
        case "=":
          n.push(s(d.ASSIGN, "=", t, r)), o++, r++;
          continue;
        case "+":
          n.push(s(d.PLUS, "+", t, r)), o++, r++;
          continue;
        case "-":
          n.push(s(d.MINUS, "-", t, r)), o++, r++;
          continue;
        case "*":
          n.push(s(d.MULTIPLY, "*", t, r)), o++, r++;
          continue;
        case "/":
          n.push(s(d.DIVIDE, "/", t, r)), o++, r++;
          continue;
        case "%":
          n.push(s(d.MODULO, "%", t, r)), o++, r++;
          continue;
        case ">":
          n.push(s(d.GT, ">", t, r)), o++, r++;
          continue;
        case "<":
          n.push(s(d.LT, "<", t, r)), o++, r++;
          continue;
        case "!":
          n.push(s(d.NOT, "!", t, r)), o++, r++;
          continue;
        case "(":
          n.push(s(d.LPAREN, "(", t, r)), o++, r++;
          continue;
        case ")":
          n.push(s(d.RPAREN, ")", t, r)), o++, r++;
          continue;
        case "[":
          n.push(s(d.LBRACKET, "[", t, r)), o++, r++;
          continue;
        case "]":
          n.push(s(d.RBRACKET, "]", t, r)), o++, r++;
          continue;
        case "{":
          n.push(s(d.LBRACE, "{", t, r)), o++, r++;
          continue;
        case "}":
          n.push(s(d.RBRACE, "}", t, r)), o++, r++;
          continue;
        case ",":
          n.push(s(d.COMMA, ",", t, r)), o++, r++;
          continue;
        case ":":
          n.push(s(d.COLON, ":", t, r)), o++, r++;
          continue;
        case ".":
          n.push(s(d.DOT, ".", t, r)), o++, r++;
          continue;
      }
      if (l(h)) {
        const m = r;
        let g = "";
        for (; o < e.length && p(e[o]); )
          g += e[o], o++, r++;
        lt.has(g) ? g === "true" ? n.push(s(d.BOOLEAN, g, t, m, true)) : g === "false" ? n.push(s(d.BOOLEAN, g, t, m, false)) : g === "null" ? n.push(s(d.NULL, g, t, m, null)) : n.push(s(d.KEYWORD, g, t, m)) : n.push(s(d.IDENTIFIER, g, t, m));
        continue;
      }
      o++, r++;
    }
    return n.push(s(d.EOF, "", t, r)), n;
  }
  /**
   * Legacy tokenize method - kept for backward compatibility
   * Tokenizes a single line into string tokens
   * 
   * @param line - A single line of code
   * @returns Array of string tokens
   */
  static tokenize(e) {
    const n = [], t = [];
    let r = false, o = "", s = 0;
    const a = () => {
      if (t.length > 0) {
        let u = 0, l = t.length;
        for (; u < l && /\s/.test(t[u]); ) u++;
        for (; l > u && /\s/.test(t[l - 1]); ) l--;
        u < l && n.push(t.slice(u, l).join("")), t.length = 0;
      }
    };
    for (; s < e.length; ) {
      const u = e[s], l = s + 1 < e.length ? e[s + 1] : "";
      if (!r && u === "#")
        break;
      if ((u === '"' || u === "'" || u === "`") && (s === 0 || e[s - 1] !== "\\")) {
        r ? u === o ? (r = false, t.push(u), n.push(t.join("")), t.length = 0, o = "") : t.push(u) : (r = true, o = u, a(), t.push(u)), s++;
        continue;
      }
      if (r) {
        t.push(u), s++;
        continue;
      }
      if (u === "=" && l === "=") {
        a(), n.push("=="), s += 2;
        continue;
      }
      if (u === "!" && l === "=") {
        a(), n.push("!="), s += 2;
        continue;
      }
      if (u === ">" && l === "=") {
        a(), n.push(">="), s += 2;
        continue;
      }
      if (u === "<" && l === "=") {
        a(), n.push("<="), s += 2;
        continue;
      }
      if (u === "&" && l === "&") {
        a(), n.push("&&"), s += 2;
        continue;
      }
      if (u === "|" && l === "|") {
        a(), n.push("||"), s += 2;
        continue;
      }
      if (["=", ">", "<", "!", "(", ")", "]"].includes(u)) {
        if (u === "]" && t.length > 0 && t[0] === "$") {
          t.push(u), s++;
          continue;
        }
        a(), n.push(u), s++;
        continue;
      }
      if (u === "[") {
        if (t.length > 0 && t[0] === "$") {
          t.push(u), s++;
          continue;
        }
        a(), n.push(u), s++;
        continue;
      }
      if (u === ".") {
        if (t.length > 0 && t[0] === "$") {
          t.push(u), s++;
          continue;
        }
        if (t.length > 0) {
          const c = t.join("").trim();
          if (/^-?\d+$/.test(c)) {
            if (s + 1 < e.length && /\d/.test(e[s + 1])) {
              t.push(u), s++;
              continue;
            }
            n.push(c), t.length = 0, n.push(u), s++;
            continue;
          }
        }
        a(), n.push(u), s++;
        continue;
      }
      if (/\s/.test(u)) {
        a(), s++;
        continue;
      }
      t.push(u), s++;
    }
    return a(), n;
  }
};
var H = {
  NONE: "none",
  ARRAY_LITERAL: "array_literal",
  OBJECT_LITERAL: "object_literal",
  FUNCTION_CALL: "function_call",
  SUBEXPRESSION: "subexpression",
  BLOCK: "block",
  // Generic block (do, together, etc.)
  FUNCTION_DEFINITION: "function_definition",
  // Inside def/enddef
  STRING_LITERAL: "string_literal"
  // Inside a string (though strings are tokenized, this helps track state)
};
var G = class _G {
  tokens;
  position = 0;
  contextStack = [];
  lastNextPosition = -1;
  // Track last position where next() was called
  consecutiveNextCalls = 0;
  // Track consecutive next() calls at same position
  positionHistory = [];
  // Track recent position changes for stuck detection
  operationsSinceLastAdvance = 0;
  // Operations since position last advanced
  lastPositionValue = 0;
  // Last position value to detect changes
  /**
   * Maximum number of consecutive next() calls allowed at the same position before throwing
   */
  static MAX_CONSECUTIVE_NEXT_AT_SAME_POSITION = 3;
  /**
   * Maximum number of operations without position advancement before detecting stuck
   * Only counts operations that should advance (next, match, expect, etc.)
   */
  static MAX_OPERATIONS_WITHOUT_ADVANCE = 100;
  /**
   * Debug mode flag - set to true to enable logging
   * Can be controlled via VITE_DEBUG environment variable or set programmatically
   * Usage: TokenStream.debug = true;
   */
  static debug = (() => {
    try {
      const e = globalThis.process;
      if (e && e.env?.VITE_DEBUG === "true")
        return true;
      const n = globalThis.import?.meta;
      if (n && n.env?.VITE_DEBUG === "true")
        return true;
    } catch {
    }
    return false;
  })();
  /**
   * Create a new TokenStream
   * @param tokens - Array of tokens to stream
   * @param startIndex - Optional starting index (default 0)
   */
  constructor(e, n = 0) {
    this.tokens = e, this.position = n, this.lastNextPosition = -1, this.consecutiveNextCalls = 0, this.positionHistory = [n], this.operationsSinceLastAdvance = 0, this.lastPositionValue = n;
  }
  /**
   * Create a new TokenStream starting from the given index
   * Useful for sub-parsing operations that need to start from a specific position
   * @param index - Starting index in the token array
   * @returns New TokenStream instance starting at the given index
   */
  cloneFrom(e) {
    const n = new _G(this.tokens, e);
    return n.contextStack = [...this.contextStack], n;
  }
  /**
   * Reset stuck detection counters (useful when manually advancing position)
   */
  resetStuckDetection() {
    this.operationsSinceLastAdvance = 0, this.consecutiveNextCalls = 0, this.lastNextPosition = -1, this.lastPositionValue = this.position;
  }
  /**
   * Set the current position directly
   * @param position - New position
   */
  setPosition(e) {
    const n = this.position;
    this.position = e, e !== n && (this.positionHistory.push(e), this.positionHistory.length > 10 && this.positionHistory.shift(), this.operationsSinceLastAdvance = 0, this.lastPositionValue = e), this.lastNextPosition = -1, this.consecutiveNextCalls = 0;
  }
  /**
   * Get the current token without consuming it
   * @returns The current token, or null if at end
   */
  current() {
    return this.peek(0);
  }
  /**
   * Look ahead at a token without consuming it
   * @param offset - Number of tokens to look ahead (default 0 = current token)
   * @returns The token at the given offset, or null if beyond end
   */
  peek(e = 0) {
    const n = this.position + e;
    return n < 0 || n >= this.tokens.length ? null : this.tokens[n];
  }
  /**
   * Consume and return the current token
   * @returns The current token, or null if at end
   * @throws Error if called multiple times at the same position (indicates infinite loop)
   */
  next() {
    if (this.operationsSinceLastAdvance++, this.position >= this.tokens.length) {
      if (_G.debug) {
        const t = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[TokenStream] [${t}] next() - At end of stream (position: ${this.position}, total tokens: ${this.tokens.length})`);
      }
      return null;
    }
    if (this.position === this.lastNextPosition) {
      if (this.consecutiveNextCalls++, this.consecutiveNextCalls >= _G.MAX_CONSECUTIVE_NEXT_AT_SAME_POSITION) {
        const t = this.tokens[this.position], r = this.getCurrentContext();
        throw new Error(
          `[TokenStream] Infinite loop detected! next() called ${this.consecutiveNextCalls} times at position ${this.position} without advancing.
  Token: ${t?.text || "null"} (${t?.kind || "EOF"})
  Location: line ${t?.line || "N/A"}, column ${t?.column || "N/A"}
  Context: ${r}
  Recent positions: ${this.positionHistory.slice(-5).join(" -> ")}
  Operations since last advance: ${this.operationsSinceLastAdvance}`
        );
      }
      if (_G.debug) {
        const t = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[TokenStream] [${t}] WARNING: next() called ${this.consecutiveNextCalls} times at position ${this.position} without advancing`);
      }
    } else
      this.consecutiveNextCalls = 0, this.lastNextPosition = this.position;
    const e = this.tokens[this.position], n = this.position;
    if (this.position++, this.position !== n ? (this.positionHistory.push(this.position), this.positionHistory.length > 10 && this.positionHistory.shift(), this.operationsSinceLastAdvance = 0, this.lastPositionValue = this.position) : this.checkStuckCondition("next"), _G.debug) {
      const t = (/* @__PURE__ */ new Date()).toISOString();
      console.log(`[TokenStream] [${t}] next() - Advanced from position ${n} to ${this.position}:`, {
        kind: e.kind,
        text: e.text,
        line: e.line,
        column: e.column,
        context: this.getCurrentContext()
      });
    }
    return e;
  }
  /**
   * Check if the stream appears to be stuck (no position advancement)
   * @param operation - Name of the operation being performed
   * @throws Error if stuck condition detected
   */
  checkStuckCondition(e) {
    if (this.position >= this.tokens.length)
      return;
    if (!(this.position !== this.lastPositionValue) && this.operationsSinceLastAdvance > _G.MAX_OPERATIONS_WITHOUT_ADVANCE) {
      const t = this.current(), r = this.getCurrentContext();
      throw new Error(
        `[TokenStream] Stream appears stuck! ${this.operationsSinceLastAdvance} operations without position advancement.
  Operation: ${e}
  Current position: ${this.position}/${this.tokens.length}
  Token: ${t?.text || "null"} (${t?.kind || "EOF"})
  Location: line ${t?.line || "N/A"}, column ${t?.column || "N/A"}
  Context: ${r}
  Recent positions: ${this.positionHistory.slice(-5).join(" -> ")}`
      );
    }
  }
  /**
   * Check if we're at the end of the token stream
   * @returns True if at EOF or beyond
   */
  isAtEnd() {
    const e = this.current();
    return e === null || e.kind === d.EOF;
  }
  /**
   * Check if the current token matches the given kind or text, without consuming it
   * @param kindOrText - TokenKind enum or string text to match
   * @returns True if the current token matches
   */
  check(e) {
    const n = this.current();
    return n ? typeof e == "string" ? n.text === e : n.kind === e : false;
  }
  /**
   * If the current token matches, consume it and return true
   * Otherwise, return false without consuming
   * 
   * @param kindOrText - TokenKind enum or string text to match
   * @returns True if matched and consumed, false otherwise
   */
  match(e) {
    return this.check(e) ? (this.next(), true) : false;
  }
  /**
   * Expect the current token to match, consume it, and return it
   * If it doesn't match, throw an error
   * 
   * @param kindOrText - TokenKind enum or string text to expect
   * @param message - Optional custom error message
   * @returns The consumed token
   * @throws Error if token doesn't match
   */
  expect(e, n) {
    const t = this.current();
    if (!t) {
      const o = n || `Expected ${e} but reached end of input`;
      throw new Error(o);
    }
    if (!(typeof e == "string" ? t.text === e : t.kind === e)) {
      const o = typeof e == "string" ? `'${e}'` : e, s = n || `Expected ${o} but got '${t.text}' at line ${t.line}, column ${t.column}`;
      throw new Error(s);
    }
    return this.next(), t;
  }
  /**
   * Save the current position for potential backtracking
   * @returns The current position index
   */
  save() {
    return this.position;
  }
  /**
   * Restore a previously saved position (backtrack)
   * @param pos - The position to restore to
   */
  restore(e) {
    this.position = e;
  }
  /**
   * Skip tokens of a specific kind (useful for skipping newlines, comments, etc.)
   * @param kind - The TokenKind to skip
   * @returns Number of tokens skipped
   */
  skip(e) {
    let n = 0;
    for (; this.check(e); )
      this.next(), n++;
    return n;
  }
  /**
   * Skip all newline tokens
   * @returns Number of newlines skipped
   */
  skipNewlines() {
    return this.skip(d.NEWLINE);
  }
  /**
   * Consume tokens until a specific kind or text is found (exclusive)
   * @param kindOrText - The kind or text to stop at
   * @returns Array of consumed tokens (not including the stop token)
   */
  consumeUntil(e) {
    const n = [];
    for (; !this.isAtEnd() && !this.check(e); ) {
      const t = this.next();
      t && n.push(t);
    }
    return n;
  }
  /**
   * Collect all tokens on the current line (until NEWLINE or EOF)
   * @returns Array of tokens on the current line
   */
  collectLine() {
    const e = [];
    for (; !this.isAtEnd(); ) {
      const n = this.current();
      if (!n || n.kind === d.NEWLINE || n.kind === d.EOF)
        break;
      e.push(this.next());
    }
    return e;
  }
  /**
   * Get the current position in the stream
   * @returns Current position index
   */
  getPosition() {
    return this.position;
  }
  /**
   * Get the total number of tokens in the stream
   * @returns Total token count
   */
  getLength() {
    return this.tokens.length;
  }
  /**
   * Get all remaining tokens without consuming them
   * @returns Array of remaining tokens
   */
  remaining() {
    return this.tokens.slice(this.position);
  }
  /**
   * Create a sub-stream from a range of tokens
   * Useful for parsing sub-expressions or blocks
   * 
   * @param start - Start position (inclusive)
   * @param end - End position (exclusive), defaults to current position
   * @returns New TokenStream instance
   */
  slice(e, n) {
    const t = n !== void 0 ? n : this.position;
    return new _G(this.tokens.slice(e, t));
  }
  /**
   * Format current position for error messages
   * @returns String like "line 10, column 5"
   */
  formatPosition() {
    const e = this.current();
    return e ? `line ${e.line}, column ${e.column}` : "end of input";
  }
  /**
   * Push a parsing context onto the context stack
   * @param context - The parsing context to enter
   */
  pushContext(e) {
    this.contextStack.push(e);
  }
  /**
   * Pop the most recent parsing context from the stack
   * @returns The context that was removed, or NONE if stack was empty
   */
  popContext() {
    return this.contextStack.pop() || H.NONE;
  }
  /**
   * Get the current parsing context (top of the stack)
   * @returns The current parsing context, or NONE if no context is active
   */
  getCurrentContext() {
    return this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : H.NONE;
  }
  /**
   * Check if we're currently in a specific parsing context
   * @param context - The context to check for
   * @returns True if we're in the given context (at any level)
   */
  isInContext(e) {
    return this.contextStack.includes(e);
  }
  /**
   * Get all active contexts (the entire stack)
   * @returns Array of contexts from bottom to top
   */
  getContextStack() {
    return [...this.contextStack];
  }
  /**
   * Clear all parsing contexts
   */
  clearContexts() {
    this.contextStack = [];
  }
  /**
   * Create a new TokenStream with the same tokens and contexts
   * Useful for sub-parsing that should inherit context
   * @param startIndex - Optional starting index (defaults to current position)
   * @returns New TokenStream instance with copied context
   */
  cloneWithContext(e) {
    const n = new _G(this.tokens, e ?? this.position);
    return n.contextStack = [...this.contextStack], n;
  }
  /**
   * Skip whitespace (newlines) and comments
   * Advances the stream past any consecutive newline or comment tokens
   */
  skipWhitespaceAndComments() {
    for (; !this.isAtEnd(); ) {
      const e = this.current();
      if (!e) break;
      if (e.kind === d.NEWLINE || e.kind === d.COMMENT) {
        this.next();
        continue;
      }
      break;
    }
  }
};
var X = class {
  /**
   * Parse a subexpression from TokenStream
   * Expects stream to be positioned at the '$(' token
   * Syntax: $( ... )
   * 
   * @param stream - TokenStream positioned at the '$(' token
   * @param context - Context with helper methods
   * @returns Parsed SubexpressionExpression
   */
  static parse(e, n) {
    const t = e.current();
    if (!t || t.kind !== d.SUBEXPRESSION_OPEN)
      throw new Error("Expected $( at start of subexpression");
    e.next(), e.pushContext(H.SUBEXPRESSION);
    try {
      const r = [];
      for (; !e.isAtEnd(); ) {
        e.skipWhitespaceAndComments();
        const o = e.current();
        if (!o || o.kind === d.EOF) break;
        if (o.kind === d.RPAREN) {
          const a = o;
          return e.next(), {
            type: "subexpression",
            body: r,
            codePos: n.createCodePosition(t, a)
          };
        }
        const s = n.parseStatement(e);
        if (s)
          r.push(s);
        else {
          const a = e.current();
          if (a && a.kind !== d.RPAREN)
            e.next();
          else if (!a)
            break;
        }
      }
      throw new Error(`Unclosed subexpression starting at line ${t.line}, column ${t.column}`);
    } finally {
      e.popContext();
    }
  }
  /**
   * Check if the current token is the start of a subexpression
   * Subexpressions must start with SUBEXPRESSION_OPEN ($()
   * 
   * @param stream - TokenStream to check
   * @returns true if current token is SUBEXPRESSION_OPEN
   */
  static isSubexpression(e) {
    const n = e.current();
    return n ? n.kind === d.SUBEXPRESSION_OPEN : false;
  }
};
function I(i, e) {
  return {
    startRow: i.line - 1,
    // Convert to 0-based
    startCol: i.column,
    endRow: e.line - 1,
    // Convert to 0-based
    endCol: e.column + (e.text.length > 0 ? e.text.length - 1 : 0)
  };
}
var Xe = null;
function z(i, e, n) {
  return Xe = i.current(), me(i, 0, e);
}
function me(i, e, n, t) {
  let r = Ne(i, n);
  for (; ; ) {
    const o = i.current();
    if (!o || o.kind === d.NEWLINE || o.kind === d.ASSIGN)
      break;
    const s = we(o);
    if (!s || s.precedence < e)
      break;
    i.next(), i.skipWhitespaceAndComments();
    const a = me(i, s.precedence + 1, n), u = Xe || o, l = o, p = {
      type: "binary",
      operator: s.operator,
      left: r,
      right: a,
      codePos: I(u, l)
    };
    s.originalText && s.originalText !== s.operator && (p.operatorText = s.originalText), r = p;
  }
  return r;
}
function Ne(i, e, n) {
  const t = i.current();
  if (!t)
    throw new Error("Unexpected end of input while parsing unary expression");
  if (t.kind === d.MINUS || t.kind === d.PLUS) {
    const r = t.kind === d.MINUS ? "-" : "+";
    i.next(), i.skipWhitespaceAndComments();
    const o = Ne(i, e);
    return {
      type: "unary",
      operator: r,
      argument: o,
      codePos: I(t, t)
      // Will be improved later with proper end token tracking
    };
  }
  if (t.kind === d.KEYWORD && (t.text === "not" || t.text === "!")) {
    i.next(), i.skipWhitespaceAndComments();
    const o = Ne(i, e), s = o.codePos ? { line: o.codePos.endRow + 1, column: o.codePos.endCol, text: "" } : t;
    return {
      type: "unary",
      operator: "not",
      argument: o,
      codePos: I(t, s)
    };
  }
  return dt(i, e);
}
function dt(i, e, n) {
  const t = i.current();
  if (!t)
    throw new Error("Unexpected end of input while parsing expression");
  if (t.kind === d.LPAREN) {
    i.next(), i.skipWhitespaceAndComments();
    const r = me(i, 0, e);
    i.skipWhitespaceAndComments();
    const o = i.current();
    if (!o || o.kind !== d.RPAREN)
      throw new Error(`Expected ')' after expression at line ${t.line}, column ${t.column}`);
    return i.next(), r.parenthesized = true, r;
  }
  if (t.kind === d.VARIABLE) {
    const r = t.text;
    if (r === "$") {
      if (X.isSubexpression(i)) {
        if (!e)
          throw new Error("parseStatement callback required for subexpressions");
        return X.parse(i, {
          parseStatement: e,
          createCodePosition: (a, u) => I(a, u)
        });
      }
      return i.next(), {
        type: "lastValue",
        codePos: I(t, t)
      };
    }
    const { name: o, path: s } = L.parseVariablePath(r);
    return i.next(), {
      type: "var",
      name: o,
      path: s,
      codePos: I(t, t)
    };
  }
  if (t.kind === d.SUBEXPRESSION_OPEN) {
    if (!e)
      throw new Error("parseStatement callback required for subexpressions");
    return X.parse(i, {
      parseStatement: e,
      createCodePosition: (r, o) => I(r, o)
    });
  }
  if (t.kind === d.STRING) {
    const r = t.text.startsWith("`"), o = L.parseString(t.text);
    return i.next(), {
      type: "string",
      value: r ? `\0TEMPLATE\0${o}` : o,
      codePos: I(t, t)
    };
  }
  if (t.kind === d.NUMBER) {
    const r = parseFloat(t.text);
    return i.next(), {
      type: "number",
      value: r,
      codePos: I(t, t)
    };
  }
  if (t.kind === d.LBRACE) {
    const r = t;
    i.next(), i.skipWhitespaceAndComments();
    const o = [], s = i.current();
    if (s && s.kind === d.RBRACE)
      return i.next(), {
        type: "objectLiteral",
        properties: [],
        codePos: I(r, s)
      };
    for (; ; ) {
      const a = i.current();
      if (!a)
        throw new Error("Unexpected end of input while parsing object literal");
      if (a.kind === d.RBRACE)
        return i.next(), {
          type: "objectLiteral",
          properties: o,
          codePos: I(r, a)
        };
      let u;
      if (a.kind === d.LBRACKET) {
        i.next(), i.skipWhitespaceAndComments(), u = z(i, e), i.skipWhitespaceAndComments();
        const h = i.current();
        if (!h || h.kind !== d.RBRACKET)
          throw new Error("Expected ] after computed property key");
        i.next();
      } else if (a.kind === d.STRING)
        u = a.value !== void 0 ? String(a.value) : a.text.slice(1, -1), i.next();
      else if (a.kind === d.IDENTIFIER || a.kind === d.KEYWORD)
        u = a.text, i.next();
      else
        throw new Error(`Unexpected token ${a.kind} as object property key at line ${a.line}, column ${a.column}`);
      i.skipWhitespaceAndComments();
      const l = i.current();
      if (!l || l.kind !== d.COLON)
        throw new Error(`Expected : after object property key at line ${l?.line || "?"}, column ${l?.column || "?"}`);
      i.next(), i.skipWhitespaceAndComments();
      const p = z(i, e);
      o.push({ key: u, value: p }), i.skipWhitespaceAndComments();
      const c = i.current();
      if (!c)
        throw new Error("Unexpected end of input while parsing object literal");
      if (c.kind === d.RBRACE)
        return i.next(), {
          type: "objectLiteral",
          properties: o,
          codePos: I(r, c)
        };
      if (c.kind === d.COMMA)
        i.next(), i.skipWhitespaceAndComments();
      else
        throw new Error(`Unexpected token ${c.kind} in object literal at line ${c.line}, column ${c.column}, expected comma or closing brace`);
    }
  }
  if (t.kind === d.LBRACKET) {
    const r = t;
    i.next(), i.skipWhitespaceAndComments();
    const o = [], s = i.current();
    if (s && s.kind === d.RBRACKET)
      return i.next(), {
        type: "arrayLiteral",
        elements: [],
        codePos: I(r, s)
      };
    for (; ; ) {
      const a = i.current();
      if (!a)
        throw new Error("Unexpected end of input while parsing array literal");
      if (a.kind === d.RBRACKET)
        return i.next(), {
          type: "arrayLiteral",
          elements: o,
          codePos: I(r, a)
        };
      const u = z(i, e);
      o.push(u), i.skipWhitespaceAndComments();
      const l = i.current();
      if (!l)
        throw new Error("Unexpected end of input while parsing array literal");
      if (l.kind === d.RBRACKET)
        return i.next(), {
          type: "arrayLiteral",
          elements: o,
          codePos: I(r, l)
        };
      if (l.kind === d.COMMA)
        i.next(), i.skipWhitespaceAndComments();
      else
        throw new Error(`Unexpected token ${l.kind} in array literal at line ${l.line}, column ${l.column}, expected comma or closing bracket`);
    }
  }
  if (t.kind === d.BOOLEAN) {
    const r = t.value !== void 0 ? t.value : t.text === "true";
    return i.next(), {
      type: "literal",
      value: r,
      codePos: I(t, t)
    };
  }
  if (t.kind === d.NULL)
    return i.next(), {
      type: "literal",
      value: null,
      codePos: I(t, t)
    };
  if (t.kind === d.IDENTIFIER || t.kind === d.KEYWORD) {
    let r = 1, o = null;
    for (; ; ) {
      const a = i.peek(r);
      if (!a || a.kind === d.NEWLINE || a.kind === d.EOF)
        break;
      if (a.kind === d.COMMENT) {
        r++;
        continue;
      }
      o = a;
      break;
    }
    if (o && (o.kind === d.LPAREN || !we(o)))
      return pt(i, e);
    const s = t.text;
    return i.next(), {
      type: "literal",
      value: s,
      codePos: I(t, t)
    };
  }
  throw t.kind === d.ASSIGN ? new Error(`Unexpected assignment operator in expression at line ${t.line}, column ${t.column}. Did you mean to use '==' for comparison?`) : t.kind === d.RBRACKET ? new Error(`Unexpected closing bracket ']' in expression at line ${t.line}, column ${t.column}. This may indicate a parsing issue with nested arrays or brackets.`) : new Error(`Unexpected token in expression: ${t.kind} '${t.text}' at line ${t.line}, column ${t.column}`);
}
function we(i) {
  return i.kind === d.AND || i.kind === d.KEYWORD && i.text === "and" ? { operator: "and", precedence: 0, originalText: i.kind === d.AND ? "&&" : "and" } : i.kind === d.OR || i.kind === d.KEYWORD && i.text === "or" ? { operator: "or", precedence: 0, originalText: i.kind === d.OR ? "||" : "or" } : i.kind === d.EQ || i.text === "==" && i.kind === d.KEYWORD ? { operator: "==", precedence: 1 } : i.kind === d.NE || i.text === "!=" && i.kind === d.KEYWORD ? { operator: "!=", precedence: 1 } : i.kind === d.LT ? { operator: "<", precedence: 1 } : i.kind === d.LTE ? { operator: "<=", precedence: 1 } : i.kind === d.GT ? { operator: ">", precedence: 1 } : i.kind === d.GTE ? { operator: ">=", precedence: 1 } : i.kind === d.PLUS ? { operator: "+", precedence: 2 } : i.kind === d.MINUS ? { operator: "-", precedence: 2 } : i.kind === d.MULTIPLY ? { operator: "*", precedence: 3 } : i.kind === d.DIVIDE ? { operator: "/", precedence: 3 } : i.kind === d.MODULO ? { operator: "%", precedence: 3 } : null;
}
function pt(i, e, n) {
  const t = i.current();
  if (!t)
    throw new Error("Unexpected end of input while parsing call expression");
  let r = t.text;
  i.next(), i.skipWhitespaceAndComments();
  const o = i.current();
  if (o && o.kind === d.DOT) {
    i.next(), i.skipWhitespaceAndComments();
    const l = i.current();
    if (!l || l.kind !== d.IDENTIFIER && l.kind !== d.KEYWORD)
      throw new Error(`Expected function name after '.' at line ${o.line}`);
    r = `${r}.${l.text}`, i.next();
  }
  i.skipWhitespaceAndComments();
  const s = [];
  let a = t;
  const u = i.current();
  if (u && u.kind === d.LPAREN) {
    i.next();
    let l = 1;
    for (i.skipWhitespaceAndComments(); !i.isAtEnd() && l > 0; ) {
      const p = i.current();
      if (!p) break;
      if (p.kind === d.LPAREN)
        l++, i.next();
      else if (p.kind === d.RPAREN) {
        if (l--, l === 0) {
          a = p, i.next();
          break;
        }
        i.next();
      } else if (p.kind === d.COMMA)
        i.next(), i.skipWhitespaceAndComments();
      else if (p.kind === d.NEWLINE)
        i.next();
      else if (p.kind === d.COMMENT)
        i.next();
      else {
        const c = me(i, 0, e);
        s.push(c), i.skipWhitespaceAndComments();
      }
    }
  } else
    for (; !i.isAtEnd(); ) {
      const l = i.current();
      if (!l || l.kind === d.NEWLINE || l.kind === d.EOF || l.kind === d.ASSIGN || l.kind === d.RBRACKET || we(l))
        break;
      if (l.kind === d.COMMENT) {
        i.next();
        continue;
      }
      const p = me(i, 0, e);
      s.push(p), a = i.current() || a, i.skipWhitespaceAndComments();
      const c = i.current();
      if (c && (we(c) || c.kind === d.ASSIGN || c.kind === d.RBRACKET))
        break;
    }
  return {
    type: "call",
    callee: r,
    args: s,
    codePos: I(t, a)
  };
}
var Ae = class {
  /**
   * Parse a command call from TokenStream
   * Expects stream to be positioned at the command name (identifier or keyword)
   * 
   * @param stream - TokenStream positioned at the command name
   * @param context - Optional context for parsing callbacks and creating code positions
   * @returns Parsed CommandCall
   */
  static parse(e, n) {
    const t = e.current();
    if (!t)
      throw new Error("Unexpected end of input while parsing command");
    const r = this.parseCommandName(e), o = r.name, s = t.line;
    e.skipWhitespaceAndComments();
    const a = e.current();
    return a && a.kind === d.LPAREN ? this.parseParenthesizedCall(e, o, t, s, n) : this.parseSpaceSeparatedCall(e, o, t, s, n, r.endToken);
  }
  /**
   * Parse command name (handles module.function syntax)
   */
  static parseCommandName(e) {
    const n = e.current();
    if (!n)
      throw new Error("Expected command name");
    if (n.kind !== d.IDENTIFIER && n.kind !== d.KEYWORD)
      throw new Error(`Expected identifier or keyword for command name at ${e.formatPosition()}`);
    let t = n.text, r = n;
    e.next();
    const o = e.current();
    if (o && o.kind === d.DOT && o.line === n.line) {
      e.next(), e.skipWhitespaceAndComments();
      const s = e.current();
      if (!s || s.kind !== d.IDENTIFIER && s.kind !== d.KEYWORD)
        throw new Error(`Expected function name after '.' at ${e.formatPosition()}`);
      t = `${t}.${s.text}`, r = s, e.next();
    }
    if (L.isNumber(t))
      throw new Error(`Expected command name, got number: ${t}`);
    if (L.isString(t))
      throw new Error(`Expected command name, got string literal: ${t}`);
    if (L.isVariable(t) || L.isPositionalParam(t))
      throw new Error(`Expected command name, got variable: ${t}`);
    if (L.isLastValue(t))
      throw new Error(`Expected command name, got last value reference: ${t}`);
    return { name: t, endToken: r };
  }
  /**
   * Parse parenthesized function call: command(...)
   */
  static parseParenthesizedCall(e, n, t, r, o) {
    e.pushContext(H.FUNCTION_CALL);
    try {
      const s = e.current();
      if (!s || s.kind !== d.LPAREN) {
        const x = s ? `'${s.text}' (${s.kind})` : "end of input", E = s ? `line ${s.line}, column ${s.column}` : "end of input";
        throw new Error(
          `Expected '(' after function name '${n}' but got ${x} at ${E}`
        );
      }
      const a = e.next(), u = [], l = {};
      let p = 1, c = false;
      const h = a.line;
      for (; !e.isAtEnd() && p > 0; ) {
        const x = e.current();
        if (!x) break;
        if (x.kind === d.LPAREN)
          p++;
        else if (x.kind === d.RPAREN && (p--, p === 0)) {
          e.next();
          break;
        }
        if (x.line !== h && (c = true), x.kind === d.NEWLINE || x.kind === d.COMMENT) {
          e.next();
          continue;
        }
        if (p === 1) {
          const E = this.parseArgument(e, o);
          E && (E.isNamed ? l[E.key] = E.arg : u.push(E.arg));
        } else
          e.next();
      }
      const f = [...u];
      Object.keys(l).length > 0 && f.push({ type: "namedArgs", args: l });
      let m;
      c ? m = "multiline-parentheses" : Object.keys(l).length > 0 ? m = "named-parentheses" : m = "parentheses";
      const g = this.parseInto(e), y = this.parseCallback(e, o), D = e.current() || t, C = o?.createCodePosition ? o.createCodePosition(t, D) : I(t, D);
      return {
        type: "command",
        name: n,
        args: f,
        syntaxType: m,
        into: g || void 0,
        callback: y,
        codePos: C
      };
    } finally {
      e.popContext();
    }
  }
  /**
   * Parse space-separated function call: command arg1 arg2
   */
  static parseSpaceSeparatedCall(e, n, t, r, o, s) {
    e.pushContext(H.FUNCTION_CALL);
    let a = false;
    const u = e.current();
    if (s && u && u.kind === d.STRING && u.text.startsWith("`")) {
      const p = s.column + s.text.length, c = u.column;
      p === c && (a = true);
    }
    try {
      const l = [], p = {};
      let c = t;
      if (n === "set") {
        e.skipWhitespaceAndComments();
        const g = this.parseArgument(e, o);
        if (!g || g.isNamed)
          throw new Error("set command requires a variable as first argument");
        l.push(g.arg), e.skipWhitespaceAndComments();
        const y = e.current();
        for (y && (y.kind === d.KEYWORD || y.kind === d.IDENTIFIER) && y.text === "as" && (e.next(), e.skipWhitespaceAndComments()); !e.isAtEnd(); ) {
          const D = e.current();
          if (!D || D.kind === d.EOF || D.kind === d.NEWLINE || D.line !== r && !D.isContinuation) break;
          if (D.kind === d.COMMENT) {
            e.next();
            continue;
          }
          if (e.isInContext(H.SUBEXPRESSION) && D.kind === d.RPAREN || D.kind === d.KEYWORD && D.text === "into") break;
          const C = this.parseArgument(e, o);
          C ? (C.isNamed ? p[C.key] = C.arg : l.push(C.arg), c = e.peek(-1) || c) : e.next();
        }
      } else {
        let g = -1, y = 0, D = false;
        const C = e.current();
        for (C && C.line === r && (c = C); !e.isAtEnd(); ) {
          const x = e.getPosition();
          if (x === g) {
            if (y++, y > 100)
              throw new Error(`Infinite loop in CommandParser (space separated) at index ${x}`);
          } else
            g = x, y = 0;
          const E = e.current();
          if (!E || E.kind === d.EOF || E.kind === d.KEYWORD && E.text === "into" || E.kind === d.KEYWORD && E.text === "with")
            break;
          if (E.kind === d.COMMENT) {
            if (E.line === r)
              break;
            e.next();
            continue;
          }
          if (E.kind === d.RPAREN || e.isInContext(H.SUBEXPRESSION) && E.kind === d.NEWLINE && !(e.isInContext(H.OBJECT_LITERAL) || e.isInContext(H.ARRAY_LITERAL)) && !D)
            break;
          if (e.isInContext(H.OBJECT_LITERAL) || e.isInContext(H.ARRAY_LITERAL)) {
            const F = this.parseArgument(e, o);
            F ? (F.isNamed ? p[F.key] = F.arg : l.push(F.arg), D = F.arg.type === "object" || F.arg.type === "objectLiteral" || F.arg.type === "array" || F.arg.type === "arrayLiteral" || F.arg.type === "subexpression") : e.next();
            continue;
          }
          const b = E.kind === d.LBRACE || E.kind === d.LBRACKET || E.kind === d.SUBEXPRESSION_OPEN || E.kind === d.VARIABLE && E.text === "$" && e.peek(1)?.kind === d.LPAREN;
          if (D || b) {
            D = false;
            const F = e.current();
            if (!F || F.kind === d.NEWLINE || F.kind === d.EOF || F.kind === d.RPAREN)
              break;
            const T = this.parseArgument(e, o);
            if (T)
              T.isNamed ? p[T.key] = T.arg : l.push(T.arg), c = e.peek(-1) || c, D = T.arg.type === "object" || T.arg.type === "objectLiteral" || T.arg.type === "array" || T.arg.type === "arrayLiteral" || T.arg.type === "subexpression";
            else {
              const S = e.current();
              if (!S || S.kind === d.NEWLINE || S.kind === d.EOF || S.kind === d.RPAREN)
                break;
              e.next();
            }
            continue;
          }
          if (E.kind === d.NEWLINE || E.line !== r && !D && !E.isContinuation)
            break;
          const v = this.parseArgument(e, o);
          v ? (v.isNamed ? p[v.key] = v.arg : l.push(v.arg), c = e.peek(-1) || c, D = v.arg.type === "object" || v.arg.type === "objectLiteral" || v.arg.type === "array" || v.arg.type === "arrayLiteral" || v.arg.type === "subexpression") : e.next();
        }
      }
      const h = [...l];
      Object.keys(p).length > 0 && h.push({ type: "namedArgs", args: p });
      const f = this.parseCallback(e, o);
      f && f.codePos && (c = {
        kind: d.KEYWORD,
        text: "endwith",
        line: f.codePos.endRow + 1,
        column: f.codePos.endCol,
        value: void 0
      });
      const m = this.parseInto(e);
      m && e.current() && (c = e.peek(-1) || c);
      try {
        let g = c;
        const y = e.current();
        !f && y && y.line === t.line && (g = y);
        const D = o?.createCodePosition ? o.createCodePosition(t, g) : I(t, g);
        return {
          type: "command",
          name: n,
          args: h,
          isTaggedTemplate: a || void 0,
          into: m || void 0,
          callback: f,
          codePos: D
        };
      } finally {
        e.popContext();
      }
    } finally {
      e.getCurrentContext() === H.FUNCTION_CALL && e.popContext();
    }
  }
  /**
   * Parse a single argument (positional or named)
   */
  static parseArgument(e, n) {
    const t = e.current();
    if (!t) return null;
    if (t.kind === d.IDENTIFIER || t.kind === d.KEYWORD) {
      const o = e.peek(1);
      if (o && o.kind === d.ASSIGN) {
        const s = t.text;
        e.next(), e.next(), e.skipWhitespaceAndComments();
        const a = this.parseArgumentValue(e, n);
        if (a)
          return { arg: a, isNamed: true, key: s };
      }
    }
    if (t.kind === d.VARIABLE && t.text !== "$") {
      const o = t.text, s = e.peek(1);
      if (s && s.kind === d.ASSIGN) {
        const { name: a } = L.parseVariablePath(o);
        if (a && /^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) {
          e.next(), e.next(), e.skipWhitespaceAndComments();
          const u = this.parseArgumentValue(e, n);
          if (u)
            return { arg: u, isNamed: true, key: a };
        }
      }
    }
    const r = this.parseArgumentValue(e, n);
    return r ? { arg: r, isNamed: false } : null;
  }
  /**
   * Parse an argument value (handles literals, variables, subexpressions, objects, arrays)
   */
  static parseArgumentValue(e, n) {
    const t = e.current();
    if (!t) return null;
    if (t.kind === d.VARIABLE && t.text === "$")
      return e.next(), { type: "lastValue" };
    if (t.kind === d.VARIABLE) {
      const { name: r, path: o } = L.parseVariablePath(t.text);
      return e.next(), { type: "var", name: r, path: o };
    }
    if (t.kind === d.STRING) {
      const r = t.text.startsWith("`"), o = t.value !== void 0 ? t.value : L.parseString(t.text);
      return e.next(), r ? { type: "string", value: `\0TEMPLATE\0${o}` } : { type: "string", value: o };
    }
    if (t.kind === d.NUMBER) {
      const r = t.value !== void 0 ? t.value : parseFloat(t.text);
      return e.next(), { type: "number", value: r };
    }
    if (t.kind === d.BOOLEAN) {
      const r = t.value !== void 0 ? t.value : t.text === "true";
      return e.next(), { type: "literal", value: r };
    }
    if (t.kind === d.NULL)
      return e.next(), { type: "literal", value: null };
    if (X.isSubexpression(e))
      return X.parse(e, {
        parseStatement: n?.parseStatement || (() => null),
        createCodePosition: n?.createCodePosition || I
      });
    if (t.kind === d.LBRACE)
      return z(e, n?.parseStatement || (() => null));
    if (t.kind === d.LBRACKET)
      return z(e, n?.parseStatement || (() => null));
    if (t.kind === d.IDENTIFIER || t.kind === d.KEYWORD) {
      let r = t.text;
      e.next();
      const o = e.save();
      for (; e.check(d.COMMENT); )
        e.next();
      const s = e.current();
      if (s && s.kind === d.DOT) {
        for (e.next(); e.check(d.COMMENT); )
          e.next();
        const a = e.current();
        a && (a.kind === d.IDENTIFIER || a.kind === d.KEYWORD) ? (r = `${r}.${a.text}`, e.next()) : e.restore(o);
      } else
        e.restore(o);
      return { type: "literal", value: r };
    }
    return null;
  }
  /**
   * Parse "into $var" syntax
   */
  static parseInto(e) {
    const n = e.save();
    for (; !e.isAtEnd(); ) {
      const a = e.current();
      if (!a) break;
      if (a.kind === d.COMMENT || a.kind === d.NEWLINE) {
        e.next();
        continue;
      }
      if (a.kind === d.EOF)
        break;
      break;
    }
    const t = e.current();
    if (!t || t.text !== "into")
      return e.restore(n), null;
    for (e.next(); !e.isAtEnd(); ) {
      const a = e.current();
      if (!a) break;
      if (a.kind === d.COMMENT || a.kind === d.NEWLINE) {
        e.next();
        continue;
      }
      if (a.kind === d.EOF)
        break;
      break;
    }
    const r = e.current();
    if (!r || r.kind !== d.VARIABLE)
      return e.restore(n), null;
    const { name: o, path: s } = L.parseVariablePath(r.text);
    return e.next(), { targetName: o, targetPath: s };
  }
  /**
   * Parse callback block (with only)
   */
  static parseCallback(e, n) {
    if (!n?.parseScope)
      return;
    const t = e.save(), r = e.current()?.line;
    let o = 0;
    for (; !e.isAtEnd() && o < 10; ) {
      const s = e.current();
      if (!s || r !== void 0 && s.line !== r)
        break;
      if (s.kind === d.COMMENT) {
        e.next(), o++;
        continue;
      }
      if (s.kind === d.NEWLINE || s.kind === d.EOF)
        break;
      if (s.kind === d.KEYWORD && s.text === "with")
        return n.parseScope(e);
      break;
    }
    e.restore(t);
  }
};
var Ve = class {
  /**
   * Parse a variable assignment statement
   * Expects stream to be positioned at the variable token
   * 
   * @param stream - TokenStream positioned at the variable token
   * @param context - Optional context with helper methods
   * @returns Assignment AST node
   */
  static parse(e, n) {
    let t = e.current();
    if (!t)
      throw new Error("Unexpected end of input while parsing assignment");
    let r = false, o = false, s = false;
    t.kind === d.KEYWORD && (t.text === "set" || t.text === "var" || t.text === "const") && (t.text === "set" ? r = true : t.text === "var" ? o = true : t.text === "const" && (s = true), e.next(), e.skipWhitespaceAndComments());
    const a = e.current();
    if (!a || a.kind !== d.VARIABLE)
      throw new Error(`Expected variable at ${e.formatPosition()}, got ${a?.kind || "end of input"}`);
    const u = a.text, { name: l, path: p } = L.parseVariablePath(u);
    e.next(), e.skipWhitespaceAndComments();
    let c = false, h = false;
    const f = e.current();
    if (!f)
      throw new Error(`Expected '=' or 'as' after variable at ${e.formatPosition()}`);
    if (f.kind === d.ASSIGN)
      e.next();
    else if (f.kind === d.KEYWORD && f.text === "as")
      c = true, e.next();
    else if (r || o || s)
      c = false, h = true;
    else {
      const C = `${f.kind} '${f.text}'`, x = `line ${f.line}, column ${f.column}`;
      throw new Error(`Expected '=' or 'as' after variable at ${x}, found ${C}. Token stream context: ${e.peek(-1)?.text} -> ${f.text}`);
    }
    e.skipWhitespaceAndComments();
    const m = this.parseAssignmentValue(e, n);
    let g = {}, y = m.endToken;
    if (r) {
      e.skipWhitespaceAndComments();
      const C = e.current();
      if (C && C.kind !== d.NEWLINE && C.kind !== d.EOF && C.kind !== d.COMMENT) {
        const x = this.parseFallbackValue(e);
        x && (g = x.data, y = x.endToken);
      }
    }
    const D = I(t, y);
    return {
      type: "assignment",
      targetName: l,
      targetPath: p,
      ...m.assignmentData,
      ...g,
      isSet: r,
      isVar: o,
      isConst: s,
      hasAs: c,
      isImplicit: h,
      codePos: D
    };
  }
  /**
   * Parse a simple fallback value (string, number, boolean, null)
   */
  static parseFallbackValue(e) {
    const n = e.current();
    if (!n) return null;
    if (n.kind === d.STRING) {
      const t = n.text.startsWith("`"), r = L.parseString(n.text);
      return e.next(), {
        data: {
          fallbackValue: t ? `\0TEMPLATE\0${r}` : r,
          fallbackValueType: "string"
        },
        endToken: n
      };
    }
    if (n.kind === d.NUMBER) {
      const t = n.value !== void 0 ? n.value : parseFloat(n.text);
      return e.next(), {
        data: { fallbackValue: t, fallbackValueType: "number" },
        endToken: n
      };
    }
    if (n.kind === d.BOOLEAN) {
      const t = n.value !== void 0 ? n.value : n.text === "true";
      return e.next(), {
        data: { fallbackValue: t, fallbackValueType: "boolean" },
        endToken: n
      };
    }
    return n.kind === d.NULL ? (e.next(), {
      data: { fallbackValue: null, fallbackValueType: "null" },
      endToken: n
    }) : null;
  }
  /**
   * Parse the value part of an assignment
   * Returns the assignment data and the end token
   */
  /**
   * Check if there's a binary operator ahead that would indicate we need parseExpression
   */
  static isBinaryOperatorAhead(e) {
    const n = e.getPosition();
    if (!e.current()) return false;
    for (e.next(); !e.isAtEnd(); ) {
      const s = e.current();
      if (!s) break;
      if (s.kind === d.COMMENT) {
        e.next();
        continue;
      }
      break;
    }
    const r = e.current();
    let o = false;
    return r && (r.kind === d.PLUS || r.kind === d.MINUS || r.kind === d.MULTIPLY || r.kind === d.DIVIDE || r.kind === d.MODULO || r.kind === d.EQ || r.kind === d.NE || r.kind === d.LT || r.kind === d.LTE || r.kind === d.GT || r.kind === d.GTE || r.kind === d.AND || r.kind === d.OR) && (o = true), e.setPosition(n), o;
  }
  static parseAssignmentValue(e, n) {
    const t = e.current();
    if (!t)
      throw new Error("Unexpected end of input while parsing assignment value");
    if (t.kind === d.LPAREN || this.isBinaryOperatorAhead(e)) {
      const s = z(e, n?.parseStatement || (() => null)), a = e.peek(-1) || t;
      return {
        assignmentData: {
          command: {
            type: "command",
            name: "_expr",
            args: [s],
            codePos: s.codePos || I(t, a)
          }
        },
        endToken: a
      };
    }
    if (t.kind === d.VARIABLE && t.text === "$")
      return e.next(), {
        assignmentData: {
          literalValue: null,
          isLastValue: true
        },
        endToken: t
      };
    if (t.kind === d.STRING) {
      const s = [];
      let a = t;
      const u = t.text.startsWith("`"), l = L.parseString(t.text);
      for (s.push(u ? `\0TEMPLATE\0${l}` : l), e.next(); !e.isAtEnd(); ) {
        const c = e.current();
        if (!c) break;
        if (c.kind === d.COMMENT || c.kind === d.NEWLINE && e.peek(1)?.kind !== d.EOF) {
          e.next();
          continue;
        }
        break;
      }
      for (; e.check(d.STRING); ) {
        const c = e.next();
        if (!c) break;
        const h = c.text.startsWith("`"), f = L.parseString(c.text);
        for (s.push(h ? `\0TEMPLATE\0${f}` : f), a = c; !e.isAtEnd(); ) {
          const m = e.current();
          if (!m) break;
          if (m.kind === d.COMMENT || m.kind === d.NEWLINE && e.peek(1)?.kind !== d.EOF) {
            e.next();
            continue;
          }
          break;
        }
      }
      return {
        assignmentData: {
          literalValue: s.join(""),
          literalValueType: "string"
        },
        endToken: a
      };
    }
    if (t.kind === d.NUMBER) {
      const s = t.value !== void 0 ? t.value : parseFloat(t.text);
      return e.next(), {
        assignmentData: {
          literalValue: s,
          literalValueType: "number"
        },
        endToken: t
      };
    }
    if (t.kind === d.BOOLEAN) {
      const s = t.value !== void 0 ? t.value : t.text === "true";
      return e.next(), {
        assignmentData: {
          literalValue: s,
          literalValueType: "boolean"
        },
        endToken: t
      };
    }
    if (t.kind === d.NULL)
      return e.next(), {
        assignmentData: {
          literalValue: null,
          literalValueType: "null"
        },
        endToken: t
      };
    if (t.kind === d.VARIABLE && t.text !== "$") {
      const s = t.text, { name: a, path: u } = L.parseVariablePath(s);
      e.next();
      const l = t;
      return {
        assignmentData: {
          command: {
            type: "command",
            name: "_var",
            args: [{ type: "var", name: a, path: u }],
            codePos: I(t, l)
          }
        },
        endToken: l
      };
    }
    if (X.isSubexpression(e)) {
      const s = X.parse(e, {
        parseStatement: n?.parseStatement || (() => null),
        createCodePosition: n?.createCodePosition || I
      }), a = e.peek(-1) || t;
      return {
        assignmentData: {
          command: {
            type: "command",
            name: "_subexpr",
            args: [s],
            // Pass SubexpressionExpression as arg
            codePos: s.codePos
          }
        },
        endToken: a
      };
    }
    if (t.kind === d.LBRACE) {
      const s = z(e, n?.parseStatement || (() => null)), a = e.current() || t;
      return {
        assignmentData: {
          command: {
            type: "command",
            name: "_object",
            args: [s],
            codePos: s.codePos || I(t, a)
          }
        },
        endToken: a
      };
    }
    if (t.kind === d.LBRACKET) {
      const s = z(e, n?.parseStatement || (() => null)), a = e.current() || t;
      return {
        assignmentData: {
          command: {
            type: "command",
            name: "_array",
            args: [s],
            codePos: s.codePos || I(t, a)
          }
        },
        endToken: a
      };
    }
    const r = Ae.parse(e), o = e.current() || t;
    return {
      assignmentData: {
        command: r
      },
      endToken: o
    };
  }
};
var q = class {
  /**
   * Parse comments from the stream and determine if they should be attached to the next statement
   * or kept as a standalone comment node
   * 
   * Strategy:
   * 1. Collect all consecutive comments
   * 2. After comments, if we hit a newline, check if next token is also newline (blank line)
   * 3. If blank line -> create standalone comment node
   * 4. Otherwise -> return comments to attach to next statement
   * 
   * @param stream - TokenStream positioned at a COMMENT token
   * @returns Object with:
   *   - comments: Array of CommentWithPosition for comments to attach
   *   - commentNode: CommentStatement if comments should be standalone (orphaned)
   *   - consumed: Whether comments were consumed from the stream
   */
  static parseComments(e) {
    const n = e.current();
    if (!n || n.kind !== d.COMMENT)
      return { comments: [], commentNode: null, consumed: false };
    const t = [];
    let r = -1;
    for (; ; ) {
      const u = e.current();
      if (!u || u.kind !== d.COMMENT)
        break;
      e.next(), r === -1 && (r = u.line - 1);
      const l = u.text.startsWith("#") ? u.text.slice(1).trim() : u.text.trim(), p = {
        startRow: u.line - 1,
        startCol: u.column,
        endRow: u.line - 1,
        endCol: u.column + u.text.length - 1
      };
      if (t.push({
        text: l,
        codePos: p,
        inline: false
        // Non-inline comments
      }), e.current()?.kind === d.NEWLINE && e.next(), e.current()?.kind === d.NEWLINE)
        break;
    }
    if (t.length === 0)
      return { comments: [], commentNode: null, consumed: false };
    const o = e.current();
    if (o && o.kind === d.NEWLINE) {
      const u = t.map((p) => p.text).join(`
`), l = {
        startRow: t[0].codePos.startRow,
        startCol: t[0].codePos.startCol,
        endRow: t[t.length - 1].codePos.endRow,
        endCol: t[t.length - 1].codePos.endCol
      };
      return {
        comments: [],
        commentNode: {
          type: "comment",
          comments: [{
            text: u,
            codePos: l,
            inline: false
          }],
          lineNumber: r
        },
        consumed: true
      };
    }
    const s = t.map((u) => u.text).join(`
`), a = {
      startRow: t[0].codePos.startRow,
      startCol: t[0].codePos.startCol,
      endRow: t[t.length - 1].codePos.endRow,
      endCol: t[t.length - 1].codePos.endCol
    };
    return {
      comments: [{
        text: s,
        codePos: a,
        inline: false
      }],
      commentNode: null,
      consumed: true
    };
  }
  /**
   * Parse inline comment from the stream (comment on same line as code)
   * 
   * @param stream - TokenStream positioned at a COMMENT token
   * @param statementLine - Line number of the statement (0-based)
   * @returns CommentWithPosition if inline comment found, null otherwise
   */
  static parseInlineComment(e, n) {
    const t = e.current();
    if (!t || t.kind !== d.COMMENT || t.line - 1 !== n)
      return null;
    const r = t.text.startsWith("#") ? t.text.slice(1).trim() : t.text.trim(), o = {
      startRow: t.line - 1,
      startCol: t.column,
      endRow: t.line - 1,
      endCol: t.column + t.text.length - 1
    };
    return e.next(), {
      text: r,
      codePos: o,
      inline: true
    };
  }
  /**
   * Attach comments to a statement
   */
  static attachComments(e, n) {
    e.comments || (e.comments = []);
    const t = n.filter((o) => !o.inline), r = n.filter((o) => o.inline);
    e.comments.push(...t, ...r);
  }
};
var ft = class {
  /**
   * Parse a 'def' function definition block
   * Expects stream to be positioned at the 'def' keyword
   * 
   * @param stream - TokenStream positioned at the 'def' keyword
   * @param parseStatement - Callback to parse a statement from the stream
   * @param parseComment - Callback to parse a comment from the stream
   * @param decorators - Optional decorators to attach to this function
   * @param environment - Optional environment for executing parse decorators
   * @returns Parsed DefineFunction
   */
  static async parse(e, n, t, r, o) {
    const s = e.current(), a = s && s.kind === d.KEYWORD && s.text === "def", u = s && s.kind === d.KEYWORD && s.text === "define";
    if (!s || !a && !u)
      throw new Error(`Expected 'def' or 'define' keyword at ${e.formatPosition()}`);
    const l = s;
    e.pushContext(H.FUNCTION_DEFINITION);
    try {
      e.next(), e.skipWhitespaceAndComments();
      const p = e.current();
      if (!p || p.kind === d.EOF || p.kind === d.NEWLINE)
        throw new Error(`def block requires a function name at line ${s.line}`);
      if (p.kind !== d.IDENTIFIER && p.kind !== d.KEYWORD)
        throw new Error(`Expected identifier for function name at ${e.formatPosition()}`);
      const c = p.text;
      e.next();
      const h = [], f = [];
      for (; !e.isAtEnd(); ) {
        const w = e.current();
        if (!w) break;
        if (w.kind === d.NEWLINE) {
          e.next();
          break;
        }
        if (w.kind === d.COMMENT) {
          const b = w.value !== void 0 ? String(w.value) : w.text.replace(/^#\s*/, "");
          f.push({
            text: b,
            inline: true,
            codePos: I(w, w)
          }), e.next();
          continue;
        }
        if ((w.kind === d.KEYWORD || w.kind === d.IDENTIFIER) && w.text === "as") {
          e.next(), e.skipWhitespaceAndComments();
          break;
        }
        if (w.kind === d.VARIABLE || L.isVariable(w.text)) {
          const { name: b } = L.parseVariablePath(w.text);
          if (b && /^[A-Za-z_][A-Za-z0-9_]*$/.test(b)) {
            h.push(b), e.next();
            continue;
          }
        }
        break;
      }
      const m = [];
      let g = l, y = -1, D = 0, C = [];
      for (; !e.isAtEnd(); ) {
        const w = e.getPosition();
        if (w === y) {
          if (D++, D > 100) {
            const N = e.current();
            throw new Error(`Infinite loop detected in DefineParser.parse() at position ${w}, token: ${N?.text} (${N?.kind})`);
          }
        } else
          y = w, D = 0;
        const b = e.current();
        if (!b || b.kind === d.EOF) break;
        g = b;
        const v = b.kind === d.KEYWORD && b.text === "def", F = b.kind === d.IDENTIFIER && b.text === "define", T = b.kind === d.KEYWORD && b.text === "on";
        if (v || F || T) {
          const N = new Error(
            `Nested function or event handler definitions are not allowed. Found '${b.text}' at line ${b.line}, column ${b.column}. Function and event handler definitions must be at the top level.`
          );
          throw N.isNestedDefinitionError = true, N;
        }
        if (b.kind === d.KEYWORD && b.text === "enddef") {
          for (e.next(); !e.isAtEnd() && e.current()?.kind !== d.NEWLINE; )
            e.next();
          e.current()?.kind === d.NEWLINE && e.next();
          break;
        }
        if (b.kind === d.NEWLINE) {
          e.next();
          const N = e.current();
          if (N && N.kind === d.NEWLINE && C.length > 0) {
            const B = C.map((Q) => Q.text).join(`
`), M = {
              startRow: C[0].codePos.startRow,
              startCol: C[0].codePos.startCol,
              endRow: C[C.length - 1].codePos.endRow,
              endCol: C[C.length - 1].codePos.endCol
            };
            m.push({
              type: "comment",
              comments: [{
                text: B,
                codePos: M,
                inline: false
              }],
              lineNumber: C[0].codePos.startRow
            }), C = [];
          }
          continue;
        }
        if (b.kind === d.COMMENT) {
          const N = b.text.startsWith("#") ? b.text.slice(1).trim() : b.text.trim(), B = {
            startRow: b.line - 1,
            startCol: b.column,
            endRow: b.line - 1,
            endCol: b.column + b.text.length - 1
          }, M = {
            text: N,
            codePos: B,
            inline: false
          };
          C.push(M), e.next(), e.current()?.kind === d.NEWLINE && e.next();
          continue;
        }
        const S = n(e);
        if (S) {
          if (C.length > 0 && (q.attachComments(S, C), C = []), "codePos" in S && S.codePos) {
            const N = S.codePos.endRow, B = e.current();
            if (B && B.kind === d.COMMENT) {
              const M = B.line - 1;
              if (M === N) {
                const Q = B.text.startsWith("#") ? B.text.slice(1).trim() : B.text.trim(), ge = {
                  startRow: M,
                  startCol: B.column,
                  endRow: M,
                  endCol: B.column + B.text.length - 1
                }, Te = {
                  text: Q,
                  codePos: ge,
                  inline: true
                };
                q.attachComments(S, [Te]), e.next(), e.current()?.kind === d.NEWLINE && e.next();
              }
            }
          }
          m.push(S);
        } else
          e.next();
      }
      if (g === l || g.kind !== d.KEYWORD || g.text !== "enddef")
        throw new Error(`missing enddef for def block starting at line ${l.line}`);
      if (C.length > 0) {
        const w = C.map((v) => v.text).join(`
`), b = {
          startRow: C[0].codePos.startRow,
          startCol: C[0].codePos.startCol,
          endRow: C[C.length - 1].codePos.endRow,
          endCol: C[C.length - 1].codePos.endCol
        };
        m.push({
          type: "comment",
          comments: [{
            text: w,
            codePos: b,
            inline: false
          }],
          lineNumber: C[0].codePos.startRow
        });
      }
      const x = I(l, g), E = {
        type: "define",
        name: c,
        paramNames: h,
        body: m,
        codePos: x
      };
      if (f.length > 0 && (E.comments = f), r && r.length > 0 && (E.decorators = r, o))
        for (const w of r) {
          const b = o.parseDecorators.get(w.name);
          b && await b(E.name, E, w.args, o);
        }
      return E;
    } finally {
      e.popContext();
    }
  }
};
var ht = class {
  /**
   * Parse an 'on' event handler block
   * Expects stream to be positioned at the 'on' keyword
   * 
   * @param stream - TokenStream positioned at the 'on' keyword
   * @param parseStatement - Callback to parse a statement from the stream
   * @param parseComment - Callback to parse a comment from the stream
   * @param decorators - Optional decorators to attach to this event handler
   * @param environment - Optional environment for executing parse decorators
   * @returns Parsed OnBlock
   */
  static async parse(e, n, t, r, o) {
    const s = e.current();
    if (!s || s.kind !== d.KEYWORD || s.text !== "on")
      throw new Error(`Expected 'on' keyword at ${e.formatPosition()}`);
    const a = s;
    e.pushContext(H.BLOCK);
    try {
      e.next(), e.skipWhitespaceAndComments();
      const u = e.current();
      if (!u || u.kind !== d.STRING)
        throw new Error(`Expected string literal for event name at ${e.formatPosition()}`);
      const l = u.value !== void 0 ? String(u.value) : u.text.slice(1, -1);
      e.next();
      const p = [];
      e.skipWhitespaceAndComments();
      const c = e.current();
      if (c && c.kind === d.COMMENT) {
        const w = c.value !== void 0 ? String(c.value) : c.text.replace(/^#\s*/, "");
        p.push({
          text: w,
          inline: true,
          codePos: I(c, c)
        }), e.next();
      }
      const h = u.line;
      for (; !e.isAtEnd(); ) {
        const w = e.current();
        if (!w || w.line > h)
          break;
        if (w.kind === d.NEWLINE) {
          e.next();
          break;
        }
        if (w.kind === d.COMMENT) {
          e.next();
          continue;
        }
        e.next();
      }
      const f = [];
      let m = a, g = -1, y = 0, D = null, C = false;
      for (; !e.isAtEnd(); ) {
        const w = e.getPosition();
        if (w === g) {
          if (y++, y > 100) {
            const N = e.current();
            throw new Error(`Infinite loop detected in EventParser.parse() at position ${w}, token: ${N?.text} (${N?.kind})`);
          }
        } else
          g = w, y = 0;
        const b = e.current();
        if (!b) break;
        m = b;
        const v = b.kind === d.KEYWORD && b.text === "def", F = b.kind === d.KEYWORD && b.text === "define", T = b.kind === d.KEYWORD && b.text === "on";
        if (v || F || T) {
          D && (m = D);
          break;
        }
        if (b.kind === d.KEYWORD && b.text === "endon") {
          for (m = b, e.next(); !e.isAtEnd() && e.current()?.kind !== d.NEWLINE; )
            e.next();
          e.current()?.kind === d.NEWLINE && e.next();
          break;
        }
        if (b.kind === d.NEWLINE) {
          D = b, C = true, e.next();
          continue;
        }
        if (b.kind === d.COMMENT) {
          if (C && f.length > 0) {
            D && (m = D);
            break;
          }
          const N = t(e);
          N && (f.push(N), D = b), C = false;
          continue;
        }
        C = false;
        const S = n(e);
        if (S) {
          if ("codePos" in S && S.codePos) {
            const N = q.parseInlineComment(e, S.codePos.endRow);
            N && q.attachComments(S, [N]);
          }
          f.push(S), D = b;
        } else
          D = b, e.next();
      }
      m === a && D && (m = D);
      const x = I(a, m), E = {
        type: "onBlock",
        eventName: l,
        body: f,
        codePos: x
      };
      if (p.length > 0 && (E.comments = p), r && r.length > 0 && (E.decorators = r, o))
        for (const w of r) {
          const b = o.parseDecorators.get(w.name);
          b && await b(E.eventName, null, w.args, o);
        }
      return E;
    } finally {
      e.popContext();
    }
  }
};
var U = class _U {
  /**
   * Maximum number of iterations allowed before detecting an infinite loop
   */
  static MAX_STUCK_ITERATIONS = 100;
  /**
   * Debug mode flag - set to true to enable logging
   * Can be controlled via VITE_DEBUG environment variable or set programmatically
   */
  static debug = (() => {
    try {
      const e = globalThis.process;
      if (e && e.env?.VITE_DEBUG === "true")
        return true;
      const n = globalThis.import?.meta;
      if (n && n.env?.VITE_DEBUG === "true")
        return true;
    } catch {
    }
    return false;
  })();
  /**
   * Parse a 'do' scope block
   * Expects stream to be positioned at the 'do' keyword
   * 
   * @param stream - TokenStream positioned at the 'do' keyword
   * @param parseStatement - Callback to parse a statement from the stream
   * @param parseComment - Callback to parse a comment from the stream
   * @param decorators - Optional decorators to attach to this do block
   * @returns Parsed ScopeBlock
   */
  static parse(e, n, t, r) {
    const o = e.current(), s = o && o.kind === d.KEYWORD && o.text === "do", a = o && o.kind === d.KEYWORD && o.text === "with";
    if (!o || !s && !a)
      throw new Error(`Expected 'do' keyword at ${e.formatPosition()}`);
    const u = a ? "endwith" : "enddo", l = o, p = e.getPosition();
    if (_U.debug) {
      const c = (/* @__PURE__ */ new Date()).toISOString();
      console.log(`[ScopeParser.parse] [${c}] Starting do block parse at position ${p}, line ${o.line}`);
    }
    e.pushContext(H.BLOCK);
    try {
      e.next();
      const c = [];
      let h = null;
      const f = [], m = [];
      for (; !e.isAtEnd(); ) {
        const T = e.current();
        if (!T) break;
        if (T.kind === d.NEWLINE) {
          e.next();
          break;
        }
        if (T.kind === d.COMMENT) {
          const S = T.value !== void 0 ? String(T.value) : T.text.replace(/^#\s*/, "");
          f.push({
            text: S,
            inline: true,
            codePos: I(T, T)
          }), e.next();
          continue;
        }
        m.push(T), e.next();
      }
      let g = -1;
      for (let T = 0; T < m.length; T++) {
        const S = m[T];
        if (S && S.kind === d.KEYWORD && S.text === "into") {
          g = T;
          break;
        }
      }
      const y = g >= 0 ? g : m.length;
      for (let T = 0; T < y; T++) {
        const S = m[T];
        if (S && S.kind === d.VARIABLE) {
          const { name: N } = L.parseVariablePath(S.text);
          N && /^[A-Za-z_][A-Za-z0-9_]*$/.test(N) && c.push(N);
        }
      }
      if (g >= 0 && g < m.length - 1) {
        const T = m[g + 1];
        if (T && T.kind === d.VARIABLE) {
          const { name: S, path: N } = L.parseVariablePath(T.text);
          h = { targetName: S, targetPath: N };
        }
      }
      const D = [];
      let C = l, x = 0, E = -1, w = 0, b = [];
      for (; !e.isAtEnd(); ) {
        x++;
        const T = e.getPosition(), S = e.current();
        if (!S || S.kind === d.EOF) {
          if (_U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] Reached EOF in do block body at iteration ${x}`);
          }
          break;
        }
        if (C = S, _U.debug) {
          const B = (/* @__PURE__ */ new Date()).toISOString();
          console.log(`[ScopeParser.parse] [${B}] Body iteration ${x}, position: ${T}, token: ${S.text} (${S.kind}), line: ${S.line}`);
        }
        if (T === E) {
          if (w++, _U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] WARNING: Body position stuck at ${T} (count: ${w})`);
          }
          if (w > _U.MAX_STUCK_ITERATIONS) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            throw new Error(`[ScopeParser.parse] [${B}] Infinite loop detected in do block body! Stuck at position ${T} for ${w} iterations. Token: ${S.text} (${S.kind}), line: ${S.line}`);
          }
        } else
          w = 0, E = T;
        if (S.kind === d.KEYWORD && S.text === u) {
          if (_U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] Found '${u}' at position ${T}, closing do block`);
          }
          for (e.next(); !e.isAtEnd() && e.current()?.kind !== d.NEWLINE; )
            e.next();
          e.current()?.kind === d.NEWLINE && e.next();
          break;
        }
        if (S.kind === d.NEWLINE) {
          if (_U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] Skipping newline in do block body`);
          }
          e.next();
          continue;
        }
        if (S.kind === d.COMMENT) {
          if (_U.debug) {
            const M = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${M}] Collecting comment in do block body at position ${T}`);
          }
          const B = S.value !== void 0 ? String(S.value) : S.text.replace(/^#\s*/, "");
          b.push({
            text: B,
            inline: false,
            codePos: I(S, S)
          }), e.next();
          continue;
        }
        if (_U.debug) {
          const B = (/* @__PURE__ */ new Date()).toISOString();
          console.log(`[ScopeParser.parse] [${B}] Parsing statement in do block body at position ${T}`);
        }
        const N = n(e);
        if (N) {
          if (b.length > 0 && (N.comments || (N.comments = []), N.comments = [...b, ...N.comments], b = []), "codePos" in N && N.codePos) {
            const B = q.parseInlineComment(e, N.codePos.endRow);
            B && q.attachComments(N, [B]);
          }
          if (_U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] Parsed statement type: ${N.type} in do block body`);
          }
          D.push(N);
        } else {
          if (_U.debug) {
            const B = (/* @__PURE__ */ new Date()).toISOString();
            console.log(`[ScopeParser.parse] [${B}] WARNING: Could not parse statement in do block body at position ${T}, skipping token: ${S.text}`);
          }
          e.next();
        }
      }
      if (C === l || C.kind !== d.KEYWORD || C.text !== u)
        throw new Error(`missing ${u} for do block starting at line ${l.line}`);
      if (_U.debug) {
        const T = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[ScopeParser.parse] [${T}] Do block body parsing complete. Iterations: ${x}, statements: ${D.length}, final position: ${e.getPosition()}`);
      }
      const v = I(l, C), F = {
        type: "do",
        body: D,
        codePos: v
      };
      if (c.length > 0 && (F.paramNames = c), h && (F.into = h), f.length > 0 && (F.comments = f), r && r.length > 0 && (F.decorators = r), _U.debug) {
        const T = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[ScopeParser.parse] [${T}] Do block parse complete. Start position: ${p}, end position: ${e.getPosition()}, body statements: ${D.length}`);
      }
      return F;
    } finally {
      e.popContext();
    }
  }
};
function Oe(i, e, n) {
  const t = i.current();
  if (!t || t.text !== "for")
    throw new Error(`parseForLoop expected 'for' keyword, got '${t?.text || "EOF"}'`);
  i.next(), i.skipWhitespaceAndComments();
  const r = i.current();
  if (!r || r.kind !== d.VARIABLE)
    throw new Error(`for loop requires a variable at line ${t.line}, column ${t.column}`);
  if (!L.isVariable(r.text))
    throw new Error(`for loop variable must be a variable (e.g., $i, $item) at line ${r.line}, column ${r.column}`);
  const o = L.parseVariablePath(r.text).name;
  i.next();
  let s, a, u, l, p;
  const c = [];
  for (; !i.isAtEnd(); ) {
    const x = i.current();
    if (!x || x.kind === d.NEWLINE) break;
    if (x.kind === d.COMMENT) {
      c.push({
        text: x.value ?? x.text.replace(/^#\s*/, ""),
        inline: true,
        codePos: e.createCodePosition(x, x)
      }), i.next();
      break;
    }
    if (x.kind === d.KEYWORD) {
      const E = x.text;
      if (E === "in" || E === "from" || E === "to" || E === "by" || E === "step" || E === "key") {
        if (i.next(), E === "key") {
          const v = i.current();
          if (!v || v.kind !== d.VARIABLE)
            throw new Error(`'key' keyword must be followed by a variable at line ${x.line}, column ${x.column}`);
          p = L.parseVariablePath(v.text).name, i.next();
          continue;
        }
        const w = [];
        for (; !i.isAtEnd(); ) {
          const v = i.current();
          if (!v || v.kind === d.NEWLINE || v.kind === d.COMMENT) break;
          if (v.kind === d.KEYWORD) {
            const F = v.text;
            if (F === "in" || F === "from" || F === "to" || F === "by" || F === "step" || F === "key")
              break;
          }
          w.push(v), i.next();
        }
        if (w.length === 0)
          throw new Error(`'${E}' keyword requires an expression at line ${x.line}, column ${x.column}`);
        const b = z(new G(w), e.parseStatement, e.parseComment);
        if (E === "in") {
          if (s) throw new Error(`Multiple 'in' keywords in for loop at line ${x.line}`);
          s = b;
        } else if (E === "from") {
          if (a) throw new Error(`Multiple 'from' keywords in for loop at line ${x.line}`);
          a = b;
        } else if (E === "to") {
          if (u) throw new Error(`Multiple 'to' keywords in for loop at line ${x.line}`);
          u = b;
        } else if (E === "by" || E === "step") {
          if (l) throw new Error(`Multiple step keywords ('by' or 'step') in for loop at line ${x.line}`);
          l = b;
        }
        continue;
      }
    }
    throw new Error(`Unexpected token '${x.text}' in for loop header at line ${x.line}, column ${x.column}`);
  }
  if (i.current()?.kind === d.NEWLINE && i.next(), s) {
    if (a || u || l)
      throw new Error(`for loop cannot have both 'in' and range keywords (from, to, by, step) at line ${t.line}`);
  } else {
    if (a && !u) throw new Error(`for loop with 'from' requires 'to' at line ${t.line}`);
    if (u && !a) throw new Error(`for loop with 'to' requires 'from' at line ${t.line}`);
    if (!a && !u) throw new Error(`for loop requires either 'in' or 'from'/'to' at line ${t.line}`);
  }
  const h = [], f = i.current() ?? t;
  let m = f, g = -1, y = 0;
  for (; !i.isAtEnd(); ) {
    const x = i.getPosition();
    if (x === g) {
      if (y++, y > 100) {
        const b = i.current();
        throw console.error(`Infinite loop detected in ForLoopParser at index: ${x}, Token: ${b?.text}`), new Error("Infinite loop in ForLoopParser");
      }
    } else
      g = x, y = 0;
    const E = i.current();
    if (!E || E.kind === d.EOF) break;
    if (m = E, E.kind === d.KEYWORD && E.text === "endfor") {
      for (i.next(); !i.isAtEnd() && i.current()?.kind !== d.NEWLINE; )
        i.next();
      i.current()?.kind === d.NEWLINE && i.next();
      break;
    }
    if (E.kind === d.NEWLINE) {
      let b = 0;
      for (; i.current()?.kind === d.NEWLINE; )
        b++, i.next();
      if (h.length > 0 && b > 1) {
        const v = h[h.length - 1];
        v.trailingBlankLines = (v.trailingBlankLines || 0) + (b - 1);
      }
      continue;
    }
    if (E.kind === d.COMMENT) {
      const b = i.getPosition(), v = e.parseComment(i), F = i.getPosition(), T = i.current()?.kind === d.COMMENT;
      (F === b || T) && i.next(), v && h.push(v);
      continue;
    }
    const w = e.parseStatement(i);
    if (w) {
      if ("codePos" in w && w.codePos) {
        const b = q.parseInlineComment(i, w.codePos.endRow);
        b && q.attachComments(w, [b]);
      }
      h.push(w);
    } else
      i.next();
  }
  if (m === f || m.kind !== d.KEYWORD || m.text !== "endfor")
    throw new Error(`missing endfor for for loop starting at line ${t.line}`);
  const D = e.createCodePosition(t, m), C = {
    type: "forLoop",
    varName: o,
    iterable: s,
    from: a,
    to: u,
    step: l,
    keyVarName: p,
    body: h,
    codePos: D
  };
  return c.length > 0 && (C.comments = c), n && n.length > 0 && (C.decorators = n), C;
}
function Me(i, e, n) {
  const t = i.current();
  if (!t || t.text !== "if")
    throw new Error(`parseIf expected 'if' keyword, got '${t?.text || "EOF"}'`);
  i.next(), i.skipWhitespaceAndComments();
  const r = Qe(i, e);
  for (; !i.isAtEnd() && i.current()?.kind === d.NEWLINE; )
    i.next();
  const o = i.current();
  if (o && o.kind === d.KEYWORD && o.text === "then") {
    let s = 1, a = i.peek(s);
    for (; a && a.kind === d.COMMENT; )
      s++, a = i.peek(s);
    return a && a.kind === d.NEWLINE ? (i.next(), i.skipWhitespaceAndComments(), je(i, t, r, e, n, true)) : mt(i, t, r, e);
  } else
    return je(i, t, r, e, n, false);
}
function Qe(i, e) {
  return z(
    i,
    e.parseStatement,
    e.parseComment
  );
}
function mt(i, e, n, t) {
  const r = i.current();
  if (!r || r.text !== "then")
    throw new Error(`Expected 'then' after if condition at line ${e.line}`);
  const o = r.line;
  for (i.next(); !i.isAtEnd() && i.current()?.kind === d.COMMENT; ) {
    const p = i.current();
    if (p && p.line !== o) break;
    i.next();
  }
  if (i.current()?.kind === d.NEWLINE)
    throw new Error(`Expected command after 'then' on the same line at line ${r.line}`);
  const s = t.parseStatement(i);
  if (!s)
    throw new Error(`Expected command after 'then' at line ${r.line}`);
  let a = i.current() || r;
  for (; !i.isAtEnd(); ) {
    const p = i.current();
    if (!p || p.kind === d.NEWLINE || p.kind === d.KEYWORD && p.text === "else")
      break;
    if (p.kind === d.COMMENT && p.line === o) {
      i.next();
      continue;
    }
    break;
  }
  const u = i.current();
  let l;
  if (u && u.kind === d.KEYWORD && u.text === "else" && u.line === o) {
    for (i.next(); !i.isAtEnd() && i.current()?.kind === d.COMMENT; ) {
      const c = i.current();
      if (c && c.line !== o) break;
      i.next();
    }
    const p = t.parseStatement(i);
    if (!p)
      throw new Error(`Expected command after 'else' at line ${u.line}`);
    l = p, a = i.current() || u;
  }
  return i.current()?.kind === d.NEWLINE && (a = i.current(), i.next()), {
    type: "inlineIf",
    condition: n,
    command: s,
    elseCommand: l,
    codePos: t.createCodePosition(e, a)
  };
}
function je(i, e, n, t, r, o) {
  const s = [], a = [];
  let u, l = false, p, c = e;
  const h = o === true;
  i.current()?.kind === d.NEWLINE && i.next();
  let m = [];
  for (; !i.isAtEnd(); ) {
    const y = i.current();
    if (!y || y.kind === d.EOF) break;
    if (y.kind === d.KEYWORD && y.text === "elseif") {
      const C = y;
      i.next(), i.skipWhitespaceAndComments();
      const x = Qe(i, t);
      let E = false;
      i.skipWhitespaceAndComments(), i.current()?.kind === d.KEYWORD && i.current()?.text === "then" && (E = true, i.next()), i.skipWhitespaceAndComments(), i.current()?.kind === d.NEWLINE && i.next();
      const w = [];
      for (; !i.isAtEnd(); ) {
        const b = i.current();
        if (!b || b.kind === d.EOF || b.kind === d.KEYWORD && (b.text === "elseif" || b.text === "else" || b.text === "endif"))
          break;
        if (b.kind === d.NEWLINE) {
          i.next();
          continue;
        }
        if (b.kind === d.COMMENT) {
          const F = i.getPosition(), T = t.parseComment(i), S = i.getPosition(), N = i.current()?.kind === d.COMMENT;
          (S === F || N) && i.next(), T && w.push(T);
          continue;
        }
        const v = t.parseStatement(i);
        if (v) {
          if ("codePos" in v && v.codePos) {
            const F = q.parseInlineComment(i, v.codePos.endRow);
            F && q.attachComments(v, [F]);
          }
          w.push(v);
        } else
          i.next();
      }
      a.push({
        condition: x,
        body: w,
        hasThen: E,
        keywordPos: t.createCodePosition(C, C)
      });
      continue;
    }
    if (y.kind === d.KEYWORD && y.text === "else") {
      const C = y;
      for (i.next(), i.skipWhitespaceAndComments(), i.current()?.kind === d.KEYWORD && i.current()?.text === "then" && (l = true, i.next()), i.current()?.kind === d.NEWLINE && i.next(); !i.isAtEnd(); ) {
        const x = i.current();
        if (!x || x.kind === d.EOF || x.kind === d.KEYWORD && x.text === "endif")
          break;
        if (x.kind === d.NEWLINE) {
          i.next();
          continue;
        }
        if (x.kind === d.COMMENT) {
          const w = i.getPosition(), b = t.parseComment(i), v = i.getPosition(), F = i.current()?.kind === d.COMMENT;
          (v === w || F) && i.next(), b && (u = u || [], u.push(b));
          continue;
        }
        const E = t.parseStatement(i);
        if (E) {
          if ("codePos" in E && E.codePos) {
            const w = q.parseInlineComment(i, E.codePos.endRow);
            w && q.attachComments(E, [w]);
          }
          u = u || [], u.push(E);
        } else
          i.next();
      }
      p = t.createCodePosition(C, C);
      continue;
    }
    if (y.kind === d.KEYWORD && y.text === "endif") {
      for (c = y, i.next(); !i.isAtEnd(); ) {
        const C = i.current();
        if (!C) break;
        if (C.kind === d.NEWLINE) {
          i.next();
          break;
        }
        if (C.kind === d.RPAREN)
          break;
        i.next();
      }
      break;
    }
    if (y.kind === d.NEWLINE) {
      i.next();
      const C = i.current();
      if (C && C.kind === d.NEWLINE && m.length > 0) {
        const x = m.map((w) => w.text).join(`
`), E = {
          startRow: m[0].codePos.startRow,
          startCol: m[0].codePos.startCol,
          endRow: m[m.length - 1].codePos.endRow,
          endCol: m[m.length - 1].codePos.endCol
        };
        s.push({
          type: "comment",
          comments: [{
            text: x,
            codePos: E,
            inline: false
          }],
          lineNumber: m[0].codePos.startRow
        }), m = [];
      }
      continue;
    }
    if (y.kind === d.COMMENT) {
      const C = y.text.startsWith("#") ? y.text.slice(1).trim() : y.text.trim(), x = {
        startRow: y.line - 1,
        startCol: y.column,
        endRow: y.line - 1,
        endCol: y.column + y.text.length - 1
      }, E = {
        text: C,
        codePos: x,
        inline: false
      };
      m.push(E), i.next(), i.current()?.kind === d.NEWLINE && i.next();
      continue;
    }
    const D = t.parseStatement(i);
    if (D) {
      if (m.length > 0 && (q.attachComments(D, m), m = []), "codePos" in D && D.codePos) {
        const C = D.codePos.endRow, x = i.current();
        if (x && x.kind === d.COMMENT) {
          const E = x.line - 1;
          if (E === C) {
            const w = x.text.startsWith("#") ? x.text.slice(1).trim() : x.text.trim(), b = {
              startRow: E,
              startCol: x.column,
              endRow: E,
              endCol: x.column + x.text.length - 1
            }, v = {
              text: w,
              codePos: b,
              inline: true
            };
            q.attachComments(D, [v]), i.next(), i.current()?.kind === d.NEWLINE && i.next();
          }
        }
      }
      s.push(D);
    } else {
      if (y.kind === d.KEYWORD && (y.text === "endif" || y.text === "else" || y.text === "elseif"))
        continue;
      i.next();
    }
  }
  if (c === e || c.kind !== d.KEYWORD || c.text !== "endif")
    throw new Error(`missing endif for if block starting at line ${e.line}`);
  if (m.length > 0) {
    const y = m.map((C) => C.text).join(`
`), D = {
      startRow: m[0].codePos.startRow,
      startCol: m[0].codePos.startCol,
      endRow: m[m.length - 1].codePos.endRow,
      endCol: m[m.length - 1].codePos.endCol
    };
    s.push({
      type: "comment",
      comments: [{
        text: y,
        codePos: D,
        inline: false
      }],
      lineNumber: m[0].codePos.startRow
    });
  }
  const g = {
    type: "ifBlock",
    condition: n,
    thenBranch: s,
    codePos: t.createCodePosition(e, c)
  };
  return a.length > 0 && (g.elseifBranches = a), u && (g.elseBranch = u), l && (g.elseHasThen = true), p && (g.elseKeywordPos = p), r && r.length > 0 && (g.decorators = r), h && (g.hasThen = true), g;
}
function qe(i, e) {
  const n = i.current();
  if (!n || n.text !== "return")
    throw new Error(`parseReturn expected 'return' keyword, got '${n?.text || "EOF"}'`);
  i.next();
  const t = i.current();
  if (!t)
    return {
      type: "return",
      value: { type: "literal", value: null },
      codePos: e.createCodePosition(n, n)
    };
  if (t.kind === d.NEWLINE || t.kind === d.EOF || t.kind === d.COMMENT)
    return {
      type: "return",
      value: { type: "literal", value: null },
      codePos: e.createCodePosition(n, n)
    };
  const r = gt(i, e), o = i.current() || n;
  return {
    type: "return",
    value: r,
    codePos: e.createCodePosition(n, o)
  };
}
function gt(i, e) {
  const n = i.current();
  if (!n)
    throw new Error("Expected return value");
  if (n.kind === d.VARIABLE)
    if (n.text === "$") {
      if (X.isSubexpression(i)) {
        if (!e.parseStatement)
          throw new Error("parseStatement callback required for subexpressions in return statements");
        return X.parse(i, {
          parseStatement: e.parseStatement,
          createCodePosition: e.createCodePosition
        });
      }
      return i.next(), { type: "lastValue" };
    } else {
      const { name: t, path: r } = L.parseVariablePath(n.text);
      return i.next(), { type: "var", name: t, path: r };
    }
  if (n.kind === d.STRING) {
    const t = n.text.startsWith("`"), r = n.value !== void 0 ? n.value : L.parseString(n.text);
    return i.next(), t ? { type: "string", value: `\0TEMPLATE\0${r}` } : { type: "string", value: r };
  }
  if (n.kind === d.NUMBER) {
    const t = n.value !== void 0 ? n.value : parseFloat(n.text);
    return i.next(), { type: "number", value: t };
  }
  if (n.kind === d.BOOLEAN) {
    const t = n.value !== void 0 ? n.value : n.text === "true";
    return i.next(), { type: "literal", value: t };
  }
  if (n.kind === d.NULL)
    return i.next(), { type: "literal", value: null };
  if (n.kind === d.SUBEXPRESSION_OPEN) {
    if (!e.parseStatement)
      throw new Error("parseStatement callback required for subexpressions in return statements");
    return X.parse(i, {
      parseStatement: e.parseStatement,
      createCodePosition: e.createCodePosition
    });
  }
  if (n.kind === d.LBRACE)
    return z(i, e.parseStatement || (() => null));
  if (n.kind === d.LBRACKET)
    return z(i, e.parseStatement || (() => null));
  if (n.kind === d.IDENTIFIER || n.kind === d.KEYWORD) {
    let t = 1, r = i.peek(t);
    for (; r && r.kind === d.COMMENT; )
      t++, r = i.peek(t);
    if (!r || r.kind === d.NEWLINE || r.kind === d.EOF) {
      const s = n.text;
      return i.next(), { type: "literal", value: s };
    }
    if (e.parseStatement) {
      const s = i.getPosition();
      try {
        const a = e.parseStatement(i);
        if (a && a.type === "command")
          return {
            type: "subexpression",
            body: [a],
            codePos: e.createCodePosition(n, i.current() || n)
          };
        i.setPosition(s);
      } catch {
        i.setPosition(s);
      }
    }
    const o = n.text;
    return i.next(), { type: "literal", value: o };
  }
  throw new Error(`Unexpected token in return value: ${n.kind} '${n.text}' at line ${n.line}, column ${n.column}`);
}
function We(i, e) {
  const n = i.current();
  if (!n || n.text !== "break")
    throw new Error(`parseBreak expected 'break' keyword, got '${n?.text || "EOF"}'`);
  i.next();
  let t = n;
  const r = i.current();
  return r && r.kind !== d.NEWLINE && r.kind !== d.EOF && (t = r), {
    type: "break",
    codePos: e.createCodePosition(n, t)
  };
}
function Ue(i, e) {
  const n = i.current();
  if (!n || n.text !== "continue")
    throw new Error(`parseContinue expected 'continue' keyword, got '${n?.text || "EOF"}'`);
  i.next();
  let t = n;
  const r = i.current();
  return r && r.kind !== d.NEWLINE && r.kind !== d.EOF && (t = r), {
    type: "continue",
    codePos: e.createCodePosition(n, t)
  };
}
function yt(i, e, n) {
  const t = i.current();
  if (!t || t.text !== "together")
    throw new Error(`parseTogether expected 'together' keyword, got '${t?.text || "EOF"}'`);
  const r = t, o = [];
  for (i.next(); !i.isAtEnd(); ) {
    const h = i.current();
    if (!h) break;
    if (h.kind === d.NEWLINE) {
      i.next();
      break;
    }
    if (h.kind === d.COMMENT) {
      const f = h.value !== void 0 ? String(h.value) : h.text.replace(/^#\s*/, "");
      o.push({
        text: f,
        inline: true,
        codePos: e.createCodePosition(h, h)
      }), i.next();
      continue;
    }
    i.next();
  }
  const s = [];
  let a = r, u = -1, l = 0;
  for (; !i.isAtEnd(); ) {
    const h = i.getPosition();
    if (h === u) {
      if (l++, l > 100) {
        const g = i.current();
        throw new Error(`Infinite loop detected in TogetherBlockParser at index ${h}, token: ${g?.text}`);
      }
    } else
      u = h, l = 0;
    const f = i.current();
    if (!f || f.kind === d.EOF) break;
    if (a = f, f.kind === d.KEYWORD && f.text === "endtogether") {
      for (i.next(); !i.isAtEnd() && i.current()?.kind !== d.NEWLINE; )
        i.next();
      i.current()?.kind === d.NEWLINE && i.next();
      break;
    }
    if (f.kind === d.NEWLINE) {
      i.next();
      continue;
    }
    if (f.kind === d.COMMENT) {
      const g = i.getPosition();
      e.parseComment(i);
      const y = i.getPosition(), D = i.current()?.kind === d.COMMENT;
      (y === g || D) && i.next();
      continue;
    }
    const m = e.parseStatement(i);
    if (m && m.type === "do")
      s.push(m);
    else {
      if (m)
        throw new Error(`together block can only contain do blocks at line ${f.line}, column ${f.column}. Found statement type: ${m.type}`);
      i.next();
    }
  }
  if (a === r || a.kind !== d.KEYWORD || a.text !== "endtogether")
    throw new Error(`missing endtogether for together block starting at line ${r.line}`);
  const p = e.createCodePosition(r, a), c = {
    type: "together",
    blocks: s,
    codePos: p
  };
  return o.length > 0 && (c.comments = o), n && n.length > 0 && (c.decorators = n), c;
}
function Dt(i, e) {
  const n = i.current();
  if (!n || n.kind !== d.DECORATOR)
    return null;
  const t = n.text.startsWith("@") ? n.text.slice(1) : n.text;
  i.next(), i.skipWhitespaceAndComments();
  const r = [];
  let o = n;
  const s = n.line;
  for (; !i.isAtEnd(); ) {
    const u = i.current();
    if (!u || u.kind === d.EOF)
      break;
    if (u.kind === d.NEWLINE) {
      o = u;
      break;
    }
    if (u.line !== s)
      break;
    if (u.kind === d.COMMENT) {
      i.next();
      continue;
    }
    const l = Ae.parseArgumentValue(i, {
      parseStatement: e.parseStatement,
      createCodePosition: (p, c) => ({
        startRow: p.line - 1,
        startCol: p.column,
        endRow: c.line - 1,
        endCol: c.column + (c.text.length > 0 ? c.text.length - 1 : 0)
      })
    });
    if (l) {
      r.push(l), o = u, i.skipWhitespaceAndComments();
      const p = i.current();
      if (!p || p.kind === d.NEWLINE || p.kind === d.EOF || p.line !== s)
        break;
    } else
      break;
  }
  const a = {
    startRow: n.line - 1,
    startCol: n.column,
    endRow: o.line - 1,
    endCol: o.column + (o.text.length > 0 ? o.text.length - 1 : 0)
  };
  return {
    name: t,
    args: r,
    codePos: a
  };
}
function Ke(i, e) {
  const n = [];
  for (; !i.isAtEnd(); ) {
    const r = i.current();
    if (!r) break;
    if (r.kind === d.NEWLINE) {
      i.next();
      continue;
    }
    if (r.kind === d.COMMENT) {
      const o = e.parseComment(i);
      i.next();
      continue;
    }
    if (r.kind === d.DECORATOR) {
      const o = Dt(i, e);
      if (o) {
        n.push(o);
        const s = i.current();
        s && s.kind === d.NEWLINE && i.next();
        continue;
      }
    }
    break;
  }
  i.skipWhitespaceAndComments();
  const t = i.current();
  return {
    decorators: n,
    positionAfter: i.getPosition(),
    nextToken: t
  };
}
function ue(i) {
  if (!i.trim().startsWith("---"))
    return null;
  const n = /^\s*---cell\s+([A-Za-z_][A-Za-z0-9_]*)\b(.*?)---\s*$/, t = i.match(n);
  if (t) {
    const u = t[1], l = t[2].trim(), p = ze(l);
    return { kind: "cell_open", cellType: u, meta: p };
  }
  if (/^\s*---end---\s*$/.test(i))
    return { kind: "cell_end" };
  const o = /^\s*---\s*chunk:([A-Za-z0-9_][A-Za-z0-9_-]*)\b(.*?)---\s*$/, s = i.match(o);
  if (s) {
    const u = s[1], l = s[2].trim(), p = ze(l);
    return { kind: "chunk_marker", id: u, meta: p };
  }
  return /^\s*---\s*$/.test(i) ? { kind: "prompt_fence" } : null;
}
function ze(i) {
  const e = {};
  if (!i || i.trim().length === 0)
    return e;
  const n = i.split(/\s+/).filter((t) => t.length > 0);
  for (const t of n)
    if (t.includes(":")) {
      const r = t.indexOf(":"), o = t.substring(0, r).trim(), s = t.substring(r + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(o))
        continue;
      let a = s;
      (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) && (a = s.slice(1, -1)), e[o] = a;
    } else if (t.includes("=")) {
      const r = t.indexOf("="), o = t.substring(0, r).trim(), s = t.substring(r + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(o))
        continue;
      let a = s;
      (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) && (a = s.slice(1, -1)), e[o] = a;
    }
  return e;
}
function He(i, e) {
  const n = i.current();
  if (!n || n.text !== "-")
    return null;
  const t = e.split(`
`), r = n.line - 1;
  if (r < 0 || r >= t.length)
    return null;
  const o = t[r], s = ue(o);
  if (!s || s.kind !== "chunk_marker") {
    const y = o.trim();
    if (y.startsWith("---") && y.includes("chunk:"))
      throw new Error(
        `Invalid chunk marker syntax at line ${n.line}, column ${n.column + 1}: ${o}
Expected format: --- chunk:<id> [key:value ...] ---`
      );
    return null;
  }
  const { id: a, meta: u } = s;
  if (o.includes("#")) {
    const y = o.indexOf("#"), D = o.substring(0, y).trim();
    if (o.substring(y).trim() && !D.endsWith("---"))
      throw new Error(
        `Chunk marker line cannot contain inline comments. Found at line ${n.line}, column ${y + 1}: ${o}`
      );
  }
  const l = n.line - 1, p = o.length - o.trimStart().length, c = l, h = p + o.trim().length - 1, f = {
    startRow: l,
    startCol: p,
    endRow: c,
    endCol: h
  }, m = n.line;
  for (; !i.isAtEnd(); ) {
    const y = i.current();
    if (!y || y.line > m)
      break;
    i.next();
  }
  const g = {
    type: "chunk_marker",
    id: a,
    codePos: f,
    raw: o.trim()
  };
  return Object.keys(u).length > 0 && (g.meta = u), g;
}
async function Et(i, e, n) {
  const t = i.current();
  if (!t) return null;
  const r = e.split(`
`), o = t.line - 1;
  if (o < 0 || o >= r.length)
    return null;
  const s = r[o], a = ue(s);
  if (!a || a.kind !== "cell_open")
    return null;
  const { cellType: u, meta: l } = a, p = t.line - 1, c = s.length - s.trimStart().length, h = p, f = c + s.trim().length - 1, m = {
    startRow: p,
    startCol: c,
    endRow: h,
    endCol: f
  }, g = t.line;
  for (; !i.isAtEnd(); ) {
    const B = i.current();
    if (!B || B.line > g)
      break;
    i.next();
  }
  const y = [];
  let D = -1, C = -1, x = false, E = -1;
  for (; !i.isAtEnd(); ) {
    const B = i.current();
    if (!B) break;
    const M = B.line - 1;
    if (M < 0 || M >= r.length)
      break;
    const Q = r[M], ge = ue(Q);
    if (ge && ge.kind === "cell_end") {
      x = true, E = M;
      const ye = B.line;
      for (; !i.isAtEnd(); ) {
        const Le = i.current();
        if (!Le || Le.line > ye)
          break;
        i.next();
      }
      break;
    }
    D === -1 && (D = M), C = M, y.push(Q);
    const Te = B.line;
    for (; !i.isAtEnd(); ) {
      const ye = i.current();
      if (!ye || ye.line > Te)
        break;
      i.next();
    }
  }
  if (!x)
    throw new Error(
      `Unterminated cell block starting at line ${t.line}. Expected ---end--- but reached end of file.`
    );
  const w = y.join(`
`), b = y.length > 0 ? r[D].length - r[D].trimStart().length : 0, v = y.length > 0 ? r[C].length - 1 : 0, F = {
    startRow: D >= 0 ? D : h + 1,
    startCol: b,
    endRow: C >= 0 ? C : h,
    endCol: v
  }, T = x && E >= 0 ? E : h, S = {
    startRow: p,
    startCol: c,
    endRow: T,
    endCol: r[T]?.length - 1 || f
  };
  let N;
  if (u === "code" && w.trim().length > 0)
    try {
      const M = await new W(w).parse();
      M && Array.isArray(M) && (N = M);
    } catch {
    }
  return {
    type: "cell",
    cellType: u,
    meta: l,
    rawBody: w,
    body: N,
    headerPos: m,
    bodyPos: F,
    codePos: S
  };
}
function Je(i, e) {
  const n = i.current();
  if (!n) return null;
  const t = e.split(`
`), r = n.line - 1;
  if (r < 0 || r >= t.length)
    return null;
  const o = t[r], s = ue(o);
  if (!s || s.kind !== "prompt_fence")
    return null;
  const a = n.line - 1, u = o.length - o.trimStart().length, l = a, p = u + o.trim().length - 1, c = {
    startRow: a,
    startCol: u,
    endRow: l,
    endCol: p
  }, h = n.line;
  for (; !i.isAtEnd(); ) {
    const N = i.current();
    if (!N || N.line > h)
      break;
    i.next();
  }
  const f = [];
  let m = -1, g = -1, y = false, D = -1;
  for (let N = r + 1; N < t.length; N++) {
    const B = t[N], M = ue(B);
    if (M && M.kind === "prompt_fence") {
      for (y = true, D = N; !i.isAtEnd(); ) {
        const Q = i.current();
        if (!Q || Q.line - 1 > D)
          break;
        i.next();
      }
      break;
    }
    m === -1 && (m = N), g = N, f.push(B);
  }
  if (!y)
    throw new Error(
      `Unterminated prompt block starting at line ${n.line}. Expected closing --- but reached end of file.`
    );
  const C = f.join(`
`), x = f.length > 0 ? t[m].length - t[m].trimStart().length : 0, E = f.length > 0 ? t[g].length - 1 : 0, w = {
    startRow: m >= 0 ? m : l + 1,
    startCol: x,
    endRow: g >= 0 ? g : l,
    endCol: E
  }, b = t[D], v = b.length - b.trimStart().length, F = v + b.trim().length - 1;
  return {
    type: "prompt_block",
    rawText: C,
    fence: "---",
    codePos: {
      startRow: a,
      startCol: u,
      endRow: D,
      endCol: F
    },
    openPos: c,
    bodyPos: w,
    closePos: {
      startRow: D,
      startCol: v,
      endRow: D,
      endCol: F
    }
  };
}
var W = class _W {
  tokens;
  stream;
  source;
  // Store source for blank line counting
  extractedFunctions = [];
  extractedEventHandlers = [];
  extractedVariables = [];
  environment = null;
  // Optional environment for parse decorators
  decoratorBuffer = [];
  // Buffer for unclaimed decorators
  pendingComments = [];
  // Comments to attach to next statement
  /**
   * Maximum number of iterations allowed before detecting an infinite loop
   */
  static MAX_STUCK_ITERATIONS = 100;
  /**
   * Debug mode flag - set to true to enable logging
   * Can be controlled via VITE_DEBUG environment variable or set programmatically
   */
  static debug = (() => {
    try {
      const e = globalThis.process;
      if (e && e.env?.VITE_DEBUG === "true")
        return true;
      const n = globalThis.import?.meta;
      if (n && n.env?.VITE_DEBUG === "true")
        return true;
    } catch {
    }
    return false;
  })();
  /**
   * Create a new Parser
   * @param source - Full source code as a single string
   * @param environment - Optional environment for executing parse decorators
   */
  constructor(e, n) {
    this.source = e, this.tokens = ct.tokenizeFull(e), this.stream = new G(this.tokens), this.environment = n || null;
  }
  /**
   * Parse the source code into an AST
   * @returns Array of statements
   */
  async parse() {
    this.stream = new G(this.tokens), this.decoratorBuffer = [];
    const e = [];
    let n = 0, t = -1, r = 0;
    for (; !this.stream.isAtEnd(); ) {
      n++;
      const o = this.stream.getPosition(), s = this.stream.current();
      if (_W.debug) {
        const a = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[Parser.parse] [${a}] Iteration ${n}, position: ${o}, token: ${s?.text || "null"} (${s?.kind || "EOF"}), line: ${s?.line || "N/A"}`);
      }
      if (o === t) {
        if (r++, r > _W.MAX_STUCK_ITERATIONS) {
          const a = this.stream.getCurrentContext();
          throw new Error(
            `[Parser.parse] Infinite loop detected! Stuck at position ${o}.
  Token: ${s?.text || "null"} (${s?.kind || "EOF"})
  Context: ${a}`
          );
        }
      } else
        r = 0, t = o, this.stream.resetStuckDetection();
      if (this.stream.check(d.NEWLINE)) {
        this.stream.next();
        continue;
      }
      if (s) {
        const a = this.source.split(`
`), u = s.line - 1;
        if (u >= 0 && u < a.length) {
          const p = a[u];
          if (p.trim().startsWith("---")) {
            const h = ue(p);
            if (h) {
              if (h.kind === "cell_open") {
                const f = await Et(
                  this.stream,
                  this.source
                );
                if (f) {
                  f.nodeKey = `root-${e.length}`, this.pendingComments.length > 0 && (q.attachComments(f, this.pendingComments), this.pendingComments = []), e.push(f);
                  continue;
                }
              } else if (h.kind === "chunk_marker") {
                const f = He(this.stream, this.source);
                if (f) {
                  f.nodeKey = `root-${e.length}`, this.pendingComments.length > 0 && (q.attachComments(f, this.pendingComments), this.pendingComments = []), e.push(f);
                  continue;
                }
              } else if (h.kind === "prompt_fence") {
                const f = Je(this.stream, this.source);
                if (f) {
                  f.nodeKey = `root-${e.length}`, this.pendingComments.length > 0 && (q.attachComments(f, this.pendingComments), this.pendingComments = []), e.push(f);
                  continue;
                }
              }
            }
          }
        }
        if (this.stream.check(d.COMMENT)) {
          const p = q.parseComments(this.stream);
          p.consumed && (p.commentNode ? (p.commentNode.nodeKey = `root-${e.length}`, e.push(p.commentNode)) : p.comments.length > 0 && this.pendingComments.push(...p.comments));
          continue;
        }
        if (s?.kind === d.DECORATOR) {
          const p = Ke(this.stream, {
            parseStatement: (c) => this.parseStatementFromStream(c),
            parseComment: (c) => this.parseCommentFromStream(c)
          });
          this.decoratorBuffer.push(...p.decorators);
          continue;
        }
        const l = await this.parseStatement();
        if (l)
          l.nodeKey = `root-${e.length}`, this.pendingComments.length > 0 && (q.attachComments(l, this.pendingComments), this.pendingComments = []), this.attachInlineComments(l), this.countTrailingBlankLines(l), e.push(l);
        else if (!this.stream.next()) break;
      }
    }
    if (this.pendingComments.length > 0) {
      const o = this.pendingComments.map((a) => a.text).join(`
`), s = {
        startRow: this.pendingComments[0].codePos.startRow,
        startCol: this.pendingComments[0].codePos.startCol,
        endRow: this.pendingComments[this.pendingComments.length - 1].codePos.endRow,
        endCol: this.pendingComments[this.pendingComments.length - 1].codePos.endCol
      };
      e.push({
        type: "comment",
        nodeKey: `root-${e.length}`,
        comments: [{
          text: o,
          codePos: s,
          inline: false
        }],
        lineNumber: this.pendingComments[0].codePos.startRow
      }), this.pendingComments = [];
    }
    for (const o of e)
      if (o.type === "define" || o.type === "do" || o.type === "forLoop") {
        const s = o;
        s.body && s.nodeKey && this.assignBodyNodeKeys(s.body, s.nodeKey);
      } else if (o.type === "onBlock") {
        const s = o;
        s.body && s.nodeKey && this.assignBodyNodeKeys(s.body, s.nodeKey);
      } else if (o.type === "ifBlock") {
        const s = o;
        if (s.nodeKey) {
          if (s.thenBranch && this.assignBodyNodeKeys(s.thenBranch, `${s.nodeKey}-then`), s.elseifBranches)
            for (let a = 0; a < s.elseifBranches.length; a++) {
              const u = s.elseifBranches[a];
              u.body && this.assignBodyNodeKeys(u.body, `${s.nodeKey}-elseif-${a}`);
            }
          s.elseBranch && this.assignBodyNodeKeys(s.elseBranch, `${s.nodeKey}-else`);
        }
      } else if (o.type === "together") {
        const s = o;
        if (s.doBlocks && s.nodeKey)
          for (let a = 0; a < s.doBlocks.length; a++) {
            const u = s.doBlocks[a];
            u.body && this.assignBodyNodeKeys(u.body, `${s.nodeKey}-do-${a}`);
          }
      } else if (o.type === "command") {
        const s = o;
        s.body && Array.isArray(s.body) && s.nodeKey && this.assignBodyNodeKeys(s.body, s.nodeKey);
      }
    return e;
  }
  /**
   * Parse a statement from a stream with hierarchical nodeKey support
   */
  parseStatementFromStream(e, n) {
    const t = e.current();
    if (!t) return null;
    const r = this.source.split(`
`), o = t.line - 1;
    if (o >= 0 && o < r.length) {
      const s = r[o];
      if (s.trim().startsWith("---")) {
        const u = ue(s);
        if (u) {
          if (u.kind === "prompt_fence") {
            const l = Je(e, this.source);
            if (l)
              return n && (l.nodeKey = n), l;
          } else if (u.kind === "chunk_marker") {
            const l = He(e, this.source);
            if (l)
              return n && (l.nodeKey = n), l;
          }
        }
      }
    }
    if (t.kind === d.DECORATOR) {
      const a = Ke(e, {
        parseStatement: (l) => this.parseStatementFromStream(l),
        parseComment: (l) => this.parseCommentFromStream(l)
      }).decorators, u = this.parseStatementFromStream(e, n);
      if (u) {
        if (u.decorators = a, u.type === "assignment") {
          const l = u;
          (!l.targetPath || l.targetPath.length === 0) && this.trackVariable(l);
        }
        return u;
      }
      return null;
    }
    if (t.kind === d.KEYWORD && (t.text === "set" || t.text === "var" || t.text === "const") || t.kind === d.VARIABLE) {
      const s = Ve.parse(e, {
        parseStatement: (a) => this.parseStatementFromStream(a),
        createCodePosition: (a, u) => ({
          startRow: a.line - 1,
          startCol: a.column,
          endRow: u.line - 1,
          endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
        })
      });
      if (s && n && (s.nodeKey = n), s && s.type === "assignment" && !s.decorators) {
        const a = s;
        (!a.targetPath || a.targetPath.length === 0) && this.trackVariable(a);
      }
      return s;
    }
    if (t.kind === d.KEYWORD) {
      if (t.text === "return") {
        const s = qe(e, {
          parseStatement: (a) => this.parseStatementFromStream(a),
          createCodePosition: (a, u) => ({
            startRow: a.line - 1,
            startCol: a.column,
            endRow: u.line - 1,
            endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
          })
        });
        return s && n && (s.nodeKey = n), s;
      }
      if (t.text === "break") {
        const s = We(e, {
          createCodePosition: (a, u) => ({
            startRow: a.line - 1,
            startCol: a.column,
            endRow: u.line - 1,
            endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
          })
        });
        return s && n && (s.nodeKey = n), s;
      }
      if (t.text === "continue") {
        const s = Ue(e, {
          createCodePosition: (a, u) => ({
            startRow: a.line - 1,
            startCol: a.column,
            endRow: u.line - 1,
            endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
          })
        });
        return s && n && (s.nodeKey = n), s;
      }
      if (t.text === "if") {
        const s = Me(e, {
          parseStatement: (a) => this.parseStatementFromStream(a),
          parseComment: (a) => this.parseCommentFromStream(a),
          createCodePosition: (a, u) => ({
            startRow: a.line - 1,
            startCol: a.column,
            endRow: u.line - 1,
            endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
          })
        });
        return s && n && (s.nodeKey = n), s;
      }
      if (t.text === "for") {
        const s = Oe(e, {
          parseStatement: (a) => this.parseStatementFromStream(a),
          parseComment: (a) => this.parseCommentFromStream(a),
          createCodePosition: (a, u) => ({
            startRow: a.line - 1,
            startCol: a.column,
            endRow: u.line - 1,
            endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
          })
        });
        return s && n && (s.nodeKey = n), s;
      }
      if (t.text === "do") {
        const s = U.parse(
          e,
          (a) => this.parseStatementFromStream(a),
          (a) => this.parseCommentFromStream(a)
        );
        return s && n && (s.nodeKey = n), s;
      }
    }
    if (t.kind === d.IDENTIFIER || t.kind === d.KEYWORD) {
      const s = Ae.parse(e, {
        parseStatement: (a) => this.parseStatementFromStream(a),
        createCodePosition: (a, u) => ({
          startRow: a.line - 1,
          startCol: a.column,
          endRow: u.line - 1,
          endCol: u.column + (u.text.length > 0 ? u.text.length - 1 : 0)
        }),
        parseScope: (a) => U.parse(
          a,
          (u) => this.parseStatementFromStream(u),
          (u) => this.parseCommentFromStream(u),
          void 0
        )
      });
      return s && n && (s.nodeKey = n), s;
    }
    if (t.kind === d.STRING) {
      const s = t.text.startsWith("`"), a = t.value !== void 0 ? t.value : t.text.slice(1, -1), u = s ? `\0TEMPLATE\0${a}` : a;
      e.next();
      const l = {
        type: "command",
        name: "_literal",
        args: [{ type: "string", value: u }],
        codePos: { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column + t.text.length - 1 }
      };
      return n && (l.nodeKey = n), l;
    }
    if (t.kind === d.NUMBER) {
      const s = t.value !== void 0 ? t.value : parseFloat(t.text);
      e.next();
      const a = {
        type: "command",
        name: "_literal",
        args: [{ type: "number", value: s }],
        codePos: { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column + t.text.length - 1 }
      };
      return n && (a.nodeKey = n), a;
    }
    if (t.kind === d.BOOLEAN) {
      const s = t.value !== void 0 ? t.value : t.text === "true";
      e.next();
      const a = {
        type: "command",
        name: "_literal",
        args: [{ type: "literal", value: s }],
        codePos: { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column + t.text.length - 1 }
      };
      return n && (a.nodeKey = n), a;
    }
    if (t.kind === d.NULL) {
      e.next();
      const s = {
        type: "command",
        name: "_literal",
        args: [{ type: "literal", value: null }],
        codePos: { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column + t.text.length - 1 }
      };
      return n && (s.nodeKey = n), s;
    }
    if (t.kind === d.LBRACE) {
      const s = z(e, (u) => this.parseStatementFromStream(u)), a = {
        type: "command",
        name: "_object",
        args: [s],
        codePos: s.codePos || { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column }
      };
      return n && (a.nodeKey = n), a;
    }
    if (t.kind === d.LBRACKET) {
      const s = z(e, (u) => this.parseStatementFromStream(u)), a = {
        type: "command",
        name: "_array",
        args: [s],
        codePos: s.codePos || { startRow: t.line - 1, startCol: t.column, endRow: t.line - 1, endCol: t.column }
      };
      return n && (a.nodeKey = n), a;
    }
    return null;
  }
  /**
   * Get extracted function definitions (def/enddef blocks)
   */
  getExtractedFunctions() {
    return this.extractedFunctions;
  }
  /**
   * Get extracted event handlers (on/endon blocks)
   */
  getExtractedEventHandlers() {
    return this.extractedEventHandlers;
  }
  /**
   * Get extracted variables (from assignments)
   */
  getExtractedVariables() {
    return this.extractedVariables;
  }
  /**
   * Track a variable from an assignment statement
   */
  trackVariable(e) {
    const n = e.targetName, t = this.extractedVariables.findIndex((s) => s.name === n);
    let r;
    if (e.decorators) {
      const s = e.decorators.find((a) => a.name === "description");
      if (s && s.args && s.args.length > 0) {
        const a = s.args[0];
        typeof a == "object" && a !== null ? "value" in a ? r = String(a.value) : "code" in a && (r = String(a.code)) : r = String(a);
      }
    }
    const o = {
      name: n,
      description: r,
      initialValue: e.literalValue,
      codePos: e.codePos
    };
    if (t >= 0) {
      const s = this.extractedVariables[t];
      this.extractedVariables[t] = {
        ...o,
        description: o.description || s.description
      };
    } else
      this.extractedVariables.push(o);
  }
  /**
   * Parse a single statement
   */
  async parseStatement() {
    const e = this.stream.current();
    if (!e) return null;
    if (e.kind === d.KEYWORD && (e.text === "set" || e.text === "var" || e.text === "const") || e.kind === d.VARIABLE) {
      const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
      this.decoratorBuffer = [];
      const t = Ve.parse(this.stream, {
        parseStatement: (r) => this.parseStatementFromStream(r),
        createCodePosition: (r, o) => ({
          startRow: r.line - 1,
          startCol: r.column,
          endRow: o.line - 1,
          endCol: o.column + (o.text.length > 0 ? o.text.length - 1 : 0)
        })
      });
      if (t && n && (t.decorators = n, this.environment && t.type === "assignment")) {
        const r = t;
        for (const o of n) {
          const s = this.environment.parseDecorators.get(o.name);
          s && s(r.targetName, null, o.args, this.environment);
        }
      }
      if (t && t.type === "assignment") {
        const r = t;
        (!r.targetPath || r.targetPath.length === 0) && this.trackVariable(r);
      }
      return t;
    }
    if (e.kind === d.KEYWORD) {
      if (e.text === "return")
        return qe(this.stream, {
          parseStatement: (n) => this.parseStatementFromStream(n),
          createCodePosition: (n, t) => ({
            startRow: n.line - 1,
            startCol: n.column,
            endRow: t.line - 1,
            endCol: t.column + (t.text.length > 0 ? t.text.length - 1 : 0)
          })
        });
      if (e.text === "break")
        return We(this.stream, {
          createCodePosition: (n, t) => ({
            startRow: n.line - 1,
            startCol: n.column,
            endRow: t.line - 1,
            endCol: t.column + (t.text.length > 0 ? t.text.length - 1 : 0)
          })
        });
      if (e.text === "continue")
        return Ue(this.stream, {
          createCodePosition: (n, t) => ({
            startRow: n.line - 1,
            startCol: n.column,
            endRow: t.line - 1,
            endCol: t.column + (t.text.length > 0 ? t.text.length - 1 : 0)
          })
        });
      if (e.text === "if") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        return this.decoratorBuffer = [], Me(this.stream, {
          parseStatement: (t) => this.parseStatementFromStream(t),
          parseComment: (t) => this.parseCommentFromStream(t),
          createCodePosition: (t, r) => ({
            startRow: t.line - 1,
            startCol: t.column,
            endRow: r.line - 1,
            endCol: r.column + (r.text.length > 0 ? r.text.length - 1 : 0)
          })
        }, n);
      }
      if (e.text === "for") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        return this.decoratorBuffer = [], Oe(this.stream, {
          parseStatement: (t) => this.parseStatementFromStream(t),
          parseComment: (t) => this.parseCommentFromStream(t),
          createCodePosition: (t, r) => ({
            startRow: t.line - 1,
            startCol: t.column,
            endRow: r.line - 1,
            endCol: r.column + (r.text.length > 0 ? r.text.length - 1 : 0)
          })
        }, n);
      }
      if (e.text === "together") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        return this.decoratorBuffer = [], yt(this.stream, {
          parseStatement: (t) => this.parseStatementFromStream(t),
          parseComment: (t) => this.parseCommentFromStream(t),
          createCodePosition: (t, r) => ({
            startRow: t.line - 1,
            startCol: t.column,
            endRow: r.line - 1,
            endCol: r.column + (r.text.length > 0 ? r.text.length - 1 : 0)
          })
        }, n);
      }
      if (e.text === "do") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        return this.decoratorBuffer = [], U.parse(
          this.stream,
          (t) => this.parseStatementFromStream(t),
          (t) => this.parseCommentFromStream(t),
          n
        );
      }
      if (e.text === "def" || e.text === "define") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        this.decoratorBuffer = [];
        const t = await ft.parse(
          this.stream,
          (r) => this.parseStatementFromStream(r),
          (r) => this.parseCommentFromStream(r),
          n,
          this.environment
        );
        return this.extractedFunctions.find((r) => r.name === t.name) || this.extractedFunctions.push(t), t;
      }
      if (e.text === "on") {
        const n = this.decoratorBuffer.length > 0 ? [...this.decoratorBuffer] : void 0;
        this.decoratorBuffer = [];
        const t = await ht.parse(
          this.stream,
          (r) => this.parseStatementFromStream(r),
          (r) => this.parseCommentFromStream(r),
          n,
          this.environment
        );
        return this.extractedEventHandlers.find((r) => r.eventName === t.eventName) || this.extractedEventHandlers.push(t), t;
      }
    }
    if (e.kind === d.LBRACE) {
      const n = z(this.stream, (t) => this.parseStatementFromStream(t));
      return {
        type: "command",
        name: "_object",
        args: [n],
        codePos: n.codePos || { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column }
      };
    }
    if (e.kind === d.LBRACKET) {
      const n = z(this.stream, (t) => this.parseStatementFromStream(t));
      return {
        type: "command",
        name: "_array",
        args: [n],
        codePos: n.codePos || { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column }
      };
    }
    if (e.kind === d.STRING) {
      const n = e.text.startsWith("`"), t = e.value !== void 0 ? e.value : e.text.slice(1, -1), r = n ? `\0TEMPLATE\0${t}` : t;
      return this.stream.next(), {
        type: "command",
        name: "_literal",
        args: [{ type: "string", value: r }],
        codePos: { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column + e.text.length - 1 }
      };
    }
    if (e.kind === d.NUMBER) {
      const n = e.value !== void 0 ? e.value : parseFloat(e.text);
      return this.stream.next(), {
        type: "command",
        name: "_literal",
        args: [{ type: "number", value: n }],
        codePos: { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column + e.text.length - 1 }
      };
    }
    if (e.kind === d.BOOLEAN) {
      const n = e.value !== void 0 ? e.value : e.text === "true";
      return this.stream.next(), {
        type: "command",
        name: "_literal",
        args: [{ type: "literal", value: n }],
        codePos: { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column + e.text.length - 1 }
      };
    }
    return e.kind === d.NULL ? (this.stream.next(), {
      type: "command",
      name: "_literal",
      args: [{ type: "literal", value: null }],
      codePos: { startRow: e.line - 1, startCol: e.column, endRow: e.line - 1, endCol: e.column + e.text.length - 1 }
    }) : e.kind === d.IDENTIFIER || e.kind === d.KEYWORD ? Ae.parse(this.stream, {
      parseStatement: (n) => this.parseStatementFromStream(n),
      createCodePosition: (n, t) => ({
        startRow: n.line - 1,
        startCol: n.column,
        endRow: t.line - 1,
        endCol: t.column + (t.text.length > 0 ? t.text.length - 1 : 0)
      }),
      parseScope: (n) => U.parse(
        n,
        (t) => this.parseStatementFromStream(t),
        (t) => this.parseCommentFromStream(t),
        void 0
      )
    }) : null;
  }
  parseCommentFromStream(e) {
    if (!e.check(d.COMMENT)) return null;
    const n = [];
    let t = e.current()?.line || 0;
    for (; e.check(d.COMMENT); ) {
      const r = e.next();
      n.push({
        text: r.text.startsWith("#") ? r.text.slice(1).trim() : r.text.trim(),
        codePos: { startRow: r.line - 1, startCol: r.column, endRow: r.line - 1, endCol: r.column + r.text.length - 1 },
        inline: false
      });
    }
    return { type: "comment", comments: n, lineNumber: t - 1 };
  }
  attachInlineComments(e) {
    let n = e.codePos?.endRow;
    if (n === void 0) return;
    const t = q.parseInlineComment(this.stream, n);
    t && q.attachComments(e, [t]);
  }
  countTrailingBlankLines(e) {
    if (!("codePos" in e) || !e.codePos) return;
    const n = this.source.split(`
`);
    let t = 0;
    for (let r = e.codePos.endRow + 1; r < n.length && n[r].trim() === ""; r++)
      t++;
    t > 0 && (e.trailingBlankLines = t);
  }
  /**
   * Recursively assign nodeKeys to body statements
   * This ensures all nested statements have hierarchical nodeKeys for execution tracking
   */
  assignBodyNodeKeys(e, n) {
    for (let t = 0; t < e.length; t++) {
      const r = e[t], o = `${n}-${t}`;
      if (r.nodeKey = o, r.type === "define" || r.type === "do" || r.type === "forLoop") {
        const s = r;
        s.body && this.assignBodyNodeKeys(s.body, o);
      } else if (r.type === "onBlock") {
        const s = r;
        s.body && this.assignBodyNodeKeys(s.body, o);
      } else if (r.type === "ifBlock") {
        const s = r;
        if (s.thenBranch && this.assignBodyNodeKeys(s.thenBranch, `${o}-then`), s.elseifBranches)
          for (let a = 0; a < s.elseifBranches.length; a++) {
            const u = s.elseifBranches[a];
            u.body && this.assignBodyNodeKeys(u.body, `${o}-elseif-${a}`);
          }
        s.elseBranch && this.assignBodyNodeKeys(s.elseBranch, `${o}-else`);
      } else if (r.type === "together") {
        const s = r;
        if (s.doBlocks)
          for (let a = 0; a < s.doBlocks.length; a++) {
            const u = s.doBlocks[a];
            u.body && this.assignBodyNodeKeys(u.body, `${o}-do-${a}`);
          }
      } else if (r.type === "command") {
        const s = r;
        s.body && Array.isArray(s.body) && this.assignBodyNodeKeys(s.body, o);
      }
    }
  }
};
var se = class extends Error {
  value;
  constructor(e) {
    super("Return"), this.value = e, this.name = "ReturnException";
  }
};
var ce = class extends Error {
  constructor() {
    super("Break"), this.name = "BreakException";
  }
};
var De = class extends Error {
  constructor() {
    super("Continue"), this.name = "ContinueException";
  }
};
var Ge = class extends Error {
  constructor() {
    super("End"), this.name = "EndException";
  }
};
var re = class _re {
  /**
   * Evaluate a template string with variable interpolation and subexpressions
   * 
   * @param template - The template string content (without backticks, already unescaped)
   * @param context - Context with methods to resolve variables and execute subexpressions
   * @param frameOverride - Optional frame override for variable resolution
   * @returns The evaluated string
   */
  static async evaluate(e, n, t) {
    let r = "", o = 0, s = false;
    for (; o < e.length; ) {
      const a = e[o];
      if (s) {
        switch (a) {
          case "n":
            r += `
`;
            break;
          case "t":
            r += "	";
            break;
          case "r":
            r += "\r";
            break;
          case "\\":
            r += "\\";
            break;
          case "`":
            r += "`";
            break;
          case "$":
            r += "$";
            break;
          case "(":
            r += "(";
            break;
          case ")":
            r += ")";
            break;
          default:
            r += a;
            break;
        }
        s = false, o++;
        continue;
      }
      if (a === "\\") {
        s = true, o++;
        continue;
      }
      if (a === "$" && o + 1 < e.length && e[o + 1] === "(") {
        let u = 1, l = o + 2;
        for (; l < e.length && u > 0; ) {
          if (e[l] === "\\") {
            l += 2;
            continue;
          }
          e[l] === "(" && u++, e[l] === ")" && u--, u > 0 && l++;
        }
        if (u === 0) {
          const p = e.substring(o + 2, l);
          try {
            const c = await n.executeSubexpression(p, t);
            r += _re.valueToString(c);
          } catch {
            r += e.substring(o, l + 1);
          }
          o = l + 1;
          continue;
        }
      }
      if (a === "$") {
        if (o + 1 >= e.length || !/[A-Za-z0-9_$]/.test(e[o + 1]) && e[o + 1] !== "(") {
          const c = n.getLastValue(t);
          r += _re.valueToString(c), o++;
          continue;
        }
        let u = o + 1, l = 0;
        for (; u < e.length; ) {
          const c = e[u];
          if (/[A-Za-z0-9_.]/.test(c))
            u++;
          else if (c === "[")
            l++, u++;
          else if (c === "]" && l > 0)
            l--, u++;
          else if (c === "$" && l > 0)
            u++;
          else
            break;
        }
        const p = e.substring(o, u);
        try {
          const { name: c, path: h } = L.parseVariablePath(p), f = n.resolveVariable(c, h, t);
          r += _re.valueToString(f);
        } catch {
          r += p;
        }
        o = u;
        continue;
      }
      r += a, o++;
    }
    return r;
  }
  /**
   * Convert a value to string representation
   */
  static valueToString(e) {
    return e == null ? "null" : typeof e == "string" ? e : typeof e == "number" || typeof e == "boolean" ? String(e) : Array.isArray(e) || typeof e == "object" ? JSON.stringify(e) : String(e);
  }
};
var bt = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
var Ct = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
var xt = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
var Fe = {
  Space_Separator: bt,
  ID_Start: Ct,
  ID_Continue: xt
};
var j = {
  isSpaceSeparator(i) {
    return typeof i == "string" && Fe.Space_Separator.test(i);
  },
  isIdStartChar(i) {
    return typeof i == "string" && (i >= "a" && i <= "z" || i >= "A" && i <= "Z" || i === "$" || i === "_" || Fe.ID_Start.test(i));
  },
  isIdContinueChar(i) {
    return typeof i == "string" && (i >= "a" && i <= "z" || i >= "A" && i <= "Z" || i >= "0" && i <= "9" || i === "$" || i === "_" || i === "\u200C" || i === "\u200D" || Fe.ID_Continue.test(i));
  },
  isDigit(i) {
    return typeof i == "string" && /[0-9]/.test(i);
  },
  isHexDigit(i) {
    return typeof i == "string" && /[0-9A-Fa-f]/.test(i);
  }
};
var Be;
var J;
var te;
var ke;
var ie;
var Y;
var K;
var Ie;
var fe;
var wt = function(e, n) {
  Be = String(e), J = "start", te = [], ke = 0, ie = 1, Y = 0, K = void 0, Ie = void 0, fe = void 0;
  do
    K = At(), Tt[J]();
  while (K.type !== "eof");
  return typeof n == "function" ? $e({ "": fe }, "", n) : fe;
};
function $e(i, e, n) {
  const t = i[e];
  if (t != null && typeof t == "object")
    if (Array.isArray(t))
      for (let r = 0; r < t.length; r++) {
        const o = String(r), s = $e(t, o, n);
        s === void 0 ? delete t[o] : Object.defineProperty(t, o, {
          value: s,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    else
      for (const r in t) {
        const o = $e(t, r, n);
        o === void 0 ? delete t[r] : Object.defineProperty(t, r, {
          value: o,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
  return n.call(i, e, t);
}
var R;
var $;
var de;
var ee;
var P;
function At() {
  for (R = "default", $ = "", de = false, ee = 1; ; ) {
    P = ne();
    const i = et[R]();
    if (i)
      return i;
  }
}
function ne() {
  if (Be[ke])
    return String.fromCodePoint(Be.codePointAt(ke));
}
function k() {
  const i = ne();
  return i === `
` ? (ie++, Y = 0) : i ? Y += i.length : Y++, i && (ke += i.length), i;
}
var et = {
  default() {
    switch (P) {
      case "	":
      case "\v":
      case "\f":
      case " ":
      case "\xA0":
      case "\uFEFF":
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
        k();
        return;
      case "/":
        k(), R = "comment";
        return;
      case void 0:
        return k(), V("eof");
    }
    if (j.isSpaceSeparator(P)) {
      k();
      return;
    }
    return et[J]();
  },
  comment() {
    switch (P) {
      case "*":
        k(), R = "multiLineComment";
        return;
      case "/":
        k(), R = "singleLineComment";
        return;
    }
    throw O(k());
  },
  multiLineComment() {
    switch (P) {
      case "*":
        k(), R = "multiLineCommentAsterisk";
        return;
      case void 0:
        throw O(k());
    }
    k();
  },
  multiLineCommentAsterisk() {
    switch (P) {
      case "*":
        k();
        return;
      case "/":
        k(), R = "default";
        return;
      case void 0:
        throw O(k());
    }
    k(), R = "multiLineComment";
  },
  singleLineComment() {
    switch (P) {
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
        k(), R = "default";
        return;
      case void 0:
        return k(), V("eof");
    }
    k();
  },
  value() {
    switch (P) {
      case "{":
      case "[":
        return V("punctuator", k());
      case "n":
        return k(), oe("ull"), V("null", null);
      case "t":
        return k(), oe("rue"), V("boolean", true);
      case "f":
        return k(), oe("alse"), V("boolean", false);
      case "-":
      case "+":
        k() === "-" && (ee = -1), R = "sign";
        return;
      case ".":
        $ = k(), R = "decimalPointLeading";
        return;
      case "0":
        $ = k(), R = "zero";
        return;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        $ = k(), R = "decimalInteger";
        return;
      case "I":
        return k(), oe("nfinity"), V("numeric", 1 / 0);
      case "N":
        return k(), oe("aN"), V("numeric", NaN);
      case '"':
      case "'":
        de = k() === '"', $ = "", R = "string";
        return;
    }
    throw O(k());
  },
  identifierNameStartEscape() {
    if (P !== "u")
      throw O(k());
    k();
    const i = Re();
    switch (i) {
      case "$":
      case "_":
        break;
      default:
        if (!j.isIdStartChar(i))
          throw _e();
        break;
    }
    $ += i, R = "identifierName";
  },
  identifierName() {
    switch (P) {
      case "$":
      case "_":
      case "\u200C":
      case "\u200D":
        $ += k();
        return;
      case "\\":
        k(), R = "identifierNameEscape";
        return;
    }
    if (j.isIdContinueChar(P)) {
      $ += k();
      return;
    }
    return V("identifier", $);
  },
  identifierNameEscape() {
    if (P !== "u")
      throw O(k());
    k();
    const i = Re();
    switch (i) {
      case "$":
      case "_":
      case "\u200C":
      case "\u200D":
        break;
      default:
        if (!j.isIdContinueChar(i))
          throw _e();
        break;
    }
    $ += i, R = "identifierName";
  },
  sign() {
    switch (P) {
      case ".":
        $ = k(), R = "decimalPointLeading";
        return;
      case "0":
        $ = k(), R = "zero";
        return;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        $ = k(), R = "decimalInteger";
        return;
      case "I":
        return k(), oe("nfinity"), V("numeric", ee * (1 / 0));
      case "N":
        return k(), oe("aN"), V("numeric", NaN);
    }
    throw O(k());
  },
  zero() {
    switch (P) {
      case ".":
        $ += k(), R = "decimalPoint";
        return;
      case "e":
      case "E":
        $ += k(), R = "decimalExponent";
        return;
      case "x":
      case "X":
        $ += k(), R = "hexadecimal";
        return;
    }
    return V("numeric", ee * 0);
  },
  decimalInteger() {
    switch (P) {
      case ".":
        $ += k(), R = "decimalPoint";
        return;
      case "e":
      case "E":
        $ += k(), R = "decimalExponent";
        return;
    }
    if (j.isDigit(P)) {
      $ += k();
      return;
    }
    return V("numeric", ee * Number($));
  },
  decimalPointLeading() {
    if (j.isDigit(P)) {
      $ += k(), R = "decimalFraction";
      return;
    }
    throw O(k());
  },
  decimalPoint() {
    switch (P) {
      case "e":
      case "E":
        $ += k(), R = "decimalExponent";
        return;
    }
    if (j.isDigit(P)) {
      $ += k(), R = "decimalFraction";
      return;
    }
    return V("numeric", ee * Number($));
  },
  decimalFraction() {
    switch (P) {
      case "e":
      case "E":
        $ += k(), R = "decimalExponent";
        return;
    }
    if (j.isDigit(P)) {
      $ += k();
      return;
    }
    return V("numeric", ee * Number($));
  },
  decimalExponent() {
    switch (P) {
      case "+":
      case "-":
        $ += k(), R = "decimalExponentSign";
        return;
    }
    if (j.isDigit(P)) {
      $ += k(), R = "decimalExponentInteger";
      return;
    }
    throw O(k());
  },
  decimalExponentSign() {
    if (j.isDigit(P)) {
      $ += k(), R = "decimalExponentInteger";
      return;
    }
    throw O(k());
  },
  decimalExponentInteger() {
    if (j.isDigit(P)) {
      $ += k();
      return;
    }
    return V("numeric", ee * Number($));
  },
  hexadecimal() {
    if (j.isHexDigit(P)) {
      $ += k(), R = "hexadecimalInteger";
      return;
    }
    throw O(k());
  },
  hexadecimalInteger() {
    if (j.isHexDigit(P)) {
      $ += k();
      return;
    }
    return V("numeric", ee * Number($));
  },
  string() {
    switch (P) {
      case "\\":
        k(), $ += kt();
        return;
      case '"':
        if (de)
          return k(), V("string", $);
        $ += k();
        return;
      case "'":
        if (!de)
          return k(), V("string", $);
        $ += k();
        return;
      case `
`:
      case "\r":
        throw O(k());
      case "\u2028":
      case "\u2029":
        Ft(P);
        break;
      case void 0:
        throw O(k());
    }
    $ += k();
  },
  start() {
    switch (P) {
      case "{":
      case "[":
        return V("punctuator", k());
    }
    R = "value";
  },
  beforePropertyName() {
    switch (P) {
      case "$":
      case "_":
        $ = k(), R = "identifierName";
        return;
      case "\\":
        k(), R = "identifierNameStartEscape";
        return;
      case "}":
        return V("punctuator", k());
      case '"':
      case "'":
        de = k() === '"', R = "string";
        return;
    }
    if (j.isIdStartChar(P)) {
      $ += k(), R = "identifierName";
      return;
    }
    throw O(k());
  },
  afterPropertyName() {
    if (P === ":")
      return V("punctuator", k());
    throw O(k());
  },
  beforePropertyValue() {
    R = "value";
  },
  afterPropertyValue() {
    switch (P) {
      case ",":
      case "}":
        return V("punctuator", k());
    }
    throw O(k());
  },
  beforeArrayValue() {
    if (P === "]")
      return V("punctuator", k());
    R = "value";
  },
  afterArrayValue() {
    switch (P) {
      case ",":
      case "]":
        return V("punctuator", k());
    }
    throw O(k());
  },
  end() {
    throw O(k());
  }
};
function V(i, e) {
  return {
    type: i,
    value: e,
    line: ie,
    column: Y
  };
}
function oe(i) {
  for (const e of i) {
    if (ne() !== e)
      throw O(k());
    k();
  }
}
function kt() {
  switch (ne()) {
    case "b":
      return k(), "\b";
    case "f":
      return k(), "\f";
    case "n":
      return k(), `
`;
    case "r":
      return k(), "\r";
    case "t":
      return k(), "	";
    case "v":
      return k(), "\v";
    case "0":
      if (k(), j.isDigit(ne()))
        throw O(k());
      return "\0";
    case "x":
      return k(), vt();
    case "u":
      return k(), Re();
    case `
`:
    case "\u2028":
    case "\u2029":
      return k(), "";
    case "\r":
      return k(), ne() === `
` && k(), "";
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      throw O(k());
    case void 0:
      throw O(k());
  }
  return k();
}
function vt() {
  let i = "", e = ne();
  if (!j.isHexDigit(e) || (i += k(), e = ne(), !j.isHexDigit(e)))
    throw O(k());
  return i += k(), String.fromCodePoint(parseInt(i, 16));
}
function Re() {
  let i = "", e = 4;
  for (; e-- > 0; ) {
    const n = ne();
    if (!j.isHexDigit(n))
      throw O(k());
    i += k();
  }
  return String.fromCodePoint(parseInt(i, 16));
}
var Tt = {
  start() {
    if (K.type === "eof")
      throw ae();
    Se();
  },
  beforePropertyName() {
    switch (K.type) {
      case "identifier":
      case "string":
        Ie = K.value, J = "afterPropertyName";
        return;
      case "punctuator":
        Ee();
        return;
      case "eof":
        throw ae();
    }
  },
  afterPropertyName() {
    if (K.type === "eof")
      throw ae();
    J = "beforePropertyValue";
  },
  beforePropertyValue() {
    if (K.type === "eof")
      throw ae();
    Se();
  },
  beforeArrayValue() {
    if (K.type === "eof")
      throw ae();
    if (K.type === "punctuator" && K.value === "]") {
      Ee();
      return;
    }
    Se();
  },
  afterPropertyValue() {
    if (K.type === "eof")
      throw ae();
    switch (K.value) {
      case ",":
        J = "beforePropertyName";
        return;
      case "}":
        Ee();
    }
  },
  afterArrayValue() {
    if (K.type === "eof")
      throw ae();
    switch (K.value) {
      case ",":
        J = "beforeArrayValue";
        return;
      case "]":
        Ee();
    }
  },
  end() {
  }
};
function Se() {
  let i;
  switch (K.type) {
    case "punctuator":
      switch (K.value) {
        case "{":
          i = {};
          break;
        case "[":
          i = [];
          break;
      }
      break;
    case "null":
    case "boolean":
    case "numeric":
    case "string":
      i = K.value;
      break;
  }
  if (fe === void 0)
    fe = i;
  else {
    const e = te[te.length - 1];
    Array.isArray(e) ? e.push(i) : Object.defineProperty(e, Ie, {
      value: i,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }
  if (i !== null && typeof i == "object")
    te.push(i), Array.isArray(i) ? J = "beforeArrayValue" : J = "beforePropertyName";
  else {
    const e = te[te.length - 1];
    e == null ? J = "end" : Array.isArray(e) ? J = "afterArrayValue" : J = "afterPropertyValue";
  }
}
function Ee() {
  te.pop();
  const i = te[te.length - 1];
  i == null ? J = "end" : Array.isArray(i) ? J = "afterArrayValue" : J = "afterPropertyValue";
}
function O(i) {
  return ve(i === void 0 ? `JSON5: invalid end of input at ${ie}:${Y}` : `JSON5: invalid character '${tt(i)}' at ${ie}:${Y}`);
}
function ae() {
  return ve(`JSON5: invalid end of input at ${ie}:${Y}`);
}
function _e() {
  return Y -= 5, ve(`JSON5: invalid identifier character at ${ie}:${Y}`);
}
function Ft(i) {
  console.warn(`JSON5: '${tt(i)}' in strings is not valid ECMAScript; consider escaping`);
}
function tt(i) {
  const e = {
    "'": "\\'",
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\f": "\\f",
    "\n": "\\n",
    "\r": "\\r",
    "	": "\\t",
    "\v": "\\v",
    "\0": "\\0",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  };
  if (e[i])
    return e[i];
  if (i < " ") {
    const n = i.charCodeAt(0).toString(16);
    return "\\x" + ("00" + n).substring(n.length);
  }
  return i;
}
function ve(i) {
  const e = new SyntaxError(i);
  return e.lineNumber = ie, e.columnNumber = Y, e;
}
var St = function(e, n, t) {
  const r = [];
  let o = "", s, a, u = "", l;
  if (n != null && typeof n == "object" && !Array.isArray(n) && (t = n.space, l = n.quote, n = n.replacer), typeof n == "function")
    a = n;
  else if (Array.isArray(n)) {
    s = [];
    for (const g of n) {
      let y;
      typeof g == "string" ? y = g : (typeof g == "number" || g instanceof String || g instanceof Number) && (y = String(g)), y !== void 0 && s.indexOf(y) < 0 && s.push(y);
    }
  }
  return t instanceof Number ? t = Number(t) : t instanceof String && (t = String(t)), typeof t == "number" ? t > 0 && (t = Math.min(10, Math.floor(t)), u = "          ".substr(0, t)) : typeof t == "string" && (u = t.substr(0, 10)), p("", { "": e });
  function p(g, y) {
    let D = y[g];
    switch (D != null && (typeof D.toJSON5 == "function" ? D = D.toJSON5(g) : typeof D.toJSON == "function" && (D = D.toJSON(g))), a && (D = a.call(y, g, D)), D instanceof Number ? D = Number(D) : D instanceof String ? D = String(D) : D instanceof Boolean && (D = D.valueOf()), D) {
      case null:
        return "null";
      case true:
        return "true";
      case false:
        return "false";
    }
    if (typeof D == "string")
      return c(D);
    if (typeof D == "number")
      return String(D);
    if (typeof D == "object")
      return Array.isArray(D) ? m(D) : h(D);
  }
  function c(g) {
    const y = {
      "'": 0.1,
      '"': 0.2
    }, D = {
      "'": "\\'",
      '"': '\\"',
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\v": "\\v",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    let C = "";
    for (let E = 0; E < g.length; E++) {
      const w = g[E];
      switch (w) {
        case "'":
        case '"':
          y[w]++, C += w;
          continue;
        case "\0":
          if (j.isDigit(g[E + 1])) {
            C += "\\x00";
            continue;
          }
      }
      if (D[w]) {
        C += D[w];
        continue;
      }
      if (w < " ") {
        let b = w.charCodeAt(0).toString(16);
        C += "\\x" + ("00" + b).substring(b.length);
        continue;
      }
      C += w;
    }
    const x = l || Object.keys(y).reduce((E, w) => y[E] < y[w] ? E : w);
    return C = C.replace(new RegExp(x, "g"), D[x]), x + C + x;
  }
  function h(g) {
    if (r.indexOf(g) >= 0)
      throw TypeError("Converting circular structure to JSON5");
    r.push(g);
    let y = o;
    o = o + u;
    let D = s || Object.keys(g), C = [];
    for (const E of D) {
      const w = p(E, g);
      if (w !== void 0) {
        let b = f(E) + ":";
        u !== "" && (b += " "), b += w, C.push(b);
      }
    }
    let x;
    if (C.length === 0)
      x = "{}";
    else {
      let E;
      if (u === "")
        E = C.join(","), x = "{" + E + "}";
      else {
        let w = `,
` + o;
        E = C.join(w), x = `{
` + o + E + `,
` + y + "}";
      }
    }
    return r.pop(), o = y, x;
  }
  function f(g) {
    if (g.length === 0)
      return c(g);
    const y = String.fromCodePoint(g.codePointAt(0));
    if (!j.isIdStartChar(y))
      return c(g);
    for (let D = y.length; D < g.length; D++)
      if (!j.isIdContinueChar(String.fromCodePoint(g.codePointAt(D))))
        return c(g);
    return g;
  }
  function m(g) {
    if (r.indexOf(g) >= 0)
      throw TypeError("Converting circular structure to JSON5");
    r.push(g);
    let y = o;
    o = o + u;
    let D = [];
    for (let x = 0; x < g.length; x++) {
      const E = p(String(x), g);
      D.push(E !== void 0 ? E : "null");
    }
    let C;
    if (D.length === 0)
      C = "[]";
    else if (u === "")
      C = "[" + D.join(",") + "]";
    else {
      let x = `,
` + o, E = D.join(x);
      C = `[
` + o + E + `,
` + y + "]";
    }
    return r.pop(), o = y, C;
  }
};
var Nt = {
  parse: wt,
  stringify: St
};
var pe = Nt;
var _ = class __ {
  environment;
  callStack = [];
  parentThread = null;
  sourceCode = null;
  // Store source code for error messages
  recursionDepth = /* @__PURE__ */ new Map();
  // Track recursion depth for each function
  currentStatement = null;
  static MAX_RECURSION_DEPTH = 5e3;
  // Maximum recursion depth (reduced from 60k to prevent stack overflow)
  /**
   * Debug mode flag - set to true to enable logging
   * Can be controlled via VITE_DEBUG environment variable or set programmatically
   */
  static debug = (() => {
    try {
      const e = globalThis.process;
      if (e && e.env?.VITE_DEBUG === "true")
        return true;
      const n = globalThis.import?.meta;
      if (n && n.env?.VITE_DEBUG === "true")
        return true;
    } catch {
    }
    return false;
  })();
  constructor(e, n, t) {
    this.environment = e, this.parentThread = n || null, this.sourceCode = t || null, this.callStack.push({
      locals: /* @__PURE__ */ new Map(),
      lastValue: null
    });
  }
  getCurrentFrame(e) {
    return e !== void 0 ? e : this.callStack[this.callStack.length - 1];
  }
  getCurrentStatement() {
    return this.currentStatement;
  }
  getEnvironment() {
    return this.environment;
  }
  getCallStack() {
    return this.callStack;
  }
  /**
   * Compute Levenshtein distance between two strings
   */
  levenshteinDistance(e, n) {
    if (e.length === 0) return n.length;
    if (n.length === 0) return e.length;
    const t = [];
    for (let r = 0; r <= n.length; r++)
      t[r] = [r];
    for (let r = 0; r <= e.length; r++)
      t[0][r] = r;
    for (let r = 1; r <= n.length; r++)
      for (let o = 1; o <= e.length; o++)
        n.charAt(r - 1) === e.charAt(o - 1) ? t[r][o] = t[r - 1][o - 1] : t[r][o] = Math.min(
          t[r - 1][o - 1] + 1,
          // substitution
          t[r][o - 1] + 1,
          // insertion
          t[r - 1][o] + 1
          // deletion
        );
    return t[n.length][e.length];
  }
  /**
   * Find similar function names for "did you mean?" suggestions
   */
  findSimilarFunctions(e, n = 3) {
    const t = [];
    for (const o of this.environment.builtins.keys())
      t.push(o);
    for (const o of this.environment.functions.keys())
      t.push(o);
    return t.map((o) => ({
      name: o,
      distance: this.levenshteinDistance(e.toLowerCase(), o.toLowerCase())
    })).filter(({ distance: o, name: s }) => {
      const a = Math.floor(Math.max(e.length, s.length) / 2) + 2;
      return o <= a && o > 0;
    }).sort((o, s) => o.distance - s.distance).slice(0, n).map(({ name: o }) => o);
  }
  /**
   * Format "Unknown function" error with suggestions
   */
  unknownFunctionError(e) {
    const n = this.findSimilarFunctions(e);
    let t = `Unknown function: ${e}`;
    return n.length > 0 && (t += `. Did you mean: ${n.join(", ")}?`), new Error(t);
  }
  /**
   * Creates a new Executor instance that shares the same environment and call stack,
   * but has its own call stack array to allow parallel execution without stack corruption.
   * The frames themselves (locals Maps) are shared.
   */
  spawnChild() {
    const e = new __(this.environment, this.parentThread, this.sourceCode);
    return e.callStack = [...this.callStack], e;
  }
  /**
   * Execute an event handler with the provided arguments
   * Arguments are available as $1, $2, $3, etc. in the handler body
   */
  async executeEventHandler(e, n) {
    const t = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: null,
      isFunctionFrame: true
    };
    for (let r = 0; r < n.length; r++)
      t.locals.set(String(r + 1), n[r]);
    this.callStack.push(t);
    try {
      for (const r of e.body)
        await this.executeStatement(r);
    } finally {
      this.callStack.pop();
    }
  }
  /**
   * Execute a single statement (public method for state tracking)
   */
  async executeStatementPublic(e) {
    await this.executeStatement(e);
  }
  /**
   * Execute a function call and return the result (public method for expression evaluation)
   */
  async executeFunctionCall(e, n) {
    const t = this.getCurrentFrame();
    if (t.forgotten && t.forgotten.has(e))
      throw this.unknownFunctionError(e);
    const r = await Promise.all(n.map((a) => this.evaluateArg(a, void 0, void 0))), o = this.environment.builtins.get(e);
    if (o) {
      const a = await o(r);
      return a !== void 0 ? a : null;
    }
    const s = this.environment.functions.get(e);
    if (s)
      return await this.callFunction(s, r);
    throw this.unknownFunctionError(e);
  }
  async execute(e) {
    try {
      for (const n of e)
        await this.executeStatement(n);
      return this.getCurrentFrame().lastValue;
    } catch (n) {
      if (n instanceof se)
        return n.value;
      if (n instanceof ce)
        throw new Error("break statement can only be used inside a for loop");
      if (n instanceof Ge)
        return this.getCurrentFrame().lastValue;
      throw n;
    }
  }
  async executeStatement(e, n) {
    switch (this.currentStatement = e, e.type) {
      case "command":
        await this.executeCommand(e, n);
        break;
      case "assignment":
        await this.executeAssignment(e, n);
        break;
      case "shorthand":
        this.executeShorthandAssignment(e, n);
        break;
      case "inlineIf":
        await this.executeInlineIf(e, n);
        break;
      case "ifBlock":
        await this.executeIfBlock(e, n);
        break;
      case "ifTrue":
        await this.executeIfTrue(e, n);
        break;
      case "ifFalse":
        await this.executeIfFalse(e, n);
        break;
      case "define":
        await this.registerFunction(e);
        break;
      case "do":
        await this.executeScope(e, n);
        break;
      case "together":
        await this.executeTogether(e);
        break;
      case "forLoop":
        await this.executeForLoop(e, n);
        break;
      case "return":
        await this.executeReturn(e, n);
        break;
      case "break":
        await this.executeBreak(e, n);
        break;
      case "continue":
        await this.executeContinue(e, n);
        break;
      case "onBlock":
        this.registerEventHandler(e);
        break;
      case "comment":
        break;
      case "chunk_marker":
        break;
      case "cell":
        e.cellType === "code" && e.body && await this.execute(e.body);
        break;
    }
    if (e.nodeKey && this.environment.stateTracker) {
      const t = n || this.getCurrentFrame();
      this.environment.stateTracker.addStep({
        nodeKey: e.nodeKey,
        variables: this.getVariableStateInternal(t),
        result: t.lastValue,
        timestamp: Date.now()
      });
    }
  }
  /**
   * Get all variables visible in the current frame
   */
  getVariableStateInternal(e) {
    const n = {};
    for (const [t, r] of this.environment.variables.entries())
      n[t] = r;
    for (const [t, r] of e.locals.entries())
      n[t] = r;
    return n;
  }
  /**
   * Reconstructs the original input string from an Arg object.
   * This is useful for commands that need to preserve the original input
   * (e.g., variable/function names) rather than evaluating them.
   * 
   * Examples:
   * - { type: 'var', name: 'a' } -> '$a'
   * - { type: 'var', name: 'a', path: [{ type: 'property', name: 'b' }] } -> '$a.b'
   * - { type: 'var', name: 'a', path: [{ type: 'index', index: 0 }] } -> '$a[0]'
   * - { type: 'string', value: 'hello' } -> 'hello'
   * 
   * @param arg The Arg object to reconstruct
   * @returns The original input string, or null if the arg type cannot be reconstructed
   */
  reconstructOriginalInput(e) {
    if (e.type === "var") {
      let n = "$" + e.name;
      if (e.path)
        for (const t of e.path)
          t.type === "property" ? n += "." + t.name : t.type === "index" && (n += "[" + t.index + "]");
      return n;
    } else {
      if (e.type === "string")
        return e.value;
      if (e.type === "literal") {
        const n = e.value;
        return typeof n == "string" ? n : null;
      }
    }
    return null;
  }
  async executeCommand(e, n) {
    const t = n !== void 0 ? n : this.getCurrentFrame(), r = [];
    let o = null;
    for (const c of e.args)
      if (c.type === "namedArgs")
        o = await this.evaluateArg(c, n, e.codePos);
      else {
        const h = await this.evaluateArg(c, n, e.codePos);
        r.push(h);
      }
    const s = o ? [...r, o] : r;
    if (e.name === "_subexpr") {
      if (s.length === 0)
        throw new Error("_subexpr command requires a subexpression argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "_var") {
      if (s.length === 0)
        throw new Error("_var command requires a variable name argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "_object") {
      if (s.length === 0)
        throw new Error("_object command requires an object literal argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "_array") {
      if (s.length === 0)
        throw new Error("_array command requires an array literal argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "_literal") {
      if (s.length === 0)
        throw new Error("_literal command requires a literal argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "_expr") {
      if (s.length === 0)
        throw new Error("_expr command requires an expression argument");
      t.lastValue = s[0];
      return;
    }
    if (e.name === "use") {
      if (s.length === 0) {
        const y = `Use Command:
  use <moduleName>         - Set module context (e.g., "use math")
  use clear                - Clear module context
  
Examples:
  use math                 - Use math module (then "add 5 5" instead of "math.add 5 5")
  use clear                - Clear module context`;
        console.log(y), t.lastValue = y;
        return;
      }
      const c = String(s[0]);
      if (c === "clear" || c === "" || c === null) {
        this.environment.currentModule = null;
        const y = "Cleared module context";
        console.log(y), t.lastValue = y;
        return;
      }
      const h = String(c), f = this.environment.moduleMetadata.has(h);
      let m = false;
      if (!f) {
        const y = `${h}.`;
        for (const D of this.environment.builtins.keys())
          if (D.startsWith(y)) {
            m = true;
            break;
          }
      }
      if (!f && !m) {
        const y = `Error: Module "${h}" not found`;
        console.log(y), t.lastValue = y;
        return;
      }
      this.environment.currentModule = h;
      const g = `Using module: ${h}`;
      console.log(g), t.lastValue = g;
      return;
    }
    if (e.name === "explain") {
      if (s.length === 0) {
        const f = `Explain Command:
  explain <moduleName>     - Show module documentation and available methods
  explain <module.function> - Show function documentation with parameters and return type
  
Examples:
  explain math             - Show math module documentation
  explain math.add         - Show add function documentation
  explain add              - Show add function (if "use math" is active)`;
        console.log(f), t.lastValue = f;
        return;
      }
      const c = s[0];
      if (!c) {
        const f = "Error: explain requires a module or function name";
        console.log(f), t.lastValue = f;
        return;
      }
      let h = String(c);
      if (!h.includes(".") && this.environment.currentModule && (h === this.environment.currentModule || (h = `${this.environment.currentModule}.${h}`)), h.includes(".")) {
        const f = this.environment.metadata.get(h);
        if (!f) {
          const g = { error: `No documentation available for function: ${h}` };
          t.lastValue = g;
          return;
        }
        const m = {
          type: "function",
          name: h,
          description: f.description,
          parameters: f.parameters || [],
          returnType: f.returnType,
          returnDescription: f.returnDescription,
          example: f.example || null
        };
        t.lastValue = m;
        return;
      } else {
        const f = this.environment.moduleMetadata.get(h);
        if (!f) {
          const g = { error: `No documentation available for module: ${h}` };
          t.lastValue = g;
          return;
        }
        const m = {
          type: "module",
          name: h,
          description: f.description,
          methods: f.methods || []
        };
        t.lastValue = m;
        return;
      }
    }
    if (e.name === "thread") {
      const c = this.parentThread?.getParent();
      if (!c) {
        const m = "Error: thread command must be executed in a thread context";
        console.log(m), t.lastValue = m;
        return;
      }
      if (!c.isThreadControlEnabled()) {
        const m = "Error: Thread control is disabled. Set threadControl: true in constructor to enable.";
        console.log(m), t.lastValue = m;
        return;
      }
      if (s.length === 0) {
        const m = `Thread Commands:
  thread list              - List all threads
  thread use <id>          - Switch to a thread
  thread create <id>       - Create a new thread with ID
  thread close [id]        - Close current thread or thread by ID`;
        console.log(m), t.lastValue = m;
        return;
      }
      const h = String(s[0]);
      if (h === "list") {
        const m = c.listThreads();
        let g = `Threads:
`;
        for (const y of m) {
          const D = y.isCurrent ? " (current)" : "";
          g += `  - ${y.id}${D}
`;
        }
        console.log(g), t.lastValue = g;
        return;
      }
      if (h === "use" && s.length > 1) {
        const m = String(s[1]);
        try {
          c.useThread(m);
          const g = `Switched to thread: ${m}`;
          console.log(g), t.lastValue = g;
        } catch (g) {
          const y = g instanceof Error ? g.message : String(g);
          console.log(y), t.lastValue = y;
        }
        return;
      }
      if (h === "create" && s.length > 1) {
        const m = String(s[1]);
        try {
          c.createThread(m);
          const g = `Created thread: ${m}`;
          console.log(g), t.lastValue = g;
        } catch (g) {
          const y = g instanceof Error ? g.message : String(g);
          console.log(y), t.lastValue = y;
        }
        return;
      }
      if (h === "close") {
        if (s.length > 1) {
          const m = String(s[1]);
          try {
            c.closeThread(m);
            const g = `Closed thread: ${m}`;
            console.log(g), t.lastValue = g;
          } catch (g) {
            const y = g instanceof Error ? g.message : String(g);
            console.log(y), t.lastValue = y;
          }
        } else {
          const m = c.getCurrentThread();
          if (m) {
            const g = m.id;
            c.closeThread(g);
            const y = `Closed current thread: ${g}`;
            console.log(y), t.lastValue = y;
          } else {
            const g = "Error: No current thread to close";
            console.log(g), t.lastValue = g;
          }
        }
        return;
      }
      const f = "Error: thread command usage: thread list|use <id>|create <id>|close [id]";
      console.log(f), t.lastValue = f;
      return;
    }
    if (e.name === "module") {
      const c = this.parentThread?.getParent();
      if (s.length === 0) {
        const m = `Module Commands:
  module list              - List all available modules`;
        console.log(m), t.lastValue = m;
        return;
      }
      if (String(s[0]) === "list") {
        let m;
        c ? m = c.getAllModuleInfo() : m = new Map(this.environment.moduleMetadata);
        const g = Array.from(m.keys());
        let y = `Available Modules:
`;
        if (g.length === 0)
          y += `  (no modules registered)
`;
        else
          for (const D of g.sort()) {
            const C = m.get(D);
            C ? y += `  - ${D}: ${C.description}
` : y += `  - ${D}
`;
          }
        console.log(y), t.lastValue = y;
        return;
      }
      const f = "Error: module command usage: module list";
      console.log(f), t.lastValue = f;
      return;
    }
    if (e.name === "set") {
      if (e.args.length < 2)
        throw new Error("set requires at least 2 arguments: variable name and value (optional fallback as 3rd arg)");
      const c = e.args[0];
      if (c.type !== "var")
        throw new Error("set first argument must be a variable (e.g., $myVar)");
      const h = c.name, f = c.path;
      let m = await this.evaluateArg(e.args[1], n);
      if ((m == null || typeof m == "string" && m.trim() === "" || Array.isArray(m) && m.length === 0 || typeof m == "object" && Object.keys(m).length === 0) && e.args.length >= 3 && (m = await this.evaluateArg(e.args[2], n)), f && f.length > 0) {
        if (this.setVariableAtPath(h, f, m, n), h === "")
          return;
      } else
        this.setVariable(h, m, n);
      t.lastValue = m;
      return;
    }
    if (e.name === "var") {
      if (e.args.length < 1)
        throw new Error("var requires at least 1 argument: variable name (optional default value as 2nd arg)");
      const c = t.lastValue, h = e.args[0];
      if (h.type !== "var")
        throw new Error("var first argument must be a variable (e.g., $myVar)");
      const f = h.name, m = h.path;
      if (m && m.length > 0)
        throw new Error("var command does not support attribute paths (e.g., $user.name). Use simple variable names only.");
      if (this.environment.variables.has(f))
        throw new Error(`Variable $${f} is already declared`);
      let g = null;
      e.args.length >= 2 && (g = await this.evaluateArg(e.args[1], n)), this.environment.variables.set(f, g), e.decorators && e.decorators.length > 0 && await this.executeDecorators(e.decorators, f, null, [], n), t.lastValue = c;
      return;
    }
    if (e.name === "const") {
      if (e.args.length < 2)
        throw new Error("const requires 2 arguments: constant name and value");
      const c = t.lastValue, h = e.args[0];
      if (h.type !== "var")
        throw new Error("const first argument must be a variable (e.g., $MY_CONST)");
      const f = h.name, m = h.path;
      if (m && m.length > 0)
        throw new Error("const command does not support attribute paths (e.g., $user.name). Use simple variable names only.");
      if (this.environment.constants.has(f))
        throw new Error(`Constant $${f} is already declared`);
      if (this.environment.variables.has(f))
        throw new Error(`Variable $${f} already exists. Cannot declare as constant.`);
      const g = await this.evaluateArg(e.args[1]);
      this.environment.variables.set(f, g), this.environment.constants.add(f), e.decorators && e.decorators.length > 0 && await this.executeDecorators(e.decorators, f, null, [], n), t.lastValue = c;
      return;
    }
    if (e.name === "empty") {
      if (e.args.length < 1)
        throw new Error("empty requires 1 argument: variable name");
      const c = t.lastValue, h = e.args[0];
      if (h.type !== "var")
        throw new Error("empty first argument must be a variable (e.g., $myVar)");
      const f = h.name, m = h.path;
      if ((!m || m.length === 0) && this.environment.constants.has(f))
        throw new Error(`Cannot empty constant $${f}. Constants are immutable.`);
      m && m.length > 0 ? this.setVariableAtPath(f, m, null) : this.setVariable(f, null), t.lastValue = c;
      return;
    }
    if (e.name === "end")
      throw new Ge();
    if (e.name === "meta" || e.name === "setMeta") {
      if (e.args.length < 3)
        throw new Error(`${e.name} requires 3 arguments: target (fn/variable), meta key, and value`);
      const c = e.args[0], h = this.reconstructOriginalInput(c);
      if (h === null)
        throw new Error(`${e.name} target must be a variable or string literal`);
      const f = h, m = String(await this.evaluateArg(e.args[1], n)), g = await this.evaluateArg(e.args[2], n);
      if (f.startsWith("$")) {
        const y = f.slice(1);
        this.environment.variableMetadata.has(y) || this.environment.variableMetadata.set(y, /* @__PURE__ */ new Map()), this.environment.variableMetadata.get(y).set(m, g);
      } else {
        const y = f;
        this.environment.functionMetadata.has(y) || this.environment.functionMetadata.set(y, /* @__PURE__ */ new Map()), this.environment.functionMetadata.get(y).set(m, g);
      }
      return;
    }
    if (e.name === "getMeta") {
      if (e.args.length < 1)
        throw new Error("getMeta requires at least 1 argument: target (fn/variable)");
      const c = e.args[0], h = this.reconstructOriginalInput(c);
      if (h === null)
        throw new Error("getMeta target must be a variable or string literal");
      const f = h;
      if (f.startsWith("$")) {
        const m = f.slice(1), g = this.environment.variableMetadata?.get(m);
        if (!g || g.size === 0) {
          t.lastValue = null;
          return;
        }
        if (e.args.length >= 2) {
          const D = String(await this.evaluateArg(e.args[1], n)), C = g.get(D);
          t.lastValue = C !== void 0 ? C : null;
          return;
        }
        const y = {};
        for (const [D, C] of g.entries())
          y[D] = C;
        t.lastValue = y;
        return;
      } else {
        const m = f, g = this.environment.functionMetadata?.get(m);
        if (!g || g.size === 0) {
          t.lastValue = null;
          return;
        }
        if (e.args.length >= 2) {
          const D = String(await this.evaluateArg(e.args[1], n)), C = g.get(D);
          t.lastValue = C !== void 0 ? C : null;
          return;
        }
        const y = {};
        for (const [D, C] of g.entries())
          y[D] = C;
        t.lastValue = y;
        return;
      }
    }
    if (e.name === "getType") {
      if (e.args.length < 1)
        throw new Error("getType requires 1 argument: variable name");
      const c = e.args[0];
      if (c.type !== "var")
        throw new Error("getType first argument must be a variable (e.g., $myVar)");
      const h = await this.evaluateArg(c, n);
      let f;
      h === null ? f = "null" : h === void 0 ? f = "undefined" : typeof h == "string" ? f = "string" : typeof h == "number" ? f = "number" : typeof h == "boolean" ? f = "boolean" : Array.isArray(h) ? f = "array" : typeof h == "object" ? f = "object" : f = "unknown", t.lastValue = f;
      return;
    }
    if (e.name === "has") {
      if (e.args.length < 1)
        throw new Error("has requires at least 1 argument: variable/function name");
      const c = e.args[0];
      let h = this.reconstructOriginalInput(c);
      if (h === null)
        if (c.type === "call")
          h = c.callee;
        else if (c.type === "literal" && typeof c.value == "string")
          h = c.value;
        else
          throw new Error("has target must be a variable, function name, or string literal");
      if (h === null)
        throw new Error("has target must be a variable, function name, or string literal");
      if (h.startsWith("$")) {
        const m = h.substring(1);
        let g = false;
        (this.getCurrentFrame().locals.has(m) || this.environment.variables.has(m)) && (g = true), t.lastValue = g;
        return;
      }
      const f = h.indexOf(".");
      if (f >= 0) {
        const m = h.substring(0, f), g = h.substring(f + 1), y = `${m}.${g}`, D = this.environment.builtins.has(y) || this.environment.metadata && this.environment.metadata.has(y);
        t.lastValue = D;
        return;
      }
      if (this.environment.functions.has(h)) {
        t.lastValue = true;
        return;
      }
      if (this.environment.builtins.has(h)) {
        t.lastValue = true;
        return;
      }
      t.lastValue = false;
      return;
    }
    if (e.name === "clear") {
      t.lastValue = null;
      return;
    }
    if (e.name === "forget") {
      if (e.args.length < 1)
        throw new Error("forget requires 1 argument: variable or function name");
      const c = e.args[0];
      let h;
      if (c.type === "var")
        h = c.name;
      else if (c.type === "string" || c.type === "literal")
        h = String(await this.evaluateArg(c, n));
      else
        throw new Error("forget argument must be a variable (e.g., $var) or function name (string)");
      t.forgotten || (t.forgotten = /* @__PURE__ */ new Set()), t.forgotten.add(h);
      return;
    }
    if (e.name === "fallback") {
      if (e.args.length < 1)
        throw new Error("fallback requires at least 1 argument: variable name (optional fallback as 2nd arg)");
      const c = e.args[0];
      if (c.type !== "var")
        throw new Error("fallback first argument must be a variable (e.g., $myVar)");
      const h = await this.evaluateArg(c, n);
      if ((h == null || typeof h == "string" && h.trim() === "" || Array.isArray(h) && h.length === 0 || typeof h == "object" && Object.keys(h).length === 0) && e.args.length >= 2) {
        const m = await this.evaluateArg(e.args[1], n);
        t.lastValue = m;
        return;
      }
      t.lastValue = h;
      return;
    }
    if (e.name === "json" && s.length > 0 && this.environment.builtins.has("json")) {
      const c = this.environment.builtins.get("json"), h = await Promise.resolve(c(s));
      t.lastValue = h !== void 0 ? h : null;
      return;
    }
    const a = e.name.includes(".");
    let u = e.name;
    if (!a && this.environment.currentModule && (u = `${this.environment.currentModule}.${u}`), t.forgotten && (t.forgotten.has(e.name) || u !== e.name && t.forgotten.has(u)))
      throw this.unknownFunctionError(e.name);
    const l = this.environment.functions.get(e.name);
    if (l) {
      const c = t.lastValue, h = await this.callFunction(l, s);
      if (e.into) {
        const f = h !== void 0 ? h : null;
        e.into.targetPath && e.into.targetPath.length > 0 ? this.setVariableAtPath(e.into.targetName, e.into.targetPath, f) : this.setVariable(e.into.targetName, f), t.lastValue = c;
      } else
        t.lastValue = h !== void 0 ? h : null;
      return;
    }
    if (e.name === "length" && s.length > 0) {
      const c = s[0];
      if (Array.isArray(c)) {
        const h = this.environment.builtins.get("array.length");
        if (h) {
          const f = await Promise.resolve(h(s));
          t.lastValue = f !== void 0 ? f : null;
          return;
        }
      } else {
        const h = this.environment.builtins.get("string.length");
        if (h) {
          const f = await Promise.resolve(h(s));
          t.lastValue = f !== void 0 ? f : null;
          return;
        }
      }
    }
    let p = this.environment.builtins.get(u);
    if (!p && u !== e.name && (p = this.environment.builtins.get(e.name)), p) {
      const c = t.lastValue;
      let h = null;
      if (e.callback) {
        const D = this.getCurrentFrame(n);
        h = async (C) => {
          const x = {
            locals: /* @__PURE__ */ new Map(),
            lastValue: null,
            isFunctionFrame: true
          };
          for (let b = 0; b < C.length; b++)
            x.locals.set(String(b + 1), C[b]);
          if (e.callback && e.callback.paramNames)
            for (let b = 0; b < e.callback.paramNames.length; b++) {
              const v = e.callback.paramNames[b], F = b < C.length ? C[b] : null;
              x.locals.set(v, F);
            }
          const E = x.lastValue;
          this.callStack.push(x);
          let w = null;
          try {
            if (e.callback) {
              for (const b of e.callback.body)
                await this.executeStatement(b, x);
              e.callback.body.length === 0 || x.lastValue === E ? w = null : w = x.lastValue;
            }
          } catch (b) {
            if (b instanceof se)
              w = b.value;
            else
              throw b;
          } finally {
            this.callStack.pop(), e.callback && e.callback.into && (e.callback.into.targetPath && e.callback.into.targetPath.length > 0 ? this.setVariableAtPath(e.callback.into.targetName, e.callback.into.targetPath, w, D) : this.setVariable(e.callback.into.targetName, w, D));
          }
          return w;
        };
      }
      const f = await Promise.resolve(p(s, h)), m = u === "log" || e.name === "log", g = u.startsWith("test.assert") || e.name.startsWith("test.assert") || u === "assert" || e.name === "assert", y = u === "time.sleep" || e.name === "time.sleep" || u === "sleep" && this.environment.currentModule === "time";
      if (e.into) {
        const D = f !== void 0 ? f : null;
        e.into.targetPath && e.into.targetPath.length > 0 ? this.setVariableAtPath(e.into.targetName, e.into.targetPath, D) : this.setVariable(e.into.targetName, D), t.lastValue = c;
      } else
        m || g || y ? t.lastValue = c : t.lastValue = f !== void 0 ? f : null;
      return;
    }
    throw this.unknownFunctionError(e.name);
  }
  /**
   * Execute decorators for a target (function or variable)
   * @param decorators Array of decorator calls
   * @param targetName Name of the target (function or variable)
   * @param func Function object (null for variables)
   * @param originalArgs Original arguments (for functions, empty array for variables)
   * @returns Modified arguments (for functions) or original args unchanged
   */
  async executeDecorators(e, n, t, r, o) {
    let s = r;
    for (const a of e) {
      if (this.environment.parseDecorators.has(a.name))
        continue;
      const u = [];
      for (const c of a.args) {
        const h = await this.evaluateArg(c, o);
        u.push(h);
      }
      const l = this.environment.decorators.get(a.name);
      if (!l)
        throw new Error(`Unknown decorator: @${a.name}. Decorators must be registered via registerDecorator() API, not defined in scripts.`);
      l.__environment = this.environment;
      const p = await l(
        n,
        // Target name (function or variable name)
        t,
        // Function object (null for variables)
        s,
        // Current args (may have been modified by previous decorators)
        u,
        // Decorator's own arguments (evaluated)
        a.args
        // Original decorator args (AST nodes, for extracting variable names)
      );
      delete l.__environment, Array.isArray(p) && (s = p);
    }
    return s;
  }
  async callFunction(e, n) {
    const t = this.recursionDepth.get(e.name) || 0;
    if (t >= __.MAX_RECURSION_DEPTH)
      throw new Error(`Maximum recursion depth (${__.MAX_RECURSION_DEPTH}) exceeded for function "${e.name}". This usually indicates infinite recursion.`);
    this.recursionDepth.set(e.name, t + 1);
    let r = n;
    e.decorators && e.decorators.length > 0 && (r = await this.executeDecorators(e.decorators, e.name, e, n));
    const o = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: null,
      isFunctionFrame: true
    };
    let s = [], a = {};
    if (r.length > 0 && e.paramNames.length > 0) {
      const l = r[r.length - 1];
      if (typeof l == "object" && l !== null && !Array.isArray(l)) {
        const p = Object.keys(l);
        p.length > 0 && p.every((h) => e.paramNames.includes(h)) ? (a = l, s = r.slice(0, -1)) : s = r;
      } else
        s = r;
    } else
      s = r;
    const u = [];
    for (let l = 0; l < e.paramNames.length; l++) {
      const p = e.paramNames[l];
      let c;
      a && p in a ? c = a[p] : c = l < s.length ? s[l] : null, o.locals.set(p, c), u.push(c);
    }
    for (let l = 0; l < u.length; l++)
      o.locals.set(String(l + 1), u[l]);
    for (let l = e.paramNames.length; l < s.length; l++)
      o.locals.set(String(l + 1), s[l]);
    e.paramNames.includes("args") || o.locals.set("args", a), this.callStack.push(o);
    try {
      for (const l of e.body)
        await this.executeStatement(l);
      return o.lastValue;
    } catch (l) {
      if (l instanceof se)
        return l.value;
      throw l;
    } finally {
      this.callStack.pop();
      const l = this.recursionDepth.get(e.name) || 0;
      l > 1 ? this.recursionDepth.set(e.name, l - 1) : this.recursionDepth.delete(e.name);
    }
  }
  async executeAssignment(e, n) {
    if (this.environment.constants.has(e.targetName))
      throw new Error(`Cannot reassign constant $${e.targetName}. Constants are immutable.`);
    const t = n !== void 0 ? n : this.getCurrentFrame();
    let r;
    if (e.isLastValue)
      r = t.lastValue;
    else if (e.literalValue !== void 0)
      if (e.literalValueType === "string" && typeof e.literalValue == "string" && e.literalValue.startsWith("\0TEMPLATE\0")) {
        const o = e.literalValue.substring(10);
        r = await re.evaluate(o, {
          resolveVariable: (s, a, u) => this.resolveVariable(s, a, u),
          getLastValue: (s) => (s !== void 0 ? s : this.getCurrentFrame()).lastValue,
          executeSubexpression: (s, a) => this.executeSubexpressionWithFrame(s, a)
        }, n);
      } else
        r = e.literalValue;
    else if (e.command) {
      const o = t.lastValue;
      await this.executeCommand(e.command, n), r = t.lastValue, t.lastValue = o;
    } else
      throw le({
        message: "Assignment must have either literalValue or command",
        codePos: e.codePos,
        code: this.sourceCode || void 0
      });
    if (e.isSet && e.fallbackValue !== void 0 && (r == null || typeof r == "string" && r.trim() === "" || Array.isArray(r) && r.length === 0 || typeof r == "object" && r !== null && Object.keys(r).length === 0))
      if (e.fallbackValueType === "string" && typeof e.fallbackValue == "string" && e.fallbackValue.startsWith("\0TEMPLATE\0")) {
        const s = e.fallbackValue.substring(10);
        r = await re.evaluate(s, {
          resolveVariable: (a, u, l) => this.resolveVariable(a, u, l),
          getLastValue: (a) => (a !== void 0 ? a : this.getCurrentFrame()).lastValue,
          executeSubexpression: (a, u) => this.executeSubexpressionWithFrame(a, u)
        }, n);
      } else
        r = e.fallbackValue;
    e.isSet && (t.lastValue = r), e.targetPath && e.targetPath.length > 0 ? this.setVariableAtPath(e.targetName, e.targetPath, r) : this.setVariable(e.targetName, r), e.isConst && this.environment.constants.add(e.targetName), e.decorators && e.decorators.length > 0 && await this.executeDecorators(e.decorators, e.targetName, null, [], n);
  }
  executeShorthandAssignment(e, n) {
    if (this.environment.constants.has(e.targetName))
      throw new Error(`Cannot reassign constant $${e.targetName}. Constants are immutable.`);
    const r = this.getCurrentFrame(n).lastValue;
    /^[0-9]+$/.test(e.targetName) || this.setVariable(e.targetName, r);
  }
  async executeInlineIf(e, n) {
    const t = n !== void 0 ? n : this.getCurrentFrame(), r = await this.evaluateExpression(e.condition, t);
    Z(r) ? await this.executeStatement(e.command, t) : e.elseCommand && await this.executeStatement(e.elseCommand, t);
  }
  async executeIfBlock(e, n) {
    const t = n !== void 0 ? n : this.getCurrentFrame(), r = await this.evaluateExpression(e.condition, t), o = Z(r), s = t.lastValue;
    if (o) {
      for (const a of e.thenBranch)
        await this.executeStatement(a, t);
      return;
    }
    if (e.elseifBranches)
      for (const a of e.elseifBranches) {
        const u = await this.evaluateExpression(a.condition, t);
        if (Z(u)) {
          for (const l of a.body)
            await this.executeStatement(l, t);
          return;
        }
      }
    if (e.elseBranch)
      for (const a of e.elseBranch)
        await this.executeStatement(a, t);
    else
      t.lastValue = s;
  }
  async executeIfTrue(e, n) {
    const t = this.getCurrentFrame(n);
    Z(t.lastValue) && await this.executeStatement(e.command, n);
  }
  async executeIfFalse(e, n) {
    const t = this.getCurrentFrame(n);
    Z(t.lastValue) || await this.executeStatement(e.command, n);
  }
  async executeReturn(e, n) {
    if (e.value !== void 0) {
      const t = await this.evaluateArg(e.value, n);
      throw new se(t);
    } else
      throw new se(null);
  }
  async executeBreak(e, n) {
    throw new ce();
  }
  async executeContinue(e, n) {
    throw new De();
  }
  async registerFunction(e) {
    const n = this.environment.functions.get(e.name);
    n && n.decorators && (e.decorators = n.decorators), this.environment.functions.set(e.name, e), e.decorators && e.decorators.length > 0 && await this.executeDecorators(e.decorators, e.name, e, []);
  }
  registerEventHandler(e) {
    const n = this.environment.eventHandlers.get(e.eventName) || [];
    n.includes(e) || (n.push(e), this.environment.eventHandlers.set(e.eventName, n));
  }
  async executeScope(e, n) {
    const t = this.getCurrentFrame(n), r = t.lastValue;
    if (__.debug) {
      const l = (/* @__PURE__ */ new Date()).toISOString();
      console.log(`[Executor.executeScope] [${l}] Starting do block execution. Body statements: ${e.body.length}, isolated: ${e.paramNames && e.paramNames.length > 0}, callStack depth: ${this.callStack.length}`);
    }
    const o = e.paramNames && e.paramNames.length > 0, s = o ? null : t.lastValue, a = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: s,
      // Inherit parent's $ unless isolated scope
      isFunctionFrame: true,
      // Scope uses function-like scoping rules
      isIsolatedScope: o
      // Mark as isolated if parameters are declared
    };
    if (e.paramNames)
      for (const l of e.paramNames) {
        let p = null;
        t.locals.has(l) ? p = t.locals.get(l) : this.environment.variables.has(l) && (p = this.environment.variables.get(l)), a.locals.set(l, p);
      }
    this.callStack.push(a);
    let u = null;
    try {
      let l = 0;
      for (const p of e.body) {
        if (l++, __.debug) {
          const c = (/* @__PURE__ */ new Date()).toISOString();
          console.log(`[Executor.executeScope] [${c}] Executing statement ${l}/${e.body.length}, type: ${p.type}`);
        }
        await this.executeStatement(p, a);
      }
      if (__.debug) {
        const p = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[Executor.executeScope] [${p}] Completed do block execution. Statements executed: ${l}`);
      }
      e.body.length === 0 ? u = null : a.lastValue === s ? u = s : u = a.lastValue;
    } catch (l) {
      if (l instanceof se)
        a.lastValue = l.value, u = l.value;
      else
        throw l;
    } finally {
      this.callStack.pop(), e.into ? (e.into.targetPath && e.into.targetPath.length > 0 ? this.setVariableAtPath(e.into.targetName, e.into.targetPath, u) : this.setVariable(e.into.targetName, u), t.lastValue = r) : t.lastValue = u;
    }
  }
  async executeTogether(e) {
    const n = this.getCurrentFrame(), t = e.blocks.map(async (r) => {
      const o = this.spawnChild(), s = r.paramNames && r.paramNames.length > 0, a = s ? null : n.lastValue, u = {
        locals: /* @__PURE__ */ new Map(),
        lastValue: a,
        // Inherit parent's $ unless isolated scope
        isFunctionFrame: true,
        isIsolatedScope: s
      };
      if (r.paramNames)
        for (const p of r.paramNames) {
          let c = null;
          n.locals.has(p) ? c = n.locals.get(p) : this.environment.variables.has(p) && (c = this.environment.variables.get(p)), u.locals.set(p, c);
        }
      o.callStack.push(u);
      let l = null;
      try {
        for (const p of r.body)
          await o.executeStatement(p, u);
        r.body.length === 0 || u.lastValue === a ? l = null : l = u.lastValue;
      } catch (p) {
        if (p instanceof se)
          u.lastValue = p.value, l = p.value;
        else
          throw p;
      } finally {
        o.callStack.pop();
      }
      r.into && (r.into.targetPath && r.into.targetPath.length > 0 ? this.setVariableAtPathInParentScope(n, r.into.targetName, r.into.targetPath, l) : this.setVariable(r.into.targetName, l, n));
    });
    await Promise.all(t);
  }
  /**
   * Set a variable at a path in the parent scope (for together blocks)
   */
  setVariableAtPathInParentScope(e, n, t, r) {
    let o;
    if (e.locals.has(n) ? o = e.locals.get(n) : this.environment.variables.has(n) ? o = this.environment.variables.get(n) : (t[0].type === "index" ? o = [] : o = {}, e.isFunctionFrame ? e.locals.set(n, o) : this.environment.variables.set(n, o)), o != null && typeof o != "object" && (t[0].type === "index" ? o = [] : o = {}, e.locals.has(n) ? e.locals.set(n, o) : this.environment.variables.set(n, o)), o == null)
      throw new Error("Cannot set property on null or undefined");
    if (typeof o != "object")
      throw new Error(`Cannot set property on ${typeof o}`);
    let s = o;
    for (let u = 0; u < t.length - 1; u++) {
      const l = t[u], p = t[u + 1];
      if (l.type === "property") {
        if (s[l.name] === null || s[l.name] === void 0)
          p.type === "index" ? s[l.name] = [] : s[l.name] = {};
        else if (typeof s[l.name] != "object")
          throw new Error(`Cannot access property '${l.name}' of ${typeof s[l.name]}`);
        s = s[l.name];
      } else if (l.type === "index") {
        if (!Array.isArray(s))
          throw new Error(`Cannot access index ${l.index} of non-array value`);
        if (l.index < 0)
          throw new Error(`Index ${l.index} must be non-negative`);
        for (; s.length <= l.index; )
          s.push(null);
        (s[l.index] === null || s[l.index] === void 0) && (p.type === "index" ? s[l.index] = [] : s[l.index] = {}), s = s[l.index];
      } else if (l.type === "dynamicKey") {
        const c = this.resolveDynamicKey(l);
        if (c == null)
          throw new Error("Dynamic key resolved to null or undefined");
        const h = String(c);
        if (s[h] === null || s[h] === void 0)
          p.type === "index" ? s[h] = [] : s[h] = {};
        else if (typeof s[h] != "object")
          throw new Error(`Cannot access property '${h}' of ${typeof s[h]}`);
        s = s[h];
      }
    }
    const a = t[t.length - 1];
    if (a.type === "property")
      s[a.name] = r;
    else if (a.type === "index") {
      if (!Array.isArray(s))
        throw new Error(`Cannot set index ${a.index} on non-array value`);
      if (a.index < 0)
        throw new Error(`Index ${a.index} must be non-negative`);
      for (; s.length <= a.index; )
        s.push(null);
      s[a.index] = r;
    } else if (a.type === "dynamicKey") {
      const u = this.resolveDynamicKey(a);
      if (u == null)
        throw new Error("Dynamic key resolved to null or undefined");
      s[String(u)] = r;
    }
  }
  async executeForLoop(e, n) {
    const t = this.getCurrentFrame(n);
    let r = [], o = false, s = 0, a = 0, u = 1;
    if (e.iterable) {
      const h = await this.evaluateExpression(e.iterable, n);
      if (!Array.isArray(h))
        throw new Error(`for loop iterable must be an array, got ${typeof h}`);
      r = h;
    } else if (e.from && e.to) {
      if (o = true, s = Number(await this.evaluateExpression(e.from, n)), a = Number(await this.evaluateExpression(e.to, n)), e.step && (u = Number(await this.evaluateExpression(e.step, n))), isNaN(s) || isNaN(a) || isNaN(u))
        throw new Error(`for loop range parameters must be numbers (from: ${s}, to: ${a}, step: ${u})`);
      if (u === 0)
        throw new Error("for loop step cannot be 0");
    }
    const l = t.lastValue, p = async (h, f) => {
      t.locals.set(e.varName, h), e.keyVarName && t.locals.set(e.keyVarName, f), t.lastValue = h;
      for (const m of e.body)
        await this.executeStatement(m, n);
    };
    let c = 0;
    if (o) {
      let h = 0;
      if (u > 0)
        for (let f = s; f <= a; f += u)
          try {
            await p(f, h++), c++;
          } catch (m) {
            if (m instanceof ce) break;
            if (m instanceof De) continue;
            throw m;
          }
      else
        for (let f = s; f >= a; f += u)
          try {
            await p(f, h++), c++;
          } catch (m) {
            if (m instanceof ce) break;
            if (m instanceof De) continue;
            throw m;
          }
    } else
      for (let h = 0; h < r.length; h++)
        try {
          await p(r[h], h), c++;
        } catch (f) {
          if (f instanceof ce) break;
          if (f instanceof De) continue;
          throw f;
        }
    c === 0 && (t.lastValue = l);
  }
  async evaluateArg(e, n, t) {
    if (e.type === "var" || e.type === "lastValue" || e.type === "literal" || e.type === "number" || e.type === "string" || e.type === "objectLiteral" || e.type === "arrayLiteral" || e.type === "subexpression" || e.type === "binary" || e.type === "unary" || e.type === "call")
      return await this.evaluateExpression(e, n);
    if (e.type === "subexpr" || e.type === "object" || e.type === "array")
      switch (e.type) {
        case "subexpr":
          return await this.executeSubexpression(e.code);
        case "object":
          if (!e.code || e.code.trim() === "")
            return {};
          try {
            const r = await this.interpolateObjectLiteral(e.code, n);
            return pe.parse(`{${r}}`);
          } catch (r) {
            const o = r instanceof Error ? r.message : String(r);
            throw le({
              message: `Invalid object literal: ${o}`,
              codePos: t,
              code: this.sourceCode || void 0
            });
          }
        case "array":
          if (!e.code || e.code.trim() === "")
            return [];
          try {
            const r = await this.interpolateObjectLiteral(e.code, n);
            return pe.parse(`[${r}]`);
          } catch (r) {
            const o = r instanceof Error ? r.message : String(r);
            throw le({
              message: `Invalid array literal: ${o}`,
              codePos: t,
              code: this.sourceCode || void 0
            });
          }
      }
    if (e.type === "namedArgs") {
      const r = {};
      for (const [o, s] of Object.entries(e.args))
        r[o] = await this.evaluateExpression(s, n);
      return r;
    }
    throw new Error(`Unknown arg type: ${e.type}`);
  }
  /**
   * Interpolate variables and subexpressions in object literal code
   * Replaces $var, $(expr), $ (last value), and [$key] with their actual values
   * 
   * TODO: AST Refactor - This method will be removed once ObjectLiteralExpression
   * is used. Object literals will be evaluated by walking the properties AST nodes.
   */
  async interpolateObjectLiteral(e, n) {
    let t = e;
    const r = [];
    let o = 0;
    for (; o < e.length; )
      if (e[o] === "$" && o + 1 < e.length && e[o + 1] === "(") {
        let x = 1, E = o + 2;
        for (; E < e.length && x > 0; ) {
          if (e[E] === "\\") {
            E += 2;
            continue;
          }
          if (e[E] === "$" && E + 1 < e.length && e[E + 1] === "(") {
            x++, E += 2;
            continue;
          }
          if (e[E] === "(")
            x++;
          else if (e[E] === ")" && (x--, x === 0)) {
            const w = e.substring(o + 2, E), b = o, v = E + 1;
            r.push({
              start: b,
              end: v,
              promise: this.executeSubexpression(w).then((F) => F === null ? "null" : typeof F == "string" ? JSON.stringify(F) : typeof F == "number" || typeof F == "boolean" ? String(F) : Array.isArray(F) || typeof F == "object" ? JSON.stringify(F) : String(F))
            }), o = E + 1;
            break;
          }
          E++;
        }
        x > 0 && o++;
      } else
        o++;
    const s = await Promise.all(r.map((x) => x.promise));
    for (let x = r.length - 1; x >= 0; x--) {
      const { start: E, end: w } = r[x], b = s[x];
      t = t.substring(0, E) + b + t.substring(w);
    }
    const a = /`([^`]*)`/g, u = [];
    let l;
    for (; (l = a.exec(t)) !== null; ) {
      const x = l[1], E = l.index, w = l.index + l[0].length;
      u.push({
        start: E,
        end: w,
        promise: re.evaluate(x, {
          resolveVariable: (b, v, F) => this.resolveVariable(b, v, F),
          getLastValue: (b) => this.getCurrentFrame(b).lastValue,
          executeSubexpression: async (b, v) => await this.executeSubexpressionWithFrame(b, v)
        }, n).then((b) => JSON.stringify(b))
      });
    }
    const p = await Promise.all(u.map((x) => x.promise));
    for (let x = u.length - 1; x >= 0; x--) {
      const { start: E, end: w } = u[x], b = p[x];
      t = t.substring(0, E) + b + t.substring(w);
    }
    const c = /\[(\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])*)\]\s*:/g, h = [];
    let f;
    for (; (f = c.exec(t)) !== null; ) {
      const x = f[1], { name: E, path: w } = L.parseVariablePath(x), b = this.resolveVariable(E, w);
      if (b != null) {
        const v = typeof b == "string" ? b : String(b);
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(v) ? h.push({
          match: f[0],
          replacement: `${v}:`
        }) : h.push({
          match: f[0],
          replacement: `"${v.replace(/"/g, '\\"')}":`
        });
      }
    }
    for (let x = h.length - 1; x >= 0; x--) {
      const { match: E, replacement: w } = h[x], b = t.lastIndexOf(E);
      b >= 0 && (t = t.substring(0, b) + w + t.substring(b + E.length));
    }
    let m = false, g = false, y = 0;
    const D = [];
    let C = 0;
    for (; y < t.length; ) {
      const x = t[y];
      if (!g && (x === '"' || x === "'" || x === "`")) {
        m ? x === m && (m = false) : m = x, g = false, y++;
        continue;
      }
      if (m) {
        g = x === "\\" && !g, y++;
        continue;
      }
      if (x === "$") {
        const E = y + 1 < t.length ? t[y + 1] : null;
        if (E === null || /[\s,}\]\)]/.test(E)) {
          const b = this.getCurrentFrame(n).lastValue;
          let v;
          b === null ? v = "null" : typeof b == "string" ? v = JSON.stringify(b) : typeof b == "number" || typeof b == "boolean" ? v = String(b) : Array.isArray(b) || typeof b == "object" ? v = JSON.stringify(b) : v = String(b), y > C && D.push(t.substring(C, y)), D.push(v), C = y + 1, y = y + 1;
          continue;
        } else if (/[A-Za-z_0-9]/.test(E)) {
          let w = y + 1;
          if (/[0-9]/.test(E))
            for (; w < t.length && /[0-9]/.test(t[w]); )
              w++;
          else
            for (; w < t.length && /[A-Za-z0-9_.\[\]]/.test(t[w]); )
              w++;
          const b = t.substring(y, w);
          try {
            const { name: v, path: F } = L.parseVariablePath(b), T = this.resolveVariable(v, F);
            let S;
            T === null ? S = "null" : typeof T == "string" ? S = JSON.stringify(T) : typeof T == "number" || typeof T == "boolean" ? S = String(T) : Array.isArray(T) || typeof T == "object" ? S = JSON.stringify(T) : S = String(T), y > C && D.push(t.substring(C, y)), D.push(S), C = w, y = w;
            continue;
          } catch {
          }
        }
      }
      g = false, y++;
    }
    return C < t.length && D.push(t.substring(C)), D.join("");
  }
  /**
   * Execute a subexpression from code string with frame override support
   * 
   * @param code - The subexpression code to execute
   * @param frameOverride - Optional frame override for variable resolution
   */
  async executeSubexpressionWithFrame(e, n) {
    const r = await new W(e).parse(), o = n !== void 0 ? n : this.getCurrentFrame(), s = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: o.lastValue,
      // Start with parent's $ (though it will be overwritten)
      isFunctionFrame: false
      // Subexpressions are not function frames
    };
    for (const [a, u] of o.locals.entries())
      s.locals.set(a, u);
    this.callStack.push(s);
    try {
      for (const a of r)
        await this.executeStatement(a, s);
      return s.lastValue;
    } finally {
      this.callStack.pop();
    }
  }
  /**
   * Execute a subexpression from code string
   * 
   * TODO: AST Refactor - This will be replaced with executeSubexpressionStatements()
   * which takes Statement[] directly, eliminating runtime parsing.
   */
  async executeSubexpression(e) {
    const t = await new W(e).parse(), r = this.getCurrentFrame(), o = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: r.lastValue,
      // Start with caller's $ (though it will be overwritten)
      isFunctionFrame: false
      // Subexpressions are not function frames
    };
    for (const [s, a] of r.locals.entries())
      o.locals.set(s, a);
    this.callStack.push(o);
    try {
      for (const s of t)
        await this.executeStatement(s);
      return o.lastValue;
    } finally {
      this.callStack.pop();
    }
  }
  /**
   * Execute subexpression statements directly (for Expression-based AST)
   * 
   * @param statements - Pre-parsed statements from SubexpressionExpression.body
   * @param frameOverride - Optional frame override for parallel execution
   * @returns The lastValue after executing the statements
   */
  async executeSubexpressionStatements(e, n) {
    const t = this.getCurrentFrame(n), r = {
      locals: /* @__PURE__ */ new Map(),
      lastValue: t.lastValue,
      isFunctionFrame: false
    };
    for (const [o, s] of t.locals.entries())
      r.locals.set(o, s);
    this.callStack.push(r);
    try {
      for (const o of e)
        await this.executeStatement(o, r);
      return r.lastValue;
    } finally {
      this.callStack.pop();
    }
  }
  /**
   * Evaluate an Expression node
   * 
   * @param expr - The Expression node to evaluate
   * @param frameOverride - Optional frame override
   * @returns The evaluated value
   */
  async evaluateExpression(e, n) {
    switch (e.type) {
      case "var":
        return this.resolveVariable(e.name, e.path, n);
      case "lastValue":
        return (n !== void 0 ? n : this.getCurrentFrame()).lastValue;
      case "literal":
        return e.value;
      case "number":
        return e.value;
      case "string":
        if (typeof e.value == "string" && e.value.startsWith("\0TEMPLATE\0")) {
          const o = e.value.substring(10);
          return await re.evaluate(o, {
            resolveVariable: (s, a, u) => this.resolveVariable(s, a, u),
            getLastValue: (s) => (s !== void 0 ? s : this.getCurrentFrame()).lastValue,
            executeSubexpression: (s, a) => this.executeSubexpressionWithFrame(s, a)
          }, n);
        }
        return e.value;
      case "objectLiteral":
        return await this.evaluateObjectLiteral(e, n);
      case "arrayLiteral":
        return await this.evaluateArrayLiteral(e, n);
      case "subexpression":
        return await this.executeSubexpressionStatements(e.body, n);
      case "binary":
        return await this.evaluateBinaryExpression(e, n);
      case "unary":
        return await this.evaluateUnaryExpression(e, n);
      case "call":
        return await this.evaluateCallExpression(e, n);
      default:
        const r = e;
        if (r.type === "array" && r.code !== void 0) {
          if (!r.code || r.code.trim() === "")
            return [];
          try {
            const o = await this.interpolateObjectLiteral(r.code, n);
            return pe.parse(`[${o}]`);
          } catch (o) {
            const s = o instanceof Error ? o.message : String(o);
            throw le({
              message: `Invalid array literal: ${s}`,
              codePos: r.codePos,
              code: this.sourceCode || void 0
            });
          }
        }
        if (r.type === "object" && r.code !== void 0) {
          if (!r.code || r.code.trim() === "")
            return {};
          try {
            const o = await this.interpolateObjectLiteral(r.code, n);
            return pe.parse(`{${o}}`);
          } catch (o) {
            const s = o instanceof Error ? o.message : String(o);
            throw le({
              message: `Invalid object literal: ${s}`,
              codePos: r.codePos,
              code: this.sourceCode || void 0
            });
          }
        }
        throw new Error(`Unknown expression type: ${e.type}`);
    }
  }
  /**
   * Evaluate an ObjectLiteralExpression
   * 
   * @param expr - The ObjectLiteralExpression node
   * @param frameOverride - Optional frame override
   * @returns The evaluated object
   */
  async evaluateObjectLiteral(e, n) {
    const t = {};
    for (const r of e.properties) {
      const o = typeof r.key == "string" ? r.key : String(await this.evaluateExpression(r.key, n)), s = await this.evaluateExpression(r.value, n);
      t[o] = s;
    }
    return t;
  }
  /**
   * Evaluate an ArrayLiteralExpression
   * 
   * @param expr - The ArrayLiteralExpression node
   * @param frameOverride - Optional frame override
   * @returns The evaluated array
   */
  async evaluateArrayLiteral(e, n) {
    const t = [];
    for (const r of e.elements) {
      const o = await this.evaluateExpression(r, n);
      t.push(o);
    }
    return t;
  }
  /**
   * Evaluate a BinaryExpression
   * 
   * @param expr - The BinaryExpression node
   * @param frameOverride - Optional frame override
   * @returns The evaluated value
   */
  async evaluateBinaryExpression(e, n) {
    const t = await this.evaluateExpression(e.left, n), r = await this.evaluateExpression(e.right, n);
    switch (e.operator) {
      case "==":
        return t === r;
      case "!=":
        return t !== r;
      case "<":
        return t < r;
      case "<=":
        return t <= r;
      case ">":
        return t > r;
      case ">=":
        return t >= r;
      case "and":
        return Z(t) && Z(r);
      case "or":
        return Z(t) || Z(r);
      case "+":
        return t + r;
      case "-":
        return t - r;
      case "*":
        return t * r;
      case "/":
        return t / r;
      case "%":
        return t % r;
      default:
        throw new Error(`Unknown binary operator: ${e.operator}`);
    }
  }
  /**
   * Evaluate a UnaryExpression
   * 
   * @param expr - The UnaryExpression node
   * @param frameOverride - Optional frame override
   * @returns The evaluated value
   */
  async evaluateUnaryExpression(e, n) {
    const t = await this.evaluateExpression(e.argument, n);
    switch (e.operator) {
      case "not":
        return !Z(t);
      case "-":
        return -t;
      case "+":
        return +t;
      default:
        throw new Error(`Unknown unary operator: ${e.operator}`);
    }
  }
  /**
   * Evaluate a CallExpression
   * 
   * @param expr - The CallExpression node
   * @param frameOverride - Optional frame override
   * @returns The evaluated value
   */
  async evaluateCallExpression(e, n) {
    const t = [];
    for (const u of e.args)
      t.push(await this.evaluateExpression(u, n));
    const r = this.getCurrentFrame(n), o = r.lastValue, s = {
      type: "command",
      name: e.callee,
      args: e.args,
      // Pass Expression[] directly - evaluateArg will handle them
      codePos: e.codePos || { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
    };
    await this.executeCommand(s, n);
    const a = r.lastValue;
    return r.lastValue = o, a;
  }
  resolveVariable(e, n, t) {
    const r = t !== void 0 ? t : this.getCurrentFrame();
    if (r.forgotten && r.forgotten.has(e))
      return null;
    if (r.isIsolatedScope) {
      let a;
      if (e === "")
        a = r.lastValue;
      else if (r.locals.has(e))
        a = r.locals.get(e);
      else
        return null;
      if (!n || n.length === 0)
        return a;
      let u = a;
      for (let l = 0; l < n.length; l++) {
        const p = n[l];
        if (p.type === "property") {
          if (u == null || typeof u != "object")
            return null;
          u = u[p.name];
        } else if (p.type === "index") {
          if (!Array.isArray(u) || p.index < 0 || p.index >= u.length)
            return null;
          u = u[p.index];
        } else if (p.type === "dynamicKey") {
          if (u == null || typeof u != "object")
            return null;
          const c = this.resolveDynamicKey(p);
          if (c == null)
            return null;
          u = u[String(c)];
        }
      }
      return u;
    }
    let o = null;
    if (e === "")
      o = r.lastValue;
    else if (r.locals.has(e))
      o = r.locals.get(e);
    else {
      let a = false;
      for (let u = this.callStack.length - 2; u >= 0; u--) {
        const l = this.callStack[u];
        if (!l.isIsolatedScope && l.locals.has(e)) {
          o = l.locals.get(e), a = true;
          break;
        }
      }
      if (!a)
        if (this.environment.variables.has(e))
          o = this.environment.variables.get(e);
        else
          return null;
    }
    if (!n || n.length === 0)
      return o;
    let s = o;
    for (let a = 0; a < n.length; a++) {
      const u = n[a];
      if (u.type === "property") {
        if (s == null || typeof s != "object")
          return null;
        s = s[u.name];
      } else if (u.type === "index") {
        if (!Array.isArray(s) || u.index < 0 || u.index >= s.length)
          return null;
        s = s[u.index];
      } else if (u.type === "dynamicKey") {
        if (s == null || typeof s != "object")
          return null;
        const l = this.resolveDynamicKey(u);
        if (l == null)
          return null;
        s = s[String(l)];
      }
    }
    return s;
  }
  setVariable(e, n, t) {
    if (this.environment.constants.has(e))
      throw new Error(`Cannot reassign constant $${e}. Constants are immutable.`);
    const r = this.getCurrentFrame(t), o = r.isFunctionFrame === true;
    if (r.isIsolatedScope === true) {
      r.locals.set(e, n);
      return;
    }
    if (r.locals.has(e)) {
      r.locals.set(e, n);
      return;
    }
    for (let a = this.callStack.length - 2; a >= 0; a--) {
      const u = this.callStack[a];
      if (!u.isIsolatedScope && u.locals.has(e)) {
        u.locals.set(e, n);
        return;
      }
    }
    if (this.environment.variables.has(e)) {
      this.environment.variables.set(e, n);
      return;
    }
    this.callStack.length === 1 ? this.environment.variables.set(e, n) : o ? r.locals.set(e, n) : this.environment.variables.set(e, n);
  }
  /**
   * Set a value at an attribute path (e.g., $animal.cat = 5 or $.property = value)
   */
  setVariableAtPath(e, n, t, r) {
    if ((!n || n.length === 0) && this.environment.constants.has(e))
      throw new Error(`Cannot reassign constant $${e}. Constants are immutable.`);
    const o = this.getCurrentFrame(r), s = o.isIsolatedScope === true;
    let a;
    if (e === "")
      a = o.lastValue, (a == null || typeof a != "object") && (n[0].type === "index" ? a = [] : a = {}, o.lastValue = a);
    else if (s)
      o.locals.has(e) ? a = o.locals.get(e) : (n[0].type === "index" ? a = [] : a = {}, o.locals.set(e, a)), a != null && typeof a != "object" && (n[0].type === "index" ? a = [] : a = {}, o.locals.set(e, a));
    else {
      if (o.locals.has(e))
        a = o.locals.get(e);
      else if (this.environment.variables.has(e))
        a = this.environment.variables.get(e);
      else if (n[0].type === "index" ? a = [] : a = {}, this.callStack.length === 1)
        this.environment.variables.set(e, a);
      else {
        const p = this.getCurrentFrame(r);
        p.isFunctionFrame === true ? p.locals.set(e, a) : this.environment.variables.set(e, a);
      }
      a != null && typeof a != "object" && (n[0].type === "index" ? a = [] : a = {}, o.locals.has(e) ? o.locals.set(e, a) : this.environment.variables.set(e, a));
    }
    if (a == null)
      throw new Error("Cannot set property on null or undefined");
    if (typeof a != "object")
      throw new Error(`Cannot set property on ${typeof a}`);
    let u = a;
    for (let p = 0; p < n.length - 1; p++) {
      const c = n[p], h = n[p + 1];
      if (c.type === "property") {
        if (u[c.name] === null || u[c.name] === void 0)
          h.type === "index" ? u[c.name] = [] : u[c.name] = {};
        else if (typeof u[c.name] != "object")
          throw new Error(`Cannot access property '${c.name}' of ${typeof u[c.name]}`);
        u = u[c.name];
      } else if (c.type === "index") {
        if (!Array.isArray(u))
          throw new Error(`Cannot access index ${c.index} of non-array value`);
        if (c.index < 0)
          throw new Error(`Index ${c.index} must be non-negative`);
        for (; u.length <= c.index; )
          u.push(null);
        (u[c.index] === null || u[c.index] === void 0) && (h.type === "index" ? u[c.index] = [] : u[c.index] = {}), u = u[c.index];
      } else if (c.type === "dynamicKey") {
        const f = this.resolveDynamicKey(c);
        if (f == null)
          throw new Error("Dynamic key resolved to null or undefined");
        const m = String(f);
        if (u[m] === null || u[m] === void 0)
          h.type === "index" ? u[m] = [] : u[m] = {};
        else if (typeof u[m] != "object")
          throw new Error(`Cannot access property '${m}' of ${typeof u[m]}`);
        u = u[m];
      }
    }
    const l = n[n.length - 1];
    if (l.type === "property")
      u[l.name] = t;
    else if (l.type === "index") {
      if (!Array.isArray(u))
        throw new Error(`Cannot set index ${l.index} on non-array value`);
      if (l.index < 0)
        throw new Error(`Index ${l.index} must be non-negative`);
      for (; u.length <= l.index; )
        u.push(null);
      u[l.index] = t;
    } else if (l.type === "dynamicKey") {
      const p = this.resolveDynamicKey(l);
      if (p == null)
        throw new Error("Dynamic key resolved to null or undefined");
      u[String(p)] = t;
    }
  }
  /**
   * Resolve a dynamic key segment to its actual key value
   */
  resolveDynamicKey(e) {
    return this.resolveVariable(e.variable, e.varPath);
  }
  // isTruthy isTruthy is imported from utils
};
var nt = class {
  steps = [];
  logs = [];
  nodeStates = /* @__PURE__ */ new Map();
  indexedStates = /* @__PURE__ */ new Map();
  onLog = null;
  setLogCallback(e) {
    this.onLog = e;
  }
  addStep(e) {
    this.steps.push(e), this.nodeStates.set(e.nodeKey, e);
  }
  addLog(e) {
    this.logs.push(e), this.onLog && this.onLog(e);
  }
  getSteps() {
    return this.steps;
  }
  getLogs() {
    return this.logs;
  }
  getNodeState(e) {
    return this.nodeStates.get(e);
  }
  getState(e) {
    return this.indexedStates.get(e);
  }
  setState(e, n) {
    this.indexedStates.set(e, n);
  }
  clear() {
    this.steps = [], this.logs = [], this.nodeStates.clear(), this.indexedStates.clear();
  }
};
var rt = class {
  environment;
  constructor(e) {
    this.environment = e;
  }
  /**
   * Find the module name for a given function name
   * Returns the module name if found, null otherwise
   */
  findModuleName(e, n) {
    if (e.includes("."))
      return e.split(".")[0] || null;
    const t = n !== void 0 ? n : this.environment.currentModule;
    if (t) {
      const r = `${t}.${e}`;
      if (this.environment.builtins.has(r) || this.environment.metadata.has(r))
        return t;
    }
    if (this.environment.builtins.has(e) || this.environment.metadata.has(e))
      return null;
    for (const [r] of this.environment.builtins.entries())
      if (r.includes(".") && r.endsWith(`.${e}`))
        return r.split(".")[0] || null;
    for (const [r] of this.environment.metadata.entries())
      if (r.includes(".") && r.endsWith(`.${e}`))
        return r.split(".")[0] || null;
    return null;
  }
  /**
  
           * Get a simplified tree structure of the AST for navigation
  
           */
  getStructure(e, n = "root") {
    return e.map((t, r) => {
      const o = t.nodeKey || `${n}-${r}`, s = {
        key: o,
        type: t.type,
        label: this.getNodeLabel(t)
      };
      switch (t.type) {
        case "define":
        case "do":
        case "forLoop":
        case "onBlock":
          t.body && t.body.length > 0 && (s.children = this.getStructure(t.body, o));
          break;
        case "ifBlock":
          const a = [];
          t.thenBranch.length > 0 && a.push({
            key: `${o}-then`,
            label: "then",
            type: "branch",
            children: this.getStructure(t.thenBranch, `${o}-then`)
          }), t.elseifBranches && t.elseifBranches.forEach((u, l) => {
            a.push({
              key: `${o}-elseif-${l}`,
              label: "else if",
              type: "branch",
              children: this.getStructure(u.body, `${o}-elseif-${l}`)
            });
          }), t.elseBranch && t.elseBranch.length > 0 && a.push({
            key: `${o}-else`,
            label: "else",
            type: "branch",
            children: this.getStructure(t.elseBranch, `${o}-else`)
          }), a.length > 0 && (s.children = a);
          break;
        case "command":
          t.callback && (s.children = [{
            key: `${o}-with`,
            label: "with",
            type: "branch",
            children: this.getStructure(t.callback.body, `${o}-with`)
          }]);
          break;
        case "assignment":
          t.command && (s.children = this.getStructure([t.command], o));
          break;
      }
      return s;
    });
  }
  /**
  
           * Generate a human-readable label for a statement
  
           */
  getNodeLabel(e) {
    switch (e.type) {
      case "command":
        return e.name;
      case "assignment":
        return `set ${e.targetName}`;
      case "shorthand":
        return `set ${e.targetName}`;
      case "define":
        return `def ${e.name}`;
      case "onBlock":
        return `on ${e.eventName}`;
      case "ifBlock":
        return "if";
      case "forLoop":
        return `for ${e.varName}`;
      case "do": {
        const n = e.decorators?.find((t) => t.name === "title");
        return n?.args?.[0]?.value ? `do:${n.args[0].value}` : "do";
      }
      case "return":
        return "return";
      case "break":
        return "break";
      case "continue":
        return "continue";
      case "comment":
        return e.comments[0]?.text.substring(0, 20) || "comment";
      default:
        return e.type;
    }
  }
  /**
  
           * Serialize a statement to a JSON-serializable object
  
           * @param stmt The statement to serialize
  
           * @param currentModuleContext Optional module context from "use" command
  
           * @param lastValue Optional last value (execution state) - can be a Value or a state object with lastValue and beforeValue
  
           * @param nodeKey Optional key for the node
  
           */
  serializeStatement(e, n, t, r) {
    const o = t && typeof t == "object" && "lastValue" in t ? t.lastValue : t ?? null, s = {
      type: e.type,
      lastValue: o,
      nodeKey: r
    };
    e.decorators && e.decorators.length > 0 && (s.decorators = e.decorators), e.type !== "comment" && (s.codePos = e.codePos);
    const a = e.comments;
    a && a.length > 0 && (s.comments = a);
    const u = e.trailingBlankLines;
    switch (u != null && (s.trailingBlankLines = u), e.type) {
      case "command":
        const l = this.findModuleName(e.name, n), p = {
          ...s,
          name: e.name,
          module: l,
          args: e.args.map((y) => this.serializeArg(y, n, e.nodeKey || r)),
          syntaxType: e.syntaxType,
          isTaggedTemplate: e.isTaggedTemplate,
          into: e.into
        };
        if (e.callback) {
          const y = e.nodeKey ? `${e.nodeKey}-with` : r ? `${r}-with` : void 0;
          p.callback = {
            type: "do",
            paramNames: e.callback.paramNames,
            body: e.callback.body.map((D, C) => this.serializeStatement(D, n, void 0, y ? `${y}-${C}` : void 0)),
            into: e.callback.into
          };
        }
        return p;
      case "assignment":
        return {
          ...s,
          targetName: e.targetName,
          targetPath: e.targetPath,
          command: e.command ? this.serializeStatement(e.command, n, void 0, e.nodeKey || r ? `${e.nodeKey || r}-0` : void 0) : void 0,
          literalValue: e.literalValue,
          literalValueType: e.literalValue !== void 0 ? Pe(e.literalValue) : void 0,
          isLastValue: e.isLastValue,
          isSet: e.isSet,
          hasAs: e.hasAs,
          isImplicit: e.isImplicit
        };
      case "shorthand":
        return {
          ...s,
          targetName: e.targetName
        };
      case "inlineIf":
        return {
          ...s,
          conditionExpr: e.condition,
          command: this.serializeStatement(e.command, n, void 0, r ? `${r}-then` : void 0)
        };
      case "ifBlock": {
        const y = {
          ...s,
          condition: e.condition,
          conditionExpr: e.condition,
          thenBranch: e.thenBranch.map((D, C) => this.serializeStatement(D, n, void 0, r ? `${r}-then-${C}` : void 0))
        };
        return e.elseifBranches && e.elseifBranches.length > 0 && (y.elseifBranches = e.elseifBranches.map((D, C) => ({
          condition: D.condition,
          conditionExpr: D.condition,
          body: D.body.map((x, E) => this.serializeStatement(x, n, void 0, r ? `${r}-elseif-${C}-${E}` : void 0))
        }))), e.elseBranch && e.elseBranch.length > 0 && (y.elseBranch = e.elseBranch.map((D, C) => this.serializeStatement(D, n, void 0, r ? `${r}-else-${C}` : void 0))), e.hasThen && (y.hasThen = true), y;
      }
      case "ifTrue":
        return {
          ...s,
          command: this.serializeStatement(e.command, n)
        };
      case "ifFalse":
        return {
          ...s,
          command: this.serializeStatement(e.command, n)
        };
      case "define":
        return {
          ...s,
          name: e.name,
          paramNames: e.paramNames,
          body: e.body.map((y, D) => this.serializeStatement(y, n, void 0, r ? `${r}-${D}` : `func-${e.name}-${D}`))
        };
      case "do":
        return {
          ...s,
          paramNames: e.paramNames,
          body: e.body.map((y, D) => this.serializeStatement(y, n, void 0, r ? `${r}-${D}` : void 0)),
          into: e.into
        };
      case "forLoop":
        return {
          ...s,
          varName: e.varName,
          iterable: e.iterable,
          iterableExpr: e.iterable,
          body: e.body.map((y, D) => this.serializeStatement(y, n, void 0, r ? `${r}-${D}` : void 0))
        };
      case "together":
        return {
          ...s,
          blocks: (e.blocks || []).map((D) => this.serializeStatement(D, n))
        };
      case "onBlock":
        const c = e;
        return {
          ...s,
          eventName: c.eventName,
          body: c.body.map((y, D) => this.serializeStatement(y, n, void 0, r ? `${r}-${D}` : `event-${c.eventName}-${D}`))
        };
      case "return":
        return {
          ...s,
          value: e.value ? this.serializeArg(e.value) : void 0
        };
      case "break":
        return {
          ...s
        };
      case "continue":
        return {
          ...s
        };
      case "comment":
        return {
          ...s,
          comments: e.comments || [],
          lineNumber: e.lineNumber
        };
      case "chunk_marker":
        const h = e;
        return {
          ...s,
          id: h.id,
          meta: h.meta,
          raw: h.raw
        };
      case "cell":
        const f = e, m = {
          ...s,
          cellType: f.cellType,
          meta: f.meta || {}
        };
        return f.rawBody !== void 0 && f.rawBody !== null && (m.rawBody = f.rawBody), f.body && Array.isArray(f.body) && f.body.length > 0 && (m.body = f.body.map((y) => this.serializeStatement(y, n))), m;
      case "prompt_block":
        const g = e;
        return {
          ...s,
          rawText: g.rawText || "",
          fence: g.fence || "---",
          bodyPos: g.bodyPos
        };
      default:
        return s;
    }
  }
  /**
   * Serialize an argument to a JSON-serializable object
   */
  serializeArg(e, n, t) {
    switch (e.type) {
      case "subexpr":
        return { type: "subexpr", code: e.code };
      case "subexpression":
        const r = e;
        return {
          type: "subexpression",
          body: r.body ? r.body.map((s, a) => this.serializeStatement(s, n, void 0, t ? `${t}-sub-${a}` : void 0)) : [],
          codePos: r.codePos
        };
      case "var":
        return { type: "var", name: e.name, path: e.path };
      case "lastValue":
        return { type: "lastValue" };
      case "number":
        return { type: "number", value: e.value };
      case "string":
        return { type: "string", value: e.value };
      case "literal":
        return { type: "literal", value: e.value };
      case "namedArgs":
        const o = {};
        for (const [s, a] of Object.entries(e.args))
          o[s] = this.serializeArg(a, n, t);
        return { type: "namedArgs", args: o };
      case "objectLiteral":
        return {
          type: "objectLiteral",
          properties: e.properties.map((s) => ({
            key: typeof s.key == "string" ? s.key : this.serializeArg(s.key, n, t),
            value: this.serializeArg(s.value, n, t)
          })),
          codePos: e.codePos
        };
      case "arrayLiteral":
        return {
          type: "arrayLiteral",
          elements: e.elements.map((s) => this.serializeArg(s, n, t)),
          codePos: e.codePos
        };
      case "object":
        return { type: "object", code: e.code };
      case "array":
        return { type: "array", code: e.code };
      default:
        return null;
    }
  }
};
var Bt = class {
  environment;
  executor;
  id;
  parent = null;
  serializer;
  constructor(e, n, t) {
    this.id = n, this.parent = t || null, this.environment = {
      variables: /* @__PURE__ */ new Map(),
      // per-thread vars
      functions: /* @__PURE__ */ new Map(),
      // per-thread def/enddef
      builtins: e.builtins,
      // shared
      decorators: e.decorators,
      // shared (runtime decorators)
      parseDecorators: e.parseDecorators,
      // shared (parse-time decorators)
      metadata: e.metadata,
      // shared
      moduleMetadata: e.moduleMetadata,
      // shared
      currentModule: null,
      // per-thread module context
      variableMetadata: /* @__PURE__ */ new Map(),
      // per-thread variable metadata
      functionMetadata: /* @__PURE__ */ new Map(),
      // per-thread function metadata
      constants: /* @__PURE__ */ new Set(),
      // per-thread constants
      eventHandlers: /* @__PURE__ */ new Map()
      // per-thread event handlers
    }, this.executor = new _(this.environment, this), this.serializer = new rt(this.environment);
  }
  /**
   * Check if a script needs more input (incomplete block)
   * Returns { needsMore: true, waitingFor: 'endif' | 'enddef' | 'endfor' | 'enddo' | 'subexpr' | 'paren' | 'object' | 'array' } if incomplete,
   * or { needsMore: false } if complete.
   */
  async needsMoreInput(e) {
    try {
      return await new W(e).parse(), { needsMore: false };
    } catch (n) {
      const t = n instanceof Error ? n.message : String(n);
      return t.includes("missing endif") ? { needsMore: true, waitingFor: "endif" } : t.includes("missing enddef") ? { needsMore: true, waitingFor: "enddef" } : t.includes("missing endfor") ? { needsMore: true, waitingFor: "endfor" } : t.includes("missing enddo") ? { needsMore: true, waitingFor: "enddo" } : t.includes("unclosed subexpression") ? { needsMore: true, waitingFor: "subexpr" } : t.includes("unclosed parenthesized function call") ? { needsMore: true, waitingFor: "paren" } : t.includes("unclosed object literal") ? { needsMore: true, waitingFor: "object" } : t.includes("unclosed array literal") ? { needsMore: true, waitingFor: "array" } : { needsMore: false };
    }
  }
  /**
   * Execute a RobinPath script in this thread
   */
  async executeScript(e) {
    const n = new W(e, this.environment), t = await n.parse(), r = n.getExtractedFunctions();
    for (const a of r)
      this.environment.functions.set(a.name, a), a.decorators && a.decorators.length > 0 && await this.executor.executeDecorators(a.decorators, a.name, a, []);
    const o = n.getExtractedEventHandlers();
    for (const a of o) {
      const u = this.environment.eventHandlers.get(a.eventName) || [];
      u.push(a), this.environment.eventHandlers.set(a.eventName, u), a.decorators && a.decorators.length > 0 && await this.executor.executeDecorators(a.decorators, a.eventName, null, []);
    }
    return await this.executor.execute(t);
  }
  /**
   * Execute a single line in this thread (for REPL)
   */
  async executeLine(e) {
    const n = new W(e), t = await n.parse(), r = n.getExtractedFunctions();
    for (const a of r)
      this.environment.functions.set(a.name, a);
    const o = n.getExtractedEventHandlers();
    for (const a of o) {
      const u = this.environment.eventHandlers.get(a.eventName) || [];
      u.push(a), this.environment.eventHandlers.set(a.eventName, u);
    }
    return await this.executor.execute(t);
  }
  /**
   * Get the last value ($) from this thread
   */
  getLastValue() {
    return this.executor.getCurrentFrame().lastValue;
  }
  /**
   * Get a variable value from this thread
   */
  getVariable(e) {
    return this.environment.variables.get(e) ?? null;
  }
  /**
   * Set a variable value in this thread
   */
  setVariable(e, n) {
    this.environment.variables.set(e, n);
  }
  /**
   * Get all variables in this thread as a plain object
   */
  getVariableState() {
    const e = {};
    for (const [n, t] of this.environment.variables.entries())
      e[n] = t;
    return e;
  }
  /**
   * Get the current module name (set by "use" command)
   * Returns null if no module is currently in use
   */
  getCurrentModule() {
    return this.environment.currentModule;
  }
  /**
   * Get the parent RobinPath instance
   */
  getParent() {
    return this.parent;
  }
  /**
   * Get the environment for this thread (for CLI access to metadata)
   */
  getEnvironment() {
    return this.environment;
  }
  /**
   * Get the AST without execution state
   * Returns a JSON-serializable AST array
   * 
   * Note: This method only parses the script, it does not execute it.
   */
  async getAST(e) {
    const t = await new W(e).parse();
    let r = null;
    return t.map((s) => {
      if (s.type === "command" && s.name === "use" && s.args.length > 0) {
        const a = s.args[0];
        if (a.type === "literal" || a.type === "string") {
          const u = String(a.value);
          u === "clear" || u === "" || u === null ? r = null : r = u;
        }
      }
      return this.serializer.serializeStatement(s, r);
    });
  }
  /**
   * Get extracted function definitions (def/enddef blocks) from a script
   * Returns a JSON-serializable array of function definitions
   * 
   * Note: This method only parses the script, it does not execute it.
   */
  async getExtractedFunctions(e) {
    const n = new W(e);
    return await n.parse(), n.getExtractedFunctions().map((r) => ({
      name: r.name,
      paramNames: r.paramNames,
      body: r.body.map((o) => this.serializer.serializeStatement(o, void 0))
    }));
  }
  /**
   * Get all event handlers as a flat array
   * @returns Array of all OnBlock handlers
   */
  getAllEventHandlers() {
    const e = [];
    for (const n of this.environment.eventHandlers.values())
      e.push(...n);
    return e;
  }
  /**
   * Get event handlers as serialized AST
   * @returns Array of serialized event handler AST nodes
   */
  getEventAST() {
    const e = this.getAllEventHandlers();
    let n = null;
    return e.map((t) => this.serializer.serializeStatement(t, n));
  }
  /**
   * Get the AST with execution state for the current thread
   * Returns a JSON-serializable object with:
   * - AST nodes with execution state ($ lastValue at each node)
   * - Available variables (thread-local and global)
   * - Organized for UI representation
   * 
   * Note: This method executes the script to capture execution state at each node.
   */
  async getASTWithState(e) {
    const t = await new W(e).parse(), r = new nt();
    await this.executeWithStateTracking(t, r);
    const o = this.executor.getCurrentFrame(), s = this.executor.getCallStack(), a = t.map((c, h) => {
      const f = r.getState(h);
      return this.serializer.serializeStatement(c, void 0, f);
    }), u = {};
    for (const [c, h] of this.environment.variables.entries())
      u[c] = h;
    const l = {};
    if (this.parent) {
      const c = this.parent.environment;
      for (const [h, f] of c.variables.entries())
        l[h] = f;
    }
    const p = s.map((c) => ({
      locals: Object.fromEntries(c.locals.entries()),
      lastValue: c.lastValue
    }));
    return {
      ast: a,
      variables: {
        thread: u,
        global: l
      },
      lastValue: o.lastValue,
      callStack: p
    };
  }
  /**
   * Execute statements with state tracking
   */
  async executeWithStateTracking(e, n) {
    for (let t = 0; t < e.length; t++) {
      const r = e[t], o = this.executor.getCurrentFrame().lastValue;
      if (r.type === "comment") {
        n.setState(t, {
          lastValue: o,
          // Comments preserve the last value
          beforeValue: o
        });
        continue;
      }
      await this.executor.executeStatementPublic(r);
      const s = this.executor.getCurrentFrame().lastValue;
      n.setState(t, {
        lastValue: s,
        beforeValue: o
      });
    }
  }
  /**
   * Get all available commands, modules, and functions for this thread
   * Includes thread-local user-defined functions in addition to shared builtins and modules
   * 
   * @param context Optional syntax context to filter commands based on what's valid next
   */
  getAvailableCommands(e) {
    const n = this.getParent();
    let t;
    if (n)
      t = n.getAvailableCommands();
    else {
      const a = {
        if: "Conditional statement - starts a conditional block",
        then: "Used with inline if statements",
        else: "Alternative branch in conditional blocks",
        elseif: "Additional condition in conditional blocks",
        endif: "Ends a conditional block",
        def: "Defines a user function - starts function definition",
        enddef: "Ends a function definition",
        iftrue: "Executes command if last value is truthy",
        iffalse: "Executes command if last value is falsy"
      }, u = e || {}, l = {
        canStartStatement: !u.afterIf && !u.afterDef && !u.afterElseif,
        canUseBlockKeywords: !u.inIfBlock && !u.inDefBlock,
        canUseEndKeywords: !!(u.inIfBlock || u.inDefBlock),
        canUseConditionalKeywords: !!u.inIfBlock
      }, p = [], c = Object.keys(a).map((g) => ({
        name: g,
        type: "native",
        description: a[g]
      }));
      l.canUseBlockKeywords && p.push(...c.filter((g) => g.name === "if" || g.name === "def" || g.name === "do")), l.canUseConditionalKeywords && p.push(...c.filter((g) => g.name === "elseif" || g.name === "else")), l.canUseEndKeywords && (u.inIfBlock && p.push(...c.filter((g) => g.name === "endif")), u.inDefBlock && p.push(...c.filter((g) => g.name === "enddef")), p.push(...c.filter((g) => g.name === "enddo"))), l.canStartStatement && p.push(...c.filter((g) => g.name === "iftrue" || g.name === "iffalse"));
      const h = [];
      if (l.canStartStatement) {
        for (const [g] of this.environment.builtins.entries())
          if (!g.includes(".")) {
            const y = this.environment.metadata.get(g);
            h.push({
              name: g,
              type: "builtin",
              description: y?.description || "Builtin command"
            });
          }
        h.sort((g, y) => g.name.localeCompare(y.name));
      }
      const f = [];
      if (l.canStartStatement) {
        for (const [g, y] of this.environment.moduleMetadata.entries())
          f.push({
            name: g,
            type: "module",
            description: y.description || "Module"
          });
        f.sort((g, y) => g.name.localeCompare(y.name));
      }
      const m = [];
      if (l.canStartStatement) {
        for (const [g] of this.environment.builtins.entries())
          if (g.includes(".")) {
            const y = this.environment.metadata.get(g);
            m.push({
              name: g,
              type: "moduleFunction",
              description: y?.description || "Module function"
            });
          }
        m.sort((g, y) => g.name.localeCompare(y.name));
      }
      t = {
        native: p,
        builtin: h,
        modules: f,
        moduleFunctions: m,
        userFunctions: []
      };
    }
    const r = e || {}, o = {
      canStartStatement: !r.afterIf && !r.afterDef && !r.afterElseif,
      canUseBlockKeywords: !r.inIfBlock && !r.inDefBlock,
      canUseEndKeywords: !!(r.inIfBlock || r.inDefBlock),
      canUseConditionalKeywords: !!r.inIfBlock
    }, s = [];
    if (o.canStartStatement) {
      for (const a of this.environment.functions.keys())
        s.push({
          name: a,
          type: "userFunction",
          description: "User-defined function"
        });
      s.sort((a, u) => a.name.localeCompare(u.name));
    }
    return {
      native: t.native,
      builtin: t.builtin,
      modules: t.modules,
      moduleFunctions: t.moduleFunctions,
      userFunctions: s
    };
  }
};
var Ye = class {
  parts = [];
  currentIndent = 0;
  indentString = "  ";
  // 2 spaces per indent level
  /**
   * Push a string to the output
   */
  push(e) {
    this.parts.push(e);
  }
  /**
   * Push a newline
   */
  newline() {
    this.parts.push(`
`);
  }
  /**
   * Set the indentation level
   */
  indent(e) {
    this.currentIndent = e;
  }
  /**
   * Push text with current indentation
   */
  pushIndented(e) {
    const n = this.indentString.repeat(this.currentIndent);
    this.parts.push(n + e);
  }
  /**
   * Push a line with current indentation
   */
  pushLine(e) {
    this.pushIndented(e), this.newline();
  }
  /**
   * Push a blank line
   */
  pushBlankLine() {
    this.parts.push(`
`);
  }
  /**
   * Get the final string
   */
  toString() {
    return this.parts.join("");
  }
  /**
   * Clear all content
   */
  clear() {
    this.parts = [], this.currentIndent = 0;
  }
};
var A = class _A {
  // Registry of printers by node type
  static printersRegistry = {
    command: _A.printCommand,
    assignment: _A.printAssignment,
    shorthand: (e, n) => {
      n.pushLine(`$${e.targetName} = $`);
    },
    inlineIf: (e, n, t) => {
      const r = _A.printArg(e.conditionExpr, t) ?? String(e.conditionExpr), o = _A.printNode(e.command, { ...t, indentLevel: 0 });
      n.pushLine(`if ${r} then ${o.trim()}`);
    },
    ifBlock: _A.printIfBlock,
    ifTrue: (e, n, t) => {
      const r = _A.printNode(e.command, { ...t, indentLevel: 0 });
      n.pushLine(`iftrue ${r.trim()}`);
    },
    ifFalse: (e, n, t) => {
      const r = _A.printNode(e.command, { ...t, indentLevel: 0 });
      n.pushLine(`iffalse ${r.trim()}`);
    },
    define: _A.printDefine,
    do: _A.printDo,
    together: _A.printTogether,
    forLoop: _A.printForLoop,
    onBlock: _A.printOnBlock,
    return: (e, n, t) => {
      let r = "";
      if (e.value ? r = `return ${_A.printArg(e.value, t) || ""}` : r = "return", e.comments && Array.isArray(e.comments)) {
        const o = e.comments.find((s) => s.inline === true);
        o && (r += `  # ${o.text}`);
      }
      n.pushLine(r);
    },
    break: (e, n) => {
      let t = "break";
      const r = _A.getInlineComment(e);
      r && (t += _A.formatInlineComment(r)), n.pushLine(t);
    },
    continue: (e, n) => {
      let t = "continue";
      const r = _A.getInlineComment(e);
      r && (t += _A.formatInlineComment(r)), n.pushLine(t);
    },
    comment: _A.printCommentNode,
    chunk_marker: _A.printChunkMarker,
    cell: _A.printCellBlock,
    prompt_block: _A.printPromptBlock
  };
  /**
   * Print a statement node to code
   */
  static printNode(e, n) {
    const t = n.allowExtractOriginalCode === void 0 && n.originalScript ? { ...n, allowExtractOriginalCode: true } : n, r = new Ye();
    r.indent(t.indentLevel);
    const o = _A.printersRegistry[e.type];
    return o ? (o(e, r, t), r.toString()) : "";
  }
  /**
   * Print a comment
   */
  static printComment(e, n = 0) {
    if (!e.text || e.text.trim() === "")
      return "";
    const t = "  ".repeat(n);
    return e.text.split(`
`).map((r) => `${t}# ${r}`).join(`
`);
  }
  /**
   * Get value type
   */
  static getValueType(e) {
    return Pe(e);
  }
  /**
   * Convert value type
   */
  static convertValueType(e, n) {
    return st(e, n);
  }
  /**
   * Print argument/expression code
   */
  static printArg(e, n) {
    if (!e) return null;
    switch (e.type) {
      case "var":
        return _A.printVarRef(e.name, e.path);
      case "string":
        const t = String(e.value);
        return t.startsWith("\0TEMPLATE\0") ? `\`${t.replace("\0TEMPLATE\0", "")}\`` : t.includes(`
`) ? `\`${t}\`` : `"${t}"`;
      case "number":
        return String(e.value);
      case "literal":
        return String(e.value);
      case "lastValue":
        return "$";
      case "subexpr":
        return `$(${e.code || ""})`;
      case "subexpression": {
        const r = e.body || [];
        if (r.length === 0)
          return "$()";
        const o = new Ye(), s = e.codePos?.startRow, a = e.codePos?.endRow, u = r[0]?.codePos?.startRow, l = r[r.length - 1]?.codePos?.endRow, p = s !== void 0 && u !== void 0 && s === u;
        if (r.length > 1 || e.codePos && e.codePos.endRow > e.codePos.startRow)
          if (p) {
            o.push("$");
            for (let m = 0; m < r.length; m++) {
              const g = r[m], y = _A.printNode(g, { ...n, indentLevel: n.indentLevel });
              m === 0 ? o.push("(" + (y ? y.trimStart() : "")) : y && o.push(y.endsWith(`
`) ? y : y + `
`);
            }
            const h = a !== void 0 && l !== void 0 && a === l;
            let f = o.toString();
            if (h)
              f.endsWith(`
`) && (f = f.slice(0, -1)), f += ")";
            else {
              f.endsWith(`
`) || (f += `
`);
              const m = "  ".repeat(n.indentLevel);
              f += m + ")";
            }
            return f;
          } else {
            o.push(`$(
`);
            for (const h of r) {
              const f = _A.printNode(h, { ...n, indentLevel: n.indentLevel + 1 });
              f && o.push(f.endsWith(`
`) ? f : f + `
`);
            }
            return o.indent(n.indentLevel), o.pushIndented(")"), o.toString();
          }
        else
          return `$(${r.map((f) => {
            const m = _A.printNode(f, { ...n, indentLevel: 0 });
            return m ? m.trim() : "";
          }).filter((f) => f).join(" ")})`;
      }
      case "objectLiteral":
        return `{${(e.properties || []).map((o) => {
          const s = typeof o.key == "string" ? o.key : _A.printArg(o.key, n), a = _A.printArg(o.value, n);
          return `${s}: ${a}`;
        }).join(", ")}}`;
      case "arrayLiteral":
        return `[${(e.elements || []).map((o) => _A.printArg(o, n)).join(", ")}]`;
      case "object":
        return `{${e.code || ""}}`;
      case "array":
        return `[${e.code || ""}]`;
      case "binary": {
        const r = _A.printArg(e.left, n) || "", o = _A.printArg(e.right, n) || "", s = e.operatorText || e.operator, a = `${r} ${s} ${o}`;
        return e.parenthesized ? `(${a})` : a;
      }
      case "unary": {
        const r = _A.printArg(e.argument, n) || "";
        return `${e.operator} ${r}`;
      }
      case "call": {
        const r = e.callee || "", o = (e.args || []).map((s) => _A.printArg(s, n)).filter((s) => s !== null).join(" ");
        return o ? `${r} ${o}` : r;
      }
      case "namedArgs":
        return null;
      default:
        return typeof e == "string" ? e : null;
    }
  }
  /**
   * Print a variable reference
   */
  static printVarRef(e, n) {
    let t = "$" + e;
    if (n)
      for (const r of n)
        r && r.type === "property" ? t += "." + r.name : r && r.type === "index" && (t += "[" + r.index + "]");
    return t;
  }
  /**
   * Print an into target
   */
  static printIntoTarget(e, n) {
    let t = "$" + e;
    if (n)
      for (const r of n)
        r.type === "property" ? t += "." + r.name : r.type === "index" && (t += "[" + r.index + "]");
    return t;
  }
  /**
   * Print assignment node
   */
  static printAssignment(e, n, t) {
    _A.emitDecorators(e, n, t);
    const r = "$" + e.targetName + (e.targetPath?.map(
      (l) => l.type === "property" ? "." + l.name : `[${l.index}]`
    ).join("") || "");
    let o;
    const s = e.isSet ? "set " : "";
    let a = " = ";
    if (e.isImplicit ? a = " " : e.hasAs ? a = " as " : (!e.isSet && !e.hasAs || e.isSet && !e.hasAs && e.isImplicit === false) && (a = " = "), e.isLastValue)
      o = `${s}${r}${a}$`;
    else if (e.command) {
      const l = _A.printNode(e.command, { ...t, indentLevel: 0 });
      o = `${s}${r}${a}${l.trim()}`;
    } else if (e.literalValue !== void 0) {
      let l = e.literalValue, p;
      const c = _A.getValueType(e.literalValue);
      if (e.literalValueType)
        if (c !== e.literalValueType) {
          const f = _A.convertValueType(e.literalValue, e.literalValueType);
          f !== null ? (l = f, p = e.literalValueType) : p = c;
        } else
          p = e.literalValueType;
      else
        p = c;
      let h;
      if (p === "string") {
        const f = String(l);
        f.startsWith("\0TEMPLATE\0") ? h = `\`${f.replace("\0TEMPLATE\0", "")}\`` : h = `"${f.replace(/"/g, '\\"')}"`;
      } else p === "null" ? h = "null" : p === "boolean" || p === "number" ? h = String(l) : p === "array" || p === "object" ? h = JSON.stringify(l) : h = typeof l == "string" ? `"${l}"` : String(l);
      o = `${s}${r}${a}${h}`;
    } else
      return;
    const u = _A.getInlineComment(e);
    u && (o += _A.formatInlineComment(u)), n.pushLine(o);
  }
  /**
   * Print cell block node
   */
  static printCellBlock(e, n, t) {
    let r = `---cell ${e.cellType}`;
    const o = e.meta || {}, s = Object.keys(o);
    if (o.id !== void 0) {
      const u = o.id;
      /[\s:=-]/.test(u) ? r += ` id:"${u}"` : r += ` id:${u}`;
    }
    const a = s.filter((u) => u !== "id").sort();
    for (const u of a) {
      const l = o[u];
      /[\s:=-]/.test(l) ? r += ` ${u}:"${l}"` : r += ` ${u}:${l}`;
    }
    if (r += "---", n.pushLine(r), e.cellType === "code" && e.body && Array.isArray(e.body) && e.body.length > 0)
      for (const u of e.body) {
        const l = _A.printNode(u, { ...t, indentLevel: t.indentLevel });
        l && n.push(l.endsWith(`
`) ? l : l + `
`);
      }
    else e.rawBody !== void 0 && e.rawBody.length > 0 && (n.push(e.rawBody), e.rawBody.endsWith(`
`) || n.newline());
    n.pushLine("---end---");
  }
  /**
   * Print chunk marker node
   */
  static printChunkMarker(e, n, t) {
    let r = `--- chunk:${e.id}`;
    if (e.meta && Object.keys(e.meta).length > 0) {
      const s = Object.keys(e.meta).sort().map((a) => {
        const u = e.meta[a];
        return /[\s:=-]/.test(u) ? `${a}:"${u}"` : `${a}:${u}`;
      });
      r += " " + s.join(" ");
    }
    r += " ---", n.pushLine(r);
  }
  /**
   * Print command node
   */
  static printCommand(e, n, t) {
    if (_A.emitDecorators(e, n, t), e.name === "_var" && e.args && e.args.length === 1 && e.args[0] && e.args[0].type === "var") {
      const c = e.args[0];
      n.pushLine(_A.printVarRef(c.name, c.path));
      return;
    }
    if (e.name === "_subexpr" && e.args && e.args.length === 1 && e.args[0]) {
      const c = e.args[0];
      if (c.type === "subexpr") {
        n.pushLine(`$(${c.code || ""})`);
        return;
      } else if (c.type === "subexpression") {
        const h = c.body || [];
        if (h.length === 0) {
          n.pushLine("$()");
          return;
        }
        const f = c.codePos?.startRow, m = c.codePos?.endRow, g = h[0]?.codePos?.startRow, y = h[h.length - 1]?.codePos?.endRow, D = f !== void 0 && g !== void 0 && f === g;
        if (h.length > 1 || c.codePos && c.codePos.endRow > c.codePos.startRow)
          if (D) {
            n.pushIndented("$");
            const x = m !== void 0 && y !== void 0 && m === y;
            for (let E = 0; E < h.length; E++) {
              const w = h[E];
              let b = _A.printNode(w, { ...t, indentLevel: t.indentLevel });
              E === 0 && (b = b ? b.trimStart() : "", n.push("(")), E === h.length - 1 && x ? (b.endsWith(`
`) && (b = b.slice(0, -1)), n.push(b + ")"), n.newline()) : (b && !b.endsWith(`
`) && (b += `
`), n.push(b), E === h.length - 1 && (n.pushIndented(")"), n.newline()));
            }
          } else {
            n.pushIndented(`$(
`);
            for (const x of h) {
              const E = _A.printNode(x, { ...t, indentLevel: t.indentLevel + 1 });
              E && n.push(E.endsWith(`
`) ? E : E + `
`);
            }
            n.pushIndented(")"), n.newline();
          }
        else {
          const x = h.map((E) => {
            const w = _A.printNode(E, { ...t, indentLevel: 0 });
            return w ? w.trim() : "";
          }).filter((E) => E).join(" ");
          n.pushLine(`$(${x})`);
        }
        return;
      }
    }
    if (e.name === "_literal" && e.args && e.args.length === 1 && e.args[0]) {
      const c = e.args[0], h = _A.printArg(c, t);
      if (h !== null) {
        let f = h;
        const m = _A.getInlineComment(e);
        m && (f += _A.formatInlineComment(m)), n.pushLine(f);
        return;
      }
    }
    if (e.name === "_object") {
      if (e.args && e.args.length >= 1 && e.args[0] && e.args[0].type === "object") {
        const c = e.args[0];
        n.pushLine(`{${c.code || ""}}`);
      } else
        n.pushLine("{}");
      return;
    }
    if (e.name === "_array") {
      if (e.args && e.args.length >= 1 && e.args[0] && e.args[0].type === "array") {
        const c = e.args[0];
        n.pushLine(`[${c.code || ""}]`);
      } else
        n.pushLine("[]");
      return;
    }
    let r = e.name, o = "";
    if (e.module && e.name.includes("."))
      o = "";
    else if (e.module) {
      const c = e.name.split(".");
      c.length > 1 ? (r = c[c.length - 1], o = `${e.module}.`) : (r = e.name, o = "");
    }
    const s = [];
    let a = null;
    for (const c of e.args || [])
      c && (c.type === "namedArgs" ? a = c.args || {} : s.push(c));
    const u = e.syntaxType || "space";
    let l = "";
    if (u === "space") {
      const h = (e.args || []).filter((f) => f && f.type !== "namedArgs").map((f) => _A.printArg(f, t)).filter((f) => f !== null).join(" ");
      e.isTaggedTemplate && h ? l = `${o}${r}${h}` : l = `${o}${r}${h ? " " + h : ""}`;
    } else if (u === "parentheses") {
      const c = s.map((h) => _A.printArg(h, t)).filter((h) => h !== null).join(" ");
      l = `${o}${r}(${c})`;
    } else if (u === "named-parentheses") {
      const c = [], h = s.map((f) => _A.printArg(f, t)).filter((f) => f !== null);
      if (c.push(...h), a)
        for (const [f, m] of Object.entries(a)) {
          const g = _A.printArg(m, t);
          g !== null && c.push(`$${f}=${g}`);
        }
      c.length > 0 ? l = `${o}${r}(${c.join(" ")})` : l = `${o}${r}()`;
    } else if (u === "multiline-parentheses") {
      const c = [], h = s.map((f) => _A.printArg(f, t)).filter((f) => f !== null);
      if (h.length > 0 && c.push(...h.map((f) => `  ${f}`)), a)
        for (const [f, m] of Object.entries(a)) {
          const g = _A.printArg(m, t);
          g !== null && c.push(`  $${f}=${g}`);
        }
      if (c.length > 0) {
        n.pushIndented(`${o}${r}(
`);
        for (const m of c)
          n.pushIndented(m), n.newline();
        let f = ")";
        e.into && (f = `) into ${_A.printIntoTarget(e.into.targetName, e.into.targetPath)}`), n.pushIndented(f), n.newline();
        return;
      } else
        l = `${o}${r}()`;
    } else {
      const c = (e.args || []).filter((h) => h).map((h) => _A.printArg(h, t)).filter((h) => h !== null).join(" ");
      l = `${o}${r}${c ? " " + c : ""}`;
    }
    if (e.into) {
      const c = _A.printIntoTarget(e.into.targetName, e.into.targetPath);
      l += ` into ${c}`;
    }
    const p = _A.getInlineComment(e);
    if (p && (l += _A.formatInlineComment(p)), e.callback) {
      if (n.pushIndented(l), n.push(" with"), e.callback.paramNames && e.callback.paramNames.length > 0 && n.push(" " + e.callback.paramNames.map((h) => `$${h}`).join(" ")), e.callback.into) {
        const h = _A.printIntoTarget(e.callback.into.targetName, e.callback.into.targetPath);
        n.push(` into ${h}`);
      }
      const c = _A.getInlineComment(e.callback);
      if (c && n.push(_A.formatInlineComment(c)), n.newline(), e.callback.body && Array.isArray(e.callback.body))
        for (const h of e.callback.body) {
          _A.emitLeadingComments(h, n, t, t.indentLevel + 1);
          const f = _A.printNode(h, { ...t, indentLevel: t.indentLevel + 1 });
          f && n.push(f.endsWith(`
`) ? f : f + `
`);
        }
      n.pushLine("endwith");
      return;
    }
    n.pushLine(l);
  }
  /**
   * Print a comment node
   */
  static printCommentNode(e, n, t) {
    if (!(!e || !e.comments || !Array.isArray(e.comments)))
      for (const r of e.comments) {
        const s = (r && typeof r.text == "string" ? r.text : "").split(`
`);
        for (const a of s) {
          const u = a.replace(/\r/g, "");
          u.trim() === "" ? n.pushLine("#") : n.pushLine(`# ${u}`);
        }
      }
  }
  /**
   * Get leading comments from a statement node.
   */
  static getLeadingComments(e) {
    return e?.comments && Array.isArray(e.comments) ? e.comments.filter((n) => !n.inline) : e?.leadingComments && Array.isArray(e.leadingComments) ? e.leadingComments : [];
  }
  /**
   * Get inline comment from a statement node.
   */
  static getInlineComment(e) {
    return !e?.comments || !Array.isArray(e.comments) ? null : e.comments.find((n) => n.inline === true) || null;
  }
  /**
   * Format an inline comment as a string to append to a line.
   */
  static formatInlineComment(e) {
    return !e || !e.text ? "" : `  # ${e.text}`;
  }
  /**
   * Emit decorators for a node if they exist.
   */
  static emitDecorators(e, n, t) {
    if (e.decorators && Array.isArray(e.decorators) && e.decorators.length > 0)
      for (const r of e.decorators) {
        const o = [];
        for (const a of r.args || []) {
          const u = _A.printArg(a, t);
          u !== null && o.push(u);
        }
        const s = o.length > 0 ? " " + o.join(" ") : "";
        n.pushLine(`@${r.name}${s}`);
      }
  }
  /**
   * Emit leading comments for a statement, preserving blank lines between them.
   */
  static emitLeadingComments(e, n, t, r) {
    const o = _A.getLeadingComments(e);
    if (o.length === 0)
      return false;
    o.sort((s, a) => {
      const u = s?.codePos?.startRow ?? 0, l = a?.codePos?.startRow ?? 0;
      return u - l;
    });
    for (let s = 0; s < o.length; s++) {
      const a = o[s], u = _A.printComment(a, r);
      u && n.push(u.endsWith(`
`) ? u : u + `
`), s < o.length - 1 && (o[s + 1]?.codePos?.startRow ?? 0) - (a?.codePos?.endRow ?? 0) > 1 && n.pushBlankLine();
    }
    return true;
  }
  /**
   * Check if there's a blank line gap between the last comment and a statement.
   */
  static emitBlankLineAfterComments(e, n) {
    if (!e || !("codePos" in e) || !e.codePos)
      return;
    const t = _A.getLeadingComments(e);
    if (t.length === 0)
      return;
    const r = t[t.length - 1];
    e.codePos.startRow - (r?.codePos?.endRow ?? 0) > 1 && n.pushBlankLine();
  }
  /**
   * Check if there's a blank line gap between two statements.
   */
  static emitBlankLineBetweenStatements(e, n, t) {
    if (!e || !n || !("codePos" in e) || !e.codePos || !("codePos" in n) || !n.codePos)
      return;
    const r = e.codePos.endRow;
    let o = n.codePos.startRow;
    if (n.decorators && Array.isArray(n.decorators) && n.decorators.length > 0) {
      const u = n.decorators[0];
      u.codePos && u.codePos.startRow < o && (o = u.codePos.startRow);
    }
    const s = _A.getLeadingComments(n);
    s.length > 0 && s[0]?.codePos && (o = s[0].codePos.startRow), o - r > 1 && t.pushBlankLine();
  }
  /**
   * Print define (function definition) node
   */
  static printDefine(e, n, t) {
    _A.emitDecorators(e, n, t);
    const o = (e.paramNames && Array.isArray(e.paramNames) ? e.paramNames : []).map((s) => `$${s}`).join(" ");
    if (n.pushLine(`def ${e.name}${o ? " " + o : ""}`), e.body && Array.isArray(e.body)) {
      for (let s = 0; s < e.body.length; s++) {
        const a = e.body[s], u = s > 0 ? e.body[s - 1] : null;
        if (s === 0 && "codePos" in e && e.codePos && "codePos" in a && a.codePos) {
          const c = e.decorators && Array.isArray(e.decorators) ? e.decorators.length : 0, h = e.codePos.startRow + c;
          let f = a.codePos.startRow;
          if (a.decorators && Array.isArray(a.decorators) && a.decorators.length > 0) {
            const y = a.decorators[0];
            y.codePos && y.codePos.startRow < f && (f = y.codePos.startRow);
          }
          const m = _A.getLeadingComments(a);
          m.length > 0 && m[0].codePos && (f = m[0].codePos.startRow), f - h > 1 && n.pushBlankLine();
        } else
          _A.emitBlankLineBetweenStatements(u, a, n);
        _A.emitLeadingComments(a, n, t, t.indentLevel + 1), _A.emitBlankLineAfterComments(a, n);
        const l = _A.printNode(a, { ...t, indentLevel: t.indentLevel + 1 });
        l && n.push(l.endsWith(`
`) ? l : l + `
`);
        const p = a?.trailingBlankLines;
        p != null && p > 0 && n.push(`
`.repeat(p));
      }
      if (e.body.length > 0 && "codePos" in e && e.codePos) {
        const s = e.body[e.body.length - 1];
        "codePos" in s && s.codePos && e.codePos.endRow - s.codePos.endRow > 1 && n.pushBlankLine();
      }
    }
    n.pushLine("enddef");
  }
  /**
   * Print do block node
   */
  static printDo(e, n, t) {
    _A.emitDecorators(e, n, t);
    let r = "do";
    if (e.paramNames && Array.isArray(e.paramNames) && e.paramNames.length > 0) {
      const o = e.paramNames.map((s) => s.startsWith("$") ? s : `$${s}`).join(" ");
      r += ` ${o}`;
    }
    if (e.into) {
      const o = e.into.targetName.startsWith("$") ? e.into.targetName : `$${e.into.targetName}`;
      r += ` into ${o}`;
    }
    if (n.pushLine(r), e.body && Array.isArray(e.body))
      for (const o of e.body) {
        _A.emitLeadingComments(o, n, t, t.indentLevel + 1);
        const s = _A.printNode(o, { ...t, indentLevel: t.indentLevel + 1 });
        s && n.push(s.endsWith(`
`) ? s : s + `
`);
        const a = o?.trailingBlankLines;
        a != null && a > 0 && n.push(`
`.repeat(a));
      }
    n.pushLine("enddo");
  }
  /**
   * Print for loop node
   */
  static printForLoop(e, n, t) {
    _A.emitDecorators(e, n, t);
    const r = e.varName || e.var || e.iterator || "$i", o = r.startsWith("$") ? "" : "$";
    if (e.range && e.range.from !== void 0 && e.range.to !== void 0) {
      const s = _A.printArg(e.range.from, t), a = _A.printArg(e.range.to, t);
      n.pushLine(`for ${o}${r} in range ${s} ${a}`);
    } else if (e.iterable) {
      const s = _A.printArg(e.iterable, t);
      n.pushLine(`for ${o}${r} in ${s ?? ""}`.trimEnd());
    } else
      n.pushLine(`for ${o}${r} in `.trimEnd());
    if (e.body && Array.isArray(e.body))
      for (const s of e.body) {
        if (!s) continue;
        _A.emitLeadingComments(s, n, t, t.indentLevel + 1);
        const a = _A.printNode(s, { ...t, indentLevel: t.indentLevel + 1 });
        a && n.push(a.endsWith(`
`) ? a : a + `
`);
        const u = s?.trailingBlankLines;
        u != null && u > 0 && n.push(`
`.repeat(u));
      }
    n.pushLine("endfor");
  }
  /**
   * Print ifBlock node
   */
  static printIfBlock(e, n, t) {
    _A.emitDecorators(e, n, t);
    const r = e.condition || e.conditionExpr, o = typeof r == "object" && r !== null ? _A.printArg(r, t) ?? String(r) : String(r), s = e.hasThen ? " then" : "";
    if (n.pushLine(`if ${o}${s}`), e.thenBranch && Array.isArray(e.thenBranch)) {
      const a = t.indentLevel + 1;
      for (const u of e.thenBranch) {
        _A.emitLeadingComments(u, n, t, a), _A.emitBlankLineAfterComments(u, n);
        const l = _A.printNode(u, { ...t, indentLevel: a });
        l && n.push(l.endsWith(`
`) ? l : l + `
`);
        const p = u?.trailingBlankLines;
        p != null && p > 0 && n.push(`
`.repeat(p));
      }
    }
    if (e.elseifBranches && Array.isArray(e.elseifBranches))
      for (const a of e.elseifBranches) {
        const u = a.condition || a.conditionExpr, l = typeof u == "object" && u !== null ? _A.printArg(u, t) ?? String(u) : String(u);
        let p = a.hasThen === true, c = a.body || [];
        !p && c.length > 0 && c[0]?.type === "command" && c[0]?.name === "then" && (p = true, c = c.slice(1));
        const h = p ? " then" : "";
        if (t.lineIndex && t.originalScript && a.keywordPos) {
          const m = t.lineIndex.getLine(a.keywordPos.startRow).substring(0, a.keywordPos.startCol);
          n.push(m + `elseif ${l}${h}
`);
        } else
          n.pushLine(`elseif ${l}${h}`);
        if (c && Array.isArray(c)) {
          const f = t.indentLevel + 1;
          for (const m of c) {
            _A.emitLeadingComments(m, n, t, f), _A.emitBlankLineAfterComments(m, n);
            const g = _A.printNode(m, { ...t, indentLevel: f });
            g && n.push(g.endsWith(`
`) ? g : g + `
`);
            const y = m?.trailingBlankLines;
            y != null && y > 0 && n.push(`
`.repeat(y));
          }
        }
      }
    if (e.elseBranch && Array.isArray(e.elseBranch)) {
      let a = e.elseBranch, u = e.elseHasThen === true;
      if (!u && a.length > 0 && a[0]?.type === "command" && a[0]?.name === "then" && (u = true, a = a.slice(1)), a.length > 0 || u) {
        const l = u ? " then" : "";
        if (t.lineIndex && t.originalScript && e.elseKeywordPos) {
          const h = t.lineIndex.getLine(e.elseKeywordPos.startRow).substring(0, e.elseKeywordPos.startCol);
          n.push(h + `else${l}
`);
        } else
          n.pushLine(`else${l}`);
        const p = t.indentLevel + 1;
        for (const c of a) {
          _A.emitLeadingComments(c, n, t, p), _A.emitBlankLineAfterComments(c, n);
          const h = _A.printNode(c, { ...t, indentLevel: p });
          h && n.push(h.endsWith(`
`) ? h : h + `
`);
          const f = c?.trailingBlankLines;
          f != null && f > 0 && n.push(`
`.repeat(f));
        }
      }
    }
    n.pushLine("endif");
  }
  /**
   * Print on block node
   */
  static printOnBlock(e, n, t) {
    _A.emitDecorators(e, n, t);
    const r = e.eventName || e.event || "";
    if (n.pushLine(`on "${r}"`.trimEnd()), e.body && Array.isArray(e.body))
      for (const o of e.body) {
        _A.emitLeadingComments(o, n, t, t.indentLevel + 1);
        const s = _A.printNode(o, { ...t, indentLevel: t.indentLevel + 1 });
        s && n.push(s.endsWith(`
`) ? s : s + `
`);
        const a = o?.trailingBlankLines;
        a != null && a > 0 && n.push(`
`.repeat(a));
      }
    n.pushLine("endon");
  }
  /**
   * Print prompt block node
   */
  static printPromptBlock(e, n, t) {
    let r = "  ".repeat(t.indentLevel);
    if (t.lineIndex && t.originalScript && e.codePos) {
      const s = t.lineIndex.getLine(e.codePos.startRow).match(/^(\s*)---/);
      s && (r = s[1]);
    } else e.codePos && e.codePos.startCol === 0 && (r = "");
    n.push(r + `---
`), e.rawText !== void 0 && (e.rawText.length > 0 ? (n.push(e.rawText), e.rawText.endsWith(`
`) || n.newline()) : e.bodyPos && e.bodyPos.startRow >= 0 && e.bodyPos.startRow <= e.bodyPos.endRow && n.newline()), n.push(r + `---
`);
  }
  /**
   * Print together block node
   */
  static printTogether(e, n, t) {
    if (_A.emitDecorators(e, n, t), n.pushLine("together"), e.blocks && Array.isArray(e.blocks))
      for (const r of e.blocks) {
        _A.emitLeadingComments(r, n, t, t.indentLevel + 1);
        const o = _A.printNode(r, { ...t, indentLevel: t.indentLevel + 1 });
        o && n.push(o.endsWith(`
`) ? o : o + `
`);
        const s = r?.trailingBlankLines;
        s != null && s > 0 && n.push(`
`.repeat(s));
      }
    n.pushLine("endtogether");
  }
};
var it = class {
  lineStartOffsets;
  lines;
  originalScript;
  constructor(e) {
    this.originalScript = e, this.lines = e.split(`
`), this.lineStartOffsets = new Array(this.lines.length);
    let n = 0;
    for (let t = 0; t < this.lines.length; t++)
      this.lineStartOffsets[t] = n, n += this.lines[t].length + 1;
  }
  /**
   * Convert row/column to character offset
   * @param row Zero-based row number
   * @param col Zero-based column number
   * @param exclusive If true, return offset one past the column (for end positions)
   * @returns Character offset in the script string
   */
  offsetAt(e, n, t = false) {
    if (e < 0 || e >= this.lines.length)
      return t && e >= this.lines.length ? this.originalScript.length : 0;
    const r = this.lineStartOffsets[e], o = this.lines[e].length, s = Math.min(n, o);
    let a = r + s;
    return t && (s >= o ? this.hasNewline(e) && (a += 1) : a += 1), a;
  }
  /**
   * Get the offset at the end of a line (after the newline)
   */
  lineEndOffset(e) {
    if (e < 0 || e >= this.lines.length)
      return this.originalScript.length;
    const n = this.lineStartOffsets[e] + this.lines[e].length;
    return this.hasNewline(e) ? n + 1 : n;
  }
  /**
   * Check if a line has a newline character
   */
  hasNewline(e) {
    return e < 0 || e >= this.lines.length ? false : e === this.lines.length - 1 ? this.originalScript.endsWith(`
`) : true;
  }
  /**
   * Get the text content of a specific line
   */
  getLine(e) {
    return e < 0 || e >= this.lines.length ? "" : this.lines[e];
  }
  /**
   * Get all lines as an array
   */
  getLines() {
    return [...this.lines];
  }
  /**
   * Get the total number of lines
   */
  lineCount() {
    return this.lines.length;
  }
};
var Ze = class {
  /**
   * Normalize comment layout for a statement
   */
  static normalize(e, n) {
    if (!(e.comments && Array.isArray(e.comments) && e.comments.length > 0))
      return {
        leadingComments: [],
        inlineComment: null,
        leadingGapLines: 0,
        trailingBlankLinesAfterStandaloneComment: 0
      };
    const r = [];
    let o = null;
    if (e.comments)
      for (const u of e.comments)
        !u.text || u.text.trim() === "" || (u.inline === true ? o = u : r.push(u));
    let s = 0;
    if (r.length > 0 && "codePos" in e && e.codePos) {
      const u = r[r.length - 1], l = e.codePos.startRow, p = u.codePos.endRow;
      for (let c = p + 1; c < l && n.getLine(c).trim() === ""; c++)
        s++;
    }
    let a = 0;
    if (e.type === "comment" && "comments" in e && e.comments && Array.isArray(e.comments) && e.comments.length > 0) {
      const u = e.comments[e.comments.length - 1];
      if (u && u.codePos) {
        const l = u.codePos.endRow, p = n.getLines();
        for (let c = l + 1; c < p.length && p[c].trim() === ""; c++)
          a++;
      }
    }
    return {
      leadingComments: r,
      inlineComment: o,
      leadingGapLines: s,
      trailingBlankLinesAfterStandaloneComment: a
    };
  }
};
var $t = class {
  /**
   * Apply patches to source code
   * Patches are sorted descending by startOffset and applied from end to start
   * to prevent character position shifts from affecting subsequent replacements
   */
  static apply(e, n) {
    const t = [...n].sort((o, s) => s.startOffset !== o.startOffset ? s.startOffset - o.startOffset : s.endOffset - o.endOffset);
    let r = e;
    for (const o of t)
      r = r.slice(0, o.startOffset) + o.replacement + r.slice(o.endOffset);
    return r;
  }
  /**
   * Validate that patches don't overlap
   * @internal This method is kept for potential future use or manual invocation
   */
  static validatePatches(e) {
    for (let n = 0; n < e.length - 1; n++) {
      const t = e[n], r = e[n + 1];
      t.endOffset > r.startOffset && console.warn("Patch overlap detected:", {
        current: { start: t.startOffset, end: t.endOffset },
        next: { start: r.startOffset, end: r.endOffset }
      });
    }
  }
};
var Rt = class {
  lineIndex;
  patches = [];
  originalScript;
  originalAST = null;
  /**
   * Enable defensive validation of extracted code.
   * When true, extracted code is validated before use and falls back to regeneration if invalid.
   * Set via ROBINPATH_DEBUG environment variable or constructor option.
   */
  debugMode;
  constructor(e, n) {
    this.originalScript = e, this.lineIndex = new it(e), this.debugMode = n?.debugMode ?? false;
  }
  /**
   * Plan patches for all nodes in the AST
   * This includes patches for:
   * - Updated nodes (in modified AST)
   * - New nodes (in modified AST but not in original)
   * - Deleted nodes (in original AST but not in modified)
   */
  async planPatches(e) {
    this.patches = [];
    const n = new W(this.originalScript);
    this.originalAST = await n.parse();
    const t = /* @__PURE__ */ new Set();
    for (const r of e)
      if ("codePos" in r && r.codePos) {
        const o = `${r.codePos.startRow}:${r.codePos.startCol}:${r.codePos.endRow}:${r.codePos.endCol}`;
        t.add(o);
      }
    for (const r of this.originalAST)
      if ("codePos" in r && r.codePos) {
        const o = `${r.codePos.startRow}:${r.codePos.startCol}:${r.codePos.endRow}:${r.codePos.endCol}`;
        t.has(o) || e.some((a) => !("codePos" in a) || !a.codePos ? false : !(a.codePos.endRow < r.codePos.startRow || a.codePos.startRow > r.codePos.endRow || a.codePos.endRow === r.codePos.startRow && a.codePos.endCol < r.codePos.startCol || a.codePos.startRow === r.codePos.endRow && a.codePos.startCol > r.codePos.endCol)) || this.planPatchForDeletedNode(r, this.originalAST);
      }
    for (let r = 0; r < e.length; r++) {
      const o = e[r], s = r > 0 ? e[r - 1] : null, a = r < e.length - 1 ? e[r + 1] : null;
      this.planPatchForNode(o, s, a);
    }
    return this.patches;
  }
  /**
   * Plan a patch for a deleted node
   */
  planPatchForDeletedNode(e, n) {
    if (!("codePos" in e) || !e.codePos) return;
    const t = n.indexOf(e), r = t >= 0 && t < n.length - 1 ? n[t + 1] : null, o = Ze.normalize(e, this.lineIndex), s = this.computeStatementRange(e, o, r);
    s && this.patches.push({
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      replacement: ""
    });
  }
  /**
   * Plan a patch for a single node
   */
  planPatchForNode(e, n, t) {
    if (e.type === "comment") {
      this.planPatchForCommentNode(e, t);
      return;
    }
    if (!("codePos" in e) || !e.codePos) {
      this.planPatchForNewNode(e, n, t);
      return;
    }
    const r = Ze.normalize(e, this.lineIndex);
    if (e.comments && Array.isArray(e.comments) && e.comments.length === 0 && this.planPatchToRemoveComments(e), r.leadingComments.length > 0 && "codePos" in e && e.codePos && r.leadingComments[r.leadingComments.length - 1].codePos.endRow >= e.codePos.startRow) {
      const a = this.computeStatementRange(e, r, t);
      if (!a) return;
      const u = this.generateReplacement(e, r, a);
      this.patches.push({
        startOffset: a.startOffset,
        endOffset: a.endOffset,
        replacement: u
      });
    } else {
      r.leadingComments.length > 0 && this.planPatchForLeadingComments(e, r, n);
      const a = this.computeStatementRange(e, r, t);
      if (!a) return;
      let u = this.generateReplacementWithoutLeadingComments(e, a);
      const l = this.lineIndex.lineCount();
      "codePos" in e && e.codePos && e.codePos.startRow >= l && u && (u = `
` + u), this.patches.push({
        startOffset: a.startOffset,
        endOffset: a.endOffset,
        replacement: u
      });
    }
  }
  /**
   * Plan a patch for a new node (insertion)
   */
  planPatchForNewNode(e, n, t) {
    let r = 0, o = "", s = "", a = 0;
    if (n && "codePos" in n && n.codePos) {
      r = this.lineIndex.lineEndOffset(n.codePos.endRow), this.lineIndex.hasNewline(n.codePos.endRow) || (o = `
`);
      const p = this.lineIndex.getLine(n.codePos.startRow).match(/^(\s*)/);
      p && (a = Math.floor(p[1].length / 2));
    } else if (t && "codePos" in t && t.codePos) {
      r = this.lineIndex.offsetAt(t.codePos.startRow, t.codePos.startCol, false);
      const p = this.lineIndex.getLine(t.codePos.startRow).match(/^(\s*)/);
      p && (a = Math.floor(p[1].length / 2));
    } else
      r = this.lineIndex.offsetAt(this.lineIndex.lineCount(), 0, true), r > 0 && !this.originalScript.endsWith(`
`) && (o = `
`);
    const u = A.printNode(e, {
      indentLevel: a,
      lineIndex: this.lineIndex,
      originalScript: this.originalScript
    });
    u && this.patches.push({
      startOffset: r,
      endOffset: r,
      replacement: o + u + s
    });
  }
  /**
   * Plan patch for leading comments (non-overlapping case)
   */
  planPatchForLeadingComments(e, n, t) {
    if (n.leadingComments.length === 0 || !("codePos" in e) || !e.codePos)
      return;
    const r = n.leadingComments[0], o = n.leadingComments[n.leadingComments.length - 1];
    let s = r.codePos.startRow, a = r.codePos.startCol;
    const u = [], l = t && t.trailingBlankLines > 0;
    if (!(t && t.type === "comment") && !l)
      for (let D = r.codePos.startRow - 1; D >= 0 && this.lineIndex.getLine(D).trim() === ""; D--)
        s = D, a = 0, u.push("");
    for (let D = 0; D < n.leadingComments.length; D++) {
      const C = n.leadingComments[D], x = A.printComment(C, 0);
      if (x && u.push(x), D < n.leadingComments.length - 1) {
        const E = n.leadingComments[D + 1];
        for (let w = C.codePos.endRow + 1; w < E.codePos.startRow && this.lineIndex.getLine(w).trim() === ""; w++)
          u.push("");
      }
    }
    let p = o.codePos.endRow, c = o.codePos.endCol;
    for (let D = p + 1; D < e.codePos.startRow; D++) {
      const C = this.lineIndex.getLine(D);
      if (C.trim() === "")
        u.push(""), p = D, c = C.length;
      else
        break;
    }
    const h = u.join(`
`), f = s < r.codePos.startRow ? s : r.codePos.startRow, m = s < r.codePos.startRow ? a : r.codePos.startCol, g = this.lineIndex.offsetAt(f, m, false), y = this.lineIndex.offsetAt(p, c, true);
    this.patches.push({
      startOffset: g,
      endOffset: y,
      replacement: h
    });
  }
  /**
   * Generate replacement without leading comments (for non-overlapping case)
   */
  generateReplacementWithoutLeadingComments(e, n) {
    const t = this.extractOriginalCode(e, n);
    if (t !== null)
      return t;
    const r = this.generateCodeWithPreservedIndentation(e, n), o = this.preserveBlankLinesInRange(e, n);
    return (r || "") + o;
  }
  /**
   * Plan patch for a standalone comment node
   */
  planPatchForCommentNode(e, n) {
    if (!e.comments || !Array.isArray(e.comments) || e.comments.length === 0)
      return;
    const t = e.comments[0], r = e.comments[e.comments.length - 1];
    if (!t.codePos || !r.codePos)
      return;
    const o = A.printNode(e, {
      indentLevel: 0,
      lineIndex: this.lineIndex,
      originalScript: this.originalScript
    }), s = this.lineIndex.lineCount();
    if (t.codePos.startRow >= s) {
      const u = s > 0 ? this.lineIndex.getLine(s - 1) : "", l = s > 0 ? this.lineIndex.offsetAt(s - 1, u.length, true) : 0, c = s > 0 && !this.lineIndex.hasNewline(s - 1) ? `
` + o : o;
      this.patches.push({
        startOffset: l,
        endOffset: l,
        replacement: c
      });
      return;
    }
    if (o === "") {
      const u = this.lineIndex.offsetAt(
        t.codePos.startRow,
        t.codePos.startCol,
        false
      );
      let l = r.codePos.endRow, p = r.codePos.endCol;
      const c = n ? this.findStopRowForComment(n) : this.lineIndex.lineCount();
      for (let f = l + 1; f < c; f++) {
        const m = this.lineIndex.getLine(f);
        if (m.trim() === "")
          l = f, p = m.length;
        else
          break;
      }
      const h = this.lineIndex.offsetAt(l, p, true);
      this.patches.push({
        startOffset: u,
        endOffset: h,
        replacement: ""
      });
    } else {
      const u = this.lineIndex.offsetAt(
        t.codePos.startRow,
        t.codePos.startCol,
        false
      );
      let l = r.codePos.endRow, p = r.codePos.endCol;
      const c = n ? this.findStopRowForComment(n) : this.lineIndex.lineCount();
      for (let g = l + 1; g < c; g++) {
        const y = this.lineIndex.getLine(g);
        if (y.trim() === "")
          l = g, p = y.length;
        else
          break;
      }
      const h = this.lineIndex.offsetAt(l, p, true), f = l - r.codePos.endRow, m = f > 0 ? o + `
`.repeat(f) : o;
      this.patches.push({
        startOffset: u,
        endOffset: h,
        replacement: m
      });
    }
  }
  /**
   * Find the stop row for comment blank line inclusion
   */
  findStopRowForComment(e) {
    if (!("codePos" in e) || !e.codePos)
      return this.lineIndex.lineCount();
    let n = e.codePos.startRow;
    if (e.comments && Array.isArray(e.comments) && e.comments.length > 0) {
      const t = e.comments.find((r) => !r.inline);
      t && t.codePos && (n = t.codePos.startRow);
    }
    return n;
  }
  /**
   * Plan patch to remove existing comments
   */
  planPatchToRemoveComments(e) {
    if (!("codePos" in e) || !e.codePos) return;
    const n = e.codePos.startRow, t = this.lineIndex.getLines();
    let r = -1, o = -1;
    for (let s = n - 1; s >= Math.max(0, n - 10); s--) {
      const u = t[s].trim();
      if (u.startsWith("#"))
        o === -1 && (o = s), r = s;
      else {
        if (u === "")
          continue;
        break;
      }
    }
    if (r >= 0 && o >= 0) {
      const s = t[r], a = t[o], u = s.indexOf("#"), l = a.length - 1, p = this.lineIndex.offsetAt(r, u, false), c = this.lineIndex.offsetAt(o, l, true);
      this.patches.push({
        startOffset: p,
        endOffset: c,
        replacement: ""
      });
    }
    if (n < t.length) {
      const s = t[n];
      if (s.match(/(\s+#\s*.+)$/) && "codePos" in e && e.codePos) {
        const u = s.indexOf("#", e.codePos.startCol);
        if (u >= 0) {
          const l = s.substring(0, u).replace(/\s+$/, ""), p = this.lineIndex.offsetAt(n, l.length, false), c = this.lineIndex.lineEndOffset(n);
          this.patches.push({
            startOffset: p,
            endOffset: c,
            replacement: this.lineIndex.hasNewline(n) ? `
` : ""
          });
        }
      }
    }
  }
  /**
   * Compute the range for a statement region
   */
  computeStatementRange(e, n, t) {
    if (!("codePos" in e) || !e.codePos) return null;
    const r = this.lineIndex.lineCount();
    if (e.codePos.startRow >= r) {
      const f = this.lineIndex.offsetAt(r, 0, true);
      return {
        startOffset: f,
        endOffset: f
      };
    }
    let o = e.codePos.startRow, s = e.codePos.startCol, a = false;
    if (e.decorators && Array.isArray(e.decorators)) {
      const f = e.decorators;
      if (f.length > 0) {
        const m = f[0];
        m.codePos && m.codePos.startRow < e.codePos.startRow && (o = m.codePos.startRow, s = m.codePos.startCol, a = true);
      }
    }
    if (!a && this.originalAST) {
      const f = this.findOriginalNode(e);
      if (f && f.decorators && Array.isArray(f.decorators)) {
        const m = f.decorators;
        if (m.length > 0) {
          const g = m[0];
          g.codePos && g.codePos.startRow < e.codePos.startRow && (o = g.codePos.startRow, s = g.codePos.startCol);
        }
      }
    }
    if (n.leadingComments.length > 0) {
      const f = n.leadingComments[0];
      f.codePos.endRow >= e.codePos.startRow && (o = f.codePos.startRow, s = f.codePos.startCol);
    }
    let u = e.codePos.endRow, l = e.codePos.endCol;
    n.inlineComment && n.inlineComment.codePos.endCol > l && (l = n.inlineComment.codePos.endCol);
    let p = e.trailingBlankLines;
    if (p == null && this.originalAST) {
      const f = this.findOriginalNode(e);
      f && (p = f.trailingBlankLines);
    }
    if (p != null && p > 0 && !(t && !("codePos" in t && t.codePos))) {
      const m = t && "codePos" in t && t.codePos ? t.codePos.startRow : this.lineIndex.lineCount();
      for (let g = u + 1; g < m; g++) {
        const y = this.lineIndex.getLine(g);
        if (y.trim() === "")
          u = g, l = y.length;
        else
          break;
      }
    }
    const c = this.lineIndex.offsetAt(o, s, false), h = this.lineIndex.lineEndOffset(u);
    return { startOffset: c, endOffset: h };
  }
  /**
   * Generate replacement text for a node
   */
  generateReplacement(e, n, t) {
    const r = [];
    if (n.leadingComments.length > 0)
      for (const l of n.leadingComments) {
        const p = A.printComment(l, 0);
        p && r.push(p);
      }
    n.leadingGapLines > 0 && r.push(...Array(n.leadingGapLines).fill(""));
    const o = this.extractOriginalCode(e, t);
    if (o !== null && n.leadingComments.length === 0)
      return o;
    const s = n.leadingComments.length > 0 || e.decorators && Array.isArray(e.decorators) && e.decorators.length > 0 ? A.printNode(e, {
      indentLevel: 0,
      lineIndex: this.lineIndex,
      originalScript: this.originalScript,
      allowExtractOriginalCode: false
    }) : this.generateCodeWithPreservedIndentation(e, t, false);
    if (s) {
      const l = s.split(`
`);
      n.inlineComment && l.length > 0, r.push(s);
    }
    const a = r.join(`
`), u = this.preserveBlankLinesInRange(e, t);
    return a + u;
  }
  /**
   * Preserve blank lines that were included in the range after the statement
   */
  preserveBlankLinesInRange(e, n) {
    if (!("codePos" in e) || !e.codePos)
      return "";
    const t = this.originalScript.length, r = n.endOffset >= t;
    let o = e.trailingBlankLines;
    if (o == null && this.originalAST) {
      const s = this.findOriginalNode(e);
      s && (o = s.trailingBlankLines);
    }
    return o != null ? r ? !this.originalScript.endsWith(`
`) || o === 1 ? "" : `
`.repeat(o - 1) : o === 1 ? `
` : `
`.repeat(o - 1) + `
` : "";
  }
  /**
   * Extract original code from the script if the node hasn't changed
   * Returns null if the node has changed and needs regeneration
   * 
   * This preserves all original formatting including:
   * - Indentation (spaces and tabs)
   * - Spacing within statements
   * - Blank lines
   */
  extractOriginalCode(e, n) {
    if (!("codePos" in e) || !e.codePos)
      return null;
    const t = this.lineIndex.lineCount();
    if (e.codePos.startRow >= t)
      return null;
    if (this.originalAST) {
      const r = this.findOriginalNode(e);
      let o = r && this.nodesAreEqual(e, r);
      if (o && (e.type === "define" || e.type === "onBlock")) {
        const s = e.body || [], a = r.body || [];
        if (s.length !== a.length)
          o = false;
        else
          for (let u = 0; u < s.length; u++) {
            const l = s[u], p = a[u];
            if (!p || !this.nodesAreEqual(l, p)) {
              o = false;
              break;
            }
          }
      }
      if (o && e.type === "ifBlock") {
        const s = e.thenBranch || [], a = r.thenBranch || [];
        if (s.length !== a.length)
          o = false;
        else
          for (let u = 0; u < s.length; u++)
            if (!this.nodesAreEqual(s[u], a[u])) {
              o = false;
              break;
            }
        if (o) {
          const u = e.elseBranch || [], l = r.elseBranch || [];
          if (u.length !== l.length)
            o = false;
          else
            for (let p = 0; p < u.length; p++)
              if (!this.nodesAreEqual(u[p], l[p])) {
                o = false;
                break;
              }
        }
      }
      if (o && (e.type === "forLoop" || e.type === "do" || e.type === "cell")) {
        const s = e.body || [], a = r.body || [];
        if (s.length !== a.length)
          o = false;
        else
          for (let u = 0; u < s.length; u++)
            if (!this.nodesAreEqual(s[u], a[u])) {
              o = false;
              break;
            }
      }
      if (o) {
        let s = e.codePos.startRow, a = e.codePos.startCol;
        if (e.decorators && Array.isArray(e.decorators)) {
          const C = e.decorators;
          if (C.length > 0) {
            const x = C[0];
            x.codePos && (x.codePos.startRow < e.codePos.startRow ? (s = x.codePos.startRow, a = x.codePos.startCol) : x.codePos.startRow === e.codePos.startRow && x.codePos.startCol < e.codePos.startCol && (a = x.codePos.startCol));
          }
        }
        const u = this.lineIndex.offsetAt(
          s,
          a,
          false
        ), l = this.lineIndex.lineEndOffset(e.codePos.endRow);
        let p = this.originalScript.substring(u, l);
        const c = r.trailingBlankLines, h = e.trailingBlankLines, f = c ?? h, m = this.originalScript.length, g = l >= m;
        let y = "";
        f != null ? g ? this.originalScript.endsWith(`
`) ? f === 1 ? y = "" : y = `
`.repeat(f - 1) : y = "" : y = `
`.repeat(f) : y = "";
        const D = p + y;
        if (this.debugMode)
          try {
            const C = this.validateExtractedCode(D, e);
            if (!C.isValid)
              return console.warn(`[PatchPlanner] Extraction validation failed for ${e.type}:`, C.reason), console.warn("[PatchPlanner] Extracted code:", D.substring(0, 100)), null;
          } catch (C) {
            console.warn("[PatchPlanner] Extraction validation error:", C);
          }
        return D;
      } else
        return null;
    }
    return null;
  }
  /**
   * Validate extracted code by checking if it parses correctly and matches expected type.
   * Used in debug mode to detect extraction corruption.
   */
  validateExtractedCode(e, n) {
    if (!e || e.trim() === "")
      return { isValid: false, reason: "Empty extracted code" };
    const t = e.trim();
    return n.type === "do" && (!t.includes("do") || !t.includes("enddo")) ? { isValid: false, reason: "Missing do/enddo keywords" } : n.type === "define" && (!t.includes("def ") || !t.includes("enddef")) ? { isValid: false, reason: "Missing def/enddef keywords" } : n.type === "ifBlock" && (!t.includes("if ") || !t.includes("endif")) ? { isValid: false, reason: "Missing if/endif keywords" } : n.type === "forLoop" && (!t.includes("for ") || !t.includes("endfor")) ? { isValid: false, reason: "Missing for/endfor keywords" } : { isValid: true };
  }
  /**
   * Find the original node that corresponds to the modified node
   */
  findOriginalNode(e) {
    return !("codePos" in e) || !e.codePos || !this.originalAST ? null : this.originalAST.find((n) => !("codePos" in n) || !n.codePos ? false : n.codePos.startRow === e.codePos.startRow && n.codePos.startCol === e.codePos.startCol && n.codePos.endRow === e.codePos.endRow && n.codePos.endCol === e.codePos.endCol) || null;
  }
  /**
   * Compare two nodes to see if they're equal (ignoring codePos and metadata)
   */
  nodesAreEqual(e, n) {
    if (e.type !== n.type)
      return false;
    const t = /* @__PURE__ */ new Set([
      "codePos",
      // Position changes when code moves
      "module",
      // Added by serializeStatement
      "trailingBlankLines",
      // Metadata about formatting
      "lastValue",
      // Runtime execution state
      "lineNumber",
      // Derived from codePos
      "leadingComments",
      // Metadata about comments handled separately
      "literalValueType",
      // Added by serializeStatement for assignments
      "operatorText",
      // Expression original operator text
      "parenthesized",
      // Expression was in parentheses
      "conditionExpr",
      // Duplicate of condition added by serializeStatement
      "keywordPos",
      // Pos of elseif/else keywords (metadata)
      "elseKeywordPos",
      // Pos of else keyword (metadata)
      "bodyPos",
      // Pos of block body (metadata)
      "openPos",
      // Pos of block opening (metadata)
      "closePos",
      // Pos of block closing (metadata)
      "headerPos",
      // Pos of cell header (metadata)
      "hasThen",
      // ifBlock syntax variant (metadata for equality)
      "elseHasThen"
      // else branch syntax variant (metadata for equality)
    ]), r = (o, s) => {
      if (o === s || o == null && s == null)
        return true;
      if (typeof o != typeof s || typeof o != "object" || Array.isArray(o) !== Array.isArray(s)) return false;
      if (Array.isArray(o)) {
        if (o.length !== s.length) return false;
        for (let u = 0; u < o.length; u++)
          if (!r(o[u], s[u])) return false;
        return true;
      }
      const a = /* @__PURE__ */ new Set([
        ...Object.keys(o).filter((u) => !t.has(u)),
        ...Object.keys(s).filter((u) => !t.has(u))
      ]);
      for (const u of a)
        if (!r(o[u], s[u])) return false;
      return true;
    };
    return r(e, n);
  }
  /**
   * Generate code with preserved indentation and spacing from original
   * This is used when we must regenerate code but want to preserve formatting
   */
  generateCodeWithPreservedIndentation(e, n, t = false) {
    if (!("codePos" in e) || !e.codePos)
      return A.printNode(e, {
        indentLevel: 0,
        lineIndex: this.lineIndex,
        originalScript: this.originalScript,
        allowExtractOriginalCode: t
      }) || "";
    const r = this.lineIndex.lineCount();
    if (e.codePos.startRow >= r)
      return A.printNode(e, {
        indentLevel: 0,
        lineIndex: this.lineIndex,
        originalScript: this.originalScript,
        allowExtractOriginalCode: t
      }) || "";
    let o = e.codePos.startRow, s = e.codePos.startCol;
    if (e.decorators && Array.isArray(e.decorators)) {
      const f = e.decorators;
      if (f.length > 0) {
        const m = f[0];
        m.codePos && m.codePos.startRow < e.codePos.startRow && (o = m.codePos.startRow, s = m.codePos.startCol);
      }
    }
    const u = this.lineIndex.getLine(o).substring(0, s), p = (A.printNode(e, {
      indentLevel: 0,
      lineIndex: this.lineIndex,
      originalScript: this.originalScript,
      allowExtractOriginalCode: t
    }) || "").split(`
`), c = [];
    for (let f = 0; f < p.length; f++) {
      const m = p[f];
      m.trim() === "" ? c.push(m) : c.push(u + m);
    }
    c.length > 0 && c[c.length - 1] === "" && c.pop();
    const h = c.join(`
`);
    return h && !h.endsWith(`
`) ? h + `
` : h;
  }
};
var Pt = class {
  /**
   * Validate that AST node positions are within bounds of the source code.
   * This helps detect stale AST data from external source modifications.
   *
   * @param source The current source code
   * @param ast The AST to validate
   * @returns Object with isValid flag and optional error details
   */
  validateASTPositions(e, n) {
    const t = [], r = e.split(`
`), o = r.length, s = (a, u) => {
      if (!("codePos" in a) || !a.codePos)
        return;
      const { startRow: l, startCol: p, endRow: c, endCol: h } = a.codePos;
      if (l < 0 || l >= o) {
        l !== o && t.push(`${u}: startRow ${l} out of bounds (0-${o - 1})`);
        return;
      }
      if (c < 0 || c >= o) {
        t.push(`${u}: endRow ${c} out of bounds (0-${o - 1})`);
        return;
      }
      const f = r[l], m = r[c];
      (p < 0 || p > f.length) && t.push(`${u}: startCol ${p} out of bounds for line ${l} (length ${f.length})`), (h < 0 || h > m.length) && t.push(`${u}: endCol ${h} out of bounds for line ${c} (length ${m.length})`), a.body && Array.isArray(a.body) && a.body.forEach((g, y) => {
        s(g, `${u}.body[${y}]`);
      }), a.thenBranch && Array.isArray(a.thenBranch) && a.thenBranch.forEach((g, y) => {
        s(g, `${u}.thenBranch[${y}]`);
      }), a.elseBranch && Array.isArray(a.elseBranch) && a.elseBranch.forEach((g, y) => {
        s(g, `${u}.elseBranch[${y}]`);
      }), a.elseifBranches && Array.isArray(a.elseifBranches) && a.elseifBranches.forEach((g, y) => {
        g.body && Array.isArray(g.body) && g.body.forEach((D, C) => {
          s(D, `${u}.elseifBranches[${y}].body[${C}]`);
        });
      });
    };
    return n.forEach((a, u) => {
      s(a, `ast[${u}]`);
    }), {
      isValid: t.length === 0,
      errors: t
    };
  }
  /**
   * Update source code based on AST changes
   * Uses precise character-level positions (codePos.startRow/startCol/endRow/endCol) to update code
   * Nested nodes are reconstructed as part of their parent's code
   * @param originalScript The original source code
   * @param ast The modified AST array (top-level nodes only)
   * @returns Updated source code
   */
  async updateCodeFromAST(e, n) {
    const t = this.validateASTPositions(e, n);
    t.isValid || (console.warn("[ASTToCodeConverter] AST position validation warnings:", t.errors.slice(0, 5)), t.errors.length > 10 && console.warn(`[ASTToCodeConverter] ${t.errors.length} position errors detected - AST may be stale`));
    const o = await new Rt(e).planPatches(n), s = $t.apply(e, o);
    try {
      await new W(s).parse();
    } catch (a) {
      throw new Error(`Generated code has parsing errors: ${a instanceof Error ? a.message : String(a)}`);
    }
    return s;
  }
  /**
   * Reconstruct code string from an AST node
   * @param node The AST node (serialized)
   * @param indentLevel Indentation level for nested code
   * @returns Reconstructed code string, or null if cannot be reconstructed
   */
  reconstructCodeFromASTNode(e, n = 0) {
    const t = new it("");
    return A.printNode(e, {
      indentLevel: n,
      lineIndex: t
    }) || null;
  }
};
var It = {
  log: async (i) => {
    const e = i.map((c) => {
      if (c === null) return "null";
      if (c === void 0) return "undefined";
      if (typeof c == "object")
        try {
          return JSON.stringify(c);
        } catch {
          return String(c);
        }
      return c;
    }), n = /* @__PURE__ */ new Date(), t = n.getFullYear(), r = String(n.getMonth() + 1).padStart(2, "0"), o = String(n.getDate()).padStart(2, "0"), s = String(n.getHours()).padStart(2, "0"), a = String(n.getMinutes()).padStart(2, "0"), u = String(n.getSeconds()).padStart(2, "0"), l = String(n.getMilliseconds()).padStart(3, "0"), p = `[${t}-${r}-${o} ${s}:${a}:${u}.${l}]`;
    return new Promise((c) => {
      console.log(p, ...e), c(null);
    });
  },
  say: async (i) => {
    const n = i.map((t) => {
      if (t === null) return "null";
      if (t === void 0) return "undefined";
      if (typeof t == "object")
        try {
          return JSON.stringify(t);
        } catch {
          return String(t);
        }
      return String(t);
    }).join("");
    return console.log(n), n;
  },
  obj: (i) => {
    if (i.length === 0)
      return {};
    const e = String(i[0]);
    try {
      return pe.parse(e);
    } catch (n) {
      throw new Error(`Invalid JSON5: ${n instanceof Error ? n.message : String(n)}`);
    }
  },
  array: (i) => [...i],
  tag: (i) => {
    if (i.length < 3)
      throw new Error("tag requires 3 arguments: type, name, and description");
    return null;
  },
  meta: (i) => {
    if (i.length < 3)
      throw new Error("meta requires 3 arguments: target (fn/variable), meta key, and value");
    return null;
  },
  setMeta: (i) => {
    if (i.length < 3)
      throw new Error("setMeta requires 3 arguments: target (fn/variable), meta key, and value");
    return null;
  },
  getMeta: (i) => {
    if (i.length < 1)
      throw new Error("getMeta requires at least 1 argument: target (fn/variable)");
    return null;
  },
  getType: (i) => {
    if (i.length < 1)
      throw new Error("getType requires 1 argument: variable name");
    return null;
  },
  clear: () => null,
  forget: () => null,
  set: () => null,
  get: (i) => {
    const e = i[0], n = String(i[1] ?? "");
    if (console.log("get", e, n), typeof e != "object" || e === null)
      throw new Error("First argument must be an object");
    const t = n.split(".");
    let r = e;
    for (const o of t) {
      if (r == null || typeof r != "object")
        return null;
      r = r[o];
    }
    return r;
  },
  range: (i) => {
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0, t = i.length >= 3 ? Number(i[2]) : void 0, r = [];
    if (t !== void 0) {
      if (t === 0)
        throw new Error("range step cannot be zero");
      if (t > 0)
        for (let o = e; o <= n; o += t)
          r.push(o);
      else
        for (let o = e; o >= n; o += t)
          r.push(o);
    } else if (e <= n)
      for (let o = e; o <= n; o++)
        r.push(o);
    else
      for (let o = e; o >= n; o--)
        r.push(o);
    return r;
  },
  has: (i) => null,
  repeat: async (i, e) => {
    const n = Number(i[0] ?? 0);
    if (isNaN(n) || n < 0)
      throw new Error("repeat requires a non-negative number");
    if (!e)
      throw new Error("repeat requires a with callback block");
    let t = null;
    for (let r = 0; r < n; r++) {
      const o = [r, t], s = await Promise.resolve(e(o));
      t = s !== void 0 ? s : null;
    }
    return t;
  }
};
var Lt = {
  log: {
    description: "Logs values to the console",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "any",
        description: "Values to log (any number of arguments)",
        formInputType: "json",
        required: false,
        defaultValue: [""],
        children: {
          name: "value",
          dataType: "any",
          description: "Value to log",
          formInputType: "textarea",
          required: false,
          defaultValue: ""
        }
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null (does not affect last value)",
    example: 'log "Hello" "World"  # Prints: Hello World'
  },
  say: {
    description: 'Prints values to the console without timestamp and returns the last value. Unlike log, say returns the value, allowing assignments like: $a = say "hello"',
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "any",
        description: "Values to print (any number of arguments). Returns the last argument.",
        formInputType: "json",
        required: false,
        defaultValue: [""],
        children: {
          name: "value",
          dataType: "any",
          description: "Value to print",
          formInputType: "textarea",
          required: false,
          defaultValue: ""
        }
      }
    ],
    returnType: "any",
    returnDescription: 'Returns the last argument (or null if no arguments). This allows assignments like: $a = say "hello"',
    example: '$a = say "hello"  # Prints: hello, and $a becomes "hello"'
  },
  obj: {
    description: "Creates an object from a JSON5 string, or returns an empty object if no arguments",
    parameters: [
      {
        name: "jsonString",
        dataType: "string",
        description: "JSON5 string to parse into an object (optional)",
        formInputType: "textarea",
        required: false,
        defaultValue: "{}"
      }
    ],
    returnType: "object",
    returnDescription: "Parsed object or empty object",
    example: `obj '{name: "John", age: 30}'  # Returns {name: "John", age: 30}`
  },
  array: {
    description: "Creates an array from the given arguments",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "any",
        description: "Values to include in the array (any number of arguments)",
        formInputType: "json",
        required: false,
        defaultValue: [],
        children: {
          name: "value",
          dataType: "any",
          description: "Value to include in the array",
          formInputType: "json",
          required: false,
          defaultValue: ""
        }
      }
    ],
    returnType: "array",
    returnDescription: "New array containing all provided values",
    example: 'array 1 2 3 "hello"  # Returns [1, 2, 3, "hello"]'
  },
  tag: {
    description: "Declares metadata for types, names, and descriptions (no-op command)",
    parameters: [
      {
        name: "type",
        dataType: "string",
        description: "Type of the tag",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "name",
        dataType: "string",
        description: "Name of the tag",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "description",
        dataType: "string",
        description: "Description of the tag",
        formInputType: "textarea",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null",
    example: 'tag type "User" "Represents a user object"'
  },
  meta: {
    description: "Adds metadata for functions or variables (actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "target",
        dataType: "string",
        description: "Target to add metadata to (fn/variable name)",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      },
      {
        name: "key",
        dataType: "string",
        description: "Metadata key",
        formInputType: "text",
        required: true,
        defaultValue: "description"
      },
      {
        name: "value",
        dataType: "any",
        description: "Metadata value",
        formInputType: "json",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null",
    example: 'meta $a description "A variable to add number"'
  },
  setMeta: {
    description: "Adds metadata for functions or variables (alias for meta command, actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "target",
        dataType: "string",
        description: "Target to add metadata to (fn/variable name)",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      },
      {
        name: "key",
        dataType: "string",
        description: "Metadata key",
        formInputType: "text",
        required: true,
        defaultValue: "description"
      },
      {
        name: "value",
        dataType: "any",
        description: "Metadata value",
        formInputType: "json",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null",
    example: 'setMeta $a description "A variable to add number"'
  },
  getMeta: {
    description: "Retrieves metadata for functions or variables (actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "target",
        dataType: "string",
        description: "Target to get metadata from (fn/variable name)",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      },
      {
        name: "key",
        dataType: "string",
        description: "Metadata key (optional, if omitted returns all metadata)",
        formInputType: "text",
        required: false,
        defaultValue: ""
      }
    ],
    returnType: "any",
    returnDescription: "Metadata value or object containing all metadata",
    example: "getMeta $a description  # Returns metadata value"
  },
  getType: {
    description: "Returns the type of a variable as a string (actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "variable",
        dataType: "string",
        description: "Variable name to get type of",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      }
    ],
    returnType: "string",
    returnDescription: 'Type string: "string", "number", "boolean", "object", "array", or "null"',
    example: 'getType $myVar  # Returns "string"'
  },
  clear: {
    description: "Clears the last return value ($) (actual implementation handled by executeCommand)",
    parameters: [],
    returnType: "null",
    returnDescription: "Always returns null",
    example: `math.add 10 20  # $ = 30
clear  # $ = null`
  },
  forget: {
    description: "Ignores a variable or function in the current scope only (actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "target",
        dataType: "string",
        description: "Variable or function name to forget",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null",
    example: `scope
  forget $x
  $x  # Returns null
endscope`
  },
  set: {
    description: "Assigns a value to a variable, with optional fallback if value is empty/null (actual implementation handled by executeCommand)",
    parameters: [
      {
        name: "variable",
        dataType: "string",
        description: "Variable name to assign to (e.g., $myVar or $user.name)",
        formInputType: "varname",
        allowedTypes: ["string"],
        required: true,
        defaultValue: "var"
      },
      {
        name: "value",
        dataType: "any",
        description: "Value to assign",
        formInputType: "code",
        required: true,
        defaultValue: ""
      },
      {
        name: "fallback",
        dataType: "any",
        description: "Fallback value to use if value is empty/null (optional)",
        formInputType: "code",
        required: false,
        defaultValue: ""
      }
    ],
    returnType: "null",
    returnDescription: "Always returns null (does not affect last value)",
    example: `set $myVar "hello"  # $myVar = "hello"
set $x "" "default"  # $x = "default" (fallback used)`
  },
  get: {
    description: "Gets a value from an object using a dot-notation path",
    parameters: [
      {
        name: "obj",
        dataType: "object",
        description: "Object to get value from",
        formInputType: "json",
        required: true,
        defaultValue: {}
      },
      {
        name: "path",
        dataType: "string",
        description: 'Dot-notation path (e.g., "user.name")',
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "any",
    returnDescription: "Value at the specified path, or null if not found",
    example: 'get {user: {name: "John"}} "user.name"  # Returns "John"'
  },
  has: {
    description: "Checks if a variable or function exists",
    parameters: [
      {
        name: "name",
        dataType: "string",
        description: "Variable name (e.g., $myVar) or function name (e.g., myFunc or math.add)",
        formInputType: "text",
        required: true,
        defaultValue: "$"
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if the variable or function exists, false otherwise",
    example: "has $myVar  # Returns true if $myVar exists"
  },
  range: {
    description: "Generates an array of numbers from start to end (inclusive)",
    parameters: [
      {
        name: "start",
        dataType: "any",
        description: "Start value (inclusive)",
        formInputType: "textarea",
        required: true,
        defaultValue: 1
      },
      {
        name: "end",
        dataType: "any",
        description: "End value (inclusive)",
        formInputType: "textarea",
        required: true,
        defaultValue: 10
      },
      {
        name: "step",
        dataType: "any",
        description: "Step size (optional, defaults to 1 or -1 based on direction)",
        formInputType: "textarea",
        required: false,
        defaultValue: 1
      }
    ],
    returnType: "array",
    returnDescription: "Array of numbers from start to end",
    example: "range 1 5  # Returns [1, 2, 3, 4, 5]"
  },
  repeat: {
    description: "Repeats a callback block a specified number of times. The callback receives $1 (current iteration index, starting from 0) and $2 (accumulated value from previous iteration, null on first iteration).",
    parameters: [
      {
        name: "count",
        dataType: "any",
        description: "Number of times to repeat the callback",
        formInputType: "textarea",
        required: true,
        defaultValue: 1
      }
    ],
    returnType: "any",
    returnDescription: "Returns the last value returned by the callback after all iterations",
    example: `repeat 5 with
  add $2 1
endwith  # Adds 1 to the accumulated value 5 times`
  }
};
var Vt = {
  description: "Core built-in functions including logging, object creation, arrays, metadata, and utilities",
  author: "RobinPath",
  category: "RobinPath Core",
  methods: [
    "log",
    "obj",
    "array",
    "tag",
    "meta",
    "setMeta",
    "getMeta",
    "getType",
    "clear",
    "forget",
    "set",
    "get",
    "range",
    "has",
    "say",
    "repeat"
  ]
};
var Ot = {
  name: "core",
  functions: It,
  functionMetadata: Lt,
  moduleMetadata: Vt,
  global: true
  // Register functions globally (without module prefix)
};
var Mt = {
  add: (i) => i.length === 0 ? 0 : i.reduce((e, n) => e + (Number(n) || 0), 0),
  subtract: (i) => {
    const e = i[0] ?? 0, n = i[1] ?? 0;
    return (Number(e) || 0) - (Number(n) || 0);
  },
  multiply: (i) => i.length === 0 ? 0 : i.reduce(
    (e, n) => e * (Number(n) || 0),
    1
  ),
  divide: (i) => {
    const e = i[0] ?? 0, n = i[1] ?? 0;
    if (Number(n) === 0)
      throw new Error("Division by zero");
    return (Number(e) || 0) / (Number(n) || 0);
  },
  modulo: (i) => {
    const e = i[0] ?? 0, n = i[1] ?? 0;
    if (Number(n) === 0)
      throw new Error("Modulo by zero");
    return (Number(e) || 0) % (Number(n) || 0);
  },
  power: (i) => {
    const e = i[0] ?? 0, n = i[1] ?? 0;
    return Math.pow(Number(e) || 0, Number(n) || 0);
  },
  sqrt: (i) => {
    const e = i[0] ?? 0, n = Number(e) || 0;
    if (n < 0)
      throw new Error("Square root of negative number");
    return Math.sqrt(n);
  },
  abs: (i) => {
    const e = i[0] ?? 0;
    return Math.abs(Number(e) || 0);
  },
  round: (i) => {
    const e = i[0] ?? 0;
    return Math.round(Number(e) || 0);
  },
  floor: (i) => {
    const e = i[0] ?? 0;
    return Math.floor(Number(e) || 0);
  },
  ceil: (i) => {
    const e = i[0] ?? 0;
    return Math.ceil(Number(e) || 0);
  },
  min: (i) => i.length === 0 ? 0 : Math.min(...i.map((e) => Number(e) || 0)),
  max: (i) => i.length === 0 ? 0 : Math.max(...i.map((e) => Number(e) || 0)),
  sin: (i) => {
    const e = i[0] ?? 0;
    return Math.sin(Number(e) || 0);
  },
  cos: (i) => {
    const e = i[0] ?? 0;
    return Math.cos(Number(e) || 0);
  },
  tan: (i) => {
    const e = i[0] ?? 0;
    return Math.tan(Number(e) || 0);
  },
  pi: () => Math.PI,
  e: () => Math.E
};
var jt = {
  add: {
    description: "Adds multiple numbers together",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "Numbers to add together (supports multiple arguments)",
        formInputType: "json",
        required: true,
        defaultValue: [0, 0],
        children: {
          name: "value",
          dataType: "any",
          description: "Number to add",
          formInputType: "textarea",
          required: true,
          defaultValue: 0,
          allowedTypes: ["number", "var", "lastValue", "subexpr"]
        }
      }
    ],
    returnType: "number",
    returnDescription: "Sum of all the numbers",
    example: "add 5 10 20  # Returns 35"
  },
  subtract: {
    description: "Subtracts the second number from the first",
    parameters: [
      {
        name: "a",
        dataType: "any",
        description: "Number to subtract from",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      },
      {
        name: "b",
        dataType: "any",
        description: "Number to subtract",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Difference of the two numbers",
    example: "subtract 10 3  # Returns 7"
  },
  multiply: {
    description: "Multiplies multiple numbers together",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "Numbers to multiply together (supports multiple arguments)",
        formInputType: "json",
        required: true,
        defaultValue: [1, 1],
        children: {
          name: "value",
          dataType: "any",
          description: "Number to multiply",
          formInputType: "textarea",
          required: true,
          defaultValue: 1,
          allowedTypes: ["number", "var", "lastValue", "subexpr"]
        }
      }
    ],
    returnType: "number",
    returnDescription: "Product of all the numbers",
    example: "multiply 5 3 2  # Returns 30"
  },
  divide: {
    description: "Divides the first number by the second",
    parameters: [
      {
        name: "a",
        dataType: "any",
        description: "Dividend (number to divide)",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      },
      {
        name: "b",
        dataType: "any",
        description: "Divisor (number to divide by)",
        formInputType: "textarea",
        required: true,
        defaultValue: 1
      }
    ],
    returnType: "number",
    returnDescription: "Quotient of the division",
    example: "divide 15 3  # Returns 5"
  },
  modulo: {
    description: "Returns the remainder after division",
    parameters: [
      {
        name: "a",
        dataType: "any",
        description: "Dividend",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      },
      {
        name: "b",
        dataType: "any",
        description: "Divisor",
        formInputType: "textarea",
        required: true,
        defaultValue: 1
      }
    ],
    returnType: "number",
    returnDescription: "Remainder after division",
    example: "modulo 17 5  # Returns 2"
  },
  power: {
    description: "Raises the first number to the power of the second",
    parameters: [
      {
        name: "base",
        dataType: "any",
        description: "Base number",
        formInputType: "textarea",
        required: true,
        defaultValue: 2
      },
      {
        name: "exponent",
        dataType: "any",
        description: "Exponent (power)",
        formInputType: "textarea",
        required: true,
        defaultValue: 2
      }
    ],
    returnType: "number",
    returnDescription: "Result of base raised to the exponent",
    example: "power 2 8  # Returns 256"
  },
  sqrt: {
    description: "Calculates the square root of a number",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Number to calculate square root of",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Square root of the input number",
    example: "sqrt 16  # Returns 4"
  },
  abs: {
    description: "Returns the absolute value of a number",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Number to get absolute value of",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Absolute value of the input number",
    example: "abs -5  # Returns 5"
  },
  round: {
    description: "Rounds a number to the nearest integer",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Number to round",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Rounded integer value",
    example: "round 3.7  # Returns 4"
  },
  floor: {
    description: "Rounds a number down to the nearest integer",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Number to round down",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Largest integer less than or equal to the input",
    example: "floor 3.7  # Returns 3"
  },
  ceil: {
    description: "Rounds a number up to the nearest integer",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Number to round up",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Smallest integer greater than or equal to the input",
    example: "ceil 3.2  # Returns 4"
  },
  min: {
    description: "Returns the minimum value from a list of numbers",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "Array of numbers to find minimum from",
        formInputType: "json",
        required: true,
        defaultValue: [0, 0],
        children: {
          name: "value",
          dataType: "any",
          description: "Number to compare",
          formInputType: "textarea",
          required: true,
          defaultValue: 0
        }
      }
    ],
    returnType: "number",
    returnDescription: "Minimum value from the input numbers",
    example: "min 5 2 8 1  # Returns 1"
  },
  max: {
    description: "Returns the maximum value from a list of numbers",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "Array of numbers to find maximum from",
        formInputType: "json",
        required: true,
        defaultValue: [0, 0],
        children: {
          name: "value",
          dataType: "any",
          description: "Number to compare",
          formInputType: "textarea",
          required: true,
          defaultValue: 0
        }
      }
    ],
    returnType: "number",
    returnDescription: "Maximum value from the input numbers",
    example: "max 5 2 8 1  # Returns 8"
  },
  sin: {
    description: "Calculates the sine of an angle in radians",
    parameters: [
      {
        name: "angle",
        dataType: "any",
        description: "Angle in radians",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Sine of the angle",
    example: "sin 0  # Returns 0"
  },
  cos: {
    description: "Calculates the cosine of an angle in radians",
    parameters: [
      {
        name: "angle",
        dataType: "any",
        description: "Angle in radians",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Cosine of the angle",
    example: "cos 0  # Returns 1"
  },
  tan: {
    description: "Calculates the tangent of an angle in radians",
    parameters: [
      {
        name: "angle",
        dataType: "any",
        description: "Angle in radians",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "number",
    returnDescription: "Tangent of the angle",
    example: "tan 0  # Returns 0"
  },
  pi: {
    description: "Returns the mathematical constant \u03C0 (pi)",
    parameters: [],
    returnType: "number",
    returnDescription: "Value of \u03C0 (approximately 3.14159)",
    example: "pi  # Returns 3.141592653589793"
  },
  e: {
    description: "Returns the mathematical constant e (Euler's number)",
    parameters: [],
    returnType: "number",
    returnDescription: "Value of e (approximately 2.71828)",
    example: "e  # Returns 2.718281828459045"
  }
};
var qt = {
  description: "Mathematical operations and functions including basic arithmetic, trigonometry, and mathematical constants",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/math-module",
  methods: [
    "add",
    "subtract",
    "multiply",
    "divide",
    "modulo",
    "power",
    "sqrt",
    "abs",
    "round",
    "floor",
    "ceil",
    "min",
    "max",
    "sin",
    "cos",
    "tan",
    "pi",
    "e"
  ]
};
var Wt = {
  name: "math",
  functions: Mt,
  functionMetadata: jt,
  moduleMetadata: qt,
  global: true
};
var Ut = {
  length: (i) => String(i[0] ?? "").length,
  substring: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0, t = i[2] !== void 0 ? Number(i[2]) : e.length;
    return e.substring(n, t);
  },
  toUpperCase: (i) => String(i[0] ?? "").toUpperCase(),
  toLowerCase: (i) => String(i[0] ?? "").toLowerCase(),
  trim: (i) => String(i[0] ?? "").trim(),
  replace: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? ""), t = String(i[2] ?? "");
    return e.replace(
      new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      t
    );
  },
  replaceAll: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? ""), t = String(i[2] ?? "");
    return e.split(n).join(t);
  },
  split: (i) => {
    const e = String(i[0] ?? ""), n = i[1] !== void 0 ? String(i[1]) : "";
    return e.split(n);
  },
  join: (i) => {
    const e = i.length > 1 && typeof i[i.length - 1] == "string" ? String(i[i.length - 1]) : "";
    return (Array.isArray(i[0]) ? i[0] : i.slice(0, i.length > 1 ? -1 : void 0)).map((t) => String(t ?? "")).join(e);
  },
  startsWith: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? "");
    return e.startsWith(n);
  },
  endsWith: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? "");
    return e.endsWith(n);
  },
  contains: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? "");
    return e.includes(n);
  },
  indexOf: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? "");
    return e.indexOf(n);
  },
  lastIndexOf: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? "");
    return e.lastIndexOf(n);
  },
  charAt: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0;
    return e.charAt(n);
  },
  padStart: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0, t = i[2] !== void 0 ? String(i[2]) : " ";
    return e.padStart(n, t);
  },
  padEnd: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0, t = i[2] !== void 0 ? String(i[2]) : " ";
    return e.padEnd(n, t);
  },
  repeat: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0;
    return e.repeat(Math.max(0, n));
  },
  concat: (i) => i.map((e) => String(e ?? "")).join("")
};
var Kt = {
  length: {
    description: "Returns the length of a string",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to get length of",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "number",
    returnDescription: "Length of the string",
    example: 'length "hello"  # Returns 5'
  },
  substring: {
    description: "Extracts a substring from a string",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "Source string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "start",
        dataType: "number",
        description: "Start index (inclusive)",
        formInputType: "number",
        required: true,
        defaultValue: 0
      },
      {
        name: "end",
        dataType: "number",
        description: "End index (exclusive). If omitted, extracts to end of string",
        formInputType: "number",
        required: false,
        defaultValue: 0
      }
    ],
    returnType: "string",
    returnDescription: "Extracted substring",
    example: 'substring "hello" 1 4  # Returns "ell"'
  },
  toUpperCase: {
    description: "Converts a string to uppercase",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to convert",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "Uppercase version of the string",
    example: 'toUpperCase "hello"  # Returns "HELLO"'
  },
  toLowerCase: {
    description: "Converts a string to lowercase",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to convert",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "Lowercase version of the string",
    example: 'toLowerCase "HELLO"  # Returns "hello"'
  },
  trim: {
    description: "Removes whitespace from both ends of a string",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to trim",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "Trimmed string",
    example: 'trim "  hello  "  # Returns "hello"'
  },
  replace: {
    description: "Replaces the first occurrence of a substring in a string",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "Source string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "search",
        dataType: "string",
        description: "Substring to search for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "replace",
        dataType: "string",
        description: "Replacement string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "String with first occurrence replaced",
    example: 'replace "hello world" "world" "universe"  # Returns "hello universe"'
  },
  replaceAll: {
    description: "Replaces all occurrences of a substring in a string",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "Source string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "search",
        dataType: "string",
        description: "Substring to search for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "replace",
        dataType: "string",
        description: "Replacement string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "String with all occurrences replaced",
    example: 'replaceAll "a b a" "a" "x"  # Returns "x b x"'
  },
  split: {
    description: "Splits a string into an array of substrings",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to split",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "delimiter",
        dataType: "string",
        description: "Delimiter to split on. If omitted, splits into individual characters",
        formInputType: "text",
        required: false,
        defaultValue: ","
      }
    ],
    returnType: "array",
    returnDescription: "Array of substrings",
    example: 'split "a,b,c" ","  # Returns ["a", "b", "c"]'
  },
  join: {
    description: "Joins array elements into a string",
    parameters: [
      {
        name: "items",
        dataType: "array",
        description: "Array of items to join",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "delimiter",
        dataType: "string",
        description: "Delimiter to join with",
        formInputType: "text",
        required: false,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "Joined string",
    example: 'join ["a", "b", "c"] ","  # Returns "a,b,c"'
  },
  startsWith: {
    description: "Checks if a string starts with a given prefix",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to check",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "prefix",
        dataType: "string",
        description: "Prefix to check for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "boolean",
    returnDescription: "True if string starts with prefix",
    example: 'startsWith "hello" "he"  # Returns true'
  },
  endsWith: {
    description: "Checks if a string ends with a given suffix",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to check",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "suffix",
        dataType: "string",
        description: "Suffix to check for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "boolean",
    returnDescription: "True if string ends with suffix",
    example: 'endsWith "hello" "lo"  # Returns true'
  },
  contains: {
    description: "Checks if a string contains a given substring",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to search in",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "search",
        dataType: "string",
        description: "Substring to search for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "boolean",
    returnDescription: "True if string contains the substring",
    example: 'contains "hello" "ell"  # Returns true'
  },
  indexOf: {
    description: "Returns the index of the first occurrence of a substring",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to search in",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "search",
        dataType: "string",
        description: "Substring to search for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "number",
    returnDescription: "Index of first occurrence, or -1 if not found",
    example: 'indexOf "hello" "l"  # Returns 2'
  },
  lastIndexOf: {
    description: "Returns the index of the last occurrence of a substring",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to search in",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "search",
        dataType: "string",
        description: "Substring to search for",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "number",
    returnDescription: "Index of last occurrence, or -1 if not found",
    example: 'lastIndexOf "hello" "l"  # Returns 3'
  },
  charAt: {
    description: "Returns the character at a given index",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "Source string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "index",
        dataType: "number",
        description: "Character index",
        formInputType: "number",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "string",
    returnDescription: "Character at the given index",
    example: 'charAt "hello" 1  # Returns "e"'
  },
  padStart: {
    description: "Pads the start of a string to a given length",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to pad",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "length",
        dataType: "number",
        description: "Target length",
        formInputType: "number",
        required: true,
        defaultValue: 0
      },
      {
        name: "padString",
        dataType: "string",
        description: "String to pad with. Defaults to space",
        formInputType: "text",
        required: false,
        defaultValue: " "
      }
    ],
    returnType: "string",
    returnDescription: "Padded string",
    example: 'padStart "5" 3 "0"  # Returns "005"'
  },
  padEnd: {
    description: "Pads the end of a string to a given length",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to pad",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "length",
        dataType: "number",
        description: "Target length",
        formInputType: "number",
        required: true,
        defaultValue: 0
      },
      {
        name: "padString",
        dataType: "string",
        description: "String to pad with. Defaults to space",
        formInputType: "text",
        required: false,
        defaultValue: " "
      }
    ],
    returnType: "string",
    returnDescription: "Padded string",
    example: 'padEnd "5" 3 "0"  # Returns "500"'
  },
  repeat: {
    description: "Repeats a string a given number of times",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to repeat",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "count",
        dataType: "number",
        description: "Number of times to repeat",
        formInputType: "number",
        required: true,
        defaultValue: 1
      }
    ],
    returnType: "string",
    returnDescription: "Repeated string",
    example: 'repeat "ha" 3  # Returns "hahaha"'
  },
  concat: {
    description: "Concatenates multiple strings together",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "string",
        description: "Strings to concatenate (can be multiple arguments)",
        formInputType: "json",
        required: true,
        defaultValue: ["", ""],
        children: {
          name: "string",
          dataType: "string",
          description: "String to concatenate",
          formInputType: "text",
          required: true,
          defaultValue: ""
        }
      }
    ],
    returnType: "string",
    returnDescription: "Concatenated string",
    example: 'concat "hello" " " "world"  # Returns "hello world"'
  }
};
var zt = {
  description: "String manipulation operations including substring extraction, case conversion, searching, and formatting",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/string-module",
  methods: [
    "length",
    "substring",
    "toUpperCase",
    "toLowerCase",
    "trim",
    "replace",
    "replaceAll",
    "split",
    "join",
    "startsWith",
    "endsWith",
    "contains",
    "indexOf",
    "lastIndexOf",
    "charAt",
    "padStart",
    "padEnd",
    "repeat",
    "concat"
  ]
};
var Ht = {
  name: "string",
  functions: Ut,
  functionMetadata: Kt,
  moduleMetadata: zt,
  global: true
};
var Jt = {
  parse: (i) => {
    const e = String(i[0] ?? "");
    try {
      return JSON.parse(e);
    } catch (n) {
      throw new Error(
        `JSON parse error: ${n instanceof Error ? n.message : String(n)}`
      );
    }
  },
  stringify: (i) => {
    const e = i[0], n = i[1] !== void 0 ? Number(i[1]) : void 0;
    try {
      return n !== void 0 && n >= 0 ? JSON.stringify(e, null, n) : JSON.stringify(e);
    } catch (t) {
      throw new Error(
        `JSON stringify error: ${t instanceof Error ? t.message : String(t)}`
      );
    }
  },
  isValid: (i) => {
    const e = String(i[0] ?? "");
    try {
      return JSON.parse(e), true;
    } catch {
      return false;
    }
  }
};
var Gt = {
  parse: {
    description: "Parses a JSON string into a JavaScript value",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "JSON string to parse",
        formInputType: "textarea",
        required: true,
        defaultValue: "{}"
      }
    ],
    returnType: "any",
    returnDescription: "Parsed JavaScript value (object, array, string, number, boolean, or null)",
    example: `json.parse '{"name": "John"}'  # Returns {name: "John"}`
  },
  stringify: {
    description: "Converts a JavaScript value to a JSON string",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to stringify",
        formInputType: "json",
        required: true,
        defaultValue: {}
      },
      {
        name: "indent",
        dataType: "number",
        description: "Number of spaces for indentation (optional, for pretty printing)",
        formInputType: "number",
        required: false,
        defaultValue: 2
      }
    ],
    returnType: "string",
    returnDescription: "JSON string representation of the value",
    example: `json.stringify {name: "John"}  # Returns '{"name":"John"}'`
  },
  isValid: {
    description: "Checks if a string is valid JSON",
    parameters: [
      {
        name: "str",
        dataType: "string",
        description: "String to validate",
        formInputType: "textarea",
        required: true,
        defaultValue: "{}"
      }
    ],
    returnType: "boolean",
    returnDescription: "True if the string is valid JSON",
    example: `json.isValid '{"valid": true}'  # Returns true`
  }
};
var _t = {
  description: "JSON parsing and serialization operations",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/json-module",
  methods: ["parse", "stringify", "isValid"]
};
var Yt = {
  name: "json",
  functions: Jt,
  functionMetadata: Gt,
  moduleMetadata: _t,
  global: false
};
var Zt = {
  keyLength: (i) => {
    const e = i[0];
    return typeof e != "object" || e === null ? 0 : Object.keys(e).length;
  },
  keys: (i) => {
    const e = i[0];
    return typeof e != "object" || e === null ? [] : Object.keys(e);
  },
  values: (i) => {
    const e = i[0];
    return typeof e != "object" || e === null ? [] : Object.values(e);
  },
  entries: (i) => {
    const e = i[0];
    return typeof e != "object" || e === null ? [] : Object.entries(e);
  },
  merge: (i) => {
    if (i.length === 0)
      return {};
    const e = {};
    for (const n of i)
      typeof n == "object" && n !== null && !Array.isArray(n) && Object.assign(e, n);
    return e;
  },
  clone: (i) => {
    const e = i[0];
    try {
      return JSON.parse(JSON.stringify(e));
    } catch {
      throw new Error("Unable to clone value");
    }
  }
};
var Xt = {
  keys: {
    description: "Returns an array of an object's own enumerable property names",
    parameters: [
      {
        name: "obj",
        dataType: "object",
        description: "Object to get keys from",
        formInputType: "json",
        required: true,
        defaultValue: {}
      }
    ],
    returnType: "array",
    returnDescription: "Array of property names",
    example: 'keys {a: 1, b: 2}  # Returns ["a", "b"]'
  },
  values: {
    description: "Returns an array of an object's own enumerable property values",
    parameters: [
      {
        name: "obj",
        dataType: "object",
        description: "Object to get values from",
        formInputType: "json",
        required: true,
        defaultValue: {}
      }
    ],
    returnType: "array",
    returnDescription: "Array of property values",
    example: "values {a: 1, b: 2}  # Returns [1, 2]"
  },
  entries: {
    description: "Returns an array of an object's own enumerable [key, value] pairs",
    parameters: [
      {
        name: "obj",
        dataType: "object",
        description: "Object to get entries from",
        formInputType: "json",
        required: true,
        defaultValue: {}
      }
    ],
    returnType: "array",
    returnDescription: "Array of [key, value] pairs",
    example: 'entries {a: 1, b: 2}  # Returns [["a", 1], ["b", 2]]'
  },
  merge: {
    description: "Merges multiple objects into a single object",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "Array of objects to merge (or multiple object arguments)",
        formInputType: "json",
        required: true,
        defaultValue: [{}, {}],
        children: {
          name: "object",
          dataType: "object",
          description: "Object to merge",
          formInputType: "json",
          required: true,
          defaultValue: {}
        }
      }
    ],
    returnType: "object",
    returnDescription: "Merged object (later objects override earlier ones)",
    example: "merge {a: 1} {b: 2}  # Returns {a: 1, b: 2}"
  },
  clone: {
    description: "Creates a deep copy of a value using JSON serialization",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to clone",
        formInputType: "json",
        required: true,
        defaultValue: {}
      }
    ],
    returnType: "any",
    returnDescription: "Deep copy of the value",
    example: "clone {a: 1, b: {c: 2}}  # Returns a deep copy"
  }
};
var Qt = {
  description: "Operations for creating and manipulating objects",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/object-module",
  methods: ["keys", "values", "entries", "merge", "clone"]
};
var en = {
  name: "object",
  functions: Zt,
  functionMetadata: Xt,
  moduleMetadata: Qt,
  global: true
};
var tn = {
  now: () => (/* @__PURE__ */ new Date()).toISOString(),
  timestamp: () => Date.now(),
  format: (i) => {
    const e = i[0];
    let n;
    if (typeof e == "string")
      n = new Date(e);
    else if (typeof e == "number")
      n = new Date(e);
    else
      throw new Error("Value must be a date string or timestamp");
    if (isNaN(n.getTime()))
      throw new Error("Invalid date");
    return n.toISOString();
  },
  addDays: (i) => {
    const e = String(i[0] ?? ""), n = Number(i[1]) || 0, t = new Date(e);
    if (isNaN(t.getTime()))
      throw new Error("Invalid date string");
    return t.setDate(t.getDate() + n), t.toISOString();
  },
  diffDays: (i) => {
    const e = String(i[0] ?? ""), n = String(i[1] ?? ""), t = new Date(e), r = new Date(n);
    if (isNaN(t.getTime()) || isNaN(r.getTime()))
      throw new Error("Invalid date string");
    const o = r.getTime() - t.getTime();
    return Math.floor(o / (1e3 * 60 * 60 * 24));
  },
  sleep: async (i) => {
    const e = Number(i[0]) || 0;
    if (e < 0)
      throw new Error("Sleep duration must be non-negative");
    return await new Promise((n) => setTimeout(n, e)), null;
  }
};
var nn = {
  now: {
    description: "Returns the current date and time as an ISO string",
    parameters: [],
    returnType: "string",
    returnDescription: "Current date/time in ISO 8601 format",
    example: 'time.now  # Returns current ISO date string like "2024-01-15T10:30:00.000Z"'
  },
  timestamp: {
    description: "Returns the current timestamp in milliseconds",
    parameters: [],
    returnType: "number",
    returnDescription: "Current timestamp in milliseconds since Unix epoch",
    example: "time.timestamp  # Returns current timestamp like 1705312200000"
  },
  format: {
    description: "Formats a date value (currently returns ISO string)",
    parameters: [
      {
        name: "value",
        dataType: "string",
        description: "Date string or timestamp to format",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "pattern",
        dataType: "string",
        description: "Format pattern (currently unused, returns ISO)",
        formInputType: "text",
        required: false,
        defaultValue: ""
      }
    ],
    returnType: "string",
    returnDescription: "Formatted date as ISO string",
    example: 'time.format "2024-01-15"  # Returns ISO formatted date string'
  },
  addDays: {
    description: "Adds a number of days to a date",
    parameters: [
      {
        name: "iso",
        dataType: "string",
        description: "ISO date string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "days",
        dataType: "any",
        description: "Number of days to add (can be negative)",
        formInputType: "textarea",
        required: true,
        defaultValue: 1
      }
    ],
    returnType: "string",
    returnDescription: "New date as ISO string",
    example: 'time.addDays "2024-01-15T00:00:00.000Z" 7  # Returns date 7 days later'
  },
  diffDays: {
    description: "Calculates the difference in days between two dates",
    parameters: [
      {
        name: "iso1",
        dataType: "string",
        description: "First ISO date string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      },
      {
        name: "iso2",
        dataType: "string",
        description: "Second ISO date string",
        formInputType: "text",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "number",
    returnDescription: "Number of days difference (iso2 - iso1)",
    example: 'time.diffDays "2024-01-01" "2024-01-08"  # Returns 7'
  },
  sleep: {
    description: "Pauses execution for a specified number of milliseconds",
    parameters: [
      {
        name: "ms",
        dataType: "number",
        description: "Number of milliseconds to sleep",
        formInputType: "number",
        required: true,
        defaultValue: 1e3,
        allowedTypes: ["number", "lastValue", "subexpr", "var"]
      }
    ],
    returnType: "null",
    returnDescription: "Returns null after the sleep duration",
    example: "time.sleep 1000  # Pauses execution for 1 second"
  }
};
var rn = {
  description: "Time and date operations including delays, timestamps, and formatting",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/time-module",
  methods: ["now", "timestamp", "format", "addDays", "diffDays", "sleep"]
};
var sn = {
  name: "time",
  functions: tn,
  functionMetadata: nn,
  moduleMetadata: rn,
  global: true
};
function on() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (i) => {
    const e = Math.random() * 16 | 0;
    return (i === "x" ? e : e & 3 | 8).toString(16);
  });
}
var an = {
  int: (i) => {
    const e = Number(i[0]) || 0, n = Number(i[1]) || 1, t = Math.ceil(e), r = Math.floor(n);
    if (t > r)
      throw new Error("Min must be less than or equal to max");
    return Math.floor(Math.random() * (r - t + 1)) + t;
  },
  float: () => Math.random(),
  uuid: () => on(),
  choice: (i) => {
    const e = i[0];
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    if (e.length === 0)
      throw new Error("Array cannot be empty");
    const n = Math.floor(Math.random() * e.length);
    return e[n];
  }
};
var un = {
  int: {
    description: "Generates a random integer between min and max (inclusive)",
    parameters: [
      {
        name: "min",
        dataType: "any",
        description: "Minimum value (inclusive)",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      },
      {
        name: "max",
        dataType: "any",
        description: "Maximum value (inclusive)",
        formInputType: "textarea",
        required: true,
        defaultValue: 100
      }
    ],
    returnType: "number",
    returnDescription: "Random integer between min and max",
    example: "random.int 1 10  # Returns a random integer between 1 and 10"
  },
  float: {
    description: "Generates a random floating-point number between 0 and 1",
    parameters: [],
    returnType: "number",
    returnDescription: "Random float between 0 (inclusive) and 1 (exclusive)",
    example: "random.float  # Returns a random float like 0.123456"
  },
  uuid: {
    description: "Generates a random UUID v4",
    parameters: [],
    returnType: "string",
    returnDescription: "Random UUID v4 string",
    example: 'random.uuid  # Returns a UUID like "550e8400-e29b-41d4-a716-446655440000"'
  },
  choice: {
    description: "Randomly selects one element from an array",
    parameters: [
      {
        name: "array",
        dataType: "array",
        description: "Array to choose from",
        formInputType: "json",
        required: true,
        defaultValue: []
      }
    ],
    returnType: "any",
    returnDescription: "Randomly selected element from the array",
    example: "random.choice range 1 5  # Returns a random number from [1, 2, 3, 4, 5]"
  }
};
var ln = {
  description: "Operations for generating random numbers and values",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/random-module",
  methods: ["int", "float", "uuid", "choice"]
};
var cn = {
  name: "random",
  functions: an,
  functionMetadata: un,
  moduleMetadata: ln,
  global: false
};
var dn = {
  length: (i) => {
    const e = i[0];
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    return e.length;
  },
  get: (i) => {
    const e = i[0], n = Number(i[1]) || 0;
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    return n < 0 || n >= e.length ? null : e[n];
  },
  slice: (i) => {
    const e = i[0], n = Number(i[1]) || 0, t = i[2] !== void 0 ? Number(i[2]) : void 0;
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    return t !== void 0 ? e.slice(n, t) : e.slice(n);
  },
  push: (i) => {
    const e = i[0], n = i[1];
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    return e.push(n), e;
  },
  concat: (i) => {
    const e = i[0], n = i[1];
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    if (!Array.isArray(n))
      throw new Error("Second argument must be an array");
    return e.concat(n);
  },
  join: (i) => {
    const e = i[0], n = i[1] !== void 0 ? String(i[1]) : ",";
    if (!Array.isArray(e))
      throw new Error("First argument must be an array");
    return e.map((t) => String(t ?? "")).join(n);
  },
  create: (i) => [...i]
};
var pn = {
  length: {
    description: "Returns the length of an array",
    parameters: [
      {
        name: "arr",
        dataType: "array",
        description: "Array to get length of",
        formInputType: "json",
        required: true,
        defaultValue: []
      }
    ],
    returnType: "number",
    returnDescription: "Length of the array",
    example: "length range 1 5  # Returns 5"
  },
  get: {
    description: "Gets an element from an array by index",
    parameters: [
      {
        name: "arr",
        dataType: "array",
        description: "Array to get element from",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "index",
        dataType: "any",
        description: "Index of the element (0-based)",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      }
    ],
    returnType: "any",
    returnDescription: "Element at the specified index, or null if out of bounds",
    example: "get range 1 5 2  # Returns 3"
  },
  slice: {
    description: "Extracts a section of an array",
    parameters: [
      {
        name: "arr",
        dataType: "array",
        description: "Array to slice",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "start",
        dataType: "any",
        description: "Start index (inclusive)",
        formInputType: "textarea",
        required: true,
        defaultValue: 0
      },
      {
        name: "end",
        dataType: "any",
        description: "End index (exclusive). If omitted, slices to end of array",
        formInputType: "textarea",
        required: false,
        defaultValue: 0
      }
    ],
    returnType: "array",
    returnDescription: "New array containing the sliced elements",
    example: "slice range 1 10 2 5  # Returns [3, 4, 5]"
  },
  push: {
    description: "Adds an element to the end of an array (mutates the original array)",
    parameters: [
      {
        name: "arr",
        dataType: "array",
        description: "Array to add element to",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "value",
        dataType: "any",
        description: "Value to add",
        formInputType: "json",
        required: true,
        defaultValue: ""
      }
    ],
    returnType: "array",
    returnDescription: "The same array with the element added (mutated in place)",
    example: "push range 1 3 4  # Mutates array to [1, 2, 3, 4]"
  },
  concat: {
    description: "Concatenates two arrays",
    parameters: [
      {
        name: "arr1",
        dataType: "array",
        description: "First array",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "arr2",
        dataType: "array",
        description: "Second array",
        formInputType: "json",
        required: true,
        defaultValue: []
      }
    ],
    returnType: "array",
    returnDescription: "New array containing elements from both arrays",
    example: "concat range 1 2 range 3 4  # Returns [1, 2, 3, 4]"
  },
  join: {
    description: "Joins array elements into a string with a delimiter",
    parameters: [
      {
        name: "arr",
        dataType: "array",
        description: "Array to join",
        formInputType: "json",
        required: true,
        defaultValue: []
      },
      {
        name: "delimiter",
        dataType: "string",
        description: "Delimiter to join with. Defaults to comma",
        formInputType: "text",
        required: false,
        defaultValue: ","
      }
    ],
    returnType: "string",
    returnDescription: "Joined string",
    example: 'join range 1 3 ","  # Returns "1,2,3"'
  },
  create: {
    description: "Creates an array from the given arguments",
    parameters: [
      {
        name: "args",
        label: "Arguments",
        dataType: "any",
        description: "Values to include in the array (any number of arguments)",
        formInputType: "json",
        required: false,
        defaultValue: [],
        children: {
          name: "value",
          dataType: "any",
          description: "Value to include in the array",
          formInputType: "json",
          required: false,
          defaultValue: ""
        }
      }
    ],
    returnType: "array",
    returnDescription: "New array containing all provided values",
    example: 'array.create 1 2 3 "hello"  # Returns [1, 2, 3, "hello"]'
  }
};
var fn = {
  description: "Operations for creating and manipulating arrays",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/array-module",
  methods: ["length", "get", "slice", "push", "concat", "join", "create"]
};
var hn = {
  name: "array",
  functions: dn,
  functionMetadata: pn,
  moduleMetadata: fn,
  global: false
};
var be = (i) => {
  const { positionalArgs: e, namedArgs: n } = ot(i);
  let t;
  if (n.url !== void 0) {
    if (typeof n.url != "string")
      throw new Error(
        `url must be a string, got ${typeof n.url}: ${JSON.stringify(
          n.url
        )}`
      );
    t = n.url;
  } else if (e.length > 0) {
    if (typeof e[0] != "string")
      throw new Error(
        `url must be a string, got ${typeof e[0]}: ${JSON.stringify(
          e[0]
        )}`
      );
    t = e[0];
  }
  if (!t || typeof t != "string" || t.trim() === "" || t === "undefined" || t === "null")
    throw new Error(
      `url is required and must be a non-empty string. Received: ${JSON.stringify(
        t
      )}. Use url="..." or pass as first positional argument`
    );
  if (t = t.trim(), t.length < 4 || !t.startsWith("http://") && !t.startsWith("https://"))
    throw new Error(
      `Invalid URL format: "${t}". URL must start with http:// or https://`
    );
  let r;
  n.body !== void 0 ? r = n.body : e.length > 1 && (r = e[1]);
  let o;
  if (n.headers !== void 0) {
    const s = n.headers;
    typeof s == "object" && s !== null && !Array.isArray(s) && (o = s);
  } else if (e.length > 2) {
    const s = e[2];
    typeof s == "object" && s !== null && !Array.isArray(s) && (o = s);
  }
  return {
    url: t,
    body: r,
    headers: o,
    method: n.method ? String(n.method).toUpperCase() : void 0
  };
};
var Ce = async (i, e) => {
  const n = i.method || e, t = {
    ...i.headers || {}
  };
  i.body !== void 0 && !t["Content-Type"] && !t["content-type"] && (t["Content-Type"] = "application/json");
  const r = {
    method: n,
    headers: Object.keys(t).length > 0 ? t : void 0
  };
  i.body !== void 0 && (n === "POST" || n === "PUT" || n === "PATCH") && (typeof i.body == "string" ? r.body = i.body : r.body = JSON.stringify(i.body));
  try {
    if (!i.url || typeof i.url != "string")
      throw new Error(`Invalid URL: ${JSON.stringify(i.url)}`);
    const o = await fetch(i.url, r);
    let s;
    const a = o.headers.get("content-type");
    if (a && a.includes("application/json"))
      try {
        s = await o.json();
      } catch {
        s = await o.text();
      }
    else
      s = await o.text();
    return {
      ok: o.ok,
      status: o.status,
      statusText: o.statusText,
      headers: Object.fromEntries(o.headers.entries()),
      data: s
    };
  } catch (o) {
    throw new Error(
      `Fetch failed: ${o instanceof Error ? o.message : String(o)}`
    );
  }
};
var mn = {
  get: async (i) => {
    const e = be(i);
    return await Ce(e, "GET");
  },
  post: async (i) => {
    const e = be(i);
    return await Ce(e, "POST");
  },
  delete: async (i) => {
    const e = be(i);
    return await Ce(e, "DELETE");
  },
  put: async (i) => {
    const e = be(i);
    return await Ce(e, "PUT");
  }
};
var gn = {
  get: {
    description: "Performs an HTTP GET request",
    parameters: [
      {
        name: "url",
        dataType: "string",
        description: "URL to fetch from",
        formInputType: "text",
        required: true,
        defaultValue: "https://"
      },
      {
        name: "headers",
        dataType: "object",
        description: "HTTP headers as key-value pairs",
        formInputType: "json",
        required: false,
        defaultValue: {}
      }
    ],
    returnType: "object",
    returnDescription: "Response object with ok, status, statusText, headers, and data properties",
    example: 'fetch.get(url="https://api.example.com/data", headers=obj`{"Authorization": "Bearer token"}`)'
  },
  post: {
    description: "Performs an HTTP POST request",
    parameters: [
      {
        name: "url",
        dataType: "string",
        description: "URL to send request to",
        formInputType: "text",
        required: true,
        defaultValue: "https://"
      },
      {
        name: "body",
        dataType: "any",
        description: "Request body (will be JSON stringified if object)",
        formInputType: "json",
        required: false,
        defaultValue: {}
      },
      {
        name: "headers",
        dataType: "object",
        description: "HTTP headers as key-value pairs",
        formInputType: "json",
        required: false,
        defaultValue: {}
      }
    ],
    returnType: "object",
    returnDescription: "Response object with ok, status, statusText, headers, and data properties",
    example: 'fetch.post(url="https://api.example.com/users", body=obj`{"name": "John"}`, headers=obj`{"Content-Type": "application/json"}`)'
  },
  delete: {
    description: "Performs an HTTP DELETE request",
    parameters: [
      {
        name: "url",
        dataType: "string",
        description: "URL to delete resource at",
        formInputType: "text",
        required: true,
        defaultValue: "https://"
      },
      {
        name: "headers",
        dataType: "object",
        description: "HTTP headers as key-value pairs",
        formInputType: "json",
        required: false,
        defaultValue: {}
      }
    ],
    returnType: "object",
    returnDescription: "Response object with ok, status, statusText, headers, and data properties",
    example: 'fetch.delete(url="https://api.example.com/users/123", headers=obj`{"Authorization": "Bearer token"}`)'
  },
  put: {
    description: "Performs an HTTP PUT request",
    parameters: [
      {
        name: "url",
        dataType: "string",
        description: "URL to send request to",
        formInputType: "text",
        required: true,
        defaultValue: "https://"
      },
      {
        name: "body",
        dataType: "any",
        description: "Request body (will be JSON stringified if object)",
        formInputType: "json",
        required: false,
        defaultValue: {}
      },
      {
        name: "headers",
        dataType: "object",
        description: "HTTP headers as key-value pairs",
        formInputType: "json",
        required: false,
        defaultValue: {}
      }
    ],
    returnType: "object",
    returnDescription: "Response object with ok, status, statusText, headers, and data properties",
    example: 'fetch.put(url="https://api.example.com/users/123", body=obj`{"name": "Jane"}`, headers=obj`{"Content-Type": "application/json"}`)'
  }
};
var yn = {
  description: "HTTP request operations using the native fetch API. Supports GET, POST, DELETE, and PUT methods.",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/fetch-module",
  methods: ["get", "post", "delete", "put"]
};
var Dn = {
  name: "fetch",
  functions: mn,
  functionMetadata: gn,
  moduleMetadata: yn,
  global: false
};
var En = {
  assert: (i) => {
    if (i.length === 0)
      throw new Error("assert requires at least one argument");
    const e = i[0], n = `Expected truthy value, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (!bn(e))
      throw new Error(t);
    return true;
  },
  assertEqual: (i) => {
    if (i.length < 2)
      throw new Error("assertEqual requires two arguments");
    const e = i[0], n = i[1], t = `Expected ${JSON.stringify(
      n
    )}, got ${JSON.stringify(e)}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (!he(e, n))
      throw new Error(r);
    return true;
  },
  assertNotEqual: (i) => {
    if (i.length < 2)
      throw new Error("assertNotEqual requires two arguments");
    const e = i[0], n = i[1], t = `Expected values to be different, but both were ${JSON.stringify(
      e
    )}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (he(e, n))
      throw new Error(r);
    return true;
  },
  assertTrue: (i) => {
    if (i.length === 0)
      throw new Error("assertTrue requires one argument");
    const e = i[0], n = `Expected true, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (e !== true)
      throw new Error(t);
    return true;
  },
  assertFalse: (i) => {
    if (i.length === 0)
      throw new Error("assertFalse requires one argument");
    const e = i[0], n = `Expected false, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (e !== false)
      throw new Error(t);
    return true;
  },
  assertNull: (i) => {
    if (i.length === 0)
      throw new Error("assertNull requires one argument");
    const e = i[0], n = `Expected null, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (e !== null)
      throw new Error(t);
    return true;
  },
  assertNotNull: (i) => {
    if (i.length === 0)
      throw new Error("assertNotNull requires one argument");
    const e = i[0], n = `Expected non-null value, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (e === null)
      throw new Error(t);
    return true;
  },
  assertEmpty: (i) => {
    if (i.length === 0)
      throw new Error("assertEmpty requires one argument");
    const e = i[0], n = `Expected empty value, got ${JSON.stringify(e)}`, t = i.length > 1 ? `${String(i[1])} (${n})` : n;
    if (e === null || typeof e == "string" && e === "" || Array.isArray(e) && e.length === 0 || typeof e == "object" && e !== null && !Array.isArray(e) && Object.keys(e).length === 0 || typeof e == "number" && e === 0)
      return true;
    throw new Error(t);
  },
  assertGreater: (i) => {
    if (i.length < 2)
      throw new Error("assertGreater requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0, t = `Expected value greater than ${n}, got ${e}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (e <= n)
      throw new Error(r);
    return true;
  },
  assertGreaterOrEqual: (i) => {
    if (i.length < 2)
      throw new Error("assertGreaterOrEqual requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0, t = `Expected value greater than or equal to ${n}, got ${e}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (e < n)
      throw new Error(r);
    return true;
  },
  assertLess: (i) => {
    if (i.length < 2)
      throw new Error("assertLess requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0, t = `Expected value less than ${n}, got ${e}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (e >= n)
      throw new Error(r);
    return true;
  },
  assertLessOrEqual: (i) => {
    if (i.length < 2)
      throw new Error("assertLessOrEqual requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0, t = `Expected value less than or equal to ${n}, got ${e}`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (e > n)
      throw new Error(r);
    return true;
  },
  assertContains: (i) => {
    if (i.length < 2)
      throw new Error("assertContains requires two arguments");
    const e = i[0], n = i[1], t = `Expected ${JSON.stringify(
      e
    )} to contain ${JSON.stringify(n)}, but it does not`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (Array.isArray(e)) {
      if (!e.includes(n))
        throw new Error(r);
    } else if (typeof e == "string" && typeof n == "string") {
      if (!e.includes(n))
        throw new Error(r);
    } else
      throw new Error(
        "assertContains: first argument must be an array or string"
      );
    return true;
  },
  assertNotContains: (i) => {
    if (i.length < 2)
      throw new Error("assertNotContains requires two arguments");
    const e = i[0], n = i[1], t = `Expected ${JSON.stringify(
      e
    )} not to contain ${JSON.stringify(n)}, but it does`, r = i.length > 2 ? `${String(i[2])} (${t})` : t;
    if (Array.isArray(e)) {
      if (e.includes(n))
        throw new Error(r);
    } else if (typeof e == "string" && typeof n == "string") {
      if (e.includes(n))
        throw new Error(r);
    } else
      throw new Error(
        "assertNotContains: first argument must be an array or string"
      );
    return true;
  },
  assertType: (i) => {
    if (i.length < 2)
      throw new Error("assertType requires two arguments");
    const e = i[0], n = String(i[1]), t = Cn(e), r = `Expected type ${n}, got ${t}`, o = i.length > 2 ? `${String(i[2])} (${r})` : r;
    if (t !== n)
      throw new Error(o);
    return true;
  },
  isEqual: (i) => {
    if (i.length < 2)
      throw new Error("isEqual requires two arguments");
    const e = i[0], n = i[1];
    return he(e, n);
  },
  isBigger: (i) => {
    if (i.length < 2)
      throw new Error("isBigger requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0;
    return e > n;
  },
  isSmaller: (i) => {
    if (i.length < 2)
      throw new Error("isSmaller requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0;
    return e < n;
  },
  isEqualOrBigger: (i) => {
    if (i.length < 2)
      throw new Error("isEqualOrBigger requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0;
    return e >= n;
  },
  isEqualOrSmaller: (i) => {
    if (i.length < 2)
      throw new Error("isEqualOrSmaller requires two arguments");
    const e = Number(i[0]) || 0, n = Number(i[1]) || 0;
    return e <= n;
  },
  fail: (i) => {
    const e = i.length > 0 ? String(i[0]) : "Test failed";
    throw new Error(e);
  }
};
function bn(i) {
  return i == null ? false : typeof i == "number" ? i !== 0 : typeof i == "string" ? i.length > 0 : typeof i == "boolean" ? i : true;
}
function he(i, e) {
  if (i === e)
    return true;
  if (i === null || e === null || i === void 0 || e === void 0 || typeof i != typeof e)
    return false;
  if (typeof i == "object") {
    if (Array.isArray(i) && Array.isArray(e)) {
      if (i.length !== e.length)
        return false;
      for (let r = 0; r < i.length; r++)
        if (!he(i[r], e[r]))
          return false;
      return true;
    }
    const n = Object.keys(i), t = Object.keys(e);
    if (n.length !== t.length)
      return false;
    for (const r of n)
      if (!he(i[r], e[r]))
        return false;
    return true;
  }
  return false;
}
function Cn(i) {
  return i === null ? "null" : Array.isArray(i) ? "array" : typeof i;
}
var xn = {
  assert: {
    description: "Asserts that a value is truthy",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to assert as truthy",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assert add 5 5  # Passes if result is truthy"
  },
  assertEqual: {
    description: "Asserts that two values are equal (deep comparison)",
    parameters: [
      {
        name: "actual",
        dataType: "any",
        description: "Actual value",
        formInputType: "json",
        required: true
      },
      {
        name: "expected",
        dataType: "any",
        description: "Expected value",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertEqual add 5 5 10  # Passes if 5+5 equals 10"
  },
  assertNotEqual: {
    description: "Asserts that two values are not equal",
    parameters: [
      {
        name: "actual",
        dataType: "any",
        description: "Actual value",
        formInputType: "json",
        required: true
      },
      {
        name: "expected",
        dataType: "any",
        description: "Value that should not equal actual",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertNotEqual add 5 5 9  # Passes if 5+5 does not equal 9"
  },
  assertTrue: {
    description: "Asserts that a value is exactly true",
    parameters: [
      {
        name: "value",
        dataType: "boolean",
        description: "Value to assert as true",
        formInputType: "checkbox",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertTrue true  # Passes if value is exactly true"
  },
  assertFalse: {
    description: "Asserts that a value is exactly false",
    parameters: [
      {
        name: "value",
        dataType: "boolean",
        description: "Value to assert as false",
        formInputType: "checkbox",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertFalse false  # Passes if value is exactly false"
  },
  assertNull: {
    description: "Asserts that a value is null",
    parameters: [
      {
        name: "value",
        dataType: "null",
        description: "Value to assert as null",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertNull null  # Passes if value is null"
  },
  assertNotNull: {
    description: "Asserts that a value is not null",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to assert as non-null",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertNotNull add 5 5  # Passes if result is not null"
  },
  assertEmpty: {
    description: 'Asserts that a value is empty (null, empty string "", empty array [], empty object {}, or number 0)',
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to assert as empty",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertEmpty null  # Passes if value is null, empty string, array, object, or 0"
  },
  assertGreater: {
    description: "Asserts that the first number is greater than the second",
    parameters: [
      {
        name: "actual",
        dataType: "number",
        description: "Actual value",
        formInputType: "number",
        required: true
      },
      {
        name: "expected",
        dataType: "number",
        description: "Value that actual should be greater than",
        formInputType: "number",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertGreater 10 5  # Passes if 10 > 5"
  },
  assertGreaterOrEqual: {
    description: "Asserts that the first number is greater than or equal to the second",
    parameters: [
      {
        name: "actual",
        dataType: "number",
        description: "Actual value",
        formInputType: "number",
        required: true
      },
      {
        name: "expected",
        dataType: "number",
        description: "Value that actual should be greater than or equal to",
        formInputType: "number",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertGreaterOrEqual 10 10  # Passes if 10 >= 10"
  },
  assertLess: {
    description: "Asserts that the first number is less than the second",
    parameters: [
      {
        name: "actual",
        dataType: "number",
        description: "Actual value",
        formInputType: "number",
        required: true
      },
      {
        name: "expected",
        dataType: "number",
        description: "Value that actual should be less than",
        formInputType: "number",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertLess 3 5  # Passes if 3 < 5"
  },
  assertLessOrEqual: {
    description: "Asserts that the first number is less than or equal to the second",
    parameters: [
      {
        name: "actual",
        dataType: "number",
        description: "Actual value",
        formInputType: "number",
        required: true
      },
      {
        name: "expected",
        dataType: "number",
        description: "Value that actual should be less than or equal to",
        formInputType: "number",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertLessOrEqual 5 5  # Passes if 5 <= 5"
  },
  assertContains: {
    description: "Asserts that an array or string contains a value",
    parameters: [
      {
        name: "container",
        dataType: "array",
        description: "Array or string to check",
        formInputType: "json",
        required: true
      },
      {
        name: "item",
        dataType: "any",
        description: "Value to check for",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertContains range 1 5 3  # Passes if array contains 3"
  },
  assertNotContains: {
    description: "Asserts that an array or string does not contain a value",
    parameters: [
      {
        name: "container",
        dataType: "array",
        description: "Array or string to check",
        formInputType: "json",
        required: true
      },
      {
        name: "item",
        dataType: "any",
        description: "Value that should not be present",
        formInputType: "json",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: "assertNotContains range 1 3 5  # Passes if array does not contain 5"
  },
  assertType: {
    description: "Asserts that a value has a specific type",
    parameters: [
      {
        name: "value",
        dataType: "any",
        description: "Value to check type of",
        formInputType: "json",
        required: true
      },
      {
        name: "type",
        dataType: "string",
        description: "Expected type (string, number, boolean, object, array, null)",
        formInputType: "text",
        required: true
      },
      {
        name: "message",
        dataType: "string",
        description: "Optional error message if assertion fails",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if assertion passes",
    example: 'assertType "hello" "string"  # Passes if value is a string'
  },
  isEqual: {
    description: "Returns true if two values are equal (deep comparison)",
    parameters: [
      {
        name: "a",
        dataType: "any",
        description: "First value to compare",
        formInputType: "json",
        required: true
      },
      {
        name: "b",
        dataType: "any",
        description: "Second value to compare",
        formInputType: "json",
        required: true
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if values are equal, false otherwise",
    example: "isEqual add 5 5 10  # Returns true if 5+5 equals 10"
  },
  isBigger: {
    description: "Returns true if the first number is greater than the second",
    parameters: [
      {
        name: "a",
        dataType: "number",
        description: "First number",
        formInputType: "number",
        required: true
      },
      {
        name: "b",
        dataType: "number",
        description: "Second number",
        formInputType: "number",
        required: true
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if a > b, false otherwise",
    example: "isBigger 10 5  # Returns true"
  },
  isSmaller: {
    description: "Returns true if the first number is less than the second",
    parameters: [
      {
        name: "a",
        dataType: "number",
        description: "First number",
        formInputType: "number",
        required: true
      },
      {
        name: "b",
        dataType: "number",
        description: "Second number",
        formInputType: "number",
        required: true
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if a < b, false otherwise",
    example: "isSmaller 3 5  # Returns true"
  },
  isEqualOrBigger: {
    description: "Returns true if the first number is greater than or equal to the second",
    parameters: [
      {
        name: "a",
        dataType: "number",
        description: "First number",
        formInputType: "number",
        required: true
      },
      {
        name: "b",
        dataType: "number",
        description: "Second number",
        formInputType: "number",
        required: true
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if a >= b, false otherwise",
    example: "isEqualOrBigger 10 10  # Returns true"
  },
  isEqualOrSmaller: {
    description: "Returns true if the first number is less than or equal to the second",
    parameters: [
      {
        name: "a",
        dataType: "number",
        description: "First number",
        formInputType: "number",
        required: true
      },
      {
        name: "b",
        dataType: "number",
        description: "Second number",
        formInputType: "number",
        required: true
      }
    ],
    returnType: "boolean",
    returnDescription: "Returns true if a <= b, false otherwise",
    example: "isEqualOrSmaller 5 5  # Returns true"
  },
  fail: {
    description: "Explicitly fails a test with an optional message",
    parameters: [
      {
        name: "message",
        dataType: "string",
        description: "Error message for the failure",
        formInputType: "text",
        required: false
      }
    ],
    returnType: "boolean",
    returnDescription: "Never returns (throws an error)",
    example: 'fail "Test intentionally failed"  # Throws an error'
  }
};
var wn = {
  description: "Testing utilities for RobinPath scripts",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/test-module",
  methods: [
    "assert",
    "assertEqual",
    "assertNotEqual",
    "assertTrue",
    "assertFalse",
    "assertNull",
    "assertNotNull",
    "assertEmpty",
    "assertGreater",
    "assertGreaterOrEqual",
    "assertLess",
    "assertLessOrEqual",
    "assertContains",
    "assertNotContains",
    "assertType",
    "isEqual",
    "isBigger",
    "isSmaller",
    "isEqualOrBigger",
    "isEqualOrSmaller",
    "fail"
  ]
};
var An = {
  name: "test",
  functions: En,
  functionMetadata: xn,
  moduleMetadata: wn,
  global: true
};
var kn = {
  click: async (i, e) => {
    const n = String(i[0] ?? "");
    if (e) {
      const t = [
        { type: "click", target: n },
        // $1 - event object
        n
        // $2 - query name
      ], r = await Promise.resolve(e(t));
      return r !== void 0 ? r : null;
    }
    return null;
  }
};
var vn = {
  click: {
    description: "Simulates a click event on an element identified by query name. Optionally accepts a with callback block.",
    parameters: [
      {
        name: "queryName",
        dataType: "string",
        description: "Query selector or identifier for the element to click",
        formInputType: "text",
        required: true,
        defaultValue: "#element"
      }
    ],
    returnType: "null",
    returnDescription: "Returns null, or the result of the callback if a with block is provided",
    example: `dom.click "button" with
  log "Clicked:" $1
endwith`
  }
};
var Tn = {
  description: "DOM manipulation and event handling operations including element clicking with callback support",
  author: "RobinPath",
  category: "RobinPath Core",
  doc_url: "https://www.robinpath.com/tutorial/dom-module",
  methods: ["click"]
};
var Fn = {
  name: "dom",
  functions: kn,
  functionMetadata: vn,
  moduleMetadata: Tn,
  global: false
};
var Sn = "0.30.0";
var xe = class _xe {
  static versionLogged = false;
  environment;
  persistentExecutor = null;
  lastExecutor = null;
  activeExecutor = null;
  threads = /* @__PURE__ */ new Map();
  currentThread = null;
  threadControl = false;
  replBuffer = "";
  astToCodeConverter;
  serializer;
  stateTracker;
  constructor(e) {
    this.threadControl = e?.threadControl ?? false, _xe.versionLogged || ((typeof globalThis < "u" ? globalThis.process : void 0)?.env?.NODE_ENV === "development" || typeof window < "u" && (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1")) && (console.log(`[RobinPath] v${Sn} (dev mode)`), _xe.versionLogged = true), this.stateTracker = new nt(), this.environment = {
      variables: /* @__PURE__ */ new Map(),
      functions: /* @__PURE__ */ new Map(),
      builtins: /* @__PURE__ */ new Map(),
      decorators: /* @__PURE__ */ new Map(),
      parseDecorators: /* @__PURE__ */ new Map(),
      metadata: /* @__PURE__ */ new Map(),
      moduleMetadata: /* @__PURE__ */ new Map(),
      currentModule: null,
      variableMetadata: /* @__PURE__ */ new Map(),
      functionMetadata: /* @__PURE__ */ new Map(),
      constants: /* @__PURE__ */ new Set(),
      eventHandlers: /* @__PURE__ */ new Map(),
      stateTracker: this.stateTracker
    }, this.persistentExecutor = new _(this.environment, null), this.astToCodeConverter = new Pt(), this.serializer = new rt(this.environment), this.loadNativeModules(), this.registerBuiltinDecorators(), this.registerBuiltin("log", async (n) => {
      const t = n.map((o) => typeof o == "object" ? JSON.stringify(o) : String(o)).join(" "), r = this.activeExecutor?.getCurrentStatement();
      return this.stateTracker.addLog({
        message: t,
        nodeKey: r?.nodeKey,
        timestamp: Date.now(),
        source: "log"
      }), console.log(t), null;
    }), this.registerBuiltin("say", async (n) => {
      const t = n.map((o) => typeof o == "object" ? JSON.stringify(o) : String(o)).join(""), r = this.activeExecutor?.getCurrentStatement();
      return this.stateTracker.addLog({
        message: t,
        nodeKey: r?.nodeKey,
        timestamp: Date.now(),
        source: "say"
      }), console.log(t), t;
    }), this.registerBuiltin("explain", (n) => {
      const t = n[0];
      if (!t) {
        const o = "Error: explain requires a module or function name";
        return console.log(o), o;
      }
      const r = String(t);
      if (r.includes(".")) {
        const o = this.environment.metadata.get(r);
        if (!o) {
          const a = `No documentation available for function: ${r}`;
          return console.log(a), a;
        }
        let s = `Function: ${r}

`;
        if (s += `Description: ${o.description}

`, o.parameters && o.parameters.length > 0) {
          s += `Parameters:
`;
          for (const a of o.parameters)
            s += `  - ${a.name} (${a.dataType})`, a.required && (s += " [required]"), s += `
    ${a.description}`, a.formInputType && (s += `
    Input type: ${a.formInputType}`), a.defaultValue !== void 0 && (s += `
    Default: ${JSON.stringify(a.defaultValue)}`), s += `
`;
        } else
          s += `Parameters: None
`;
        return s += `
Returns: ${o.returnType}`, o.returnDescription && (s += `
  ${o.returnDescription}`), o.example && (s += `

Example:
  ${o.example}`), console.log(s), s;
      } else {
        const o = this.environment.moduleMetadata.get(r);
        if (!o) {
          const a = `No documentation available for module: ${r}`;
          return console.log(a), a;
        }
        let s = `Module: ${r}

`;
        if (s += `Description: ${o.description}

`, o.methods && o.methods.length > 0) {
          s += `Available Methods:
`;
          for (const a of o.methods)
            s += `  - ${a}
`;
        } else
          s += `Available Methods: None
`;
        return console.log(s), s;
      }
    }), this.registerBuiltin("trigger", async (n) => {
      if (n.length === 0) {
        const o = "Error: trigger requires an event name";
        return console.log(o), o;
      }
      const t = String(n[0]), r = n.slice(1);
      return await this.trigger(t, ...r), null;
    });
  }
  /**
   * Get execution steps from the last execution
   */
  getExecutionSteps() {
    return this.stateTracker.getSteps();
  }
  /**
   * Get execution logs from the last execution
   */
  getExecutionLogs() {
    return this.stateTracker.getLogs();
  }
  /**
   * Set a callback for real-time log notifications
   * The callback is called immediately when a log is added during execution
   */
  setLogCallback(e) {
    this.stateTracker.setLogCallback(e);
  }
  /**
   * Clear execution state
   */
  clearExecutionState() {
    this.stateTracker.clear();
  }
  /**
   * Native modules registry
   * Add new modules here to auto-load them
   */
  static NATIVE_MODULES = [
    Ot,
    Wt,
    Ht,
    Yt,
    en,
    sn,
    cn,
    hn,
    Dn,
    An,
    Fn
  ];
  /**
   * Load a single module using the adapter pattern
   */
  loadModule(e) {
    if (this.registerModule(e.name, e.functions), this.registerModuleMeta(e.name, e.functionMetadata), this.registerModuleInfo(e.name, e.moduleMetadata), e.global === true) {
      for (const [n, t] of Object.entries(e.functions))
        this.environment.builtins.has(n) || this.environment.builtins.set(n, t);
      for (const [n, t] of Object.entries(
        e.functionMetadata || {}
      ))
        this.environment.metadata.has(n) || this.environment.metadata.set(n, t);
    }
  }
  /**
   * Load all native modules
   */
  loadNativeModules() {
    for (const e of _xe.NATIVE_MODULES)
      this.loadModule(e);
  }
  /**
   * Register a builtin function
   */
  registerBuiltin(e, n) {
    this.environment.builtins.set(e, n);
  }
  /**
   * Register a runtime decorator function that can be used to modify function calls at execution time
   * Runtime decorators execute during function execution and can modify arguments or behavior
   * Decorators are only available via API registration, not in scripts
   * @param name Decorator name (without @ prefix)
   * @param handler Decorator handler function
   */
  registerDecorator(e, n) {
    this.environment.decorators.set(e, n);
  }
  /**
   * Register a parse-time decorator function that executes during parsing
   * Parse decorators inject metadata into AST nodes (def, on, var, const)
   * They run during parsing, not execution, and work with AST arguments
   * @param name Decorator name (without @ prefix)
   * @param handler Parse decorator handler function
   */
  registerParseDecorator(e, n) {
    this.environment.parseDecorators.set(e, n);
  }
  /**
   * Register built-in parse-time decorators (@desc/@description, @title, @param, @arg, @required)
   * These decorators execute during parsing and inject metadata into AST nodes
   */
  registerBuiltinDecorators() {
    const e = async (s, a, u, l) => {
      if (u.length === 0)
        throw new Error(
          "@desc/@description decorator requires a value argument"
        );
      let p;
      const c = u[0];
      if (c.type === "string" && "value" in c)
        p = String(c.value);
      else if (c.type === "literal" && "value" in c && typeof c.value == "string")
        p = String(c.value);
      else
        throw new Error(
          "@desc/@description decorator requires a string argument"
        );
      a !== null ? (l.functionMetadata.has(s) || l.functionMetadata.set(s, /* @__PURE__ */ new Map()), l.functionMetadata.get(s).set("description", p)) : (l.variableMetadata.has(s) || l.variableMetadata.set(s, /* @__PURE__ */ new Map()), l.variableMetadata.get(s).set("description", p));
    };
    this.registerParseDecorator("desc", e), this.registerParseDecorator("description", e);
    const n = async (s, a, u, l) => {
      if (u.length === 0)
        throw new Error("@title decorator requires a value argument");
      let p;
      const c = u[0];
      if (c.type === "string" && "value" in c)
        p = String(c.value);
      else if (c.type === "literal" && "value" in c && typeof c.value == "string")
        p = String(c.value);
      else
        throw new Error("@title decorator requires a string argument");
      a !== null ? (l.functionMetadata.has(s) || l.functionMetadata.set(s, /* @__PURE__ */ new Map()), l.functionMetadata.get(s).set("title", p)) : (l.variableMetadata.has(s) || l.variableMetadata.set(s, /* @__PURE__ */ new Map()), l.variableMetadata.get(s).set("title", p));
    };
    this.registerParseDecorator("title", n);
    const t = async (s, a, u, l) => {
      if (u.length < 2)
        throw new Error(
          "@param decorator requires at least 2 arguments: type and $name"
        );
      if (a === null)
        throw new Error(
          "@param decorator can only be used on functions, not variables"
        );
      let p;
      const c = u[0];
      if (c.type === "string" && "value" in c)
        p = String(c.value);
      else if (c.type === "literal" && "value" in c)
        p = String(c.value);
      else
        throw new Error(
          "@param decorator: first argument must be a type (string literal)"
        );
      let h;
      if (u[1].type === "var")
        h = u[1].name;
      else
        throw new Error(
          "@param decorator: second argument must be a variable name (e.g., $name)"
        );
      let f, m;
      if (u.length === 3) {
        const E = u[2];
        E.type === "string" && "value" in E ? (m = String(E.value), f = void 0) : E.type === "literal" && "value" in E ? typeof E.value == "string" ? (m = String(E.value), f = void 0) : (f = E.value, m = "") : E.type === "number" && "value" in E ? (f = E.value, m = "") : (m = "", f = void 0);
      } else if (u.length >= 4) {
        const E = u[2];
        E.type === "literal" && "value" in E || E.type === "number" && "value" in E || E.type === "string" && "value" in E ? f = E.value : f = void 0;
        const w = u[3];
        w.type === "string" && "value" in w || w.type === "literal" && "value" in w && typeof w.value == "string" ? m = String(w.value) : m = "";
      } else
        f = void 0, m = "";
      if (![
        "array",
        "number",
        "string",
        "object",
        "bool",
        "boolean",
        "any"
      ].includes(p.toLowerCase()))
        throw new Error(
          `@param decorator: invalid type "${p}". Must be one of: array, number, string, object, bool, boolean, any`
        );
      const y = p.toLowerCase() === "bool" ? "boolean" : p.toLowerCase();
      l.functionMetadata.has(s) || l.functionMetadata.set(s, /* @__PURE__ */ new Map());
      const D = l.functionMetadata.get(s);
      let C = [];
      if (D.has("parameters")) {
        const E = D.get("parameters");
        Array.isArray(E) && (C = [...E]);
      }
      const x = {
        name: h,
        dataType: y,
        description: m || "",
        formInputType: y === "number" ? "number" : y === "string" ? "text" : y === "boolean" ? "checkbox" : "json",
        required: f === void 0
      };
      f !== void 0 && (x.defaultValue = f), C.push(x), D.set("parameters", C);
    };
    this.registerParseDecorator("param", t);
    const r = async (s, a, u, l) => {
      if (u.length < 1)
        throw new Error(
          "@arg decorator requires at least 1 argument: dataType"
        );
      if (a === null)
        throw new Error(
          "@arg decorator can only be used on functions, not variables"
        );
      let p;
      const c = u[0];
      if (c.type === "string" && "value" in c)
        p = String(c.value);
      else if (c.type === "literal" && "value" in c)
        p = String(c.value);
      else
        throw new Error(
          "@arg decorator: first argument must be a dataType (string literal)"
        );
      if (![
        "array",
        "number",
        "string",
        "object",
        "bool",
        "boolean",
        "any"
      ].includes(p.toLowerCase()))
        throw new Error(
          `@arg decorator: invalid dataType "${p}". Must be one of: array, number, string, object, bool, boolean, any`
        );
      const f = p.toLowerCase() === "bool" ? "boolean" : p.toLowerCase();
      let m, g;
      if (u.length === 2) {
        m = void 0;
        const w = u[1];
        w.type === "string" && "value" in w || w.type === "literal" && "value" in w && typeof w.value == "string" ? g = String(w.value) : g = "";
      } else if (u.length >= 3) {
        const w = u[1];
        w.type === "string" && "value" in w || w.type === "literal" && "value" in w && typeof w.value == "string" ? g = String(w.value) : g = "";
        const b = u[2];
        b.type === "literal" && "value" in b || b.type === "number" && "value" in b || b.type === "string" && "value" in b ? m = b.value : m = void 0;
      } else
        m = void 0, g = "";
      l.functionMetadata.has(s) || l.functionMetadata.set(s, /* @__PURE__ */ new Map());
      const y = l.functionMetadata.get(s);
      let D = [];
      if (y.has("parameters")) {
        const w = y.get("parameters");
        Array.isArray(w) && (D = [...w]);
      }
      let C = null, x = -1;
      for (let w = 0; w < D.length; w++)
        if (D[w].name === "args") {
          C = D[w], x = w;
          break;
        }
      C || (C = {
        name: "args",
        label: "Arguments",
        dataType: "array",
        description: "",
        formInputType: "json",
        required: true,
        children: []
      }, x = D.length, D.push(C)), C.children || (C.children = []);
      const E = {
        name: "value",
        dataType: f,
        description: g || "",
        formInputType: f === "number" ? "number" : f === "string" ? "text" : f === "boolean" ? "checkbox" : "json",
        required: m === void 0
      };
      m !== void 0 && (E.defaultValue = m), C.children.push(E), D[x] = C, y.set("parameters", D);
    };
    this.registerParseDecorator("arg", r);
    const o = async (s, a, u, l) => {
      if (u.length < 1)
        throw new Error(
          "@required decorator requires at least 1 argument: parameter name(s)"
        );
      if (a === null)
        throw new Error(
          "@required decorator can only be used on functions, not variables"
        );
      const p = [];
      for (let f = 0; f < u.length; f++) {
        const m = u[f];
        if (m.type === "var")
          p.push(m.name);
        else
          throw new Error(
            `@required decorator: argument at index ${f} must be a variable name (e.g., $paramName)`
          );
      }
      l.functionMetadata.has(s) || l.functionMetadata.set(s, /* @__PURE__ */ new Map());
      const c = l.functionMetadata.get(s);
      let h = [];
      if (c.has("parameters")) {
        const f = c.get("parameters");
        Array.isArray(f) && (h = [...f]);
      }
      for (const f of p) {
        let m = false;
        for (let g = 0; g < h.length; g++)
          if (h[g].name === f) {
            h[g].required = true, m = true;
            break;
          }
        m || h.push({
          name: f,
          dataType: "any",
          description: "",
          formInputType: "json",
          required: true
        });
      }
      c.set("parameters", h);
    };
    this.registerParseDecorator("required", o);
  }
  /**
   * Register a module with multiple functions
   * @example
   * rp.registerModule('fs', {
   *   read: (args) => { ... },
   *   write: (args) => { ... }
   * });
   */
  registerModule(e, n) {
    for (const [t, r] of Object.entries(n))
      this.environment.builtins.set(`${e}.${t}`, r);
  }
  /**
   * Register a module function (e.g., 'fs.read')
   */
  registerModuleFunction(e, n, t) {
    this.environment.builtins.set(`${e}.${n}`, t);
  }
  /**
   * Register an external class constructor (e.g., 'Client', 'Database')
   */
  registerConstructor(e, n) {
    this.environment.builtins.set(e, n);
  }
  /**
   * Register metadata for a module with multiple functions
   * @example
   * rp.registerModuleMeta('fs', {
   *   read: {
   *     description: 'Reads a file from the filesystem',
   *     parameters: [
   *       {
   *         name: 'filename',
   *         dataType: 'string',
   *         description: 'Path to the file to read',
   *         formInputType: 'text',
   *         required: true
   *       }
   *     ],
   *     returnType: 'string',
   *     returnDescription: 'Contents of the file'
   *   },
   *   write: {
   *     description: 'Writes content to a file',
   *     parameters: [
   *       {
   *         name: 'filename',
   *         dataType: 'string',
   *         description: 'Path to the file to write',
   *         formInputType: 'text',
   *         required: true
   *       },
   *       {
   *         name: 'content',
   *         dataType: 'string',
   *         description: 'Content to write to the file',
   *         formInputType: 'textarea',
   *         required: true
   *       }
   *     ],
   *     returnType: 'boolean',
   *     returnDescription: 'True if write was successful'
   *   }
   * });
   */
  registerModuleMeta(e, n) {
    for (const [t, r] of Object.entries(n))
      this.environment.metadata.set(`${e}.${t}`, r);
  }
  /**
   * Register metadata for a single module function (e.g., 'fs.read')
   * @example
   * rp.registerModuleFunctionMeta('fs', 'read', {
   *   description: 'Reads a file from the filesystem',
   *   parameters: [
   *     {
   *       name: 'filename',
   *       dataType: 'string',
   *       description: 'Path to the file to read',
   *       formInputType: 'text',
   *       required: true
   *     }
   *   ],
   *   returnType: 'string',
   *   returnDescription: 'Contents of the file'
   * });
   */
  registerModuleFunctionMeta(e, n, t) {
    this.environment.metadata.set(`${e}.${n}`, t);
  }
  /**
   * Get metadata for a function (builtin or module function)
   * Returns null if no metadata is registered
   */
  getFunctionMetadata(e) {
    return this.environment.metadata.get(e) ?? null;
  }
  /**
   * Get all registered function metadata
   */
  getAllFunctionMetadata() {
    return new Map(this.environment.metadata);
  }
  /**
   * Register module-level metadata (description and list of methods)
   * @example
   * rp.registerModuleInfo('fs', {
   *   description: 'File system operations for reading and writing files',
   *   methods: ['read', 'write', 'exists', 'delete']
   * });
   */
  registerModuleInfo(e, n) {
    this.environment.moduleMetadata.set(e, n);
  }
  /**
   * Get module metadata (description and methods list)
   * Returns null if no metadata is registered
   */
  getModuleInfo(e) {
    return this.environment.moduleMetadata.get(e) ?? null;
  }
  /**
   * Get all registered module metadata
   */
  getAllModuleInfo() {
    return new Map(this.environment.moduleMetadata);
  }
  /**
   * Get syntax context for available commands
   * Determines what commands are valid based on the current syntax position
   */
  getSyntaxContext(e) {
    const n = e || {};
    return {
      // Can start a new statement (commands, assignments, etc.)
      canStartStatement: !n.afterIf && !n.afterDef && !n.afterElseif,
      // Can use block keywords (if, def)
      canUseBlockKeywords: !n.inIfBlock && !n.inDefBlock,
      // Can use end keywords (endif, enddef)
      canUseEndKeywords: !!(n.inIfBlock || n.inDefBlock),
      // Can use conditional keywords (elseif, else)
      canUseConditionalKeywords: !!n.inIfBlock
    };
  }
  /**
   * Get all available commands, modules, and functions
   * Returns a structured object with categories, each containing objects with:
   * - name: The command/function name
   * - type: The type (native, builtin, module, moduleFunction, userFunction)
   * - description: Description if available
   *
   * @param context Optional syntax context to filter commands based on what's valid next
   */
  getAvailableCommands(e) {
    const n = this.getSyntaxContext(e), t = {
      if: "Conditional statement - starts a conditional block",
      else: "Alternative branch in conditional blocks",
      elseif: "Additional condition in conditional blocks",
      endif: "Ends a conditional block",
      def: "Defines a user function - starts function definition",
      enddef: "Ends a function definition",
      iftrue: "Executes command if last value is truthy",
      iffalse: "Executes command if last value is falsy"
    }, r = [];
    n.canUseBlockKeywords && (r.push({
      name: "if",
      type: "native",
      description: t.if
    }), r.push({
      name: "def",
      type: "native",
      description: t.def
    }), t.do && r.push({
      name: "do",
      type: "native",
      description: t.do
    })), n.canUseConditionalKeywords && (r.push({
      name: "elseif",
      type: "native",
      description: t.elseif
    }), r.push({
      name: "else",
      type: "native",
      description: t.else
    })), n.canUseEndKeywords && (e?.inIfBlock && t.endif && r.push({
      name: "endif",
      type: "native",
      description: t.endif
    }), e?.inDefBlock && t.enddef && r.push({
      name: "enddef",
      type: "native",
      description: t.enddef
    }), t.enddo && r.push({
      name: "enddo",
      type: "native",
      description: t.enddo
    })), n.canStartStatement && (r.push({
      name: "iftrue",
      type: "native",
      description: t.iftrue
    }), r.push({
      name: "iffalse",
      type: "native",
      description: t.iffalse
    }));
    const o = [];
    if (n.canStartStatement) {
      for (const [l] of this.environment.builtins.entries())
        if (!l.includes(".")) {
          const p = this.environment.metadata.get(l);
          o.push({
            name: l,
            type: "builtin",
            description: p?.description || "Builtin command"
          });
        }
      o.sort((l, p) => l.name.localeCompare(p.name));
    }
    const s = [];
    if (n.canStartStatement) {
      for (const [
        l,
        p
      ] of this.environment.moduleMetadata.entries())
        s.push({
          name: l,
          type: "module",
          description: p.description || "Module",
          author: p.author,
          category: p.category
        });
      s.sort((l, p) => l.name.localeCompare(p.name));
    }
    const a = [];
    if (n.canStartStatement) {
      for (const [l] of this.environment.builtins.entries())
        if (l.includes(".")) {
          const p = this.environment.metadata.get(l);
          a.push({
            name: l,
            type: "moduleFunction",
            description: p?.description || "Module function"
          });
        }
      a.sort((l, p) => l.name.localeCompare(p.name));
    }
    const u = [];
    if (n.canStartStatement) {
      for (const l of this.environment.functions.keys())
        u.push({
          name: l,
          type: "userFunction",
          description: "User-defined function"
        });
      u.sort((l, p) => l.name.localeCompare(p.name));
    }
    return {
      native: r,
      builtin: o,
      modules: s,
      moduleFunctions: a,
      userFunctions: u
    };
  }
  /**
   * Check if a script needs more input (incomplete block)
   * Returns { needsMore: true, waitingFor: 'endif' | 'enddef' | 'endfor' | 'enddo' | 'endon' | 'subexpr' | 'paren' | 'object' | 'array' } if incomplete,
   * or { needsMore: false } if complete.
   */
  async needsMoreInput(e) {
    try {
      return await new W(e).parse(), { needsMore: false };
    } catch (n) {
      const t = n instanceof Error ? n.message : String(n);
      return t.includes("missing endif") ? { needsMore: true, waitingFor: "endif" } : t.includes("missing enddef") ? { needsMore: true, waitingFor: "enddef" } : t.includes("missing endfor") ? { needsMore: true, waitingFor: "endfor" } : t.includes("missing enddo") ? { needsMore: true, waitingFor: "enddo" } : t.includes("missing endon") ? { needsMore: true, waitingFor: "endon" } : t.includes("unclosed subexpression") ? { needsMore: true, waitingFor: "subexpr" } : t.includes("unclosed parenthesized function call") ? { needsMore: true, waitingFor: "paren" } : t.includes("unclosed object literal") ? { needsMore: true, waitingFor: "object" } : t.includes("unclosed array literal") ? { needsMore: true, waitingFor: "array" } : { needsMore: false };
    }
  }
  /**
   * Get the AST without execution state
   * Returns a JSON-serializable AST array
   *
   * Note: This method only parses the script, it does not execute it.
   */
  async getAST(e) {
    const t = await new W(e).parse();
    let r = null;
    return t.map((s, a) => {
      const u = `root-${a}`;
      if (s.type === "command" && s.name === "use" && s.args.length > 0) {
        const l = s.args[0];
        if (l.type === "literal" || l.type === "string") {
          const p = String(l.value);
          p === "clear" || p === "" || p === null ? r = null : r = p;
        }
      }
      return this.serializeStatement(s, r, void 0, u);
    });
  }
  /**
   * Get extracted function definitions (def/enddef blocks) from a script
   * Returns a JSON-serializable array of function definitions
   *
   * Note: This method only parses the script, it does not execute it.
   */
  async getExtractedFunctions(e) {
    const n = new W(e);
    return await n.parse(), n.getExtractedFunctions().map((r) => {
      const o = `func-${r.name}`;
      return {
        name: r.name,
        paramNames: r.paramNames,
        body: r.body.map((s, a) => this.serializeStatement(s, null, void 0, `${o}-${a}`))
      };
    });
  }
  /**
   * Serialize a statement to JSON
   * @param stmt The statement to serialize
   * @param currentModuleContext Optional module context
   * @param lastValue Optional execution state
   * @param nodeKey Optional node key
   */
  serializeStatement(e, n, t, r) {
    return this.serializer.serializeStatement(e, n, t, r);
  }
  /**
   * Get the complete structure of the script in a tree format
   * Includes main body, functions, event handlers, and variables
   */
  async getScriptStructure(e) {
    const n = new W(e), t = await n.parse(), r = n.getExtractedFunctions(), o = n.getExtractedEventHandlers(), s = n.getExtractedVariables();
    return {
      main: this.serializer.getStructure(t, "root"),
      functions: r.map((u, l) => {
        const p = u.nodeKey || `func-${l}`;
        return {
          key: p,
          label: `def ${u.name}`,
          type: "define",
          children: this.serializer.getStructure(u.body, p)
        };
      }),
      events: o.map((u, l) => {
        const p = `event-${l}`;
        return {
          key: p,
          label: `on ${u.eventName}`,
          type: "onBlock",
          children: this.serializer.getStructure(u.body, p)
        };
      }),
      variables: s.map((u) => ({
        name: u.name,
        description: u.description,
        initialValue: u.initialValue
      }))
    };
  }
  /**
   * Get extracted variables from the script (parsed, not executed)
   * Returns variable names with optional description and initial value
   */
  async getExtractedVariables(e) {
    const n = new W(e);
    return await n.parse(), n.getExtractedVariables().map((r) => ({
      name: r.name,
      description: r.description,
      initialValue: r.initialValue
    }));
  }
  /**
   * Update source code based on AST changes
   * Uses precise character-level positions (codePos.startRow/startCol/endRow/endCol) to update code
   * Nested nodes are reconstructed as part of their parent's code
   * @param originalScript The original source code
   * @param ast The modified AST array (top-level nodes only)
   * @returns Updated source code
   */
  async updateCodeFromAST(e, n) {
    return await this.astToCodeConverter.updateCodeFromAST(
      e,
      n
    );
  }
  /**
   * Reconstruct code from an AST node
   * @param node The AST node (serialized)
   * @param indentLevel Indentation level for nested code
   * @returns Reconstructed code string, or null if cannot be reconstructed
   */
  reconstructCodeFromASTNode(e, n = 0) {
    return this.astToCodeConverter.reconstructCodeFromASTNode(
      e,
      n
    );
  }
  /**
   * Execute a RobinPath script
   */
  async executeScript(e) {
    const n = new W(e, this.environment), t = await n.parse(), r = new _(this.environment, null, e), o = n.getExtractedFunctions();
    for (const a of o)
      this.environment.functions.set(a.name, a), a.decorators && a.decorators.length > 0 && await r.executeDecorators(a.decorators, a.name, a, []);
    const s = n.getExtractedEventHandlers();
    for (const a of s) {
      const u = this.environment.eventHandlers.get(a.eventName) || [];
      u.push(a), this.environment.eventHandlers.set(a.eventName, u), a.decorators && a.decorators.length > 0 && await r.executeDecorators(
        a.decorators,
        a.eventName,
        null,
        []
      );
    }
    this.lastExecutor = r, this.activeExecutor = r;
    try {
      return await r.execute(t);
    } finally {
      this.activeExecutor = null;
    }
  }
  /**
   * Execute a single line (for REPL)
   * Uses a persistent executor to maintain state ($, variables) between calls.
   * Functions and builtins persist across calls.
   */
  async executeLine(e) {
    const n = new W(e), t = await n.parse(), r = n.getExtractedFunctions();
    for (const o of r)
      this.environment.functions.set(o.name, o);
    this.persistentExecutor || (this.persistentExecutor = new _(this.environment, null)), this.lastExecutor = this.persistentExecutor, this.activeExecutor = this.persistentExecutor;
    try {
      return await this.persistentExecutor.execute(t);
    } finally {
      this.activeExecutor = null;
    }
  }
  /**
   * Get the last value ($)
   * Returns the value from the most recent execution (script or REPL line).
   */
  getLastValue() {
    return this.lastExecutor ? this.lastExecutor.getCurrentFrame().lastValue : null;
  }
  /**
   * REPL-friendly execution that supports multi-line blocks (if/def/for and $( ... )).
   *
   * Usage pattern:
   *  - Call this for every user-entered line.
   *  - If done === false, keep collecting lines.
   *  - When done === true, value is the execution result and the buffer is cleared.
   */
  async executeReplLine(e) {
    this.replBuffer = this.replBuffer ? this.replBuffer + `
` + e : e;
    const n = await this.needsMoreInput(this.replBuffer);
    if (n.needsMore)
      return { done: false, value: null, waitingFor: n.waitingFor };
    const t = await this.executeScript(this.replBuffer);
    return this.replBuffer = "", { done: true, value: t };
  }
  /**
   * Generate a UUID v4
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (e) => {
      const n = Math.random() * 16 | 0;
      return (e === "x" ? n : n & 3 | 8).toString(16);
    });
  }
  /**
   * Create a new thread/session.
   * Each thread has its own variables, functions, and $,
   * but shares builtins and metadata with the root interpreter.
   *
   * @param id Optional thread ID. If not provided, a UUID will be generated.
   * @returns The created thread
   *
   * @example
   * const rp = new RobinPath();
   * const thread = rp.createThread('my-thread');
   * await thread.executeScript('math.add 5 5');
   * console.log(thread.getLastValue()); // 10
   */
  createThread(e) {
    const n = e || this.generateUUID();
    if (this.threads.has(n))
      throw new Error(`Thread with ID "${n}" already exists`);
    const t = new Bt(this.environment, n, this);
    return this.threads.set(n, t), this.currentThread || (this.currentThread = t), t;
  }
  /**
   * Get a thread by ID
   */
  getThread(e) {
    return this.threads.get(e) ?? null;
  }
  /**
   * List all threads with their IDs
   */
  listThreads() {
    const e = [];
    for (const [n, t] of this.threads.entries())
      e.push({
        id: n,
        isCurrent: t === this.currentThread
      });
    return e;
  }
  /**
   * Switch to a different thread
   */
  useThread(e) {
    const n = this.threads.get(e);
    if (!n)
      throw new Error(`Thread with ID "${e}" not found`);
    this.currentThread = n;
  }
  /**
   * Get the current thread
   */
  getCurrentThread() {
    return this.currentThread;
  }
  /**
   * Check if thread control is enabled
   */
  isThreadControlEnabled() {
    return this.threadControl;
  }
  /**
   * Close a thread by ID
   * If the closed thread is the current thread, currentThread is set to null
   */
  closeThread(e) {
    const n = this.threads.get(e);
    if (!n)
      throw new Error(`Thread with ID "${e}" not found`);
    this.currentThread === n && (this.currentThread = null), this.threads.delete(e);
  }
  /**
   * Trigger an event, executing all registered event handlers for the event name
   * @param eventName The name of the event to trigger
   * @param args Arguments to pass to event handlers (available as $1, $2, $3, etc.)
   * @returns Promise that resolves when all handlers have executed
   */
  async trigger(e, ...n) {
    const t = this.environment.eventHandlers.get(e) || [];
    if (t.length !== 0)
      for (const r of t) {
        const o = new _(this.environment, null);
        try {
          await o.executeEventHandler(r, n);
        } catch (s) {
          console.error(
            `Error executing event handler for "${e}":`,
            s
          );
        }
      }
  }
  /**
   * Get all event handlers (onBlocks) registered in the environment
   * @returns Map of event name to array of OnBlock handlers
   */
  getEventHandlers() {
    return this.environment.eventHandlers;
  }
  /**
   * Get all event handlers as a flat array
   * @returns Array of all OnBlock handlers
   */
  getAllEventHandlers() {
    const e = [];
    for (const n of this.environment.eventHandlers.values())
      e.push(...n);
    return e;
  }
  /**
   * Get event handlers as serialized AST
   * @returns Array of serialized event handler AST nodes
   */
  getEventAST() {
    const e = this.getAllEventHandlers();
    let n = null;
    return e.map((t, r) => this.serializeStatement(t, n, void 0, `event-${r}`));
  }
  /**
   * Get a variable value
   */
  getVariable(e) {
    return this.environment.variables.get(e) ?? null;
  }
  /**
   * Set a variable value (for external use)
   */
  setVariable(e, n) {
    this.environment.variables.set(e, n);
  }
  /**
   * Get all variables as a plain object
   */
  getVariableState() {
    const e = {};
    for (const [n, t] of this.environment.variables.entries())
      e[n] = t;
    return e;
  }
  /**
   * Get the next statement index that would execute after a given statement.
   * This method analyzes the AST structure to determine execution flow.
   *
   * @param statements The array of all statements
   * @param currentIndex The index of the current statement
   * @param context Optional context for conditional branches (which branch was taken)
   * @returns The index of the next statement to execute, or -1 if execution ends
   */
  getNextStatementIndex(e, n, t) {
    if (n < 0 || n >= e.length)
      return -1;
    const r = e[n];
    if (r.type === "return")
      return -1;
    if (r.type === "comment")
      return n + 1 < e.length ? n + 1 : -1;
    if (r.type === "ifBlock") {
      const o = t?.ifBlockBranch;
      return o === "then" && r.thenBranch && r.thenBranch.length > 0 || o === "elseif" && r.elseifBranches || o === "else" && r.elseBranch && r.elseBranch.length > 0 || o === null || r.thenBranch && r.thenBranch.length > 0 || r.elseifBranches && r.elseifBranches.length > 0 || r.elseBranch && r.elseBranch.length > 0, n + 1 < e.length ? n + 1 : -1;
    }
    return r.type === "forLoop" ? (r.body && r.body.length > 0, n + 1 < e.length ? n + 1 : -1) : (r.type === "define" || r.type === "do" || r.type === "together" || r.type === "inlineIf" || r.type === "ifTrue" || r.type === "ifFalse", n + 1 < e.length ? n + 1 : -1);
  }
};

// cli-entry.js
function getInstallDir() {
  const home = (0, import_node_os.homedir)();
  if ((0, import_node_os.platform)() === "win32") {
    return (0, import_node_path.join)(home, ".robinpath", "bin");
  }
  return (0, import_node_path.join)(home, ".robinpath", "bin");
}
function handleInstall() {
  const installDir = getInstallDir();
  const isWindows = (0, import_node_os.platform)() === "win32";
  const exeName = isWindows ? "robinpath.exe" : "robinpath";
  const dest = (0, import_node_path.join)(installDir, exeName);
  const src = process.execPath;
  if ((0, import_node_path.resolve)(src) === (0, import_node_path.resolve)(dest)) {
    console.log(`robinpath v${Sn} is already installed.`);
    return;
  }
  (0, import_node_fs.mkdirSync)(installDir, { recursive: true });
  (0, import_node_fs.copyFileSync)(src, dest);
  if (isWindows) {
    try {
      const checkPath = (0, import_node_child_process.execSync)(
        `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','User')"`,
        { encoding: "utf-8" }
      ).trim();
      if (!checkPath.includes(installDir)) {
        (0, import_node_child_process.execSync)(
          `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path','${installDir};' + [Environment]::GetEnvironmentVariable('Path','User'),'User')"`,
          { encoding: "utf-8" }
        );
      }
    } catch {
      console.log(`Could not update PATH automatically.`);
      console.log(`Add this to your PATH manually: ${installDir}`);
    }
  } else {
    const shellProfile = process.env.SHELL?.includes("zsh") ? "~/.zshrc" : "~/.bashrc";
    const exportLine = `export PATH="${installDir}:$PATH"`;
    console.log(`Add to ${shellProfile}:`);
    console.log(`  ${exportLine}`);
  }
  console.log("");
  console.log(`Installed robinpath v${Sn}`);
  console.log(`Location: ${dest}`);
  console.log("");
  console.log("Restart your terminal, then run:");
  console.log("  robinpath --version");
}
function handleUninstall() {
  const installDir = getInstallDir();
  const robinpathHome = (0, import_node_path.join)((0, import_node_os.homedir)(), ".robinpath");
  const isWindows = (0, import_node_os.platform)() === "win32";
  if ((0, import_node_fs.existsSync)(robinpathHome)) {
    (0, import_node_fs.rmSync)(robinpathHome, { recursive: true, force: true });
    console.log(`Removed ${robinpathHome}`);
  } else {
    console.log("Nothing to remove.");
  }
  if (isWindows) {
    try {
      (0, import_node_child_process.execSync)(
        `powershell -NoProfile -Command "$p = [Environment]::GetEnvironmentVariable('Path','User'); $clean = ($p -split ';' | Where-Object { $_ -notlike '*\\.robinpath\\bin*' }) -join ';'; [Environment]::SetEnvironmentVariable('Path',$clean,'User')"`,
        { encoding: "utf-8" }
      );
      console.log("Removed from PATH");
    } catch {
      console.log(`Could not update PATH automatically.`);
      console.log(`Remove "${installDir}" from your PATH manually.`);
    }
  } else {
    console.log(`Remove the robinpath PATH line from your shell profile.`);
  }
  console.log("");
  console.log("RobinPath uninstalled. Restart your terminal.");
}
function resolveScriptPath(fileArg) {
  const filePath = (0, import_node_path.resolve)(fileArg);
  if ((0, import_node_fs.existsSync)(filePath)) return filePath;
  if (!(0, import_node_path.extname)(filePath)) {
    const rpPath = filePath + ".rp";
    if ((0, import_node_fs.existsSync)(rpPath)) return rpPath;
    const robinPath = filePath + ".robin";
    if ((0, import_node_fs.existsSync)(robinPath)) return robinPath;
  }
  return null;
}
async function runScript(script) {
  const rp = new xe();
  try {
    await rp.executeScript(script);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
function readStdin() {
  return new Promise((resolve2) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve2(data);
    });
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`robinpath v${Sn}`);
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`RobinPath v${Sn} - A scripting language for automation and data processing`);
    console.log("");
    console.log("Usage:");
    console.log("  robinpath <script.rp>           Run a RobinPath script");
    console.log(`  robinpath -e 'log "hello"'       Execute inline script`);
    console.log("  robinpath                        Start interactive REPL");
    console.log(`  echo 'log "hi"' | robinpath      Pipe script via stdin`);
    console.log("");
    console.log("Commands:");
    console.log("  install               Install robinpath to your system PATH");
    console.log("  uninstall             Remove robinpath from your system");
    console.log("");
    console.log("Options:");
    console.log("  -e, --eval <script>   Execute a script string");
    console.log("  -v, --version         Show version");
    console.log("  -h, --help            Show this help");
    console.log("");
    console.log("Examples:");
    console.log("  robinpath install           Install to PATH (run once)");
    console.log("  robinpath hello             Runs hello.rp (auto-resolves extension)");
    console.log("  robinpath app.rp            Runs app.rp");
    console.log('  robinpath -e "math.add 1 2"');
    console.log("  robinpath -- -weird-name.rp Use -- for files starting with -");
    return;
  }
  if (args[0] === "install") {
    handleInstall();
    return;
  }
  if (args[0] === "uninstall") {
    handleUninstall();
    return;
  }
  const evalIdx = args.indexOf("-e") !== -1 ? args.indexOf("-e") : args.indexOf("--eval");
  if (evalIdx !== -1) {
    const script = args[evalIdx + 1];
    if (!script) {
      console.error("Error: -e requires a script argument");
      process.exit(1);
    }
    await runScript(script);
    return;
  }
  const dashDashIdx = args.indexOf("--");
  let fileArg;
  if (dashDashIdx !== -1) {
    fileArg = args[dashDashIdx + 1];
  } else {
    fileArg = args.find((a) => !a.startsWith("-"));
  }
  if (fileArg) {
    const filePath = resolveScriptPath(fileArg);
    if (!filePath) {
      console.error(`Error: File not found: ${fileArg}`);
      if (!(0, import_node_path.extname)(fileArg)) {
        console.error(`  (also tried ${fileArg}.rp and ${fileArg}.robin)`);
      }
      process.exit(1);
    }
    const script = (0, import_node_fs.readFileSync)(filePath, "utf-8");
    await runScript(script);
    return;
  }
  if (!process.stdin.isTTY) {
    const script = await readStdin();
    if (script.trim()) {
      await runScript(script);
    }
    return;
  }
  const rp = new xe({ threadControl: true });
  rp.createThread("default");
  function getPrompt() {
    const thread = rp.getCurrentThread();
    if (!thread) return "> ";
    const currentModule = thread.getCurrentModule();
    if (currentModule) {
      return `${thread.id}@${currentModule}> `;
    }
    return `${thread.id}> `;
  }
  function endsWithBackslash(line) {
    return line.trimEnd().endsWith("\\");
  }
  let accumulatedLines = [];
  const rl = (0, import_node_readline.createInterface)({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt()
  });
  console.log(`RobinPath v${Sn}`);
  console.log('Type "help" for commands, "exit" to quit');
  console.log("");
  rl.prompt();
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed && accumulatedLines.length === 0) {
      rl.prompt();
      return;
    }
    if (trimmed === "exit" || trimmed === "quit" || trimmed === ".exit") {
      console.log("Goodbye!");
      process.exit(0);
    }
    if (accumulatedLines.length === 0 && (trimmed === "help" || trimmed === ".help")) {
      console.log("");
      console.log("RobinPath REPL Commands:");
      console.log("  exit, quit     Exit the REPL");
      console.log("  help           Show this help");
      console.log("  clear          Clear the screen");
      console.log("  ..             Show all available commands");
      console.log("");
      console.log("Write RobinPath code and press Enter to execute.");
      console.log("Multi-line blocks (if/def/for/do) are supported.");
      console.log("Use \\ at end of line for line continuation.");
      console.log("");
      rl.prompt();
      return;
    }
    if (accumulatedLines.length === 0 && (trimmed === "clear" || trimmed === ".clear")) {
      console.clear();
      rl.prompt();
      return;
    }
    if (accumulatedLines.length === 0 && trimmed === "..") {
      const thread = rp.getCurrentThread();
      const commands = thread ? thread.getAvailableCommands() : rp.getAvailableCommands();
      console.log(JSON.stringify(commands, null, 2));
      rl.prompt();
      return;
    }
    if (endsWithBackslash(line)) {
      accumulatedLines.push(line);
      rl.setPrompt("... ");
      rl.prompt();
      return;
    }
    if (accumulatedLines.length > 0) {
      accumulatedLines.push(line);
    }
    const scriptToCheck = accumulatedLines.length > 0 ? accumulatedLines.join("\n") : line;
    try {
      const thread = rp.getCurrentThread();
      let needsMore;
      if (thread) {
        needsMore = await thread.needsMoreInput(scriptToCheck);
      } else {
        needsMore = await rp.needsMoreInput(scriptToCheck);
      }
      if (needsMore.needsMore) {
        if (accumulatedLines.length === 0) {
          accumulatedLines.push(line);
        }
        rl.setPrompt("... ");
        rl.prompt();
        return;
      }
      const finalScript = accumulatedLines.length > 0 ? accumulatedLines.join("\n") : line;
      accumulatedLines = [];
      if (thread) {
        await thread.executeScript(finalScript);
      } else {
        await rp.executeScript(finalScript);
      }
      rl.setPrompt(getPrompt());
    } catch (error) {
      console.error(`Error: ${error.message}`);
      accumulatedLines = [];
      rl.setPrompt(getPrompt());
    }
    rl.prompt();
  });
  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    if (accumulatedLines.length > 0) {
      console.log("\nBlock cancelled.");
      accumulatedLines = [];
      rl.setPrompt(getPrompt());
      rl.prompt();
    } else {
      console.log("\nGoodbye!");
      process.exit(0);
    }
  });
}
main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
