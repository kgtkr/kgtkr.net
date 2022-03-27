import fs from "fs/promises";
import RSS from "rss";
import { getAllPosts, postToPath } from "./blog";
import { markdownToHtml } from "./markdown";

export async function generatedRss(): Promise<void> {
  const origin = "https://kgtkr.net";
  const date = new Date();

  const feed = new RSS({
    title: "Tkr Blog",
    description: "Tkr Blog",
    feed_url: `${origin}/rss.xml`,
    site_url: origin,
    language: "ja",
    copyright: `All rights reserved ${date.getFullYear()}, kgtkr`,
    pubDate: date,
    image_url: `${origin}/images/profile.png`,
    managingEditor: "kgtkr",
    webMaster: "kgtkr",
  });

  const posts = getAllPosts({});

  posts.forEach((post) => {
    const url = `${origin}${postToPath(post)}`;
    feed.item({
      title: post.matter.title,
      url,
      description: markdownToHtml(post.markdown),
      date: new Date(post.matter.date),
      guid: url,
      author: "kgtkr",
    });
  });

  await fs.writeFile("./public/rss.xml", feed.xml());
}
