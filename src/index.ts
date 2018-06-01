import {
  propercase, strictParseInt, strictParseFloat, isAlphaCode, isWhitespaceCode,
  isDigitCode
} from "./helpers";
import * as moment from 'moment';
import * as numeral from 'numeral';

export type VarResolver = (name: string, specifier: string|null) => any|Promise<any>;
export type FuncResolver = (value: any, ...args: any[]) => any|Promise<any>;

function resolveFromObjectCached(obj: any, cachedKeys: string[], cachedLcKeys: string[], name: string,
                                 specifier: string|null): string|null {
  let lcKeysIndex = cachedLcKeys.indexOf(name);

  if (lcKeysIndex >= 0) {
    let result = obj[cachedKeys[lcKeysIndex]];
    if (specifier != null && specifier.length > 0) {
      return result == null ? null : resolveFromObject(result, specifier, null);
    } else {
      return result == null ? '' : '' + result;
    }
  } else {
    return null;
  }
}

function resolveFromObject(obj: any, name: string, specifier: string|null): string|null {
  let keys = Object.keys(obj);
  return resolveFromObjectCached(obj, keys, keys.map(key => key.toLowerCase()),
      name, specifier);
}

export function createPropsResolver(obj: any): VarResolver {
  let keys = Object.keys(obj);
  return resolveFromObjectCached.bind(null, obj, keys, keys.map(key => key.toLowerCase()));
}

export function defFormat(value: any, customJoin: string = ', '): string {
  if (typeof value === 'string') {
    return value;
  } else if (Array.isArray(value)) {
    return value.map(x => defFormat(x, customJoin)).join(customJoin);
  } else if (value instanceof Date) {
    return moment(value).format('MMMM Do YYYY, HH:mm');
  } else {
    return '' + value;
  }
}

const LOREM: string[] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

const DEFAULT_FUNCTIONS: { [name: string]: FuncResolver } = {
  lowercase: (input: any, altInput: any): string => {
    return polymArgCheck(defFormat(input), defFormat(altInput)).toLowerCase();
  },
  uppercase: (input: any, altInput: any): string => {
    return polymArgCheck(defFormat(input), defFormat(altInput)).toUpperCase();
  },
  trim: (input: any, altInput: any): string => {
    return polymArgCheck(defFormat(input), defFormat(altInput)).trim();
  },
  def: (input: any, defValue: any): any => {
    if (input == null || input === '') {
      if (defValue == null) {
        throw new FunctionArgumentsError();
      }
      return defValue;
    }
    return input;
  },
  propercase: (input: any, altInput: any): string => {
    return propercase(polymArgCheck(defFormat(input), defFormat(altInput)));
  },
  add: (input: any, ...args: any[]): number => {
    let [arg1, arg2] = polymArgsCheck(2, input, ...args);
    let a = strictParseInt(defFormat(arg1));
    if (a == null) {
      throw new FunctionArgumentsError('First argument is invalid: should be a number');
    }
    let b = strictParseInt(defFormat(arg2));
    if (b == null) {
      throw new FunctionArgumentsError('Second argument is invalid: should be a number');
    }

    return a + b;
  },
  sub: (input: any, ...args: any[]): number => {
    let [arg1, arg2] = polymArgsCheck(2, input, ...args);
    let a = strictParseInt(defFormat(arg1));
    if (a == null) {
      throw new FunctionArgumentsError('First argument is invalid: should be a number');
    }
    let b = strictParseInt(defFormat(arg2));
    if (b == null) {
      throw new FunctionArgumentsError('Second argument is invalid: should be a number');
    }

    return a - b;
  },
  wrap: (input: any, ...args: any[]): string => {
    let [text, format] = polymArgsCheck(2, input, args);
    text = defFormat(text);
    format = defFormat(format);
    if (format.indexOf('@') < 0) {
      throw new FunctionArgumentsError('You must provide a format string where @ denotes the position of text to wrap');
    }
    return format.replace('@', text);
  },
  _lorem: (input: any, arg: any): string => {
    // this function ignores filter input
    if (arg == null) {
      throw new FunctionArgumentsError('Invalid number of arguments: one argument expected');
    }
    let wordCount = strictParseInt(defFormat(arg));
    if (wordCount == null) {
      throw new FunctionArgumentsError('First argument is invalid: should be a number');
    }

    if (wordCount > LOREM.length) {
      wordCount = LOREM.length;
    }

    return LOREM.slice(0, wordCount).join(' ');
  },
  list: (input: any, ...args: any[]): any => {
    return [...args];
  },
  join: (input: any, ...args: any[]): string => {
    let [arr, join] = polymArgsCheck(2, input, ...args);
    if (!Array.isArray(arr)) {
      throw new Error('First argment is invalid: should be an array');
    }
    return defFormat(arr, defFormat(join));
  },
  now: (): Date => {
    return new Date();
  },
  utc: (input: any, arg: any): Date => {
    let date: any = polymArgCheck(input, arg);
    if (date instanceof Date) {
      return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    } else {
      throw new Error('First argument is invalid: should be a date');
    }
  },
  format_date: (input: any, ...args: any[]): string => {
    let [date, format] = polymArgsCheck(2, input, ...args);
    if (date instanceof Date) {
      format = defFormat(format);
      return moment(date).format(format);
    } else {
      throw new Error('First argument is invalid: should be a date');
    }
  },
  format_num: (input: any, ...args: any[]): string => {
    let [num, format] = polymArgsCheck(2, input, ...args);
    num = strictParseFloat(num);
    if (num == null) {
      throw new Error('First argument is invalid: should be a number or a floating-point number');
    }
    return numeral(num).format(defFormat(format));
  }
};

class FunctionArgumentsError extends Error {
  constructor(msg: string = 'Incorrect arguments') {
    super(msg);
  }
}

function polymArg(input: any, arg: any): any {
  return input == null ? arg : input;
}

function polymArgCheck(input: any, arg: any): any {
  if (input == null) {
    if (arg == null) {
      throw new FunctionArgumentsError();
    }
    return arg;
  } else {
    return input;
  }
}

function* polymArgs(count: number, input: any, ...args: any[]): IterableIterator<any> {
  if (input == null) {
    for (let j = 0; j < count; ++j) {
      yield args[j];
    }
  } else {
    yield input;
    for (let j = 0; j < count - 1; ++j) {
      yield args[j];
    }
  }
}

function* polymArgsCheck(count: number, input: any, ...args: any[]): IterableIterator<any> {
  if (input == null) {
    for (let j = 0; j < count; ++j) {
      if (args[j] == null) {
        throw new FunctionArgumentsError(`Invalid number of arguments: ${count} expected`);
      }
      yield args[j];
    }
  } else {
    yield input;
    for (let j = 0; j < count - 1; ++j) {
      if (args[j] == null) {
        throw new FunctionArgumentsError(`Invalid number of arguments: ${count} expected (and first one is filter's input value)`);
      }
      yield args[j];
    }
  }
}

export class TemplateProcessor {
  constructor(varResolver?: VarResolver, strictVarResolve: boolean = false, tokenizeOptions?: TokenizeOptions) {
    this._strictVarResolve = strictVarResolve;
    this._tokenizeOptions = tokenizeOptions;
    if (varResolver) {
      this.addVarResolver(varResolver);
    }
  }

  addVarResolver(resolver: VarResolver): void {
    if (resolver == null) {
      throw new Error('Cannot add a variable resolver: invalid resolver');
    }
    this._varResolvers.push(resolver);
  }

  addFuncResolver(name: string, resolver: FuncResolver): void {
    name = name.toLowerCase();
    if (!isValidName(name)) {
      throw new Error(`Cannot add a new function named ${name}: this is an invalid name for a function`);
    }
    if (this._funcResolvers.name != null) {
      throw new Error(`Cannot add a new function named ${name}: function already registered`);
    }
    if (resolver == null) {
      throw new Error(`Cannot add a new function named ${name}: invalid resolver`);
    }
    this._funcResolvers[name] = resolver;
  }

  async process(input: string): Promise<string> {
    let nodes = (new AstCreator(tokenize(input, this._tokenizeOptions))).create();
    if (nodes.length === 0) {
      return '';
    }

    let parts: string[] = [];

    for (let node of nodes) {
      if (node.type === AstNodeType.RawText) {
        this._badAst(node.value != null);
        parts.push(node.value);
      } else if (node.type === AstNodeType.Block) {
        let blockNode = node as BlockAstNode;
        // resolve block
        if (node.children == null || node.children.length === 0) {
          this._badAst();
        } else {
          let curValue: any = null;
          for (let j = 0; j < node.children.length; ++j) {
            let childNode = node.children[j];
            curValue = await this._resolveExpr(curValue, childNode);
            if (j === 0 && blockNode.optional && (curValue == null ||
                (typeof curValue === 'string' && !curValue.length))) {
              curValue = '';
              break;
            }
          }
          if (curValue == null) {
            curValue = '';
          } else {
            curValue = defFormat(curValue);
          }
          parts.push(curValue);
        }
      }
    }

    return parts.join('');
  }

  async resolveVar(name: string): Promise<any> {
    name = name.toLowerCase().trim();

    let realName: string, specifier: string|null;

    let specIndex = name.indexOf('#');
    if (specIndex >= 0) {
      realName = name.slice(0, specIndex);
      specifier = name.slice(specIndex + 1); // specifier can be empty, it is valid
    } else {
      realName = name;
      specifier = null;
    }

    for (let resolver of this._varResolvers) {
      let resolved = resolver(realName, specifier);
      if (resolved != null) {
        return resolved;
      }
    }
    return null;
  }

  async resolveFunc(name: string, input: any, ...args: any[]): Promise<any> {
    let resolver = this.getFuncResolver(name);
    try {
      return resolver == null ? null : resolver(input, ...args);
    } catch (err) {
      throw new Error(`Error while calling function ${name}: ${err.message}`);
    }
  }

  getFuncResolver(name: string): FuncResolver|null {
    name = name.toLowerCase().trim();
    if (this._funcResolvers[name] != null) {
      return this._funcResolvers[name];
    } else if (DEFAULT_FUNCTIONS[name] != null) {
      return DEFAULT_FUNCTIONS[name];
    }
    return null;
  }

  get strictVarResolve(): boolean { return this._strictVarResolve; }
  set strictVarResolve(value: boolean) { this._strictVarResolve = value; }

  /** Protected area **/

  protected _varResolvers: VarResolver[] = [];
  protected _funcResolvers: { [name: string]: FuncResolver } = {};
  protected _strictVarResolve: boolean;
  protected _tokenizeOptions?: TokenizeOptions;

  protected _badAst(is: boolean = false): void {
    if (!is) {
      throw new Error('Failed to resolve template: invalid ast tree');
    }
  }

  protected async _resolveExpr(curValue: any, node: AstNode): Promise<any> {
    if (node == null) {
      throw new Error('Failed to resolve template: invalid ast tree');
    }

    if (curValue != null || node.type === AstNodeType.Function) {
      // if curValue != null, the expression cannot be a variable, it must be a function
      // trying to find a function
      let funcResolver = this.getFuncResolver(node.value);
      if (funcResolver == null) {
        throw new Error(`Failed to resolve template: function ${node.value} not found`);
      }

      // build argument list
      let argList: (string|null)[] = [];
      if (node.children != null && node.children.length > 0) {
        for (let j = 0; j < node.children.length; ++j) {
          argList.push(await this._resolveExpr(null, node.children[j]));
        }
      }

      try {
        return funcResolver(curValue, ...argList);
      } catch (err) {
        throw new Error(`Error while calling function ${node.value}: ${err.message}`);
      }
    } else if (node.type === AstNodeType.String || node.type === AstNodeType.Number) {
      return node.value;
    } else if (node.type === AstNodeType.FunctionOrVariable) {
      // it can be either a variable or a function. In either case, it has no arguments.
      // try variables first
      let curValue = await this.resolveVar(node.value);
      if (curValue == null) {
        curValue = await this.resolveFunc(node.value, null);
      }
      if (curValue == null && this.strictVarResolve) {
        throw new Error(`Cannot resolve variable named "${node.value}" (strict mode set)`);
      }
      return curValue;
    } else {
      throw new Error('Failed to resolve template: invalid ast tree');
    }
  }
}

function isValidName(name: string): boolean {
  if (name.length === 0 || !(isAlphaCode(name.charCodeAt(0)) && name.charCodeAt(0) === CHAR_UNDERSCORE)) {
    return false;
  }
  for (let j = 1; j < name.length; ++j) {
    let ch = name.charCodeAt(j);
    if (!(isAlphaCode(ch) || isDigitCode(ch) || ch === CHAR_UNDERSCORE)) {
      return false;
    }
  }
  return true;
}

/** Tokenizer **/

export enum TokenType {
  RawText,
  BlockOpen,
  BlockClose,
  BracketOpen,
  BracketClose,
  Filter,
  Comma,
  Ident,
  Question,
  Gt,
  String,
  Number
}

export interface Token {
  value: string;
  begin: number;
  type: TokenType;
}

const CHAR_FILTER = '|'.charCodeAt(0);
const CHAR_COMMA = ','.charCodeAt(0);
const CHAR_BRACKET_OPEN = '('.charCodeAt(0);
const CHAR_BRACKET_CLOSE = ')'.charCodeAt(0);
const CHAR_UNDERSCORE = '_'.charCodeAt(0);
const CHAR_QUESTION = '?'.charCodeAt(0);
const CHAR_GT = '>'.charCodeAt(0);
const CHAR_SINGLE_QUOTE = '\''.charCodeAt(0);
const CHAR_DOUBLE_QUOTE = '"'.charCodeAt(0);
const CHAR_BACKSLASH = '\\'.charCodeAt(0);
const CHAR_PLUS = '+'.charCodeAt(0);
const CHAR_MINUS = '-'.charCodeAt(0);

const NAME_SPECIAL_CHARS = '_#.';
function isNameCode(ch: number): boolean {
  return (ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0)) || (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)) ||
      (ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) || NAME_SPECIAL_CHARS.indexOf(String.fromCharCode(ch)) >= 0;
}

const SUPPORTED_ESCAPE_SEQUENCES = '\\' + "'" + '"nrtb';
const SUPPORTED_ESCAPE_REPLACEMENT = [ '\\', "'", '"', '\n', '\r', '\t', '\b' ];

export function replaceEscapeSequences(input: string): string {
  let parts: string[] = [];
  let prevHit: number = 0;

  for (let j = 0; j < input.length; ++j) {
    if (input.charCodeAt(j) === CHAR_BACKSLASH) {
      // ready!
      let ch = input.charAt(j + 1);
      if (ch.length === 0) {
        throw new Error(`Unexpected end of input: escape sequence interrupted`);
      }
      let esIndex = SUPPORTED_ESCAPE_SEQUENCES.indexOf(ch);
      if (esIndex >= 0) {
        parts.push(input.slice(prevHit, j));
        parts.push(SUPPORTED_ESCAPE_REPLACEMENT[esIndex]);
        prevHit = j + 2;
        ++j;
      } else {
        throw new Error(`Unsupported escape sequence: \\${input.charAt(j + 1)}`);
      }
    }
  }

  if (prevHit > 0) {
    parts.push(input.slice(prevHit));
  }

  return parts.length > 0 ? parts.join('') : input;
}

export interface TokenizeOptions {
  openBlockMarker: string,
  closeBlockMarker: string
}

export function tokenize(input: string, options?: TokenizeOptions): Token[] {
  const openBlockMarker = ((options && options.openBlockMarker) ? options.openBlockMarker : '{');
  const closeBlockMarker = ((options && options.closeBlockMarker) ? options.closeBlockMarker : '}');

  const CHAR_OPEN_BLOCK = openBlockMarker.charCodeAt(0),
      CHAR_CLOSE_BLOCK = closeBlockMarker.charCodeAt(0);

  let tail = 0, head = -1;

  function eat(): void {
    tail = head;
  }

  function nextChar(): number|null {
    if (head + 1 >= input.length) {
      if (input.length > 0) {
        head = input.length;
      }
      return null;
    } else {
      return input.charCodeAt(++head);
    }
  }

  function pushToken(type: TokenType, back: number = 0): void {
    tokenList.push({
      value: input.slice(tail, head + 1 - back),
      begin: tail,
      type: type
    });
  }

  let tokenList: Token[] = [];

  let ch = nextChar();
  let insideVar = false;
  while (true) {
    if (ch == null) {
      // end of the string
      if (head != tail && head >= 0) {
        pushToken(TokenType.RawText, 1);
      }
      break;
    } else if (ch === CHAR_OPEN_BLOCK && input.slice(head, head + openBlockMarker.length) === openBlockMarker) {
      // flush raw text before the opening block
      if (head != tail) {
        pushToken(TokenType.RawText, 1);
        eat();
      }

      head += openBlockMarker.length - 1;
      pushToken(TokenType.BlockOpen);
      insideVar = true;
      ch = nextChar();
      eat();
    } else if (insideVar) {
      if (ch === CHAR_CLOSE_BLOCK && input.slice(head, head + closeBlockMarker.length) === closeBlockMarker) {
        head += closeBlockMarker.length - 1;
        pushToken(TokenType.BlockClose);
        insideVar = false;
        ch = nextChar();
        eat();
      } else if (ch === CHAR_FILTER) {
        pushToken(TokenType.Filter);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_FILTER) {
        pushToken(TokenType.Filter);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_BRACKET_OPEN) {
        pushToken(TokenType.BracketOpen);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_BRACKET_CLOSE) {
        pushToken(TokenType.BracketClose);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_COMMA) {
        pushToken(TokenType.Comma);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_QUESTION) {
        pushToken(TokenType.Question);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_GT) {
        pushToken(TokenType.Gt);
        ch = nextChar();
        eat();
      } else if (isWhitespaceCode(ch)) {
        do {
          ch = nextChar();
        } while (ch != null && isWhitespaceCode(ch));
        eat();
      } else if (isAlphaCode(ch) || ch === CHAR_UNDERSCORE) {
        do {
          ch = nextChar();
        } while (ch != null && (isNameCode(ch)));
        pushToken(TokenType.Ident, 1);
        eat();
      } else if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
        // quoted string
        let quoteCode = ch;
        while (true) {
          ch = nextChar();

          if (ch == null) {
            throw new Error('Unexpected end of input, quoted string is unclosed');
          } else if (ch === quoteCode) {
            break;
          } else if (ch === '\\'.charCodeAt(0)) {
            // begin escape sequence, only single-char sequences are supported
            ch = nextChar();
            if (ch == null) {
              throw new Error('Unexpected end of input, quoted string is unclosed');
            }
          }
        }

        tokenList.push({
          value: replaceEscapeSequences(input.slice(tail + 1, head)),
          begin: tail,
          type: TokenType.String
        });

        ch = nextChar();
        eat();
      } else if (isDigitCode(ch) || ch === CHAR_PLUS || ch === CHAR_MINUS) {
        let firstChar = ch;
        let startsWithSign = (ch === CHAR_PLUS || ch === CHAR_MINUS);

        do {
          ch = nextChar();
        } while (ch != null && isDigitCode(ch));

        if (ch != null && (isAlphaCode(ch) || isNameCode(ch))) {
          // this is not a number, this is an incorrect identifier!!!
          throw new Error(`Identifier cannot start with a number: ${input.slice(tail, head + 1)}`);
        }

        if (startsWithSign && head - tail <= 1) {
          throw new Error(`Unexpected char: ${String.fromCharCode(firstChar)}`);
        }

        pushToken(TokenType.Number, 1);
        eat();
      } else {
        throw new Error(`Unexpected char: ${String.fromCharCode(ch)}`);
      }
    } else {
      ch = nextChar();
    }
  }

  return tokenList;
}

/** Ast node creator **/

export enum AstNodeType {
  RawText,
  Block,
  FunctionOrVariable,
  Function,
  String,
  Number
}

export interface AstNode {
  type: AstNodeType;
  value?: any;
  children?: AstNode[];
}

export interface BlockAstNode extends AstNode {
  optional: boolean;
}

class AstCreator {
  constructor(protected _tokens: Token[]) {

  }

  create(): AstNode[] {
    this._token = this._next();

    while (true) {
      if (this._token == null) {
        break;
      } else if (this._token.type === TokenType.RawText) {
        this._nodes.push({
          type: AstNodeType.RawText,
          value: this._token.value
        });
        this._token = this._next();
      } else if (this._token.type === TokenType.BlockOpen) {
        // enter a block
        let blockNode: BlockAstNode = {
          type: AstNodeType.Block,
          optional: false
        };
        this._nodes.push(blockNode);

        this._token = this._next();

        if (this._token == null) {
          throw new Error('Unexpected end of input: function or variable name expected');
        } else if (this._token.type === TokenType.Question) {
          blockNode.optional = true;
          this._token = this._next();

          if (this._token == null) {
            throw new Error('Unexpected end of input: function or variable expected');
          } else {
            blockNode.children = this._handleFilterList();
            this._token = this._cur();

            if (this._token == null) {
              throw new Error('Unexpected end of input: block is unclosed');
            } else if (this._token.type === TokenType.BlockClose) {
              // perfectly fine, go next
              this._token = this._next();
            } else {
              throw new Error(`Block ending expected, but got this: ${this._token.value}`);
            }
          }
        } else {
          blockNode.children = this._handleFilterList();
          this._token = this._cur();

          if (this._token == null) {
            throw new Error('Unexpected end of input: block is unclosed');
          } else if (this._token.type === TokenType.BlockClose) {
            // perfectly fine, go next
            this._token = this._next();
          } else {
            throw new Error(`Block ending expected, but got this: ${this._token.value}`);
          }
        }
      } else {
        throw new Error(`Unexpected token: ${this._token.value}`);
      }
    }

    return this._nodes;
  }

  /** Protected area **/

  protected _curTokenIndex:number = -1;
  protected _token: Token|null = null;
  protected _nodes: AstNode[] = [];

  protected _next(): Token|null {
    if (this._curTokenIndex >= this._tokens.length) {
      this._token = null;
    } else {
      this._token = this._tokens[++this._curTokenIndex];
    }
    return this._token;
  }

  protected _cur(): Token|null {
    return this._token;
  }

  protected _back(): void {
    if (this._curTokenIndex === 0) {
      throw new Error('Tried to put back the first token');
    } else {
      this._token = this._tokens[--this._curTokenIndex];
    }
  }

  protected _handleFilterList(): AstNode[] {
    if (this._token == null) {
      throw new Error('Unexpected end of input: function or variable name expected');
    }

    let nodes: AstNode[] = [];

    if (this._token.type === TokenType.BlockClose) {
      // empty filter list, this is not good
      throw new Error(`Unexpected end of block`);
    }

    while (true) {
      let funcNode = this._handleExpression();
      nodes.push(funcNode);

      if (this._token == null) {
        throw new Error('Unexpected end of input, unclosed block');
      } else if (this._token.type === TokenType.Filter) {
        // process one more filter
        this._token = this._next();
      } else if (this._token.type === TokenType.BlockClose) {
        // end of block, we are done
        return nodes;
      } else {
        throw new Error(`Filter or end of block expected, but got this: ${this._token.value}`);
      }
    }
  }

  protected _handleExpression(): AstNode {
    if (this._token == null) {
      throw new Error('Unexpected end of input: function or variable name expected');
    }

    if (this._token.type === TokenType.String || this._token.type === TokenType.Number) {
      let node: AstNode = {
        type: this._token.type === TokenType.String ? AstNodeType.String : AstNodeType.Number,
        value: this._token.value
      };
      this._token = this._next();
      return node;
    }

    if (this._token.type !== TokenType.Ident) {
      throw new Error(`Function or variable name expected, but got this: ${this._token.value}`);
    }

    let funcNode: AstNode = {
      type: AstNodeType.FunctionOrVariable,
      value: this._token.value
    };

    this._token = this._next();

    if (this._token == null) {
      return funcNode;
    } else if (this._token.type === TokenType.BracketOpen) {
      // this is a function, let's handle its arguments
      funcNode.type = AstNodeType.Function;

      this._token = this._next();

      if (this._token == null) {
        throw new Error('Unexpected end of input, argument list expected');
      } else if (this._token.type === TokenType.BracketClose) {
        // empty argument list, perfectly valid, rewind to the next token and exit
        this._token = this._next();
        return funcNode;
      }

      funcNode.children = [];

      while (true) {
        let argNode = this._handleExpression();
        funcNode.children.push(argNode);

        if (this._token == null) {
          throw new Error('Unexpected end of input, closing bracket expected');
        } if (this._token.type === TokenType.BracketClose) {
          // end of the argument list, rewind to the next token and exit
          this._token = this._next();
          return funcNode;
        } else if (this._token.type === TokenType.Comma) {
          // one more argument, process it
          this._token = this._next();
        } else {
          throw new Error(`Argument or closing bracket expected, but got this: ${this._token.value}`);
        }
      }
    } else {
      return funcNode;
    }
  }
}

export function ast(input: string, tokenizeOptions?: TokenizeOptions): AstNode[] {
  let creator = new AstCreator(tokenize(input, tokenizeOptions));
  return creator.create();
}

export function isValidTemplate(template: string): boolean {
  try {
    let nodes = ast(template);
    return nodes && nodes.length > 0;
  } catch (err) {
    return false;
  }
}
