import React from "react";
import { Post, postToPath } from "../lib/blog";
import PostListItem from "./PostListItem";
import styles from "./PostList.module.scss";

type Props = {
  posts: Post[];
};

function PostList({ posts }: Props) {
  return (
    <div>
      {posts.map(post => (
        <div className={styles.item} key={postToPath(post)}>
          <PostListItem post={post}></PostListItem>
        </div>
      ))}
    </div>
  );
}

export default PostList;
