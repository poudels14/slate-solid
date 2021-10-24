import scrollIntoView from "scroll-into-view-if-needed";
import { SolidEditor } from "..";
import { DOMRange } from "./dom";

/**
 * A default implement to scroll dom range into view.
 */
const defaultScrollSelectionIntoView = (
  editor: SolidEditor,
  domRange: DOMRange
) => {
  const leafEl = domRange.startContainer.parentElement!;
  leafEl.getBoundingClientRect = domRange.getBoundingClientRect.bind(domRange);
  scrollIntoView(leafEl, {
    scrollMode: "if-needed",
  });
  // @ts-ignore
  delete leafEl.getBoundingClientRect;
};

export { defaultScrollSelectionIntoView };
