import {
  Editor,
  Node,
  Path,
  Point,
  Range,
  Transforms,
  BaseEditor,
  Descendant,
} from "slate";

import { Key } from "../utils/key";
import {
  EDITOR_TO_ELEMENT,
  ELEMENT_TO_NODE,
  IS_FOCUSED,
  IS_READ_ONLY,
  NODE_TO_KEY,
  EDITOR_TO_WINDOW,
  EDITOR_TO_KEY_TO_ELEMENT,
  NODE_TO_PATH,
} from "../utils/weak-maps";
import {
  DOMElement,
  DOMNode,
  DOMPoint,
  DOMRange,
  DOMSelection,
  DOMStaticRange,
  isDOMElement,
  isDOMSelection,
  normalizeDOMPoint,
  hasShadowRoot,
} from "../utils/dom";
import { IS_CHROME, IS_FIREFOX } from "../utils/environment";
import { SetStoreFunction } from "solid-js/store";
import { Store } from "solid-store";

export interface SolidEditor extends BaseEditor {
  children: Store<Descendant[]>;
  insertData: (data: DataTransfer) => void;
  setFragmentData: (data: DataTransfer) => void;
  hasRange: (editor: SolidEditor, range: Range) => boolean;
}

export const SolidEditor = {
  /**
   * Return the host window of the current editor.
   */

  getWindow(editor: SolidEditor): Window {
    const window = EDITOR_TO_WINDOW.get(editor);
    if (!window) {
      throw new Error("Unable to find a host window element for this editor");
    }
    return window;
  },

  /**
   * Find a key for a Slate node.
   */

  findKey(editor: SolidEditor, node: Node): Key {
    let key = NODE_TO_KEY.get(node);

    if (!key) {
      key = new Key();
      NODE_TO_KEY.set(node, key);
    }

    return key;
  },

  /**
   * Find the path of Slate node.
   */

  findPath(editor: SolidEditor, node: Node): Path {
    const p = NODE_TO_PATH.get(node)!;
    if (!p) {
      if (Editor.isEditor(node)) {
        return [];
      } else {
        throw new Error(
          `Unable to find the path for Slate node: ${JSON.stringify(node)}`
        );
      }
    }

    return p;
  },

  /**
   * Find the DOM node that implements DocumentOrShadowRoot for the editor.
   */

  findDocumentOrShadowRoot(editor: SolidEditor): Document | ShadowRoot {
    const el = SolidEditor.toDOMNode(editor, editor);
    const root = el.getRootNode();

    if (
      (root instanceof Document || root instanceof ShadowRoot) &&
      // @ts-ignore
      root.getSelection != null
    ) {
      return root;
    }

    return el.ownerDocument;
  },

  /**
   * Check if the editor is focused.
   */

  isFocused(editor: SolidEditor): boolean {
    return !!IS_FOCUSED.get(editor);
  },

  /**
   * Check if the editor is in read-only mode.
   */

  isReadOnly(editor: SolidEditor): boolean {
    return !!IS_READ_ONLY.get(editor);
  },

  /**
   * Blur the editor.
   */

  blur(editor: SolidEditor): void {
    const el = SolidEditor.toDOMNode(editor, editor);
    const root = SolidEditor.findDocumentOrShadowRoot(editor);
    IS_FOCUSED.set(editor, false);

    if (root.activeElement === el) {
      el.blur();
    }
  },

  /**
   * Focus the editor.
   */

  focus(editor: SolidEditor): void {
    const el = SolidEditor.toDOMNode(editor, editor);
    const root = SolidEditor.findDocumentOrShadowRoot(editor);
    IS_FOCUSED.set(editor, true);

    if (root.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  },

  /**
   * Deselect the editor.
   */

  deselect(editor: SolidEditor): void {
    // const el = SolidEditor.toDOMNode(editor, editor);
    const { selection } = editor;
    const root = SolidEditor.findDocumentOrShadowRoot(editor);
    // @ts-ignore
    const domSelection = root.getSelection();

    if (domSelection && domSelection.rangeCount > 0) {
      domSelection.removeAllRanges();
    }

    if (selection) {
      Transforms.deselect(editor);
    }
  },

  /**
   * Check if a DOM node is within the editor.
   */

  hasDOMNode(
    editor: SolidEditor,
    target: DOMNode,
    options: { editable?: boolean } = {}
  ): boolean {
    const { editable = false } = options;
    const editorEl = SolidEditor.toDOMNode(editor, editor);
    let targetEl;

    // COMPAT: In Firefox, reading `target.nodeType` will throw an error if
    // target is originating from an internal "restricted" element (e.g. a
    // stepper arrow on a number input). (2018/05/04)
    // https://github.com/ianstormtaylor/slate/issues/1819
    try {
      targetEl = (
        isDOMElement(target) ? target : target.parentElement
      ) as HTMLElement;
    } catch (err) {
      if (
        // @ts-ignore
        !err.message.includes('Permission denied to access property "nodeType"')
      ) {
        throw err;
      }
    }

    if (!targetEl) {
      return false;
    }

    return (
      targetEl.closest(`[data-slate-editor]`) === editorEl &&
      (!editable ||
        targetEl.isContentEditable ||
        !!targetEl.getAttribute("data-slate-zero-width"))
    );
  },

  /**
   * Insert data from a `DataTransfer` into the editor.
   */

  insertData(editor: SolidEditor, data: DataTransfer): void {
    editor.insertData(data);
  },

  /**
   * Sets data from the currently selected fragment on a `DataTransfer`.
   */

  setFragmentData(editor: SolidEditor, data: DataTransfer): void {
    editor.setFragmentData(data);
  },

  /**
   * Find the native DOM element from a Slate node.
   */

  toDOMNode(editor: SolidEditor, node: Node): HTMLElement {
    const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
    const domNode = Editor.isEditor(node)
      ? EDITOR_TO_ELEMENT.get(editor)
      : KEY_TO_ELEMENT?.get(SolidEditor.findKey(editor, node));

    if (!domNode) {
      throw new Error(
        `Cannot resolve a DOM node from Slate node: ${JSON.stringify(node)}`
      );
    }

    return domNode;
  },

  /**
   * Find a native DOM selection point from a Slate point.
   */

  toDOMPoint(editor: SolidEditor, point: Point): DOMPoint {
    const [node] = Editor.node(editor, point.path);
    const el = SolidEditor.toDOMNode(editor, node);
    let domPoint: DOMPoint | undefined;

    // If we're inside a void node, force the offset to 0, otherwise the zero
    // width spacing character will result in an incorrect offset of 1
    if (Editor.void(editor, { at: point })) {
      point = { path: point.path, offset: 0 };
    }

    // For each leaf, we need to isolate its content, which means filtering
    // to its direct text and zero-width spans. (We have to filter out any
    // other siblings that may have been rendered alongside them.)
    const selector = `[data-slate-string], [data-slate-zero-width]`;
    const texts = Array.from(el.querySelectorAll(selector));
    let start = 0;

    for (const text of texts) {
      const domNode = text.childNodes[0] as HTMLElement;

      if (domNode == null || domNode.textContent == null) {
        continue;
      }

      const { length } = domNode.textContent;
      const attr = text.getAttribute("data-slate-length");
      const trueLength = attr == null ? length : parseInt(attr, 10);
      const end = start + trueLength;

      if (point.offset <= end) {
        const offset = Math.min(length, Math.max(0, point.offset - start));
        domPoint = [domNode, offset];
        break;
      }

      start = end;
    }

    if (!domPoint) {
      throw new Error(
        `Cannot resolve a DOM point from Slate point: ${JSON.stringify(point)}`
      );
    }

    return domPoint;
  },

  /**
   * Find a native DOM range from a Slate `range`.
   *
   * Notice: the returned range will always be ordinal regardless of the direction of Slate `range` due to DOM API limit.
   *
   * there is no way to create a reverse DOM Range using Range.setStart/setEnd
   * according to https://dom.spec.whatwg.org/#concept-range-bp-set.
   */

  toDOMRange(editor: SolidEditor, range: Range): DOMRange {
    const { anchor, focus } = range;
    const isBackward = Range.isBackward(range);
    const domAnchor = SolidEditor.toDOMPoint(editor, anchor);
    const domFocus = Range.isCollapsed(range)
      ? domAnchor
      : SolidEditor.toDOMPoint(editor, focus);

    const window = SolidEditor.getWindow(editor);
    const domRange = window.document.createRange();
    const [startNode, startOffset] = isBackward ? domFocus : domAnchor;
    const [endNode, endOffset] = isBackward ? domAnchor : domFocus;

    // A slate Point at zero-width Leaf always has an offset of 0 but a native DOM selection at
    // zero-width node has an offset of 1 so we have to check if we are in a zero-width node and
    // adjust the offset accordingly.
    const startEl = (
      isDOMElement(startNode) ? startNode : startNode.parentElement
    ) as HTMLElement;
    const isStartAtZeroWidth = !!startEl.getAttribute("data-slate-zero-width");
    const endEl = (
      isDOMElement(endNode) ? endNode : endNode.parentElement
    ) as HTMLElement;
    const isEndAtZeroWidth = !!endEl.getAttribute("data-slate-zero-width");

    domRange.setStart(startNode, isStartAtZeroWidth ? 1 : startOffset);
    domRange.setEnd(endNode, isEndAtZeroWidth ? 1 : endOffset);
    return domRange;
  },

  /**
   * Find a Slate node from a native DOM `element`.
   */

  toSlateNode(editor: SolidEditor, domNode: DOMNode): Node {
    let domEl = isDOMElement(domNode) ? domNode : domNode.parentElement;

    if (domEl && !domEl.hasAttribute("data-slate-node")) {
      domEl = domEl.closest(`[data-slate-node]`);
    }

    const node = domEl ? ELEMENT_TO_NODE.get(domEl as HTMLElement) : null;

    if (!node) {
      throw new Error(`Cannot resolve a Slate node from DOM node: ${domEl}`);
    }

    return node;
  },

  /**
   * Get the target range from a DOM `event`.
   */

  findEventRange(editor: SolidEditor, event: any): Range {
    const { clientX: x, clientY: y, target } = event;

    if (x == null || y == null) {
      throw new Error(
        `Cannot resolve a Slate range from a DOM event: ${event}`
      );
    }

    const node = SolidEditor.toSlateNode(editor, event.target);
    const path = SolidEditor.findPath(editor, node);

    // If the drop target is inside a void node, move it into either the
    // next or previous node, depending on which side the `x` and `y`
    // coordinates are closest to.
    if (Editor.isVoid(editor, node)) {
      const rect = target.getBoundingClientRect();
      const isPrev = editor.isInline(node)
        ? x - rect.left < rect.left + rect.width - x
        : y - rect.top < rect.top + rect.height - y;

      const edge = Editor.point(editor, path, {
        edge: isPrev ? "start" : "end",
      });
      const point = isPrev
        ? Editor.before(editor, edge)
        : Editor.after(editor, edge);

      if (point) {
        const range = Editor.range(editor, point);
        return range;
      }
    }

    // Else resolve a range from the caret position where the drop occured.
    let domRange;
    const { document } = window;

    // COMPAT: In Firefox, `caretRangeFromPoint` doesn't exist. (2016/07/25)
    if (document.caretRangeFromPoint) {
      domRange = document.caretRangeFromPoint(x, y);
    } else {
      // @ts-ignore
      const position = document.caretPositionFromPoint(x, y);

      if (position) {
        domRange = document.createRange();
        domRange.setStart(position.offsetNode, position.offset);
        domRange.setEnd(position.offsetNode, position.offset);
      }
    }

    if (!domRange) {
      throw new Error(
        `Cannot resolve a Slate range from a DOM event: ${event}`
      );
    }

    // Resolve a Slate range from the DOM range.
    const range = SolidEditor.toSlateRange(editor, domRange, {
      exactMatch: false,
      suppressThrow: false,
    });
    return range;
  },

  /**
   * Find a Slate point from a DOM selection's `domNode` and `domOffset`.
   */

  toSlatePoint<T extends boolean>(
    editor: SolidEditor,
    domPoint: DOMPoint,
    options: {
      exactMatch: T;
      suppressThrow: T;
    }
  ): T extends true ? Point | null : Point {
    const { exactMatch, suppressThrow } = options;
    const [nearestNode, nearestOffset] = exactMatch
      ? domPoint
      : normalizeDOMPoint(domPoint);
    const parentNode = nearestNode.parentNode as DOMElement;
    let textNode: DOMElement | null = null;
    let offset = 0;

    if (parentNode) {
      const voidNode = parentNode.closest('[data-slate-void="true"]');
      let leafNode = parentNode.closest("[data-slate-leaf]");
      let domNode: DOMElement | null = null;

      // Calculate how far into the text node the `nearestNode` is, so that we
      // can determine what the offset relative to the text node is.
      if (leafNode) {
        textNode = leafNode.closest('[data-slate-node="text"]')!;
        const window = SolidEditor.getWindow(editor);
        const range = window.document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(nearestNode, nearestOffset);

        const contents = range.cloneContents();
        const removals = [
          ...Array.prototype.slice.call(
            contents.querySelectorAll("[data-slate-zero-width]")
          ),
          ...Array.prototype.slice.call(
            contents.querySelectorAll("[contenteditable=false]")
          ),
        ];

        removals.forEach((el) => {
          el!.parentNode!.removeChild(el);
        });

        // COMPAT: Edge has a bug where Range.prototype.toString() will
        // convert \n into \r\n. The bug causes a loop when slate-react
        // attempts to reposition its cursor to match the native position. Use
        // textContent.length instead.
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10291116/
        offset = contents.textContent!.length;
        domNode = textNode;
      } else if (voidNode) {
        // For void nodes, the element with the offset key will be a cousin, not an
        // ancestor, so find it by going down from the nearest void parent.
        leafNode = voidNode.querySelector("[data-slate-leaf]")!;

        // COMPAT: In read-only editors the leaf is not rendered.
        if (!leafNode) {
          offset = 1;
        } else {
          textNode = leafNode.closest('[data-slate-node="text"]')!;
          domNode = leafNode;
          offset = domNode.textContent!.length;
          domNode.querySelectorAll("[data-slate-zero-width]").forEach((el) => {
            offset -= el.textContent!.length;
          });
        }
      }

      if (
        domNode &&
        offset === domNode.textContent!.length &&
        // COMPAT: If the parent node is a Slate zero-width space, editor is
        // because the text node should have no characters. However, during IME
        // composition the ASCII characters will be prepended to the zero-width
        // space, so subtract 1 from the offset to account for the zero-width
        // space character.
        (parentNode.hasAttribute("data-slate-zero-width") ||
          // COMPAT: In Firefox, `range.cloneContents()` returns an extra trailing '\n'
          // when the document ends with a new-line character. This results in the offset
          // length being off by one, so we need to subtract one to account for this.
          (IS_FIREFOX && domNode.textContent?.endsWith("\n\n")))
      ) {
        offset--;
      }
    }

    if (!textNode) {
      if (suppressThrow) {
        return null as T extends true ? Point | null : Point;
      }
      throw new Error(
        `Cannot resolve a Slate point from DOM point: ${domPoint}`
      );
    }

    // COMPAT: If someone is clicking from one Slate editor into another,
    // the select event fires twice, once for the old editor's `element`
    // first, and then afterwards for the correct `element`. (2017/03/03)
    const slateNode = SolidEditor.toSlateNode(editor, textNode!);

    const path = SolidEditor.findPath(editor, slateNode);
    return { path, offset } as T extends true ? Point | null : Point;
  },

  /**
   * Find a Slate range from a DOM range or selection.
   */

  toSlateRange<T extends boolean>(
    editor: SolidEditor,
    domRange: DOMRange | DOMStaticRange | DOMSelection,
    options: {
      exactMatch: T;
      suppressThrow: T;
    }
  ): T extends true ? Range | null : Range {
    const { exactMatch, suppressThrow } = options;
    const el = isDOMSelection(domRange)
      ? domRange.anchorNode
      : domRange.startContainer;
    let anchorNode;
    let anchorOffset;
    let focusNode;
    let focusOffset;
    let isCollapsed;

    if (el) {
      if (isDOMSelection(domRange)) {
        anchorNode = domRange.anchorNode;
        anchorOffset = domRange.anchorOffset;
        focusNode = domRange.focusNode;
        focusOffset = domRange.focusOffset;
        // COMPAT: There's a bug in chrome that always returns `true` for
        // `isCollapsed` for a Selection that comes from a ShadowRoot.
        // (2020/08/08)
        // https://bugs.chromium.org/p/chromium/issues/detail?id=447523
        if (IS_CHROME && hasShadowRoot()) {
          isCollapsed =
            domRange.anchorNode === domRange.focusNode &&
            domRange.anchorOffset === domRange.focusOffset;
        } else {
          isCollapsed = domRange.isCollapsed;
        }
      } else {
        anchorNode = domRange.startContainer;
        anchorOffset = domRange.startOffset;
        focusNode = domRange.endContainer;
        focusOffset = domRange.endOffset;
        isCollapsed = domRange.collapsed;
      }
    }

    if (
      anchorNode == null ||
      focusNode == null ||
      anchorOffset == null ||
      focusOffset == null
    ) {
      throw new Error(
        `Cannot resolve a Slate range from DOM range: ${domRange}`
      );
    }

    const anchor = SolidEditor.toSlatePoint(
      editor,
      [anchorNode, anchorOffset],
      { exactMatch, suppressThrow }
    );
    if (!anchor) {
      return null as T extends true ? Range | null : Range;
    }

    const focus = isCollapsed
      ? anchor
      : SolidEditor.toSlatePoint(editor, [focusNode, focusOffset], {
          exactMatch,
          suppressThrow,
        });
    if (!focus) {
      return null as T extends true ? Range | null : Range;
    }

    let range: Range = { anchor: anchor as Point, focus: focus as Point };
    // if the selection is a hanging range that ends in a void
    // and the DOM focus is an Element
    // (meaning that the selection ends before the element)
    // unhang the range to avoid mistakenly including the void
    if (
      Range.isExpanded(range) &&
      Range.isForward(range) &&
      isDOMElement(focusNode) &&
      Editor.void(editor, { at: range.focus, mode: "highest" })
    ) {
      range = Editor.unhangRange(editor, range, { voids: true });
    }

    return range as unknown as T extends true ? Range | null : Range;
  },

  hasRange(editor: SolidEditor, range: Range): boolean {
    const { anchor, focus } = range;
    return (
      Editor.hasPath(editor, anchor.path) && Editor.hasPath(editor, focus.path)
    );
  },
};
