import {
  createEffect,
  onCleanup,
  Show,
  useContext,
  splitProps,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { StoreSignal } from "solid-store";
import { Element, Text } from "slate";

import String from "./string";
import { PLACEHOLDER_SYMBOL } from "../utils/weak-maps";
import { EditableContext } from "../hooks/editable";
import { DefaultLeaf, DefaultPlaceholder } from "./renderer";

/**
 * Individual leaves in a text node with unique formatting.
 */

const Leaf = (props: {
  isLast: boolean;
  leaf: Text;
  parent: StoreSignal<Element>;
  text: Text;
}) => {
  const { LeafRenderer, PlaceholderRenderer } = useContext(EditableContext)!;

  let placeholderRef: any;
  createEffect(() => {
    const editorEl = document.querySelector<HTMLDivElement>(
      '[data-slate-editor="true"]'
    );

    if (!placeholderRef || !editorEl) {
      return;
    }

    editorEl.style.minHeight = `${placeholderRef.clientHeight}px`;
    onCleanup(() => {
      editorEl.style.minHeight = "auto";
    });
  });

  const placeholderAttributes = {
    "data-slate-placeholder": true,
    style: {
      position: "absolute",
      "pointer-events": "none",
      width: "100%",
      "max-width": "100%",
      display: "block",
      opacity: "0.333",
      "user-select": "none",
      "text-decoration": "none",
    },
    contentEditable: false,
  };

  // COMPAT: Having the `data-` attributes on these leaf elements ensures that
  // in certain misbehaving browsers they aren't weirdly cloned/destroyed by
  // contenteditable behaviors. (2019/05/08)
  const attributes = {
    "data-slate-leaf": true,
  };

  const [rendererProps] = splitProps(props, ["leaf", "text"]);

  return (
    <Dynamic
      component={LeafRenderer || DefaultLeaf}
      // @ts-ignore
      attributes={attributes}
      {...rendererProps}
    >
      <Show when={props.leaf[PLACEHOLDER_SYMBOL]}>
        {/* TODO: make placeholder work */}
        <Dynamic
          component={PlaceholderRenderer || DefaultPlaceholder}
          attributes={placeholderAttributes}
          // @ts-ignore
          children={props.leaf.placeholder}
          ref={placeholderRef}
        />
      </Show>
      <String
        isLast={props.isLast}
        leaf={props.leaf}
        parent={props.parent}
        text={props.text}
      />
    </Dynamic>
  );
};

export default Leaf;
