import { unified, Processor } from "unified";
import remarkRehype from "remark-rehype";
import remarkParse from "remark-parse";
import emoji from "remark-emoji";
import { remarkCodeFilename } from "./remark-code-filename";
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

function markdownProcessor(): Processor<
  Mdast.Root,
  Mdast.Root,
  Mdast.Root,
  void
> {
  return unified()
    .use(remarkParse)
    .use(remarkBreaks)
    .use(remarkCodeFilename)
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
    <Link href={href}>{children}</Link>
  );
}

function mkMdImage(
  basedir: string,
  context: __WebpackModuleApi.RequireContext,
) {
  return function MdImage({ src, alt }: { src: string; alt: string }) {
    return <Image src={context(path.join(basedir, src))} alt={alt} />;
  };
}

function reactProcessor(
  basedir: string,
  context: __WebpackModuleApi.RequireContext,
) {
  return rehypeProcessor().use(rehypeReact, {
    createElement: React.createElement,
    components: {
      a: MdLink as any,
      img: mkMdImage(basedir, context) as any,
    },
  });
}

function rehypeToString(this: any) {
  Object.assign(this, { Compiler: compiler });

  function compiler(tree: Hast.Root) {
    return toText(tree);
  }
}

export function markdownToPlainText(markdown: string): string {
  return rehypeProcessor()
    .use(rehypeToString)
    .processSync(markdown).value as any;
}
