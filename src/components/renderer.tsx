import {
  Accessor,
  createMemo,
  createSignal,
  JSX,
  JSXElement,
  Match,
  Setter,
  Switch,
} from "solid-js";
import { Element } from "slate";
import { createComponent } from "solid-js/web";
import { StoreSignal } from "solid-store";
import { useSlateStatic } from "..";
import { Decorator } from "../hooks/editable";

type DecoratorsBuilder = (
  decorators: Record<string, Decorator>
) => [Accessor<Decorator>, (type: string, decorator: Decorator) => void];
const buildDecorators: DecoratorsBuilder = (
  decorators: Record<string, Decorator>
) => {
  const cache = signalCache<Decorator>(() => []);

  const getDecorator: Accessor<Decorator> =
    () =>
    ([node, path]: any) => {
      if (!node.type) {
        return [];
      }
      const decorate = cache.get(node.type);
      return decorate!([node, path]);
    };

  const attachDecorator = (type: string, decorator: Decorator) => {
    cache.set(type, decorator);
  };

  Object.entries(decorators).forEach(([type, dec]) =>
    attachDecorator(type, dec)
  );
  return [getDecorator, attachDecorator];
};

type ElementRenderersBuilder = (
  renderers: Record<string, (props: any) => JSXElement>
) => [
  (props: any) => JSXElement,
  (type: string, comp: JSX.FunctionElement) => void
];
const buildElementRenderers: ElementRenderersBuilder = (
  renderers: Record<string, (props: any) => JSXElement>
) => {
  const cache = signalCache<(props: any) => JSXElement>();
  const elementRenderer = (props: any) => {
    const comp = createMemo(() => cache.get(props.element().type));
    return createComponent(comp() || DefaultElement, props);
  };

  const attachElementRenderer = (
    type: string,
    component: (props: any) => JSXElement
  ) => {
    cache.set(type, component);
  };

  Object.entries(renderers).forEach(([type, ren]) =>
    attachElementRenderer(type, ren)
  );
  return [elementRenderer, attachElementRenderer];
};

type LeafRenderersBuilder = (
  renderers: Record<string, (props: any) => JSXElement>
) => [
  (props: any) => JSXElement,
  (type: string, comp: JSX.FunctionElement) => void
];
const buildLeafRenderers: LeafRenderersBuilder = (
  renderers: Record<string, (props: any) => JSXElement>
) => {
  const cache = signalCache<(props: any) => JSXElement>();
  const LeafRenderer = (props: any) => {
    const comp = createMemo(() => cache.get(props.leaf.type));
    return createComponent(comp() || DefaultLeaf, props);
  };

  const attachLeafRenderer = (
    type: string,
    component: (props: any) => JSXElement
  ) => {
    cache.set(type, component);
  };

  Object.entries(renderers).forEach(([type, ren]) =>
    attachLeafRenderer(type, ren)
  );
  return [LeafRenderer, attachLeafRenderer];
};

function signalCache<T>(def?: T) {
  const cache = new Map<string, [Accessor<T>, Setter<T>]>();
  const get = (key: string) => {
    const value = cache.get(key);
    let g;
    if (value) {
      return value[0]();
    } else if (def) {
      let s;
      [g, s] = createSignal<T>(def);
      cache.set(key, [g, s]);
      return g();
    }
    return null;
  };

  const set = (key: string, value: T) => {
    if (cache.has(key)) {
      const [_, s] = cache.get(key)!;
      // Note: need to pass getter since setSignal treats function argument
      // as value etter
      s(() => value);
      return;
    }
    const [g, s] = createSignal<T>(value);
    cache.set(key, [g, s]);
  };
  return { get, set };
}

/**
 * `RenderElementProps` are passed to the `renderElement` handler.
 */
interface ElementRendererProps {
  children: any;
  element: StoreSignal<Element>;
  ref: any;
  attributes: {
    "data-slate-node": "element";
    "data-slate-inline"?: true;
    "data-slate-void"?: true;
    dir?: "rtl";
  };
}

/**
 * The default element renderer.
 */
const DefaultElement = (props: ElementRendererProps) => {
  const { getEditor } = useSlateStatic();
  const editor = getEditor();

  return (
    <Switch>
      <Match when={editor.isInline(props.element())}>
        <span
          {...props.attributes}
          ref={props.ref}
          style={{ position: "relative" }}
        >
          {props.children}
        </span>
      </Match>
      <Match when={1}>
        <div
          {...props.attributes}
          ref={props.ref}
          style={{ position: "relative" }}
        >
          {props.children}
        </div>
      </Match>
    </Switch>
  );
};

/**
 * The props that get passed to renderPlaceholder
 */
type PlaceholderRendererProps = {
  children: any;
  ref: any;
  attributes: {
    "data-slate-placeholder": boolean;
    dir?: "rtl";
    contentEditable: boolean;
    style: Record<string, any>;
  };
};

const DefaultPlaceholder = (props: PlaceholderRendererProps) => {
  return (
    <div {...props.attributes} ref={props.ref}>
      PLACEHOLDER!
    </div>
  );
};

/**
 * `RenderLeafProps` are passed to the `renderLeaf` handler.
 */

interface LeafRendererProps {
  children: any;
  leaf: Text;
  text: Text;
  attributes: {
    "data-slate-leaf": true;
  };
}

const DefaultLeaf = (props: LeafRendererProps) => {
  return <span {...props.attributes}>{props.children}</span>;
};

export type {
  ElementRendererProps,
  LeafRendererProps,
  PlaceholderRendererProps,
};
export {
  buildDecorators,
  buildElementRenderers,
  buildLeafRenderers,
  DefaultElement,
  DefaultLeaf,
  DefaultPlaceholder,
};
