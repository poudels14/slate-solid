import { createContext, mergeProps, useContext } from "solid-js";

type ElementContext = {};

const ElementContext = createContext<ElementContext>({});

const ElementContextProvider = (props: any) => {
  const context = mergeProps({}, props.value);

  return (
    <ElementContext.Provider value={context}>
      {props.children}
    </ElementContext.Provider>
  );
};

const useElementContext = () => {
  return useContext(ElementContext);
};

export { ElementContext, ElementContextProvider, useElementContext };
