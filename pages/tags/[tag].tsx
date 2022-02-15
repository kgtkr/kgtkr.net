import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Link from "next/link";
import React from "react";
import PostList from "../../components/PostList";
import Title from "../../components/Title";
import { Post, postsToTags, postToPath, readPosts } from "../../lib/blog";

type Props = {
  posts: Post[];
  tag: string;
};

const Tags: NextPage<Props> = props => {
  return (
    <div>
      <Title title={`${props.tag} | Tags`} />
      <h2>Posts about "{props.tag}"</h2>
      <Link href="/tags">All tags</Link>
      <PostList posts={props.posts} />
    </div>
  );
};

export default Tags;

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = readPosts();
  const tags = postsToTags(posts);
  return {
    paths: tags.map(tag => `/tags/${tag.name}`),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, { tag: string }> = async ({
  params,
}) => {
  const posts = readPosts();
  const filteredPosts = posts.filter(post =>
    post.matter.tags.includes(params!.tag),
  );
  return {
    props: {
      posts: filteredPosts,
      tag: params!.tag,
    },
  };
};
