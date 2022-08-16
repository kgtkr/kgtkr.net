import React from "react";
import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Title from "../components/Title";
import Bio from "../components/Bio";
import Link from "next/link";
import { getAllPosts } from "../lib/blog";
import PostList from "../components/PostList";
import { generatedRss } from "../lib/rss";
import { PostListItemPost } from "../components/PostListItem";
import withPage from "../components/withPage";

const pagination = withPage<PostListItemPost>({
  pageSize: 10,
  pageToPath: (page) => (page === 0 ? "/" : `/page/${page + 1}`),
});

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
      <div style={{ marginTop: 28 }}>
        {pagination.paginationView({
          currentPage: props.currentPage,
          totalPages: props.totalPages,
        })}
      </div>
    </div>
  );
};

export default Home;

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllPosts({}).map((post) => PostListItemPost(post));

  return {
    paths: pagination.getStaticPaths(posts),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props, { page?: string[] }> =
  async ({ params }) => {
    const page = Number(params?.page?.[1] ?? 1) - 1;
    if (page === 0) {
      await generatedRss();
    }
    const allPosts = getAllPosts({}).map((post) => PostListItemPost(post));
    const { items: posts, totalPages } = pagination.getStaticProps(allPosts, {
      page,
    });

    return {
      props: {
        posts,
        currentPage: page,
        totalPages,
      },
    };
  };
