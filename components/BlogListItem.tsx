import Link from "next/link";
import React from "react";
import { Blog, blogToPath } from "../lib/blog";
import { markdownToPlainText } from "../lib/markdown";
import styles from "./BlogListItem.module.scss";
import * as fns from "date-fns";

type Props = {
  blog: Blog;
};

function BlogListItem({ blog }: Props) {
  return (
    <div>
      <div className={styles.subject}>
        <Link href={blogToPath(blog)}>{blog.matter.title}</Link>
      </div>
      <div className={styles.createdAt}>
        {fns.format(new Date(blog.matter.date), "yyyy/MM/dd")}
      </div>
      <div className={styles.summary}>
        {markdownToPlainText(blog.markdown).substring(0, 480)}
      </div>
    </div>
  );
}

export default BlogListItem;
