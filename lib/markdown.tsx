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
import * as path from "path";
import { toText } from "hast-util-to-text";
import haskell from "highlight.js/lib/languages/haskell";
import scala from "highlight.js/lib/languages/scala";
import ocaml from "highlight.js/lib/languages/ocaml";
import { toHtml } from "hast-util-to-html";
import remarkGfm from "remark-gfm";

function markdownProcessor(): Processor<
  Mdast.Root,
  Mdast.Root,
  Mdast.Root,
  void
> {
  return unified()
    .use(remarkParse)
    .use(remarkBreaks)
    .use(remarkGfm)
    .use(emoji)
    .use(remarkMath);
}

function rehypeProcessor(): Processor<Mdast.Root, Hast.Root, Hast.Root, void> {
  return markdownProcessor()
    .use(remarkRehype)
    .use(rehypeHighlight, { languages: { haskell, scala, ocaml } })
    .use(rehypeKatex);
}

function MdLink({ href, children }: { href: string; children: JSX.Element }) {
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
  const markdownContext = React.useContext(MarkdownContext);
  if (markdownContext === null) {
    throw new Error("MarkdownContext is null");
  }

  const { basedir, context } = markdownContext;

  return (
    <Image
      src={
        src.startsWith("https://") ||
        src.startsWith("http://") ||
        src.startsWith("//")
          ? src
          : context("./" + path.join(basedir, src))
      }
      alt={alt}
    />
  );
}

function reactProcessor() {
  return rehypeProcessor().use(rehypeReact, {
    createElement: React.createElement,
    components: {
      a: MdLink as any,
      img: MdImage as any,
    },
  });
}

const MarkdownContext = React.createContext<null | {
  basedir: string;
  context: __WebpackModuleApi.RequireContext;
}>(null);

export function Markdown(props: {
  basedir: string;
  context: __WebpackModuleApi.RequireContext;
  markdown: string;
}): JSX.Element {
  const element = reactProcessor().processSync(props.markdown).result;

  return (
    <MarkdownContext.Provider
      value={{
        basedir: props.basedir,
        context: props.context,
      }}
    >
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
  return rehypeProcessor().use(rehypeToString).processSync(markdown)
    .value as any;
}

export function markdownToHtml(markdown: string): string {
  return rehypeProcessor().use(rehypeToHtml).processSync(markdown).value as any;
}
