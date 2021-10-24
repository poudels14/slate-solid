import { Editor, Range, Element, Descendant, Ancestor } from "slate";
import { Store, StoreSignal } from "solid-store";
import {
  createComputed,
  createMemo,
  For,
  Index,
  Match,
  Switch,
} from "solid-js";
// @ts-ignore
import arrayEqual from "array-equal";
import ElementComponent from "./element";
import TextComponent from "./text";
import { NODE_TO_PATH } from "../utils/weak-maps";
import { useSlate } from "./slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useDecorate } from "../hooks/use-decorate";
import { ElementContextProvider } from "../hooks/element";

type ChildrenProps = {
  decorations: Range[];
  node: StoreSignal<Ancestor> | Store<any>;
  selection: Range | null;
};

const Children = (props: ChildrenProps) => {
  const node = createMemo<any>(props.node);

  const { getEditor } = useSlate();
  const editor = getEditor();

  const getPath = createMemo(() => {
    const n = props.node();
    return SolidEditor.findPath(editor, n);
  });

  const isLeafBlock = createMemo(() => {
    return (
      Element.isElement(node()) &&
      !editor.isInline(node()) &&
      Editor.hasInlines(editor, node())
    );
  });

  const getChildren = createMemo<Descendant[]>(props.node.children);
  return (
    <Index each={getChildren()}>
      {(child, index) => {
        const childPath = createMemo(() => getPath().concat(index), undefined, {
          equals: (p, n) => arrayEqual(p, n),
        });
        return (
          <Child
            editor={editor}
            path={childPath()}
            node={props.node.children[index]}
            parent={props.node}
            index={index}
            isLast={isLeafBlock() && index === getChildren().length - 1}
            selection={props.selection}
            decorations={props.decorations}
          />
        );
      }}
    </Index>
  );
};

type ChildProps = {
  editor: any;
  path: any[];
  index: number;
  isLast: boolean;
  node: StoreSignal<any>;
  parent: any;
  selection: Range | null;
  decorations: Range[];
};

const Child = (props: ChildProps) => {
  const node = createMemo<any>(() => props.node());
  const range = createMemo(() => Editor.range(props.editor, props.path));
  const selection = createMemo(() => {
    return props.selection && Range.intersection(range(), props.selection);
  });
  const isElement = createMemo(() => Element.isElement(node()));
  const isSelected = createMemo(
    () => props.selection && Range.intersection(range(), props.selection)
  );

  createComputed(() => {
    const n = node();
    createComputed(() => {
      NODE_TO_PATH.set(n, props.path);
    });
  });

  const path = createMemo(() => props.path, undefined, {
    equals: (p, n) => arrayEqual(p, n),
  });
  const decorations = createMemo(
    () => {
      const n = node();
      const decorate = useDecorate();
      const ds = decorate([n, path()]);
      for (const dec of props.decorations) {
        const d = Range.intersection(dec, range());
        if (d) {
          ds.push(d);
        }
      }
      return ds;
    },
    undefined,
    {
      equals: (p, n) => arrayEqual(p, n),
    }
  );

  return (
    <Switch>
      <Match when={isElement()}>
        <ElementContextProvider value={!!isSelected()}>
          <ElementComponent
            decorations={decorations()}
            element={props.node}
            selection={selection()}
          />
        </ElementContextProvider>
      </Match>
      <Match when={!isElement()}>
        <TextComponent
          decorations={decorations()}
          isLast={props.isLast}
          parent={props.parent}
          text={node()}
        />
      </Match>
    </Switch>
  );
};

export default Children;
