import {
  createComputed,
  createEffect,
  createMemo,
  Match,
  Switch,
  useContext,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { StoreSignal } from "solid-store";
import { direction as getDirection } from "direction";
import { Editor, Node, Range, Element as SlateElement } from "slate";

import Text from "./text";
import { SolidEditor, useSlateStatic } from "..";
import {
  NODE_TO_ELEMENT,
  ELEMENT_TO_NODE,
  EDITOR_TO_KEY_TO_ELEMENT,
  NODE_TO_PATH,
} from "../utils/weak-maps";
import Children from "./children";
import { EditableContext, useEditableContext } from "../hooks/editable";
import { DefaultElement } from "./renderer";

type Attributes = {
  // Attributes that the developer must mix into the element in their
  // custom node renderer component.
  "data-slate-node": "element";
  "data-slate-void"?: true;
  "data-slate-inline"?: true;
  contentEditable?: false;
  dir?: "rtl";
};

/**
 * Element.
 */

const Element = (props: {
  decorations: Range[];
  element: StoreSignal<SlateElement>;
  selection: Range | null;
}) => {
  const { getEditor } = useSlateStatic();
  const { getReadOnly } = useEditableContext()!;
  const editor = getEditor();

  let ref: any;

  const element = createMemo<SlateElement>(props.element);
  const getIsInline = createMemo(() => editor.isInline(element()));
  const getIsVoid = createMemo(() => Editor.isVoid(editor, element()));
  const { ElementRenderer } = useContext(EditableContext)!;

  const getAttributes = createMemo(() => {
    const isVoid = getIsVoid();
    const isInline = getIsInline();
    // Attributes that the developer must mix into the element in their
    // custom node renderer component.
    const attributes: Attributes = {
      "data-slate-node": "element",
      "data-slate-inline": isInline || undefined,

      // If it's a void node, wrap the children in extra void-specific elements.
      "data-slate-void": isVoid || undefined,
      contentEditable: isVoid && !getReadOnly() && isInline ? false : undefined,
    };

    // If it's a block node with inline children, add the proper `dir` attribute
    // for text direction.
    if (!isInline && Editor.hasInlines(editor, element())) {
      const text = Node.string(element());
      const dir = getDirection(text);

      if (dir === "rtl") {
        attributes.dir = dir;
      }
    }
    return attributes;
  });

  // Update element-related weak maps with the DOM element ref.
  createEffect(() => {
    const ele = element();
    const key = SolidEditor.findKey(editor, ele);
    const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);

    if (ref) {
      KEY_TO_ELEMENT?.set(key, ref);
      NODE_TO_ELEMENT.set(ele, ref);
      ELEMENT_TO_NODE.set(ref, ele);
    } else {
      KEY_TO_ELEMENT?.delete(key);
      NODE_TO_ELEMENT.delete(ele);
    }
  });

  return (
    <Dynamic
      component={ElementRenderer || DefaultElement}
      attributes={getAttributes()}
      element={props.element}
      ref={ref}
      as="span"
    >
      <Switch>
        <Match when={getIsVoid()}>
          {/* If it's a void node, wrap the children in extra void-specific elements. */}
          <VoidElement
            readOnly={getReadOnly()}
            isInline={getIsInline()}
            text={Node.texts(element())[0][0]}
            parent={props.element}
          />
        </Match>
        <Match when={!getIsVoid()}>
          <Children
            decorations={props.decorations}
            node={props.element}
            selection={props.selection}
          />
        </Match>
      </Switch>
    </Dynamic>
  );
};

const VoidElement = (props: {
  readOnly: boolean;
  isInline: boolean;
  text: any;
  parent: StoreSignal<any>;
}) => {
  const { getEditor } = useSlateStatic();
  const editor = getEditor();

  const parent = createMemo<any>(props.parent);
  const getPath = createMemo(() => {
    return [...SolidEditor.findPath(editor, parent()), 0];
  });
  createComputed(() => {
    NODE_TO_PATH.set(props.text, getPath());
  });

  return (
    <Switch>
      <Match when={!props.readOnly && props.isInline}>
        <span
          data-slate-spacer
          style={{
            height: "0",
            color: "transparent",
            outline: "none",
            position: "absolute",
          }}
        >
          <Text
            decorations={[]}
            isLast={false}
            parent={props.parent}
            text={props.text}
          />
        </span>
      </Match>
      <Match when={!props.readOnly && !props.isInline}>
        <div
          data-slate-spacer
          style={{
            height: "0",
            color: "transparent",
            outline: "none",
            position: "absolute",
          }}
        >
          <Text
            decorations={[]}
            isLast={false}
            parent={props.parent}
            text={props.text}
          />
        </div>
      </Match>
    </Switch>
  );
};

export default Element;
