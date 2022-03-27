import React from "react";
import Head from "next/head";

type Props = {
  title?: string;
};

function Title({ title }: Props) {
  return (
    <Head>
      <title>{title !== undefined ? `${title} | ` : ""}Tkr Blog</title>
      {title !== undefined ? (
        <meta property="og:title" content={title} />
      ) : null}
      <meta property="og:site_name" content="Tkr Blog" />
    </Head>
  );
}

export default Title;
