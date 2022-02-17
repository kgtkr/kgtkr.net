import { visit } from "unist-util-visit";
import { Plugin } from "unified";
import { Root, PhrasingContent } from "mdast";

export const remarkAutoLink: Plugin<[], Root, Root> = () => {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (
        parent === null ||
        index === null ||
        parent.type === "link" ||
        parent.type === "linkReference"
      ) {
        return;
      }

      const value = node.value;
      // https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
      const regexp =
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
      const result: PhrasingContent[] = [];

      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regexp.exec(value)) !== null) {
        const url = match[0];

        if (lastIndex !== match.index) {
          result.push({
            type: "text",
            value: value.substring(lastIndex, match.index),
          });
        }

        result.push({
          type: "link",
          url,
          children: [
            {
              type: "text",
              value: url,
            },
          ],
        });

        lastIndex = match.index + url.length;
      }

      if (lastIndex < value.length) {
        result.push({
          type: "text",
          value: value.substring(lastIndex),
        });
      }

      parent.children.splice(index, 1, ...result);
    });

    return tree;
  };
};
