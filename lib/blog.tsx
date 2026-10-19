import React from "react";
import { z } from "zod";
import * as N from "fp-ts/number";
import * as Ord from "fp-ts/Ord";
import * as S from "fp-ts/string";
import { ImageMetadata, Markdown } from "./markdown";

const defaultLang = "ja";

const Lang = z.enum(["en", "ja"]);

export const Matter = z
  .object({
    title: z.string(),
    date: z.string(),
    update: z.string(),
    tags: z.array(z.string()).default([]),
    name: z.string(),
    lang: Lang.default(defaultLang),
    private: z.boolean().default(false),
    showPrivateMessage: z.boolean().default(true),
    otherLangs: z.array(Lang).default([]),
  })
  .strict();

export type Matter = z.infer<typeof Matter>;

export type Post = {
  matter: Matter;
  markdown: string;
  images: Record<string, ImageMetadata>;
};

export const PostOrd = Ord.contramap((x: Post) =>
  new Date(x.matter.date).valueOf(),
)(Ord.reverse(N.Ord));

export function Content({ post }: { post: Post }): React.JSX.Element {
  return <Markdown images={post.images} markdown={post.markdown} />;
}

export type Tag = {
  name: string;
  count: number;
};

export const TagOrd: Ord.Ord<Tag> = Ord.contramap(
  (tag: Tag) => [tag.count, tag.name] as const,
)(Ord.tuple(Ord.reverse(N.Ord), S.Ord));

export function postToPath(post: Post): string {
  const date = new Date(post.matter.date);
  return toPath({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    slug: post.matter.name,
    lang: post.matter.lang,
  });
}

export function toPath({
  year,
  month,
  day,
  slug,
  lang,
}: {
  year: number | string;
  month: number | string;
  day: number | string;
  slug: string;
  lang?: string;
}): string {
  return `/blog/${
    typeof year === "string" ? year : year.toString().padStart(4, "0")
  }/${typeof month === "string" ? month : month.toString().padStart(2, "0")}/${
    typeof day === "string" ? day : day.toString().padStart(2, "0")
  }/${slug}${lang === undefined || lang === defaultLang ? "" : `/${lang}`}`;
}

export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
