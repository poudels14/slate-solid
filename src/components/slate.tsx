import {
  JSX,
  splitProps,
  createEffect,
  onCleanup,
  createSignal,
  createContext,
  useContext,
  createMemo,
  useTransition,
  ErrorBoundary,
  onError,
} from "solid-js";
import { Editor, Node, Descendant } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { EDITOR_TO_ON_CHANGE } from "../utils/weak-maps";
import { createStore } from "solid-store";

type SlateContext = {
  getEditor: () => SolidEditor;
};

const SlateContext = createContext<SlateContext | null>(null);

const useSlate = (): SlateContext => {
  const context = useContext(SlateContext);
  if (!context) {
    throw new Error(
      `The \`useSlate\` hook must be used inside the <Slate> component's context.`
    );
  }
  return context;
};

type SlateProps = {
  editor: SolidEditor;
  value: Descendant[];
  onChange?: (value: Descendant[]) => void;
  children?: JSX.Element;
};

/**
 * A wrapper around the provider to handle `onChange` events, because the editor
 * is a mutable singleton so it won't ever register as "changed" otherwise.
 */

const Slate = (props: SlateProps) => {
  const [localProps, rest] = splitProps(props, [
    "editor",
    "children",
    "onChange",
    "value",
  ]);

  let setRxEditor: any;

  const getEditor = createMemo<SolidEditor>(() => {
    const [editor, set] = createStore(props.editor);
    if (!setRxEditor) {
      setRxEditor = set;
    } else {
      const [_, start] = useTransition();
      start(
        () => setRxEditor("children", editor.children),
        () => setRxEditor("selection", editor.selection)
      );
    }

    if (!Node.isNodeList(localProps.value)) {
      throw new Error(
        `[Slate] value is invalid! Expected a list of elements` +
          `but got: ${JSON.stringify(localProps.value)}`
      );
    }
    if (!Editor.isEditor(editor)) {
      throw new Error(
        `[Slate] editor is invalid! you passed:` + `${JSON.stringify(editor)}`
      );
    }

    editor.children = localProps.value;
    return editor;
  });

  const onContextChange = () => {
    const editor = getEditor();
    const [_, start] = useTransition();
    start(
      () => setRxEditor("children", editor.children),
      () => setRxEditor("selection", editor.selection)
    );
    localProps.onChange?.(editor.children);
  };

  createEffect(() => {
    const editor = getEditor();
    EDITOR_TO_ON_CHANGE.set(editor, onContextChange);
    onCleanup(() => {
      EDITOR_TO_ON_CHANGE.set(editor, () => {});
    });
  });

  // TODO
  const [isFocused, setIsFocused] = createSignal(
    SolidEditor.isFocused(getEditor())
  );

  createEffect(() => {
    setIsFocused(SolidEditor.isFocused(getEditor()));
  });

  createEffect(() => {
    // TODO:
    // const fn = () => setIsFocused(SolidEditor.isFocused(props.getEditor()));
    // document.addEventListener("focus", fn, true);
    // onCleanup(() => document.removeEventListener("focus", fn, true));
  });

  createEffect(() => {
    const fn = () => setIsFocused(SolidEditor.isFocused(getEditor()));
    document.addEventListener("blur", fn, true);
    onCleanup(() => document.removeEventListener("blur", fn, true));
  });

  onError((e) => console.error(e));
  return (
    <ErrorBoundary fallback={(e) => `Error:${e}`}>
      <SlateContext.Provider value={{ getEditor }}>
        {/* <FocusedContext.Provider value={{ isFocused }}> */}
        {props.children}
        {/* </FocusedContext.Provider> */}
      </SlateContext.Provider>
    </ErrorBoundary>
  );
};

export { SlateContext, Slate, useSlate };
