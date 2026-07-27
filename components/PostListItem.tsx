import Link from "next/link";
import React from "react";
import { Post, postToPath, formatDate } from "../lib/blog";
import { markdownToPlainText } from "../lib/markdown";
import styles from "./PostListItem.module.scss";

export type PostListItemPost = {
  title: string;
  date: string;
  summary: string;
  path: string;
};

export function PostListItemPost(post: Post): PostListItemPost {
  return {
    title: post.matter.title,
    date: formatDate(post.matter.date),
    summary: markdownToPlainText(post.markdown).substring(0, 480),
    path: postToPath(post),
  };
}

export type Props = {
  post: PostListItemPost;
};

function PostListItem({ post }: Props) {
  return (
    <div>
      <div className={styles.subject}>
        <Link href={post.path}>{post.title}</Link>
      </div>
      <div className={styles.createdAt}>{post.date}</div>
      <div className={styles.summary}>{post.summary}</div>
    </div>
  );
}

export default PostListItem;
