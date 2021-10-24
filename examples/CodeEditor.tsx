import { tw, css } from "twind/css";
import { createEditor } from "slate";
import {
  Leaf as CodeLeaf,
  decorator as codeDecorator,
} from "../src/renderers/code";
import {
  Slate,
  Editable,
  withSolid,
  buildDecorators,
  buildElementRenderers,
  buildLeafRenderers,
} from "../src";

const CodeEditor = () => {
  const [getDecorator] = buildDecorators({
    code: codeDecorator,
  });

  const editor = withSolid(createEditor());

  const [elementRenderer] = buildElementRenderers({
    "code-block": CodeBlock,
  });

  const [leafRenderer] = buildLeafRenderers({
    code: CodeLeaf,
  });

  const value = [
    {
      type: "code-block",
      children: [
        {
          children: [
            {
              type: "code",
              text: 'const log = (msg) => console.log("[log]:", msg);',
            },
          ],
        },
        {
          children: [
            {
              type: "code",
              text: "// single line comment",
            },
          ],
        },
        {
          children: [
            {
              type: "code",
              text: "const bool = false;",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div>
      <Slate editor={editor} value={value} onChange={(children: any) => {}}>
        <Editable
          getDecorator={getDecorator}
          leafRenderer={leafRenderer}
          elementRenderer={elementRenderer}
        />
      </Slate>
    </div>
  );
};

const CodeBlock = (props: any) => {
  return (
    <pre
      {...props.attributes}
      classList={{
        [tw`p-5 overflow-auto`]: true,
        [tw(
          css`
            color: #f8f8f2;
            background: #282c34;
          `
        )]: true,
      }}
      ref={props.ref}
    >
      {props.children}
    </pre>
  );
};

export default CodeEditor;
