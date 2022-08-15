import React from "react";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Title from "../components/Title";
import Bio from "../components/Bio";
import Link from "next/link";
import { getAllPosts } from "../lib/blog";
import PostList from "../components/PostList";
import { generatedRss } from "../lib/rss";
import { PostListItemPost } from "../components/PostListItem";
import styles from "./index.module.scss";

const pageSize = 10;

function pageToPath(page: number): string {
  return page === 0 ? "/" : `/page/${page + 1}`;
}

type Props = {
  posts: PostListItemPost[];
  currentPage: number;
  totalPages: number;
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
      <div className={styles.pages}>
        {props.currentPage > 0 ? (
          <Link href={pageToPath(props.currentPage - 1)}>Prev</Link>
        ) : null}
        {Array.from({ length: props.totalPages }, (_, i) =>
          i === props.currentPage ? (
            <span>{i + 1}</span>
          ) : (
            <Link href={pageToPath(i)}>{i + 1}</Link>
          ),
        )}
        {props.currentPage < props.totalPages - 1 ? (
          <Link href={pageToPath(props.currentPage + 1)}>Next</Link>
        ) : null}
      </div>
    </div>
  );
};

export default Home;

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllPosts({});

  return {
    paths: Array.from({ length: Math.ceil(posts.length / pageSize) }, (_, i) =>
      pageToPath(i),
    ),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, { page?: string[] }> =
  async ({ params }) => {
    const page = Number(params?.page?.[1] ?? 1) - 1;
    if (page === 0) {
      await generatedRss();
    }
    const allPosts = getAllPosts({});
    const posts = allPosts.slice(page * pageSize, (page + 1) * pageSize);
    return {
      props: {
        posts: posts.map((post) => PostListItemPost(post)),
        currentPage: page,
        totalPages: Math.ceil(allPosts.length / pageSize),
      },
    };
  };
