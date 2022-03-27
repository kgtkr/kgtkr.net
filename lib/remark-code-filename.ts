// https://github.com/DSchau/gatsby-remark-code-titles/blob/master/src/index.js

import { visit } from "unist-util-visit";
import { Plugin } from "unified";
import { Root } from "mdast";

export const remarkCodeFilename: Plugin<[], Root, Root> = () => {
  return (tree) => {
    visit(tree, "code", (node, index, parent) => {
      const [language, filename] = (node.lang ?? "").split(":");

      if (filename !== undefined) {
        const filenameNode = {
          type: "html" as const,
          value: '<div class="remark-code-filename">${filename}</div>',
        };

        if (parent !== null && index !== null) {
          parent.children.splice(index, 0, filenameNode);
        }
      }

      if (language) {
        node.lang = language;
      } else {
        node.lang = undefined;
      }
    });

    return tree;
  };
};
