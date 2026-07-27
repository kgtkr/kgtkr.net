import React from "react";
import { NextPage } from "next";
import Image from "next/legacy/image";
import profileImage from "../public/images/profile.png";
import Link from "next/link";
import styles from "./Bio.module.scss";

const Bio: NextPage = () => {
  return (
    <div className={styles.container}>
      <div
        style={{
          overflow: "hidden",
          borderRadius: "50%",
          height: 50,
          width: 50,
          marginRight: 14,
        }}
      >
        <Image
          src={profileImage}
          alt={"Profile image"}
          height={100}
          width={100}
        />
      </div>
      <div>
        <div>Web Developer.</div>
        <div>
          <Link href="/about">About</Link>
        </div>
        <div>
          <a
            href="https://mstdn.kgtkr.net/@me"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 25,
              height: 25,
              borderRadius: "50%",
              backgroundColor: "#523bc4",
              marginRight: 5,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mastodon.svg"
              alt="Mastodon"
              style={{ width: 15, height: 15 }}
            />
          </a>
          <a
            href="https://github.com/kgtkr"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 25,
              height: 25,
              borderRadius: "50%",
              backgroundColor: "#333",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/github.svg"
              alt="GitHub"
              style={{ width: 15, height: 15 }}
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Bio;
