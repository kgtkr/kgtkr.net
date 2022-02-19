import Link from "next/link";
import React from "react";
import styles from "./Tag.module.scss";

type Props = {
  tag: string;
};

function Tag({ tag }: Props) {
  return (
    <span className={styles.container}>
      <Link key={tag} href={`/tags/${tag}`}>
        {tag}
      </Link>
    </span>
  );
}

export default Tag;
