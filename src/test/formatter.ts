import {should, expect} from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import * as chai from 'chai';
import {
  ast, AstNodeType, createPropsResolver, replaceEscapeSequences, TemplateProcessor, tokenize,
  TokenType
} from "../index";
import {propercase, romanToNumber} from "../helpers";
import * as sinon from "sinon";

should();
chai.use(chaiAsPromised);

describe("formatter", function () {
  describe("tokenize", function () {
    it("should process an empty string", function () {
      let tokens = tokenize('');
      expect(tokens).to.have.lengthOf(0);
    });

    it("should process an string without vars", function () {
      let tokens = tokenize('just a simple string');
      expect(tokens).to.be.deep.equal([
        {
          value: 'just a simple string',
          begin: 0,
          type: TokenType.RawText
        }
      ]);
    });

    it("should process a template with single var", function () {
      let tokens = tokenize('this is {var}, hello');
      expect(tokens).to.have.lengthOf(5);

      expect(tokens).to.be.deep.equal([
        {
          value: 'this is ',
          begin: 0,
          type: TokenType.RawText
        },
        {
          value: '{',
          begin: 8,
          type: TokenType.BlockOpen
        },
        {
          value: 'var',
          begin: 9,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 12,
          type: TokenType.BlockClose
        },
        {
          value: ', hello',
          begin: 13,
          type: TokenType.RawText
        }
      ])
    });

    it("should process a template consisting of the only var", function () {
      let tokens = tokenize('{var}');
      expect(tokens).to.have.lengthOf(3);

      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: 'var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 4,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should process a template consisting of the only var with custom block markers", function () {
      let tokens = tokenize('%[var]%', {
        openBlockMarker: '%[',
        closeBlockMarker: ']%'
      });
      expect(tokens).to.have.lengthOf(3);

      expect(tokens).to.be.deep.equal([
        {
          value: '%[',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: 'var',
          begin: 2,
          type: TokenType.Ident
        },
        {
          value: ']%',
          begin: 5,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should cut whitespaces out of variable name", function () {
      let tokens = tokenize('{ var }');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: 'var',
          begin: 2,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 6,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should process var with trailing single char", function () {
      let tokens = tokenize('{var}.');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: 'var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 4,
          type: TokenType.BlockClose
        },
        {
          value: '.',
          begin: 5,
          type: TokenType.RawText
        }
      ]);
    });

    it("should accept correct names", function () {
      let tokens = tokenize('{_var}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: '_var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 5,
          type: TokenType.BlockClose
        }
      ])
    });

    it("should accept many different symbols", function () {
      let tokens = tokenize('{_821some.#quant}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: '_821some.#quant',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 16,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should not accept invalid names", function () {
      expect(() => tokenize('{#name}')).to.throw();
      expect(() => tokenize('{.name}')).to.throw();
    });

    it("should handle whitespace", function () {
      let tokens = tokenize('{ }');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          type: TokenType.BlockOpen,
          begin: 0,
        },
        {
          value: '}',
          type: TokenType.BlockClose,
          begin: 2
        }
      ]);
    });

    it("should handle quoted strings", function () {
      let tokens = tokenize("{'some \\'quoted\\' shit'}");
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: "some \'quoted\' shit",
          begin: 1,
          type: TokenType.String
        },
        {
          value: '}',
          begin: 23,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should handle quoted strings (with double quotes)", function () {
      let tokens = tokenize('{"some \\"quoted\\" shit"}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.BlockOpen
        },
        {
          value: 'some \"quoted\" shit',
          begin: 1,
          type: TokenType.String
        },
        {
          value: '}',
          begin: 23,
          type: TokenType.BlockClose
        }
      ]);
    });

    it("should handle numbers", function () {
      let tokens = tokenize('{012}');
      expect(tokens).to.be.deep.equal([
        {
          type: TokenType.BlockOpen,
          value: '{',
          begin: 0
        },
        {
          type: TokenType.Number,
          value: '012',
          begin: 1,
        },
        {
          type: TokenType.BlockClose,
          value: '}',
          begin: 4
        }
      ])
    });

    it("should not accept identifiers starting with digits", function () {
      expect(() => tokenize('{123_}')).to.throw();
    });

    it("should handle escape sequences", function () {
      let tokens = tokenize('{"\\tvar"}');
      expect(tokens[1]).to.be.deep.equal({
        type: TokenType.String,
        value: '\tvar',
        begin: 1
      });
    });

    it("should accept negative integers", function () {
      let tokens = tokenize('{-20}');
      expect(tokens).to.have.lengthOf(3);
      expect(tokens[1]).to.be.deep.equal({
        type: TokenType.Number,
        value: '-20',
        begin: 1
      });
    });

    it("should accept positive integers with plus sign", function () {
      let tokens = tokenize('{+20}');
      expect(tokens).to.have.lengthOf(3);
      expect(tokens[1]).to.be.deep.equal({
        type: TokenType.Number,
        value: '+20',
        begin: 1
      });
    });

    it("should not accept a single plus or minus", function () {
      expect(() => tokenize('{+}')).to.throw();
      expect(() => tokenize('{-}')).to.throw();
    });

    it("should accept single-digit numbers", function () {
      let tokens = tokenize('{0}');
      expect(tokens).to.have.lengthOf(3);
      expect(tokens[1]).to.be.deep.equal({
        type: TokenType.Number,
        value: '0',
        begin: 1
      })
    });
  });

  describe("ast", function () {
    it("should process plain text", function () {
      let nodes = ast("just a plain text");

      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.RawText,
          value: 'just a plain text'
        }
      ]);
    });

    it("should process a text with a simple var", function () {
      let nodes = ast('just a {var}.');

      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.RawText,
          value: 'just a '
        },
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        },
        {
          type: AstNodeType.RawText,
          value: '.'
        }
      ]);
    });

    it("should process a single var", function () {
      let nodes = ast('{var}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        }
      ]);
    });

    it("should process a single optional block", function () {
      let nodes = ast('{?var}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: true,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        }
      ]);
    });

    it("should process a var with a filter", function () {
      let nodes = ast('{var|lowercase}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var',
            },
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'lowercase'
            }
          ]
        }
      ]);
    });

    it("should process a var with a filter function", function () {
      let nodes = ast('{var|func(a, b)}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
              children: [
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'a'
                },
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'b'
                }
              ]
            }
          ]
        }
      ])
    });

    it("should not process a var without a name", function () {
      expect(() => ast('{}')).to.throw();
    });

    it("should process a filter without arguments", function () {
      let nodes = ast('{var|func()}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
            }
          ]
        }
      ])
    });

    it("should not process a broken syntax", function () {
      expect(() => ast('{unclosed')).to.throw();
      expect(() => ast('{unclosed|')).to.throw();
      expect(() => ast('{unclosed|func')).to.throw();
      expect(() => ast('{unclosed|func(}')).to.throw();
      expect(() => ast('{var|func(|)}')).to.throw();
    });

    it("should process nested calls", function () {
      let nodes = ast('{var|func(func2(a),b)}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
              children: [
                {
                  type: AstNodeType.Function,
                  value: 'func2',
                  children: [
                    {
                      type: AstNodeType.FunctionOrVariable,
                      value: 'a'
                    }
                  ]
                },
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'b'
                }
              ]
            }
          ]
        }
      ])
    });

    it("should not process invalid token sequences", function () {
      expect(() => ast('{func(')).to.throw();
      expect(() => ast('{?')).to.throw();
      expect(() => ast('{func')).to.throw();
      expect(() => ast("{'func'")).to.throw();
      expect(() => ast('{}')).to.throw();
      expect(() => ast('{func|func>func}')).to.throw();
      expect(() => ast('{')).to.throw();
    });

    it("should process single constants", function () {
      let nodes = ast('{"text"}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.String,
              value: 'text'
            }
          ]
        }
      ]);

      expect(ast('{0}')).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.Number,
              value: '0'
            }
          ]
        }
      ])
    });
  });

  describe("process", function () {
    let propsObj = {
      'var': 'some value',
      UC_var: 'some value',
      uc: 'SOME VALUE',
      empty: '',
      obj: {
        prop: 'prop value'
      },
      arr: ['first', 'second', 'third']
    };
    let proc: TemplateProcessor;

    beforeEach(function () {
      proc = new TemplateProcessor(createPropsResolver(propsObj));
    });

    it("should process plain text", async function () {
      expect(await proc.process('just a text')).to.be.equal('just a text');
    });

    it("should resolve vars", async function () {
      expect(await proc.process('{var}')).to.be.equal('some value');
    });

    it("should process variable names regardless of case", async function () {
      expect(await proc.process('{uc_VAR}')).to.be.equal('some value');
    });

    it("should process variable surrounded with spaces", async function () {
      expect(await proc.process('{ var }')).to.be.equal('some value');
    });

    it("should apply filters", async function () {
      expect(await proc.process('{uc}')).to.be.equal('SOME VALUE');
      expect(await proc.process('{uc|lowercase}')).to.be.equal('some value');
      expect(await proc.process('{ uc | lowercase }')).to.be.equal('some value');
    });

    it("should resolve non-existent vars to empty strings", async function () {
      expect(await proc.process('look: {does_not_exist}')).to.be.equal('look: ');
    });

    it("should throw in strict mode", async function () {
      proc.strictVarResolve = true;
      return expect(proc.process('look: {does_not_exist}')).to.be.rejected;
    });

    it("should handle strings and numbers", async function () {
      expect(await proc.process('{"123"}')).to.be.equal('123');
      expect(await proc.process('{123}')).to.be.equal('123');
    });

    it("lorem function should work", async function () {
      expect(await proc.process('{any|_lorem(1)}')).to.be.equal('Lorem');
    });

    it("function should be allowed to generate head value", async function () {
      expect(await proc.process('{_lorem(2)}')).to.be.equal('Lorem ipsum');
      expect(await proc.process('{_lorem(2)|_lorem(3)}')).to.be.equal('Lorem ipsum dolor');
    });

    it("nested calls", async function () {
      expect(await proc.process('{ _lorem(add(1, 2)) }')).to.be.equal('Lorem ipsum dolor');
    });

    it("optional blocks", async function () {
      expect(await proc.process('{empty|wrap("[@]")}')).to.be.equal('[]');
      expect(await proc.process('{?empty|wrap("[@]")}')).to.be.equal('');
    });

    it("optional block should not be ignored when value present", async function () {
      expect(await proc.process('{?var}')).to.be.equal('some value');
      expect(await proc.process('{?0}')).to.be.equal('0');
    });

    it("specifiers", async function () {
      expect(await proc.process('{obj#prop}')).to.be.equal('prop value');
      expect(await proc.process('{arr#1}')).to.be.equal('second');
      expect(await proc.process('{arr#4}')).to.be.equal('');
    });

    it("should create lists", async function () {
      expect(await proc.process('{list(1, 2, 3, 4)}')).to.be.equal('1, 2, 3, 4');
    });

    it("should format lists", async function () {
      expect(await proc.process('{list(1, 2, 3)|join(" & ")}')).to.be.equal('1 & 2 & 3');
    });

    it("should create dates", async function () {
      let clock = sinon.useFakeTimers();
      clock.tick(10000);

      try {
        expect(await proc.process('{now|utc}')).to.be.equal('January 1st 1970, 00:00');
      } finally {
        clock.restore();
      }
    });

    it("should format dates", async function () {
      let clock = sinon.useFakeTimers();
      clock.tick(10000);

      try {
        expect(await proc.process('{now|format_date("D MMM YYYY")}')).to.be.equal('1 Jan 1970');
      } finally {
        clock.restore();
      }
    });

    it("should format dates with utc", async function () {
      let clock = sinon.useFakeTimers();
      clock.tick(10000);

      try {
        expect(await proc.process('{now|utc|format_date("D MMM YYYY")}')).to.be.equal('1 Jan 1970');
      } finally {
        clock.restore();
      }
    });

    it("should format dates from function", async function () {
      let clock = sinon.useFakeTimers();
      clock.tick(10000);

      try {
        expect(await proc.process('{format_date(now, "D MMM YYYY")}')).to.be.equal('1 Jan 1970');
      } finally {
        clock.restore();
      }
    });

    it("should throw an error when formatting a non-date var", async function () {
      return Promise.all([,
        expect(proc.process("{'string'|format_date('D MMM YYYY')}")).to.be.rejected,
        expect(proc.process("{123|format_date('D MMM YYYY')}")).to.be.rejected
      ]);
    });

    it("should process negative integers", async function () {
      return proc.process('{-20}').should.eventually.be.equal('-20');
    });

    it("should process negative integers as arguments", async function () {
      return proc.process('{add(10, -5)}').should.eventually.be.equal('5');
    });
  });

  describe("replaceEscapeSequences", function () {
    it("should replace", function () {
      expect(replaceEscapeSequences('some text')).to.be.equal('some text');
      expect(replaceEscapeSequences('some \\t tab')).to.be.equal('some \t tab');
      expect(replaceEscapeSequences('\\t')).to.be.equal('\t');
      expect(replaceEscapeSequences('\\t some text')).to.be.equal('\t some text');
      expect(replaceEscapeSequences('\\t\\r')).to.be.equal('\t\r');
      expect(replaceEscapeSequences('\\t\\rx')).to.be.equal('\t\rx');
      expect(replaceEscapeSequences('\\\\')).to.be.equal('\\');
      expect(() => replaceEscapeSequences('\\x')).to.throw();
      expect(() => replaceEscapeSequences('\\')).to.throw();
    });
  });

  describe("romans", function () {
    it("should not convert an empty string", function () {
      expect(romanToNumber('')).to.be.null;
    });

    it("should work", function () {
      expect(romanToNumber('I')).to.be.equal(1);
      expect(romanToNumber('II')).to.be.equal(2);
      expect(romanToNumber('III')).to.be.equal(3);
      expect(romanToNumber('IIII')).to.be.equal(4);
      expect(romanToNumber('IV')).to.be.equal(4);
      expect(romanToNumber('VI')).to.be.equal(6);
      expect(romanToNumber('XCIV')).to.be.equal(94);
      expect(romanToNumber('MCMXCIX')).to.be.equal(1999);
      expect(romanToNumber('MIM')).to.be.equal(1999);
      expect(romanToNumber('MCML')).to.be.equal(1950);
      expect(romanToNumber('MLM')).to.be.equal(1950);
    });

    it("should not accept invalid numerals", function () {
      expect(romanToNumber('IIIII')).to.be.null;
      expect(romanToNumber('CDM')).to.be.null;
    });
  });

  describe("proper case", function () {
    it("should work on simple sentences", function () {
      expect(propercase('lorem IPSUM Dolor sIT amet')).to.be.equal('Lorem Ipsum Dolor Sit Amet');
      expect(propercase('a this is a simple but completely wrong sentence is'))
          .to.be.equal('A This Is a Simple but Completely Wrong Sentence Is');
      expect(propercase('nothing to be afraid of ')).to.be.equal('Nothing to Be Afraid Of');
      expect(propercase('look - here it is')).to.be.equal('Look - Here It Is');
      expect(propercase('this is part xii of the book')).to.be.equal('This Is Part XII of the Book');
      expect(propercase("i'm not trying to fix urls: http://google.com"))
          .to.be.equal("I'm not Trying to Fix URLs: http://google.com");
      expect(propercase('a doctor of philosophy (phd) is the highest academic degree'))
          .to.be.equal('A Doctor of Philosophy (PhD) Is the Highest Academic Degree');
      expect(propercase('first. a thing')).to.be.equal('First. A Thing');
      expect(propercase('first: a thing')).to.be.equal('First: A Thing');
    });
  });
});
