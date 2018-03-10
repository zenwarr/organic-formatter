const INTEGER_FIRST_CHARS = '0123456789+-'.split('').map(x => x.charCodeAt(0));
const INTEGER_CHARS = '0123456789'.split('').map(x => x.charCodeAt(0));
const FLOAT_FIRST_CHARS = '0123456789+-.eE'.split('').map(x => x.charCodeAt(0));

export function strictParseInt(input: any): number|null {
  if (typeof input !== 'string') {
    input = '' + input;
  }
  let firstCh = input.charCodeAt(0);
  if (INTEGER_FIRST_CHARS.indexOf(firstCh) < 0) {
    return null;
  }

  if (input.slice(1).split('').some((d: string) => INTEGER_CHARS.indexOf(d.charCodeAt(0)) < 0)) {
    return null;
  }

  if (!isFinite(input)) {
    return null;
  }

  let result = parseInt(input, 10);
  return isNaN(result) ? null : result;
}

export function strictParseFloat(input: any): number|null {
  if (typeof input !== 'string') {
    input = '' + input;
  }

  let firstCh = input.charCodeAt(0);
  if (FLOAT_FIRST_CHARS.indexOf(firstCh) < 0) {
    return null;
  }

  if (!isFinite(input)) {
    return null;
  }

  let result = parseFloat(input);
  return isNaN(result) ? null : result;
}

export interface PropercaseOptions {
  smallWords: string[];
  abbrs: string[];
  preserveCase: string[];
  handleRomans: boolean;
  alwaysLC: string[];
  preferLC: string[];
  fix: { [lc: string]: string };
}

export const DEFAULT_PROPERCASE_OPTIONS: PropercaseOptions = {
  smallWords: 'a an the some with at from into upon of to in for on by over but up out down off or and not that but as than then so nor yet amid atop onto per se versus via vice vis-a-vis vis-à-vis'.split(' '),
  abbrs: 'id tv url faq q&a atm tba rip p.s. esl efl diy iq gmo pc pr sos pow ad bc ce bce md hr efl elt esl ba ma bsc msc cc bcc lgbt edm lol omg rsvp vip tl;dr dc ceo cmo cfo evp svp vp md pa'.split(' '),
  preserveCase: ''.split(' '),
  handleRomans: true,
  alwaysLC: 'van von der i.e. e.g. '.split(' '),
  preferLC: 'av af da dal del der di la le van von der den vel'.split(' '),
  fix: {
    'phd': 'PhD',
    'ph.d.': 'Ph.D.'
  }
};

function _titlecase(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

export function propercase(input: string, options: PropercaseOptions = DEFAULT_PROPERCASE_OPTIONS,
                           wordSeparator: string = ' '): string {
  if (input.length === 0) {
    return '';
  }

  let isFirstWord: boolean|null = null, isLastWord: boolean, prevColon: boolean = false;

  let inputWords = _words(input, wordSeparator);
  let parts = inputWords.map((inputWord: string, index: number) => {
    let w = punctuationTrim(inputWord);

    if (w.length === 0) {
      return inputWord;
    }

    let lcw = w.toLowerCase();
    let result: string;

    if (isFirstWord == null) {
      isFirstWord = true;
    } else {
      isFirstWord = isLastWord;
    }
    isLastWord = inputWord.endsWith('.') || index === inputWords.length - 1;

    if (!(isFirstWord || isLastWord || prevColon) &&
        (options.smallWords.indexOf(lcw) >= 0 || options.preferLC.indexOf(lcw) >= 0)) {
      // check if the word is preposition or any other small word that should not be capitalized.
      // we only capitalize such words if it is the first or the last one in a sentence.
      result = lcw;
    } else if (_isAbbr(options.abbrs, lcw)) {
      // check if the word is an abbreviations. We have a list of known abbreviations that should
      // be uppercased all the times. Be we should process special cases with plural forms of
      // abbreviations, for example, CDs is written with CD in uppercase while 's' is in lowercase.
      if (options.abbrs.indexOf(lcw) < 0 && lcw.endsWith('s')) {
        result = w.slice(0, -1).toUpperCase() + w.charAt(w.length - 1);
      } else {
        result = w.toUpperCase();
      }
    } else if (options.handleRomans && romanToNumber(w) != null) {
      // we have an option to process roman numerals. Roman numerals are always written in
      // uppercase.
      result = w.toUpperCase();
    } else if (options.preserveCase.indexOf(lcw) >= 0) {
      // we have also a list of words that we should not touch. Leave it as it is.
      result = w;
    } else if (lcw.indexOf('.') >= 0 || lcw.indexOf('//') >= 0 || lcw.indexOf('\\') >= 0) {
      // in this case the word can be an URL or a file path. Leave it intact.
      result = w;
    } else if (options.fix[lcw] != null) {
      // list of words we should fix case in
      result = options.fix[lcw];
    } else {
      result = _titlecase(w);
    }

    prevColon = inputWord.endsWith(':') || inputWord.endsWith(';');
    return inputWord.replace(new RegExp(w, 'ig'), result);
  });

  return parts.join(wordSeparator);
}

function _words(input: string, wordSeparator: string = ' '): string[] {
  let regexp: RegExp = wordSeparator === '-' ? /[\s\-]+/ : /\s+/;
  return input.split(regexp).filter(x => x.length > 0);
}

export function punctuationTrim(input: string): string {
  return input.replace(/^[\s.,:;!?@#$%^&*()\-—=+<>'"\[\]{}|\\/]+/, '')
      .replace(/[\s.,:;!?@#$%^&*()\-—=+<>'"\[\]{}|\\/]+$/, '');
}

function _isAbbr(abbrList: string[], word: string): boolean {
  return abbrList.indexOf(word) >= 0 ||
      (word.length > 1 && word.endsWith('s') && abbrList.indexOf(word.slice(0, -1)) >= 0) ||
      (word.length > 1 && word.endsWith("'") && abbrList.indexOf(word.slice(0, -1)) >= 0) ||
      (word.length > 2 && word.endsWith("'s") && abbrList.indexOf(word.slice(0, -2)) >= 0);
}

/**
 * Coverts a roman numeral to a number.
 * Does not trim an input, so numeral surrounded by spaces is not going to work.
 * @param {string} input String which is a roman numeral.
 * @returns {number}
 */
export function romanToNumber(input: string): number|null {
  const DIGITS:number[] = 'MDCLXVI'.split('').map(x => x.charCodeAt(0));
  const VALUES = [1000, 500, 100, 50, 10, 5, 1];

  if (input.length === 0) {
    return null;
  }
  input = input.toUpperCase();

  let result = 0;
  let subtracted = false;
  let prevValue = Number.MAX_SAFE_INTEGER;
  let simCount = 0;
  for (let j = 0; j < input.length; ++j) {
    let ch = input.charCodeAt(j);
    if (DIGITS.indexOf(ch) < 0) {
      return null;
    }
    let value = VALUES[DIGITS.indexOf(ch)];
    if (value > prevValue) {
      // the previous value should be subtracted from the current
      if (subtracted) {
        // we cannot allow more then one subtraction, so it is an error
        return null;
      }
      result -= prevValue;
      result += value - prevValue;
      subtracted = true;
    } else {
      result += value;
      subtracted = false;
    }

    if (prevValue === value) {
      ++simCount;
    } else {
      simCount = 0;
    }
    prevValue = value;

    if ((value === 1 && simCount > 4) || simCount > 3) {
      return null;
    }
  }

  return result;
}

const WHITESPACE_CODES: number[] = ' \t\n\r\v\f\u00A0\u2028\u2029'.split('').map(x => x.charCodeAt(0));
export function isWhitespaceCode(ch: number): boolean {
  return WHITESPACE_CODES.indexOf(ch) >= 0;
}

export function isAlphaCode(ch: number): boolean {
  return (ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0)) || (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0));
}

export function isDigitCode(ch: number): boolean {
  return ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0);
}

export function capitalize(input: string): string {
  if (input.length === 0) {
    return input;
  } else {
    return input.charAt(0).toUpperCase() + input.slice(1);
  }
}
