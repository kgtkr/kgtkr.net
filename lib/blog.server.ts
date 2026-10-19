import matter from "gray-matter";
import * as A from "fp-ts/Array";
import { identity, pipe } from "fp-ts/function";
import * as NA from "fp-ts/NonEmptyArray";
import * as R from "fp-ts/Record";
import * as fs from "fs/promises";
import * as path from "path";
import { imageSizeFromFile } from "image-size/fromFile";
import { PostListItemPost } from "../components/PostListItem";
import {
  formatDate,
  Matter,
  Post,
  PostOrd,
  postToPath,
  Tag,
  TagOrd,
} from "./blog";
import { ImageMetadata, markdownToPlainText } from "./markdown";

export function toPostListItemPost(post: Post): PostListItemPost {
  return {
    title: post.matter.title,
    date: formatDate(post.matter.date),
    summary: markdownToPlainText(post.markdown).substring(0, 480),
    path: postToPath(post),
  };
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);

let allPostsPromise: Promise<Post[]> | null = null;

async function loadAllPosts(): Promise<Post[]> {
  const postsDir = path.join(process.cwd(), "posts");
  const publicImagesDir = path.join(process.cwd(), "public", "post-images");
  const entries = await fs.readdir(postsDir, { recursive: true });

  const mdFiles: string[] = [];
  const imageFilesByDir = new Map<string, string[]>();

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (ext === ".md") {
      mdFiles.push(entry);
    } else if (IMAGE_EXTENSIONS.has(ext)) {
      const dir = path.dirname(entry);
      const list = imageFilesByDir.get(dir) ?? [];
      list.push(entry);
      imageFilesByDir.set(dir, list);
    }
  }

  const imagesByDir = new Map<string, Record<string, ImageMetadata>>();

  await Promise.all(
    Array.from(imageFilesByDir.entries()).map(async ([dir, files]) => {
      const destDir = path.join(publicImagesDir, dir);
      await fs.mkdir(destDir, { recursive: true });

      const dirImages: Record<string, ImageMetadata> = {};
      await Promise.all(
        files.map(async (relPath) => {
          const srcPath = path.join(postsDir, relPath);
          const destPath = path.join(publicImagesDir, relPath);
          const [dimensions] = await Promise.all([
            imageSizeFromFile(srcPath),
            fs.copyFile(srcPath, destPath),
          ]);
          if (
            dimensions.width === undefined ||
            dimensions.height === undefined
          ) {
            throw new Error(`Failed to get dimensions for image: ${relPath}`);
          }
          const fileName = path.basename(relPath);
          const urlPath = "/post-images/" + relPath.split(path.sep).join("/");
          dirImages[fileName] = {
            src: urlPath,
            width: dimensions.width,
            height: dimensions.height,
          };
        }),
      );
      imagesByDir.set(dir, dirImages);
    }),
  );

  const posts = await Promise.all(
    mdFiles.map(async (relPath): Promise<Post> => {
      const fullPath = path.join(postsDir, relPath);
      const raw = await fs.readFile(fullPath, "utf-8");
      const { data, content } = matter(raw);
      const dir = path.dirname(relPath);
      return {
        matter: Matter.parse(data),
        markdown: content,
        images: imagesByDir.get(dir) ?? {},
      };
    }),
  );

  return pipe(posts, A.sort(PostOrd));
}

export async function getAllPosts({
  includePrivate = false,
}: {
  includePrivate?: boolean;
}): Promise<Post[]> {
  if (allPostsPromise === null) {
    allPostsPromise = loadAllPosts();
  }
  const posts = await allPostsPromise;
  return posts.filter((post) => includePrivate || !post.matter.private);
}

let allTagsPromise: Promise<Tag[]> | null = null;

export async function getAllTags(): Promise<Tag[]> {
  if (allTagsPromise === null) {
    allTagsPromise = (async () => {
      const posts = await getAllPosts({});
      return pipe(
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
    })();
  }
  return allTagsPromise;
}
