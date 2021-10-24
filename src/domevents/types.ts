import { SetStoreFunction } from "solid-js/store";
import { EditableState } from "../components/editable";
import { SolidEditor } from "..";

export type EventProps = {
  editableState: EditableState;
  setEditableState: SetStoreFunction<EditableState>;
  editor: SolidEditor;
  eventHandlers: {
    onClick?: any;
    onKeyDown?: any;
    onCompositionStart?: any;
    onCompositionUpdate?: any;
    onCompositionEnd?: any;
  };
};
