import matter from "gray-matter";
import { z } from "zod";

const Matter = z
  .object({
    title: z.string(),
    date: z.string(),
    update: z.string(),
    tags: z.array(z.string()).default([]),
    name: z.string(),
    lang: z.enum(["en", "ja"]).default("ja"),
    otherLang: z.array(z.string()).default([]),
    private: z.boolean().default(false),
  })
  .strict();

export type Matter = z.infer<typeof Matter>;

export type Page = {
  matter: Matter;
  markdown: string;
};

export function readPages(): Page[] {
  const context = require.context("../blog", true, /\.md$/);
  const keys = context.keys();

  return keys.map((key) => {
    const { data, content } = matter(context(key).default);
    return {
      matter: Matter.parse(data),
      markdown: content,
    };
  });
}
