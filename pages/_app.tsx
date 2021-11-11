import "../styles/globals.scss";
import type { AppProps } from "next/app";
import Link from "next/link";
import styles from "./_app.module.scss";
import Head from "next/head";

function App({ Component, pageProps, router }: AppProps) {
  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/images/profile.png" type="image/png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2amily=Zen+Maru+Gothic:wght@500"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Code+Pro"
          rel="stylesheet"
        />
      </Head>
      <header
        className={`${styles.header} ${
          router.asPath === "/" ? styles.homeHeader : ""
        }`}
      >
        <Link href="/">Tkr Blog</Link>
      </header>
      <Component {...pageProps} />
      <footer>© 2021. All rights reserved.</footer>
    </div>
  );
}

export default App;
