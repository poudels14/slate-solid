import { direction as getDirection } from "direction";
import { Editor, Element, Node, Range, Transforms } from "slate";

import { EventProps } from "./types";
import { hasEditableTarget, isEventHandled } from "./utils";
import Hotkeys from "../utils/hotkeys";
import {
  HAS_BEFORE_INPUT_SUPPORT,
  IS_CHROME,
  IS_SAFARI,
} from "../utils/environment";

const onKeyDown = (props: EventProps, event: any) => {
  const { editor, editableState, eventHandlers } = props;

  if (
    !editableState.readOnly &&
    !editableState.isComposing &&
    hasEditableTarget(editor, event.target) &&
    !isEventHandled(event, eventHandlers.onKeyDown)
  ) {
    const { selection } = editor;

    const element =
      editor.children[selection !== null ? selection.focus.path[0] : 0];
    const isRTL = getDirection(Node.string(element)) === "rtl";

    // COMPAT: Since we prevent the default behavior on
    // `beforeinput` events, the browser doesn't think there's ever
    // any history stack to undo or redo, so we have to manage these
    // hotkeys ourselves. (2019/11/06)
    if (Hotkeys.isRedo(event)) {
      event.preventDefault();
      const maybeHistoryEditor: any = editor;

      if (typeof maybeHistoryEditor.redo === "function") {
        maybeHistoryEditor.redo();
      }

      return;
    }

    if (Hotkeys.isUndo(event)) {
      event.preventDefault();
      const maybeHistoryEditor: any = editor;

      if (typeof maybeHistoryEditor.undo === "function") {
        maybeHistoryEditor.undo();
      }

      return;
    }

    // COMPAT: Certain browsers don't handle the selection updates
    // properly. In Chrome, the selection isn't properly extended.
    // And in Firefox, the selection isn't properly collapsed.
    // (2017/10/17)
    if (Hotkeys.isMoveLineBackward(event)) {
      event.preventDefault();
      Transforms.move(editor, { unit: "line", reverse: true });
      return;
    }

    if (Hotkeys.isMoveLineForward(event)) {
      event.preventDefault();
      Transforms.move(editor, { unit: "line" });
      return;
    }

    if (Hotkeys.isExtendLineBackward(event)) {
      event.preventDefault();
      Transforms.move(editor, {
        unit: "line",
        edge: "focus",
        reverse: true,
      });
      return;
    }

    if (Hotkeys.isExtendLineForward(event)) {
      event.preventDefault();
      Transforms.move(editor, { unit: "line", edge: "focus" });
      return;
    }

    // COMPAT: If a void node is selected, or a zero-width text node
    // adjacent to an inline is selected, we need to handle these
    // hotkeys manually because browsers won't be able to skip over
    // the void node with the zero-width space not being an empty
    // string.
    if (Hotkeys.isMoveBackward(event)) {
      event.preventDefault();

      if (selection && Range.isCollapsed(selection)) {
        Transforms.move(editor, { reverse: !isRTL });
      } else {
        Transforms.collapse(editor, { edge: "start" });
      }

      return;
    }

    if (Hotkeys.isMoveForward(event)) {
      event.preventDefault();

      if (selection && Range.isCollapsed(selection)) {
        Transforms.move(editor, { reverse: isRTL });
      } else {
        Transforms.collapse(editor, { edge: "end" });
      }

      return;
    }

    if (Hotkeys.isMoveWordBackward(event)) {
      event.preventDefault();

      if (selection && Range.isExpanded(selection)) {
        Transforms.collapse(editor, { edge: "focus" });
      }

      Transforms.move(editor, { unit: "word", reverse: !isRTL });
      return;
    }

    if (Hotkeys.isMoveWordForward(event)) {
      event.preventDefault();

      if (selection && Range.isExpanded(selection)) {
        Transforms.collapse(editor, { edge: "focus" });
      }

      Transforms.move(editor, { unit: "word", reverse: isRTL });
      return;
    }

    // COMPAT: Certain browsers don't support the `beforeinput` event, so we
    // fall back to guessing at the input intention for hotkeys.
    // COMPAT: In iOS, some of these hotkeys are handled in the
    if (!HAS_BEFORE_INPUT_SUPPORT) {
      // We don't have a core behavior for these, but they change the
      // DOM if we don't prevent them, so we have to.
      if (
        Hotkeys.isBold(event) ||
        Hotkeys.isItalic(event) ||
        Hotkeys.isTransposeCharacter(event)
      ) {
        event.preventDefault();
        return;
      }

      if (Hotkeys.isSplitBlock(event)) {
        event.preventDefault();
        Editor.insertBreak(editor);
        return;
      }

      if (Hotkeys.isDeleteBackward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "backward" });
        } else {
          Editor.deleteBackward(editor);
        }

        return;
      }

      if (Hotkeys.isDeleteForward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "forward" });
        } else {
          Editor.deleteForward(editor);
        }

        return;
      }

      if (Hotkeys.isDeleteLineBackward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "backward" });
        } else {
          Editor.deleteBackward(editor, { unit: "line" });
        }

        return;
      }

      if (Hotkeys.isDeleteLineForward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "forward" });
        } else {
          Editor.deleteForward(editor, { unit: "line" });
        }

        return;
      }

      if (Hotkeys.isDeleteWordBackward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "backward" });
        } else {
          Editor.deleteBackward(editor, { unit: "word" });
        }

        return;
      }

      if (Hotkeys.isDeleteWordForward(event)) {
        event.preventDefault();

        if (selection && Range.isExpanded(selection)) {
          Editor.deleteFragment(editor, { direction: "forward" });
        } else {
          Editor.deleteForward(editor, { unit: "word" });
        }

        return;
      }
    } else {
      if (IS_CHROME || IS_SAFARI) {
        // COMPAT: Chrome and Safari support `beforeinput` event but do not fire
        // an event when deleting backwards in a selected void inline node
        if (
          selection &&
          (Hotkeys.isDeleteBackward(event) || Hotkeys.isDeleteForward(event)) &&
          Range.isCollapsed(selection)
        ) {
          const currentNode = Node.parent(editor, selection.anchor.path);

          if (
            Element.isElement(currentNode) &&
            Editor.isVoid(editor, currentNode) &&
            Editor.isInline(editor, currentNode)
          ) {
            event.preventDefault();
            Editor.deleteBackward(editor, { unit: "block" });

            return;
          }
        }
      }
    }
  }
};

export default onKeyDown;
