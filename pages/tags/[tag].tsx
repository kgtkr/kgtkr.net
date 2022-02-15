import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Link from "next/link";
import React from "react";
import BlogListItem from "../../components/BlogListItem";
import Title from "../../components/Title";
import { Blog, blogsToTags, blogToPath, readBlogs } from "../../lib/blog";

type Props = {
  blogs: Blog[];
  tag: string;
};

const Tags: NextPage<Props> = props => {
  return (
    <div>
      <Title title={`${props.tag} | Tags`} />
      <h2>Posts about "{props.tag}"</h2>
      <Link href="/tags">All tags</Link>
      <div>
        {props.blogs.map(blog => (
          <BlogListItem blog={blog} key={blogToPath(blog)}></BlogListItem>
        ))}
      </div>
    </div>
  );
};

export default Tags;

export const getStaticPaths: GetStaticPaths = async () => {
  const blogs = readBlogs();
  const tags = blogsToTags(blogs);
  return {
    paths: tags.map(tag => `/tags/${tag.name}`),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, { tag: string }> = async ({
  params,
}) => {
  const blogs = readBlogs();
  const filteredBlogs = blogs.filter(blog =>
    blog.matter.tags.includes(params!.tag),
  );
  return {
    props: {
      blogs: filteredBlogs,
      tag: params!.tag,
    },
  };
};
