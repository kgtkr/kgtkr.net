import Link from "next/link";
import React from "react";
import styles from "./PostListItem.module.scss";

export type PostListItemPost = {
  title: string;
  date: string;
  summary: string;
  path: string;
};

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
