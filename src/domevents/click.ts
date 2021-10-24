import { SolidEditor } from "..";
import { Editor, Path, Transforms } from "slate";
import { isDOMNode } from "../utils/dom";
import { EventProps } from "./types";
import { hasTarget, isEventHandled } from "./utils";

const onClick = (props: EventProps, event: any) => {
  const { editor, editableState, eventHandlers } = props;
  if (
    !editableState.readOnly &&
    hasTarget(editor, event.target) &&
    !isEventHandled(event, eventHandlers.onClick) &&
    isDOMNode(event.target)
  ) {
    const node = SolidEditor.toSlateNode(editor, event.target);
    const path = SolidEditor.findPath(editor, node);
    const start = Editor.start(editor, path);
    const end = Editor.end(editor, path);

    const startVoid = Editor.void(editor, { at: start });
    const endVoid = Editor.void(editor, { at: end });

    if (startVoid && endVoid && Path.equals(startVoid[1], endVoid[1])) {
      const range = Editor.range(editor, start);
      Transforms.select(editor, range);
    }
  }
};

export default onClick;
