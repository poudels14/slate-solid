import { useContext } from "solid-js";
import { Decorator, EditableContext } from "./editable";

const defaultDecorator: Decorator = () => [];

const useDecorate = () => {
  const { getDecorator } = useContext(EditableContext)!;
  return getDecorator?.() || defaultDecorator;
};

export { defaultDecorator, useDecorate };
