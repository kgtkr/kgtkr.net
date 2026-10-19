import { unified, Processor } from "unified";
import remarkRehype from "remark-rehype";
import remarkParse from "remark-parse";
import emoji from "remark-emoji";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import * as Mdast from "mdast";
import * as Hast from "hast";
import rehypeReact from "rehype-react";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { toText } from "hast-util-to-text";
import haskell from "highlight.js/lib/languages/haskell";
import scala from "highlight.js/lib/languages/scala";
import ocaml from "highlight.js/lib/languages/ocaml";
import graphql from "highlight.js/lib/languages/graphql";
import { toHtml } from "hast-util-to-html";
import remarkGfm from "remark-gfm";
import * as prod from "react/jsx-runtime";
import Graphviz from "../components/Graphviz";

export type ImageMetadata = {
  src: string;
  width: number;
  height: number;
};

function markdownProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkBreaks)
    .use(remarkGfm)
    .use(emoji)
    .use(remarkMath);
}

function rehypeProcessor() {
  return markdownProcessor()
    .use(remarkRehype)
    .use(rehypeHighlight, {
      languages: { haskell, scala, ocaml, graphql },
      plainText: ["dot"],
    })
    .use(rehypeKatex);
}

function MdLink({
  href,
  children,
}: {
  href: string;
  children: React.JSX.Element;
}) {
  return href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("//") ? (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href}>
      <>{children}</>
    </Link>
  );
}

function MdImage({ src, alt }: { src: string; alt: string }) {
  const images = React.useContext(MarkdownContext);
  if (images === null) {
    throw new Error("MarkdownContext is null");
  }

  const normalized = src.replace(/^\.\//, "");
  const meta = images[normalized];
  if (!meta) {
    throw new Error(`Image not found: ${src}`);
  }

  return (
    <Image
      src={meta.src}
      width={meta.width}
      height={meta.height}
      alt={alt}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}

function MdPre({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  if (
    React.isValidElement(children) &&
    typeof children.props === "object" &&
    children.props !== null
  ) {
    const codeProps = children.props as Record<string, any>;
    const className: string = codeProps.className || "";
    const classes = className.split(" ");
    if (classes.includes("language-dot")) {
      const codeChildren = codeProps.children;
      const chart =
        typeof codeChildren === "string"
          ? codeChildren
          : Array.isArray(codeChildren)
          ? codeChildren.join("")
          : "";
      return <Graphviz dot={chart} />;
    }
  }
  return <pre {...props}>{children}</pre>;
}

function reactProcessor() {
  return rehypeProcessor().use(rehypeReact, {
    Fragment: prod.Fragment,
    jsx: prod.jsx,
    jsxs: prod.jsxs,
    components: {
      a: MdLink as any,
      img: MdImage as any,
      pre: MdPre as any,
    },
  });
}

const MarkdownContext = React.createContext<null | Record<
  string,
  ImageMetadata
>>(null);

export function Markdown(props: {
  images?: Record<string, ImageMetadata>;
  markdown: string;
}): React.JSX.Element {
  const element = reactProcessor().processSync(props.markdown).result;

  return (
    <MarkdownContext.Provider value={props.images ?? {}}>
      {element}
    </MarkdownContext.Provider>
  );
}

function rehypeToString(this: any) {
  Object.assign(this, { Compiler: compiler });

  function compiler(tree: Hast.Root) {
    return toText(tree);
  }
}

function rehypeToHtml(this: any) {
  Object.assign(this, { Compiler: compiler });

  function compiler(tree: Hast.Root) {
    return toHtml(tree);
  }
}

export function markdownToPlainText(markdown: string): string {
  return rehypeProcessor().use(rehypeToString).processSync(markdown).toString();
}

export function markdownToHtml(markdown: string): string {
  return rehypeProcessor().use(rehypeToHtml).processSync(markdown).toString();
}
