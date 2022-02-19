import React from "react";
import Tag from "./Tag";
import styles from "./Tags.module.scss";

type Props = {
  tags: string[];
};

function Tags({ tags }: Props) {
  return (
    <span>
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          <Tag tag={tag} />
        </span>
      ))}
    </span>
  );
}

export default Tags;
