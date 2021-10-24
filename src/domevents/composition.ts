import { Editor, Node, Range, Transforms } from "slate";
import { EventProps } from "./types";
import { hasEditableTarget, isEventHandled } from "./utils";
import {
  IS_IOS,
  IS_FIREFOX_LEGACY,
  IS_QQBROWSER,
  IS_SAFARI,
} from "../utils/environment";

const onCompositionStart = (props: EventProps, event: any) => {
  const { editor, editableState, eventHandlers } = props;
  if (
    hasEditableTarget(editor, event.target) &&
    !isEventHandled(event, eventHandlers.onCompositionStart)
  ) {
    const { selection, marks } = editor;
    if (selection) {
      if (Range.isExpanded(selection)) {
        Editor.deleteFragment(editor);
        return;
      }
      const inline = Editor.above(editor, {
        match: (n) => Editor.isInline(editor, n),
        mode: "highest",
      });
      if (inline) {
        const [, inlinePath] = inline;
        if (Editor.isEnd(editor, selection.anchor, inlinePath)) {
          const point = Editor.after(editor, inlinePath)!;
          Transforms.setSelection(editor, {
            anchor: point,
            focus: point,
          });
        }
      }
      // insert new node in advance to ensure composition text will insert
      // along with final input text
      // add Unicode BOM prefix to avoid normalize removing this node
      if (marks) {
        editableState.hasInsertPrefixInCompositon = true;
        Transforms.insertNodes(
          editor,
          {
            text: "\uFEFF",
            ...marks,
          },
          {
            select: true,
          }
        );
      }
    }
  }
};

const onCompositionUpdate = (props: EventProps, event: any) => {
  const { editor, setEditableState, eventHandlers } = props;
  if (
    hasEditableTarget(editor, event.target) &&
    !isEventHandled(event, eventHandlers.onCompositionUpdate)
  ) {
    setEditableState("isComposing", true);
  }
};

const onCompositionEnd = (props: EventProps, event: any) => {
  const { editor, editableState, setEditableState, eventHandlers } = props;
  if (
    hasEditableTarget(editor, event.target) &&
    !isEventHandled(event, eventHandlers.onCompositionEnd)
  ) {
    setEditableState("isComposing", false);

    // COMPAT: In Chrome, `beforeinput` events for compositions
    // aren't correct and never fire the "insertFromComposition"
    // type that we need. So instead, insert whenever a composition
    // ends since it will already have been committed to the DOM.
    if (
      !IS_SAFARI &&
      !IS_FIREFOX_LEGACY &&
      !IS_IOS &&
      !IS_QQBROWSER &&
      event.data
    ) {
      Editor.insertText(editor, event.data);
    }

    if (editor.selection && Range.isCollapsed(editor.selection)) {
      const leafPath = editor.selection.anchor.path;
      const currentTextNode = Node.leaf(editor, leafPath);
      if (editableState.hasInsertPrefixInCompositon) {
        setEditableState("hasInsertPrefixInCompositon", false);
        Editor.withoutNormalizing(editor, () => {
          // remove Unicode BOM prefix added in `onCompositionStart`
          const text = currentTextNode.text.replace(/^\uFEFF/, "");
          Transforms.delete(editor, {
            distance: currentTextNode.text.length,
            reverse: true,
          });
          Transforms.insertText(editor, text);
        });
      }
    }
  }
};

export { onCompositionStart, onCompositionUpdate, onCompositionEnd };
