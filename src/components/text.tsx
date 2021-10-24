import { createEffect, createMemo, Index } from "solid-js";
import { Range, Element, Text as SlateText } from "slate";

import Leaf from "./leaf";
import { SolidEditor, useSlateStatic } from "..";
import {
  NODE_TO_ELEMENT,
  ELEMENT_TO_NODE,
  EDITOR_TO_KEY_TO_ELEMENT,
} from "../utils/weak-maps";
import { StoreSignal } from "solid-store";

type TextProps = {
  decorations: Range[];
  isLast: boolean;
  parent: StoreSignal<Element>;
  text: SlateText;
};

const Text = (props: TextProps) => {
  const { getEditor } = useSlateStatic();
  let ref: any;

  const leaves = createMemo(() =>
    SlateText.decorations(props.text, props.decorations)
  );

  // Update element-related weak maps with the DOM element ref.
  createEffect(() => {
    const editor = getEditor();
    const key = SolidEditor.findKey(editor, props.text);
    const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
    if (ref) {
      KEY_TO_ELEMENT?.set(key, ref);
      NODE_TO_ELEMENT.set(props.text, ref);
      ELEMENT_TO_NODE.set(ref, props.text);
    } else {
      KEY_TO_ELEMENT?.delete(key);
      NODE_TO_ELEMENT.delete(props.text);
    }
  });

  return (
    <span data-slate-node="text" ref={ref}>
      <Index each={leaves()}>
        {(leaf, index) => (
          <Leaf
            isLast={props.isLast && index === leaves.length - 1}
            leaf={leaf()}
            text={props.text}
            parent={props.parent}
          />
        )}
      </Index>
    </span>
  );
};

export default Text;
