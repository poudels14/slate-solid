import {
  Accessor,
  createComputed,
  createContext,
  createSignal,
  JSXElement,
  mergeProps,
  splitProps,
  useContext,
} from "solid-js";
import { NodeEntry, BaseRange } from "slate";
import { LeafRendererProps } from "../components/renderer";

type Decorator = (entry: NodeEntry) => BaseRange[];

type EditableContext = {
  getReadOnly: Accessor<boolean>;

  getDecorator: Accessor<Decorator>;
  ElementRenderer: ((props: any) => JSXElement) | null;
  LeafRenderer: ((props: LeafRendererProps) => JSXElement) | null;
  PlaceholderRenderer: ((props: any) => JSXElement) | null;
};

const EditableContext = createContext<EditableContext>();

type ProvierProps = {
  children: any;
  value: {
    readOnly?: boolean;
    getDecorator?: Accessor<Decorator>;
    ElementRenderer?: (props: any) => JSXElement;
    LeafRenderer?: (props: any) => JSXElement;
    PlaceholderRenderer?: (props: any) => JSXElement;
  };
};
const EditableContextProvider = (props: ProvierProps) => {
  const [getReadOnly, setReadOnly] = createSignal(
    Boolean(props.value.readOnly)
  );
  const [_, rest] = splitProps(props.value, ["readOnly"]);
  const context = mergeProps(
    {
      getDecorator: () => () => [],
      ElementRenderer: null,
      LeafRenderer: null,
      PlaceholderRenderer: null,
    },
    rest,
    {
      getReadOnly,
    }
  );

  createComputed(() => setReadOnly(Boolean(props.value.readOnly)));

  return (
    <EditableContext.Provider value={context}>
      {props.children}
    </EditableContext.Provider>
  );
};

const useEditableContext = () => {
  return useContext(EditableContext);
};

export type { Decorator };
export { EditableContext, EditableContextProvider, useEditableContext };
