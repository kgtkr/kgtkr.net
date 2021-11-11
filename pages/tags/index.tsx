import React from "react";
import { NextPage, GetStaticProps } from "next";
import styles from "./Tags.module.scss";
import { blogsToTags, readBlogs, Tag } from "../../lib/blog";
import Link from "next/link";
import Title from "../../components/Title";

type Props = {
  tags: Tag[];
};

const Tags: NextPage<Props> = (props) => {
  return (
    <div>
      <Title title="All Tags" />
      <ul className={styles.container}>
        {props.tags.map((tag) => (
          <li key={tag.name}>
            <Link
              href={`/tags/${tag.name}`}
            >{`${tag.name} (${tag.count})`}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Tags;

export const getStaticProps: GetStaticProps<Props> = async () => {
  const blogs = readBlogs();

  return {
    props: {
      tags: blogsToTags(blogs),
    },
  };
};
