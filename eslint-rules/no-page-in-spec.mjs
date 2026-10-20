/**
 * demo/no-page-in-spec
 *
 * In a *.spec.ts file, flag any member access on an identifier named `page`
 * (page.goto, page.locator, page.getByRole, …) except:
 *   - inside a call listed in `allow` (e.g. a fixture helper like freshSession(page, request))
 *   - passing `page` as a constructor argument: new ChatPage(page)
 *
 * Why a custom rule and not no-restricted-syntax:
 *   - esquery can't express "a `page` MemberExpression that is NOT an argument to an allowed call"
 *     without false positives on `this.page` in page objects or on fixture destructuring.
 *   - a custom rule gets a `meta.messages` entry, so the fix instruction travels with the rule
 *     and shows up in every formatter, including the one the agent reads.
 *   - it can be tested with RuleTester and pushed upstream once it has earned it.
 *
 * Upstream candidate: eslint-plugin-playwright `no-page-access-in-test` (working title).
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct `page.*` access in spec files; route it through page objects.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noPageInSpec:
        '{{message}}',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!/\.spec\.[cm]?[jt]sx?$/.test(filename)) return {};

    const options = context.options[0] ?? {};
    const allow = new Set(options.allow ?? []);
    const message =
      options.message ??
      'Specs must not touch `page` directly. Move this into a page object and call its method from the spec.';

    const calleeName = node => {
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'MemberExpression') {
        const obj = calleeName(node.object);
        const prop = node.property.type === 'Identifier' ? node.property.name : null;
        return obj && prop ? `${obj}.${prop}` : null;
      }
      return null;
    };

    const isAllowedContext = node => {
      let cur = node.parent;
      while (cur) {
        if (cur.type === 'NewExpression') return true; // new ChatPage(page)
        if (cur.type === 'CallExpression') {
          const name = calleeName(cur.callee);
          if (name && allow.has(name)) return true;
        }
        if (cur.type === 'FunctionExpression' || cur.type === 'ArrowFunctionExpression') break;
        cur = cur.parent;
      }
      return false;
    };

    return {
      'MemberExpression[object.type="Identifier"][object.name="page"]'(node) {
        if (isAllowedContext(node)) return;
        context.report({ node, messageId: 'noPageInSpec', data: { message } });
      },
    };
  },
};
