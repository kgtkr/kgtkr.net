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

type Props = {
  post: Post;
};

const Post: NextPage<Props> = ({ post }) => {
  return (
    <div>
      <Title title={post.matter.title} />
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
  const posts = getAllPosts();
  return {
    paths: posts.map((post) => postToPath(post)),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<
  Props,
  { lang?: string[]; year: string; month: string; day: string; slug: string }
> = async ({ params }) => {
  const posts = getAllPosts();
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
