import { GetStaticProps, GetStaticPaths, NextPage } from "next";
import React, { useEffect, useState } from "react";
import Title from "../../components/Title";
import { Markdown } from "../../lib/markdown";
import matter from "gray-matter";
import Head from "next/head";
import fs from "fs/promises";
import path from "path";
import { useRouter } from "next/router";
import { z } from "zod";
import {
  decryptDraftContent,
  deriveArticleKey,
  isEncryptedDraft,
} from "../../lib/draft-crypt";

const Matter = z.object({
  title: z.string(),
});

type Props =
  | {
      mode: "plaintext";
      slug: string;
      title: string;
      markdown: string;
      devEncKey: string | null;
    }
  | {
      mode: "encrypted";
      slug: string;
      encryptedContent: string;
    };

const Draft: NextPage<Props> = (props) => {
  const router = useRouter();
  const [title, setTitle] = useState<string>(
    props.mode === "plaintext" ? props.title : "Loading...",
  );
  const [markdown, setMarkdown] = useState<string>(
    props.mode === "plaintext" ? props.markdown : "",
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (props.mode === "plaintext") {
      setTitle(props.title);
      setMarkdown(props.markdown);
      setError("");
      return;
    }

    if (!router.isReady) return;

    const key = router.query.enc_key;
    if (typeof key !== "string") {
      setError("No key provided");
      setTitle("Error");
      return;
    }

    try {
      const decryptedContent = decryptDraftContent(
        props.encryptedContent,
        key,
      );
      const { data, content } = matter(decryptedContent);
      const parsedData = Matter.parse(data);
      setTitle(parsedData.title);
      setMarkdown(content);
      setError("");
    } catch {
      setError("Decryption failed");
      setTitle("Error");
    }
  }, [props, router.isReady, router.query.enc_key]);

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
        <div>この記事は限定公開記事です。</div>
        {props.mode === "plaintext" && (
          <div
            style={{
              marginTop: "0.5em",
              fontSize: "0.9em",
              color: "#555",
            }}
          >
            <div>
              <strong>[Dev Mode: Plaintext Draft]</strong>
            </div>
            {props.devEncKey ? (
              <div style={{ marginTop: "0.25em" }}>
                Share URL:{" "}
                <code>{`/drafts/${props.slug}?enc_key=${props.devEncKey}`}</code>
              </div>
            ) : (
              <div style={{ marginTop: "0.25em" }}>
                Note: <code>DRAFT_MASTER_KEY</code> is not set in environment.
              </div>
            )}
          </div>
        )}
      </div>
      <h1>{title}</h1>
      {markdown ? <Markdown markdown={markdown} /> : <p>Decrypting...</p>}
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const draftsDir = path.join(process.cwd(), "drafts");
  const files = await fs.readdir(draftsDir);

  const paths = files
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({
      params: { slug: file.replace(/\.md$/, "") },
    }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };
  const draftPath = path.join(process.cwd(), "drafts", `${slug}.md`);
  const rawContent = await fs.readFile(draftPath, "utf-8");
  const isEnc = isEncryptedDraft(rawContent);

  if (process.env.NODE_ENV === "development") {
    const masterKey = process.env.DRAFT_MASTER_KEY || null;
    const devEncKey = masterKey ? deriveArticleKey(masterKey, slug) : null;

    if (!isEnc) {
      const { data, content } = matter(rawContent);
      const parsedData = Matter.parse(data);
      return {
        props: {
          mode: "plaintext",
          slug,
          title: parsedData.title,
          markdown: content,
          devEncKey,
        },
      };
    }

    if (devEncKey) {
      const decrypted = decryptDraftContent(rawContent, devEncKey);
      const { data, content } = matter(decrypted);
      const parsedData = Matter.parse(data);
      return {
        props: {
          mode: "plaintext",
          slug,
          title: parsedData.title,
          markdown: content,
          devEncKey,
        },
      };
    }

    return {
      props: {
        mode: "encrypted",
        slug,
        encryptedContent: rawContent.trim(),
      },
    };
  }

  // Production build: require encrypted content to prevent accidental plaintext leakage
  if (!isEnc) {
    throw new Error(
      `Draft "drafts/${slug}.md" is not encrypted! Plaintext drafts cannot be included in a production build. Run "npm run draft:lock" before building locally.`,
    );
  }

  return {
    props: {
      mode: "encrypted",
      slug,
      encryptedContent: rawContent.trim(),
    },
  };
};

export default Draft;
