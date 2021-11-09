import React from "react";
import { NextPage } from "next";
import Image from "next/image";
import profileImage from "../public/images/profile.png";
import { SocialIcon } from "react-social-icons";
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
          <SocialIcon
            url="https://twitter.com/kgtkr"
            style={{ height: 25, width: 25, marginRight: 5 }}
          />
          <SocialIcon
            url="https://github.com/kgtkr"
            bgColor="#333"
            style={{ height: 25, width: 25 }}
          />
        </div>
      </div>
    </div>
  );
};

export default Bio;
