import Link from "next/link";
import React from "react";
import { Blog, blogToPath } from "../lib/blog";
import { markdownToPlainText } from "../lib/markdown";

type Props = {
  blog: Blog;
};

function BlogListItem({ blog }: Props) {
  return (
    <div>
      <h3>
        <Link href={blogToPath(blog)}>{blog.matter.title}</Link>
      </h3>
      <div>{markdownToPlainText(blog.markdown).substring(0, 140)}</div>
    </div>
  );
}

export default BlogListItem;
