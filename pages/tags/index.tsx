import React from "react";
import { NextPage, GetStaticProps } from "next";
import Image from "next/image";
import profileImage from "../public/images/profile.png";
import { SocialIcon } from "react-social-icons";
import Link from "next/link";
import styles from "./Tags.module.scss";
import matter from "gray-matter";

type Props = {
  tags: string[];
};

const Tags: NextPage<Props> = (props) => {
  return (
    <div className={styles.container}>
      {props.tags.map((tag) => (
        <div>{tag}</div>
      ))}
    </div>
  );
};

export default Tags;

export const getStaticProps: GetStaticProps<Props> = async () => {
  const context = require.context("../../blog", true, /\.md$/);
  const keys = context.keys();

  return {
    props: {
      tags: keys.flatMap((key) => {
        const { data } = matter(context(key).default);
        return data.tags;
      }),
    },
  };
};
