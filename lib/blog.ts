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

const postContext = require.context("../posts", true);

const defaultLang = "ja";

const Matter = z
  .object({
    title: z.string(),
    date: z.string(),
    update: z.string(),
    tags: z.array(z.string()).default([]),
    name: z.string(),
    lang: z.enum(["en", "ja"]).default(defaultLang),
    private: z.boolean().default(false),
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

export function readPosts(): Post[] {
  const keys = postContext.keys().filter(x => x.endsWith(".md"));

  return pipe(
    keys,
    A.map(key => {
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

export type Tag = {
  name: string;
  count: number;
};

const TagOrd: Ord.Ord<Tag> = Ord.contramap(
  (tag: Tag) => [tag.count, tag.name] as const,
)(Ord.tuple(Ord.reverse(N.Ord), S.Ord));

export function postsToTags(posts: Post[]): Tag[] {
  return pipe(
    posts,
    A.chain(blog => blog.matter.tags),
    NA.groupBy(identity),
    R.map(arr => arr.length),
    R.toArray,
    A.map(
      ([name, count]): Tag => ({
        name,
        count,
      }),
    ),
    A.sort(TagOrd),
  );
}

export function postToPath(post: Post): string {
  const date = new Date(post.matter.date);
  return `/blog/${date
    .getUTCFullYear()
    .toString()
    .padStart(4, "0")}/${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date
    .getDate()
    .toString()
    .padStart(2, "0")}/${post.matter.name}${
    post.matter.lang === defaultLang ? "" : `/${post.matter.lang}`
  }`;
}
