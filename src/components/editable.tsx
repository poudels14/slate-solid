import {
  createMemo,
  mergeProps,
  createEffect,
  onCleanup,
  JSXElement,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Editor, Node, Range } from "slate";
import { Store, storeRef } from "solid-store";
import { useSlate } from "./slate";
import onBeforeInput from "../domevents/beforeInput";
import onSelectionChange from "../domevents/selectionChange";
import Children from "./children";
import {
  EDITOR_TO_ELEMENT,
  ELEMENT_TO_NODE,
  NODE_TO_ELEMENT,
  EDITOR_TO_WINDOW,
  PLACEHOLDER_SYMBOL,
} from "../utils/weak-maps";
import { IS_FIREFOX } from "../utils/environment";
import { DOMRange, getDefaultView } from "../utils/dom";
import { SolidEditor } from "..";
import {
  onCompositionEnd,
  onCompositionStart,
  onCompositionUpdate,
} from "../domevents/composition";
import { flushNativeEvents } from "../utils/native";
import { EventProps } from "../domevents/types";
import onKeyDown from "../domevents/keydown";
import onClick from "../domevents/click";
import {
  Decorator,
  EditableContextProvider,
  useEditableContext,
} from "../hooks/editable";
import { defaultScrollSelectionIntoView } from "../utils/scroll-into-view";

export type EditableState = {
  readOnly: boolean;
  isComposing: boolean;
  hasInsertPrefixInCompositon: boolean;
  isUpdatingSelection: boolean;
  isDraggingInternally: boolean;
  latestElement: any;
};

type InternalEditableProps = {
  autoFocus?: boolean;
  placeholder?: string;
  style?: Record<string, string>;
  scrollSelectionIntoView?: (editor: SolidEditor, domRange: DOMRange) => void;
};

const Editable = (props: InternalEditableProps) => {
  const { getEditor } = useSlate();
  const editor = getEditor() as Store<SolidEditor>;
  const editorRef = storeRef(editor);

  const { getReadOnly, getDecorator } = useEditableContext()!;

  const [state, setState] = createStore<EditableState>({
    get readOnly() {
      return getReadOnly();
    },
    isComposing: false,
    hasInsertPrefixInCompositon: false,
    isUpdatingSelection: false,
    isDraggingInternally: false,
    latestElement: null,
  });

  const onInput = (props: EventProps, e: any) => {
    const { editor } = props;
    flushNativeEvents(editor);
  };

  const eventProps = {
    editableState: state,
    setEditableState: setState,
    editor: getEditor(),
    get eventHandlers() {
      // @ts-ignore
      return {
        // @ts-ignore
        onCompositionStart: props.onCompositionStart,
        // @ts-ignore
        onKeyDown: props.onKeyDown,
        // @ts-ignore
        onCompositionUpdate: props.onCompositionStart,
        // @ts-ignore
        onCompositionEnd: props.onCompositionStart,
      };
    },
  };

  const getChildrenLength = createMemo(editorRef.children.length);
  const decorations = createMemo(() => {
    const decorations = getDecorator()!([editor, []]);
    if (
      props.placeholder &&
      getChildrenLength() === 1 &&
      Array.from(Node.texts(editor)).length === 1 &&
      Node.string(editor) === "" &&
      !state.isComposing
    ) {
      const start = Editor.start(editor, []);
      decorations.push({
        [PLACEHOLDER_SYMBOL]: true,
        // @ts-ignore
        placeholder: props.placeholder,
        anchor: start,
        focus: start,
      });
    }
    return decorations;
  });

  // Whenever the editor updates...
  let ref: any;
  createEffect(() => {
    // Update element-related weak maps with the DOM element ref.
    let window;
    if (ref && (window = getDefaultView(ref))) {
      EDITOR_TO_WINDOW.set(editor, window);
      EDITOR_TO_ELEMENT.set(editor, ref);
      NODE_TO_ELEMENT.set(editor, ref);
      ELEMENT_TO_NODE.set(ref, editor);
    } else {
      NODE_TO_ELEMENT.delete(editor);
    }

    // Make sure the DOM selection state is in sync.
    const selection = editorRef.selection();
    const root = SolidEditor.findDocumentOrShadowRoot(editor);
    // @ts-ignore
    const domSelection = root.getSelection();
    if (state.isComposing || !domSelection || !SolidEditor.isFocused(editor)) {
      return;
    }

    const hasDomSelection = domSelection.type !== "None";

    // If the DOM selection is properly unset, we're done.
    if (!selection && !hasDomSelection) {
      return;
    }

    // verify that the dom selection is in the editor
    const editorElement = EDITOR_TO_ELEMENT.get(editor)!;
    let hasDomSelectionInEditor = false;
    if (
      editorElement.contains(domSelection.anchorNode) &&
      editorElement.contains(domSelection.focusNode)
    ) {
      hasDomSelectionInEditor = true;
    }

    // If the DOM selection is in the editor and the editor selection is already correct, we're done.
    if (hasDomSelection && hasDomSelectionInEditor && selection) {
      const slateRange = SolidEditor.toSlateRange(editor, domSelection, {
        exactMatch: false,

        // domSelection is not necessarily a valid Slate range
        // (e.g. when clicking on contentEditable:false element)
        suppressThrow: true,
      });
      if (slateRange && Range.equals(slateRange, selection)) {
        return;
      }
    }

    // when <Editable/> is being controlled through external value
    // then its children might just change - DOM responds to it on its own
    // but Slate's value is not being updated through any operation
    // and thus it doesn't transform selection on its own
    if (selection && !SolidEditor.hasRange(editor, selection)) {
      editor.selection = SolidEditor.toSlateRange(editor, domSelection, {
        exactMatch: false,
        suppressThrow: false,
      });
      return;
    }

    // Otherwise the DOM selection is out of sync, so update it.
    // TODO:
    setState("isUpdatingSelection", true);
    // state.isUpdatingSelection = true

    const newDomRange = selection && SolidEditor.toDOMRange(editor, selection);
    if (newDomRange) {
      if (Range.isBackward(selection!)) {
        domSelection.setBaseAndExtent(
          newDomRange.endContainer,
          newDomRange.endOffset,
          newDomRange.startContainer,
          newDomRange.startOffset
        );
      } else {
        domSelection.setBaseAndExtent(
          newDomRange.startContainer,
          newDomRange.startOffset,
          newDomRange.endContainer,
          newDomRange.endOffset
        );
      }
      props.scrollSelectionIntoView!(editor, newDomRange);
    } else {
      domSelection.removeAllRanges();
    }

    setTimeout(() => {
      // COMPAT: In Firefox, it's not enough to create a range, you also need
      // to focus the contenteditable element too. (2016/11/16)
      if (newDomRange && IS_FIREFOX) {
        const el = SolidEditor.toDOMNode(editor, editor);
        el.focus();
      }
      // TODO:
      setState("isUpdatingSelection", false);
      // state.isUpdatingSelection = false
    });
  });

  createEffect(() => {
    const window = SolidEditor.getWindow(editor);
    const selectionChange = (e: any) => {
      setTimeout(() => onSelectionChange(eventProps, e));
    };

    window.document.addEventListener("selectionchange", selectionChange);
    onCleanup(() => {
      window.document.removeEventListener("selectionchange", selectionChange);
    });
  });

  createEffect(() => {
    if (ref && props.autoFocus) {
      ref.focus();
    }
  });

  return (
    <div
      role={getReadOnly() ? undefined : "textbox"}
      contentEditable={getReadOnly() ? undefined : true}
      data-slate-editor
      data-slate-node="value"
      // @ts-ignore
      suppressContentEditableWarning
      ref={ref}
      style={{
        // Allow positioning relative to the editable element.
        position: "relative",
        // Prevent the default outline styles.
        outline: "none",
        // Preserve adjacent whitespace and new lines.
        "white-space": "pre-wrap",
        // Allow words to break if they are too long.
        "word-wrap": "break-word",
        // Allow for passed-in styles to override anything.
        ...props.style,
      }}
      onBeforeInput={[onBeforeInput, eventProps]}
      onInput={[onInput, eventProps]}
      onClick={[onClick, eventProps]}
      onCompositionStart={[onCompositionStart, eventProps]}
      onCompositionUpdate={[onCompositionUpdate, eventProps]}
      onCompositionEnd={[onCompositionEnd, eventProps]}
      onKeyDown={[onKeyDown, eventProps]}
      // TODO:
      // onCopy={onCopy}
      // onCut={onCut}
      // onDragOver={onDragOver}
      // onDragStart={onDragStart}
      // onDrop={onDrop}
      // onDragEnd={onDragEnd}
      // onBlur={onBlur}
      // onFocus={onFocus}
      // onPaste={onPaste}
    >
      <Children
        decorations={decorations()}
        node={editorRef}
        selection={editorRef.selection()}
      />
    </div>
  );
};

type EditableProps = {
  readOnly?: boolean;
  placeholder?: string;
  style?: Record<string, string>;

  getDecorator: () => Decorator;
  elementRenderer?: (props: any) => JSXElement;
  leafRenderer?: (props: any) => JSXElement;
  placeholderRenderer?: (props: any) => JSXElement;
  scrollSelectionIntoView?: (editor: SolidEditor, domRange: DOMRange) => void;
} & {
  autoFocus?: boolean;
};

const EditableWrapper = (props: EditableProps) => {
  props = mergeProps(
    {
      style: {},
      scrollSelectionIntoView: defaultScrollSelectionIntoView,
    },
    props
  );

  return (
    <EditableContextProvider
      value={{
        readOnly: props.readOnly,
        getDecorator: props.getDecorator,
        LeafRenderer: props.leafRenderer,
        ElementRenderer: props.elementRenderer,
        PlaceholderRenderer: props.placeholderRenderer,
      }}
    >
      <Editable
        style={props.style}
        autoFocus={props.autoFocus}
        scrollSelectionIntoView={props.scrollSelectionIntoView}
      />
    </EditableContextProvider>
  );
};

export default EditableWrapper;
