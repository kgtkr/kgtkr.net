import { GetStaticProps, GetStaticPaths, NextPage } from "next";
import React, { useEffect, useState } from "react";
import Title from "../../components/Title";
import { Markdown } from "../../lib/markdown";
import matter from "gray-matter";
import Head from "next/head";
import fs from "fs/promises";
import path from "path";
import CryptoJS from "crypto-js";
import { useRouter } from "next/router";
import { z } from "zod";

const Matter = z.object({
  title: z.string(),
});

type Props = {
  encryptedContent: string;
  slug: string;
};

const Draft: NextPage<Props> = ({ encryptedContent, slug }) => {
  const router = useRouter();
  const [title, setTitle] = useState<string>("Loading...");
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!router.isReady) return;

    const key = router.query.enc_key;
    if (typeof key !== "string") {
      setError("No key provided");
      setTitle("Error");
      return;
    }

    try {
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, key);
      const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedContent) {
        setError("Decryption failed");
        setTitle("Error");
        return;
      }

      const { data, content } = matter(decryptedContent);
      const parsedData = Matter.parse(data);
      setTitle(parsedData.title);
      setMarkdown(content);
      setError("");
    } catch (e) {
      setError("Decryption failed");
      setTitle("Error");
    }
  }, [router.isReady, router.query.enc_key, encryptedContent, slug]);

  const dummyContext = ((_path: string) =>
    _path) as __WebpackModuleApi.RequireContext;
  dummyContext.keys = () => [];
  dummyContext.resolve = (_path: string) => _path;
  dummyContext.id = "dummy";

  if (error) {
    return (
      <div>
        <Title title="Error" />
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <Title title={title} />
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div
        style={{
          border: "1px solid #f00",
          padding: "1em",
          margin: "1em",
          borderRadius: "1em",
          color: "#f00",
        }}
      >
        この記事は限定公開記事です。
      </div>
      <h1>{title}</h1>
      {markdown ? (
        <Markdown context={dummyContext} basedir="" markdown={markdown} />
      ) : (
        <p>Decrypting...</p>
      )}
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const draftsDir = path.join(process.cwd(), "drafts");
  const files = await fs.readdir(draftsDir);

  const paths = files
    .filter((file) => file.endsWith(".md.enc"))
    .map((file) => ({
      params: { slug: file.replace(/\.md\.enc$/, "") },
    }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };
  const encPath = path.join(process.cwd(), "drafts", `${slug}.md.enc`);
  const encryptedContent = await fs.readFile(encPath, "utf-8");

  return {
    props: {
      encryptedContent,
      slug,
    },
  };
};

export default Draft;
