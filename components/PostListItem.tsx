import Link from "next/link";
import React from "react";
import { Post, postToPath } from "../lib/blog";
import { markdownToPlainText } from "../lib/markdown";
import styles from "./BlogListItem.module.scss";
import * as fns from "date-fns";

type Props = {
  post: Post;
};

function BlogListItem({ post }: Props) {
  return (
    <div>
      <div className={styles.subject}>
        <Link href={postToPath(post)}>{post.matter.title}</Link>
      </div>
      <div className={styles.createdAt}>
        {fns.format(new Date(post.matter.date), "yyyy/MM/dd")}
      </div>
      <div className={styles.summary}>
        {markdownToPlainText(post.markdown).substring(0, 480)}
      </div>
    </div>
  );
}

export default BlogListItem;
