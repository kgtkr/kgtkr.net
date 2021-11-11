import React from "react";
import { NextPage, GetStaticProps } from "next";
import styles from "./Tags.module.scss";
import { readPages } from "../../lib/page";
import * as Ord from "fp-ts/Ord";
import * as A from "fp-ts/Array";
import { pipe, identity } from "fp-ts/function";
import * as NA from "fp-ts/NonEmptyArray";
import * as R from "fp-ts/Record";
import * as N from "fp-ts/number";
import * as S from "fp-ts/string";
import Link from "next/link";
import Title from "../../components/Title";

type Tag = {
  name: string;
  count: number;
};

const TagOrd: Ord.Ord<Tag> = Ord.contramap(
  (tag: Tag) => [tag.count, tag.name] as const,
)(Ord.tuple(Ord.reverse(N.Ord), S.Ord));

type Props = {
  tags: Tag[];
};

const Tags: NextPage<Props> = (props) => {
  return (
    <div>
      <Title title="All Tags" />
      <ul className={styles.container}>
        {props.tags.map((tag) => (
          <li>
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
  const pages = readPages();

  return {
    props: {
      tags: pipe(
        pages,
        A.chain((page) => page.matter.tags),
        NA.groupBy(identity),
        R.map((arr) => arr.length),
        R.toArray,
        A.map(
          ([name, count]): Tag => ({
            name,
            count,
          }),
        ),
        A.sort(TagOrd),
      ),
    },
  };
};
