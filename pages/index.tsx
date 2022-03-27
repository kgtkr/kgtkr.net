import React from "react";
import { GetStaticProps, NextPage } from "next";
import Title from "../components/Title";
import Bio from "../components/Bio";
import Link from "next/link";
import { getAllPosts, Post } from "../lib/blog";
import PostList from "../components/PostList";
import { generatedRss } from "../lib/rss";

type Props = {
  posts: Post[];
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
  const posts = getAllPosts();
  return {
    props: {
      posts: posts,
    },
  };
};
