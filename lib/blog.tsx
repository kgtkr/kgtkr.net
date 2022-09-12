import matter from "gray-matter";
import { z } from "zod";
import * as N from "fp-ts/number";
import * as Ord from "fp-ts/Ord";
import { identity, pipe } from "fp-ts/function";
import * as A from "fp-ts/Array";
import * as S from "fp-ts/string";
import * as NA from "fp-ts/NonEmptyArray";
import * as R from "fp-ts/Record";
import * as path from "path";
import { Markdown } from "./markdown";

const postContext = require.context("../posts", true);

const defaultLang = "ja";

const Lang = z.enum(["en", "ja"]);

const Matter = z
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
  basedir: string;
};

const PostOrd = Ord.contramap((x: Post) => new Date(x.matter.date).valueOf())(
  Ord.reverse(N.Ord),
);

let allPosts: Post[] | null = null;

export function Content({ post }: { post: Post }): JSX.Element {
  return (
    <Markdown
      context={postContext}
      basedir={post.basedir}
      markdown={post.markdown}
    />
  );
}

export function getAllPosts({
  includePrivate = false,
}: {
  includePrivate?: boolean;
}): Post[] {
  if (allPosts === null) {
    const keys = postContext.keys().filter((x) => x.endsWith(".md"));
    allPosts = pipe(
      keys,
      A.map((key) => {
        const { data, content } = matter(postContext(key).default);
        return {
          matter: Matter.parse(data),
          markdown: content,
          basedir: path.dirname(key),
        };
      }),
      A.sort(PostOrd),
    );
  }

  return allPosts.filter((post) => includePrivate || !post.matter.private);
}

export type Tag = {
  name: string;
  count: number;
};

const TagOrd: Ord.Ord<Tag> = Ord.contramap(
  (tag: Tag) => [tag.count, tag.name] as const,
)(Ord.tuple(Ord.reverse(N.Ord), S.Ord));

let allTags: Tag[] | null = null;

export function getAllTags(): Tag[] {
  if (allTags !== null) {
    return allTags;
  }

  const posts = getAllPosts({});

  allTags = pipe(
    posts,
    A.chain((blog) => blog.matter.tags),
    NA.groupBy(identity),
    R.map((arr) => arr.length),
    R.toArray,
    A.map(
      ([name, count]): Tag => ({
        name,
        count,
      }),
    ),
    A.sort(TagOrd),
  );

  return allTags;
}

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
