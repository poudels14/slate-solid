/**
 * Check if the target is editable and in the editor.
 */

import { SolidEditor } from "..";
import { Editor } from "slate";
import { DOMNode, isDOMNode } from "../utils/dom";

export const hasEditableTarget = (
  editor: SolidEditor,
  target: EventTarget | null
): target is DOMNode => {
  return (
    isDOMNode(target) &&
    SolidEditor.hasDOMNode(editor, target, { editable: true })
  );
};

/**
 * Check if the target is in the editor.
 */

export const hasTarget = (
  editor: SolidEditor,
  target: EventTarget | null
): target is DOMNode => {
  return isDOMNode(target) && SolidEditor.hasDOMNode(editor, target);
};

/**
 * Check if the target is inside void and in the editor.
 */

export const isTargetInsideVoid = (
  editor: SolidEditor,
  target: EventTarget | null
): boolean => {
  const slateNode =
    hasTarget(editor, target) && SolidEditor.toSlateNode(editor, target);
  return Editor.isVoid(editor, slateNode);
};

/**
 * Check if an event is overrided by a handler.
 */

export const isEventHandled = (
  event: any,
  handler?: (event: any) => void | boolean
) => {
  if (!handler) {
    return false;
  }
  // The custom event handler may return a boolean to specify whether the event
  // shall be treated as being handled or not.
  const shouldTreatEventAsHandled = handler(event);

  if (shouldTreatEventAsHandled != null) {
    return shouldTreatEventAsHandled;
  }

  return event.isDefaultPrevented() || event.isPropagationStopped();
};
