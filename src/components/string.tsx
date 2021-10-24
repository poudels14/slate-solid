import { Editor, Text, Path, Element, Node } from "slate";
import { Match, Switch } from "solid-js";
import { StoreSignal } from "solid-store";

import { SolidEditor, useSlateStatic } from "..";

/**
 * Leaf content strings.
 */
type StringProps = {
  isLast: boolean;
  leaf: Text;
  parent: StoreSignal<Element>;
  text: Text;
};

const String = (props: StringProps) => {
  // TODO: right now, this works because a new String component is rendered
  // when value changes. but maybe there's a way to reuse the component?
  const { getEditor } = useSlateStatic();
  const editor = getEditor();
  const path = SolidEditor.findPath(editor, props.text);
  const parentPath = Path.parent(path);
  const children = props.parent.children;

  return (
    <Switch>
      <Match when={editor.isVoid(props.parent())}>
        {/* COMPAT: Render text inside void nodes with a zero-width space.
          So the node can contain selection but the text is not visible. */}
        <ZeroWidthString length={Node.string(props.parent()).length} />
      </Match>
      <Match
        when={
          props.leaf.text === "" &&
          children()[children().length - 1] === props.text &&
          !editor.isInline(props.parent()) &&
          Editor.string(editor, parentPath) === ""
        }
      >
        {/* COMPAT: If this is the last text node in an empty block, render a zero-
            width space that will convert into a line break when copying and pasting
            to support expected plain text. */}
        <ZeroWidthString isLineBreak />
      </Match>
      <Match when={props.leaf.text === ""}>
        {/* COMPAT: If the text is empty, it's because it's on the edge of an inline
            node, so we render a zero-width space so that the selection can be
            inserted next to it still. */}
        <ZeroWidthString />
      </Match>
      <Match when={props.isLast && props.leaf.text.slice(-1) === "\n"}>
        {/* COMPAT: Browsers will collapse trailing new lines at the end of blocks,
            so we need to add an extra trailing new lines to prevent that. */}
        <TextString isTrailing text={props.leaf.text} />
      </Match>
      <Match when={1}>
        <TextString text={props.leaf.text} />
      </Match>
    </Switch>
  );
};

/**
 * Leaf strings with text in them.
 */
type TextStringProps = {
  text: string;
  isTrailing?: boolean;
};

const TextString = (props: TextStringProps) => {
  // TODO(sagar): do we need to forceUpdate here? like in slate-react
  // This component may have skipped rendering due to native operations being
  // applied. If an undo is performed React will see the old and new shadow DOM
  // match and not apply an update. Forces each render to actually reconcile.
  return (
    <span data-slate-string>
      {props.text}
      {props.isTrailing ? "\n" : null}
    </span>
  );
};

/**
 * Leaf strings without text, render as zero-width strings.
 */
type ZeroWidthStringProps = {
  length?: number;
  isLineBreak?: boolean;
};

const ZeroWidthString = (props: ZeroWidthStringProps) => {
  return (
    <span
      data-slate-zero-width={props.isLineBreak ? "n" : "z"}
      data-slate-length={props.length || 0}
    >
      {"\uFEFF"}
      {props.isLineBreak ? <br /> : null}
    </span>
  );
};

export default String;
