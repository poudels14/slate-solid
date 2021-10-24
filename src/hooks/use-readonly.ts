import { useContext } from "solid-js";
import { EditableContext } from "./editable";

const useReadOnly = () => {
  const { getReadOnly } = useContext(EditableContext)!;
  return getReadOnly?.();
};

export { useReadOnly };
