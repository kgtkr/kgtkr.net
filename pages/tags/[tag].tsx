import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Link from "next/link";
import React from "react";
import PostList from "../../components/PostList";
import { PostListItemPost } from "../../components/PostListItem";
import Title from "../../components/Title";
import { Post, getAllTags, getAllPosts } from "../../lib/blog";

type Props = {
  posts: PostListItemPost[];
  tag: string;
};

const Tags: NextPage<Props> = (props) => {
  return (
    <div>
      <Title title={`${props.tag} | Tags`} />
      <h2>Posts about &quot;{props.tag}&quot;</h2>
      <Link href="/tags">All tags</Link>
      <PostList posts={props.posts} />
    </div>
  );
};

export default Tags;

export const getStaticPaths: GetStaticPaths = async () => {
  const tags = getAllTags();
  return {
    paths: tags.map((tag) => `/tags/${tag.name}`),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, { tag: string }> = async ({
  params,
}) => {
  const posts = getAllPosts({});
  const filteredPosts = posts
    .filter((post) => post.matter.tags.includes(params!.tag))
    .map((post) => PostListItemPost(post));
  return {
    props: {
      posts: filteredPosts,
      tag: params!.tag,
    },
  };
};
