import React from "react";
import { Post, postToPath } from "../lib/blog";
import PostListItem, { PostListItemPost } from "./PostListItem";
import styles from "./PostList.module.scss";

export type Props = {
  posts: PostListItemPost[];
};

function PostList({ posts }: Props) {
  return (
    <div>
      {posts.map((post) => (
        <div className={styles.item} key={post.path}>
          <PostListItem post={post}></PostListItem>
        </div>
      ))}
    </div>
  );
}

export default PostList;
