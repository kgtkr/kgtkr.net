import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import React from "react";
import Title from "../../../../../../components/Title";
import {
  getAllPosts,
  postToPath,
  Post,
  toPath,
  Content,
} from "../../../../../../lib/blog";
import * as fns from "date-fns";
import Tags from "../../../../../../components/Tags";
import Head from "next/head";
import { markdownToPlainText } from "../../../../../../lib/markdown";

type Props = {
  post: Post;
};

const Post: NextPage<Props> = ({ post }) => {
  return (
    <div>
      <Title title={post.matter.title} />
      <Head>
        <meta
          property="og:description"
          content={markdownToPlainText(post.markdown).substring(0, 140)}
        />
      </Head>
      {post.matter.private && post.matter.showPrivateMessage ? (
        <div
          style={{
            border: "1px solid #000",
            padding: "1em",
            margin: "1em",
            borderRadius: "1em",
          }}
        >
          この記事は限定公開です.
        </div>
      ) : null}
      <h1>{post.matter.title}</h1>
      <div>{fns.format(new Date(post.matter.date), "yyyy/MM/dd")}</div>
      <div>
        <Tags tags={post.matter.tags}></Tags>
      </div>
      <Content post={post} />
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllPosts({ includePrivate: true });
  return {
    paths: posts.map((post) => postToPath(post)),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<
  Props,
  { lang?: string[]; year: string; month: string; day: string; slug: string }
> = async ({ params }) => {
  const posts = getAllPosts({ includePrivate: true });
  const post = posts.find(
    (post) =>
      postToPath(post) ===
      toPath({
        year: params!.year,
        month: params!.month,
        day: params!.day,
        slug: params!.slug,
        lang: params!.lang?.[0],
      }),
  )!;
  return {
    props: {
      post,
    },
  };
};

export default Post;
