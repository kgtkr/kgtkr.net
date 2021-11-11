import Link from "next/link";
import React from "react";
import { Blog, blogToPath } from "../lib/blog";

type Props = {
  blog: Blog;
};

function BlogListItem({ blog }: Props) {
  return (
    <div>
      <div>
        <Link href={blogToPath(blog)}>{blog.matter.title}</Link>
      </div>
    </div>
  );
}

export default BlogListItem;
