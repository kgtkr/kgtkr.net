import React from "react";
import Head from "next/head";

type Props = {
  title?: string;
};

function Title({ title }: Props) {
  return (
    <Head>
      <title>{title !== undefined ? `${title} | ` : ""}Tkr Blog</title>
    </Head>
  );
}

export default Title;
