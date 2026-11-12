import * as Hast from "hast";

function visitElements(
  node: Hast.Nodes | Hast.RootContent,
  callback: (node: Hast.Element, parent?: Hast.Element) => void,
  parent?: Hast.Element,
) {
  if (node.type === "element") {
    callback(node as Hast.Element, parent);
    for (const child of (node as Hast.Element).children) {
      visitElements(child, callback, node as Hast.Element);
    }
  } else if ("children" in node && Array.isArray((node as any).children)) {
    for (const child of (node as any).children) {
      visitElements(child, callback, parent);
    }
  }
}

function splitLines(nodes: Hast.ElementContent[]): Hast.ElementContent[][] {
  const lines: Hast.ElementContent[][] = [[]];

  function append(node: Hast.ElementContent) {
    lines[lines.length - 1].push(node);
  }

  function process(node: Hast.ElementContent) {
    if (node.type === "text") {
      const parts = node.value.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([]);
        if (parts[i].length > 0) {
          append({ type: "text", value: parts[i] });
        }
      }
    } else if (node.type === "element") {
      const childLines = splitLines(node.children as Hast.ElementContent[]);
      for (let i = 0; i < childLines.length; i++) {
        if (i > 0) lines.push([]);
        if (childLines[i].length > 0) {
          append({
            ...node,
            children: childLines[i],
          });
        }
      }
    } else {
      append(node);
    }
  }

  for (const node of nodes) {
    process(node);
  }

  return lines;
}

function getLineText(nodes: Hast.ElementContent[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.type === "text") {
      text += node.value;
    } else if (node.type === "element") {
      text += getLineText(node.children as Hast.ElementContent[]);
    }
  }
  return text;
}

export function rehypeDiffPre() {
  return (tree: Hast.Root) => {
    visitElements(tree, (node, parent) => {
      if (node.tagName !== "code" || !parent || parent.tagName !== "pre") return;
      const classNames = node.properties?.className;
      if (!Array.isArray(classNames)) return;
      for (let i = 0; i < classNames.length; i++) {
        const cls = String(classNames[i]);
        const match = cls.match(/^(?:language|lang)-diff(?::([a-zA-Z0-9_-]+))?$/);
        if (match) {
          node.properties = node.properties || {};
          node.properties["data-is-diff"] = "true";
          parent.properties = parent.properties || {};
          const parentClasses = Array.isArray(parent.properties.className)
            ? (parent.properties.className as string[])
            : [];
          if (!parentClasses.includes("diff-code")) {
            parentClasses.push("diff-code");
          }
          parent.properties.className = parentClasses;
          if (match[1]) {
            classNames[i] = "language-" + match[1];
          }
        }
      }
    });
  };
}

export function rehypeDiffPost() {
  return (tree: Hast.Root) => {
    visitElements(tree, (node) => {
      if (node.tagName !== "code" || !node.properties?.["data-is-diff"]) return;
      delete node.properties["data-is-diff"];
      const rawLines = splitLines(node.children as Hast.ElementContent[]);
      if (rawLines.length > 1 && rawLines[rawLines.length - 1].length === 0) {
        rawLines.pop();
      }
      const newChildren: Hast.ElementContent[] = [];
      for (const line of rawLines) {
        const lineText = getLineText(line);
        const classes = ["diff-line"];
        if (lineText.startsWith("+")) {
          classes.push("diff-add");
        } else if (lineText.startsWith("-")) {
          classes.push("diff-remove");
        }
        newChildren.push({
          type: "element",
          tagName: "span",
          properties: { className: classes },
          children: line.length > 0 ? line : [{ type: "text", value: " " }],
        });
      }
      node.children = newChildren;
    });
  };
}
