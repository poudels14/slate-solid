import { render } from "solid-js/web";
import { tw } from "twind";
import CodeEditor from "./CodeEditor";

const Example = () => {
  return (
    <div class={tw("py-10 max-w-6xl mx-auto text-gray-600 font-sans")}>
      <div class={tw("font-bold text-3xl text-gray-700 text-center")}>
        Slate Solid Examples
      </div>
      <div class={tw("py-2 text-center")}>
        Slate solid is a solid-js wrapper around Slate rich text editor.
      </div>

      <div class={tw("py-10 space-y-2")}>
        <div class={tw("font-bold text-xl")}>Code Editor</div>
        <CodeEditor />
      </div>
    </div>
  );
};
render(() => <Example />, document.body);
