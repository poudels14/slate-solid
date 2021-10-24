import { Editor, Range, Transforms } from "slate";
import { EventProps } from "./types";
import { SolidEditor } from "../plugin/solid-editor";
import { asNative } from "../utils/native";

const onBeforeInput = (props: EventProps, event: InputEvent) => {
  const { editor, editableState, setEditableState } = props;
  const { selection } = editor;
  const { inputType: type } = event;
  const data = (event as any).dataTransfer || event.data || undefined;

  // These two types occur while a user is composing text and can't be
  // cancelled. Let them through and wait for the composition to end.
  if (type === "insertCompositionText" || type === "deleteCompositionText") {
    return;
  }

  let native = false;
  if (
    type === "insertText" &&
    selection &&
    Range.isCollapsed(selection) &&
    // Only use native character insertion for single characters a-z or space for now.
    // Long-press events (hold a + press 4 = ä) to choose a special character otherwise
    // causes duplicate inserts.
    event.data &&
    event.data.length === 1 &&
    /[a-z ]/i.test(event.data) &&
    // Chrome seems to have issues correctly editing the start of nodes.
    // When there is an inline element, e.g. a link, and you select
    // right after it (the start of the next node).
    selection.anchor.offset !== 0
  ) {
    native = true;

    // Skip native if there are marks, as
    // `insertText` will insert a node, not just text.
    if (editor.marks) {
      native = false;
    }

    // and because of the selection moving in `insertText` (create-editor.ts).
    const { anchor } = selection;
    const inline = Editor.above(editor, {
      at: anchor,
      match: (n) => Editor.isInline(editor, n),
      mode: "highest",
    });
    if (inline) {
      const [, inlinePath] = inline;

      if (Editor.isEnd(editor, selection.anchor, inlinePath)) {
        native = false;
      }
    }
  }

  if (!native) {
    event.preventDefault();
  }

  // COMPAT: For the deleting forward/backward input types we don't want
  // to change the selection because it is the range that will be deleted,
  // and those commands determine that for themselves.
  if (!type.startsWith("delete") || type.startsWith("deleteBy")) {
    const [targetRange] = (event as any).getTargetRanges();

    if (targetRange) {
      const range = SolidEditor.toSlateRange(editor, targetRange, {
        exactMatch: false,
        suppressThrow: false,
      });

      if (!selection || !Range.equals(selection, range)) {
        Transforms.select(editor, range);
      }
    }
  }

  // COMPAT: If the selection is expanded, even if the command seems like
  // a delete forward/backward command it should delete the selection.
  if (selection && Range.isExpanded(selection) && type.startsWith("delete")) {
    const direction = type.endsWith("Backward") ? "backward" : "forward";
    Editor.deleteFragment(editor, { direction });
    return;
  }

  switch (type) {
    case "deleteByComposition":
    case "deleteByCut":
    case "deleteByDrag": {
      Editor.deleteFragment(editor);
      break;
    }

    case "deleteContent":
    case "deleteContentForward": {
      Editor.deleteForward(editor);
      break;
    }

    case "deleteContentBackward": {
      Editor.deleteBackward(editor);
      break;
    }

    case "deleteEntireSoftLine": {
      Editor.deleteBackward(editor, { unit: "line" });
      Editor.deleteForward(editor, { unit: "line" });
      break;
    }

    case "deleteHardLineBackward": {
      Editor.deleteBackward(editor, { unit: "block" });
      break;
    }

    case "deleteSoftLineBackward": {
      Editor.deleteBackward(editor, { unit: "line" });
      break;
    }

    case "deleteHardLineForward": {
      Editor.deleteForward(editor, { unit: "block" });
      break;
    }

    case "deleteSoftLineForward": {
      Editor.deleteForward(editor, { unit: "line" });
      break;
    }

    case "deleteWordBackward": {
      Editor.deleteBackward(editor, { unit: "word" });
      break;
    }

    case "deleteWordForward": {
      Editor.deleteForward(editor, { unit: "word" });
      break;
    }

    case "insertLineBreak":
    case "insertParagraph": {
      Editor.insertBreak(editor);
      break;
    }

    case "insertFromComposition":
    case "insertFromDrop":
    case "insertFromPaste":
    case "insertFromYank":
    case "insertReplacementText":
    case "insertText": {
      if (type === "insertFromComposition") {
        // COMPAT: in Safari, `compositionend` is dispatched after the
        // `beforeinput` for "insertFromComposition". But if we wait for it
        // then we will abort because we're still composing and the selection
        // won't be updated properly.
        // https://www.w3.org/TR/input-events-2/
        editableState.isComposing && setEditableState("isComposing", false);
      }

      const window = SolidEditor.getWindow(editor);
      if (data instanceof window.DataTransfer) {
        SolidEditor.insertData(editor, data as DataTransfer);
      } else if (typeof data === "string") {
        // Only insertText operations use the native functionality, for now.
        // Potentially expand to single character deletes, as well.
        if (native) {
          asNative(editor, () => Editor.insertText(editor, data), {
            onFlushed: () => event.preventDefault(),
          });
        } else {
          Editor.insertText(editor, data);
        }
      }

      break;
    }
  }
};

export default onBeforeInput;
