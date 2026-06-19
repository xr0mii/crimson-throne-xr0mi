// Shared compatibility helpers for Foundry VTT v13/v14 application APIs.
(function () {
  const existing = globalThis.CrimsonThroneCompat;
  if (existing) return;

  function getTemplateApplicationBase() {
    const api = globalThis.foundry?.applications?.api;
    if (api?.ApplicationV2 && api?.HandlebarsApplicationMixin) {
      return api.HandlebarsApplicationMixin(api.ApplicationV2);
    }
    return globalThis.Application ?? null;
  }

  function isV2Base(BaseApplication) {
    const api = globalThis.foundry?.applications?.api;
    return !!api?.ApplicationV2 && BaseApplication?.prototype instanceof api.ApplicationV2;
  }

  function mergeOptions(base, extension) {
    return globalThis.foundry?.utils?.mergeObject
      ? foundry.utils.mergeObject(base ?? {}, extension, { inplace: false })
      : Object.assign({}, base ?? {}, extension);
  }

  function v1Options(superOptions, { id, title, template, classes = [], width, height = "auto", resizable = true }) {
    return mergeOptions(superOptions, {
      id,
      title,
      template,
      classes,
      width,
      height,
      resizable
    });
  }

  function v2Options({ id, title, classes = [], width, height = null, resizable = true, contentClasses = [] }) {
    const position = { width };
    if (height !== null && height !== "auto") position.height = height;
    return {
      id,
      classes,
      position,
      window: {
        title,
        resizable,
        contentClasses
      }
    };
  }

  function singleTemplatePart(template) {
    return {
      main: {
        template,
        root: true
      }
    };
  }

  function asElement(html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    return null;
  }

  function part(app, selector, html = null) {
    const provided = asElement(html);
    if (provided) return provided;
    const root = asElement(app?.element) ?? app?.element ?? null;
    if (!root?.querySelector) return root;
    return root.querySelector(selector) ?? root;
  }

  function collectionAdapter(nodes) {
    const list = Array.from(nodes ?? []);
    return {
      length: list.length,
      0: list[0],
      prop(name, value) {
        for (const node of list) node[name] = value;
        return this;
      },
      val(value) {
        if (value === undefined) return list[0]?.value;
        for (const node of list) node.value = value;
        return this;
      }
    };
  }

  function domAdapter(root) {
    const element = asElement(root) ?? root;
    return {
      0: element,
      length: element ? 1 : 0,
      on(eventName, selector, handler) {
        if (!element?.addEventListener) return this;
        element.addEventListener(eventName, (event) => {
          const target = event.target?.closest?.(selector);
          if (!target || !element.contains(target)) return;
          const wrapped = Object.create(event);
          Object.defineProperty(wrapped, "currentTarget", { value: target });
          handler(wrapped);
        });
        return this;
      },
      find(selector) {
        return collectionAdapter(element?.querySelectorAll?.(selector));
      },
      addClass(className) {
        element?.classList?.add?.(...String(className).split(/\s+/).filter(Boolean));
        return this;
      }
    };
  }

  function asHtml(root) {
    if (root?.jquery) return root;
    const element = asElement(root) ?? root;
    const jq = globalThis.jQuery ?? globalThis.$;
    if (jq && element) return jq(element);
    return domAdapter(element);
  }

  globalThis.CrimsonThroneCompat = {
    asElement,
    asHtml,
    domAdapter,
    getTemplateApplicationBase,
    isV2Base,
    mergeOptions,
    part,
    singleTemplatePart,
    v1Options,
    v2Options
  };
})();
