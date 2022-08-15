import React from "react";
import { GetStaticProps, NextPage } from "next";
import Title from "../components/Title";
import Bio from "../components/Bio";
import Link from "next/link";
import { getAllPosts } from "../lib/blog";
import PostList from "../components/PostList";
import { generatedRss } from "../lib/rss";
import { PostListItemPost } from "../components/PostListItem";

type Props = {
  posts: PostListItemPost[];
};

const Home: NextPage<Props> = (props) => {
  return (
    <div>
      <Title />
      <Bio />
      <div style={{ marginTop: 10 }}>
        <Link href="/rss.xml">RSS</Link>
      </div>
      <PostList posts={props.posts} />
    </div>
  );
};

export default Home;

export const getStaticProps: GetStaticProps<Props, {}> = async ({}) => {
  await generatedRss();
  const posts = getAllPosts({});
  return {
    props: {
      posts: posts.map((post) => PostListItemPost(post)),
    },
  };
};
