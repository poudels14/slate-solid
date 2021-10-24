import { createMemo, untrack } from "solid-js";
import { Text } from "slate";
import Prism from "prismjs";
import { tw, css } from "twind/css";

const decorator = ([node, path]: any) =>
  untrack(() => {
    // TODO: would it be possible to memo decorator?
    const ranges: any[] = [];
    if (!Text.isText(node)) {
      return ranges;
    }
    const tokens = Prism.tokenize(node.text, Prism.languages.js);
    let start = 0;

    for (const token of tokens) {
      const length = getLength(token);
      const end = start + length;

      if (typeof token !== "string") {
        ranges.push({
          [token.type]: true,
          anchor: { path, offset: start },
          focus: { path, offset: end },
        });
      }

      start = end;
    }
    return ranges;
  });

const Leaf = (props: any) => {
  const styles = createMemo(() => {
    const leaf = props.leaf;
    const c = [
      "font-family: monospace;",
      true,
      "color: #999;",
      leaf.comment || leaf.prolog || leaf.doctype || leaf.cdata,
      "color: #ff79c6;",
      leaf.property || leaf.tag || leaf.constant || leaf.symbol || leaf.deleted,
      "color: #f08d49;",
      leaf.function || leaf.boolean || leaf.number,
      "font-weight: bold;",
      leaf.important || leaf.bold,

      "color: #cc99cd;",
      leaf.atrule ||
        leaf.builtin ||
        leaf.important ||
        leaf.keyword ||
        leaf.selector,
      "color: #9a6e3a;",
      leaf.operator || leaf.url,
      "color: #f8f8f2;",
      leaf.punctuation,
      "color: #690;",
      leaf.string || leaf.char,
      "color: #7ec699; ",
      leaf["attr-value"] ||
        leaf.char ||
        leaf.regex ||
        leaf.string ||
        leaf.variable,
      "color: #f1fa8c;",
      leaf["class-name"],
      "color: #7eb6f6;",
      leaf["attr-name"],
    ]
      .filter((x, i, arr) => {
        return i % 2 === 0 && Boolean(arr[i + 1]);
      })
      .join(" ");
    return c;
  });
  return (
    <span
      {...props.attributes}
      data-leaf={JSON.stringify(props.leaf)}
      classList={{
        [tw(
          css`
            ${styles}
          `
        )]: true,
      }}
    >
      {props.children}
    </span>
  );
};

const getLength = (token: any) => {
  if (typeof token === "string") {
    return token.length;
  } else if (typeof token.content === "string") {
    return token.content.length;
  } else {
    return token.content.reduce((l: any, t: any) => l + getLength(t), 0);
  }
};

export { decorator, Leaf };
