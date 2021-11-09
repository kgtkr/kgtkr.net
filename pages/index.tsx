import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";
import Bio from "../components/Bio";
import Link from "next/link";

const Home: NextPage = () => {
  return (
    <div>
      <Title />
      <Bio />
      <div style={{ marginTop: 10 }}>
        <Link href="/rss.xml">RSS</Link>
      </div>
    </div>
  );
};

export default Home;
