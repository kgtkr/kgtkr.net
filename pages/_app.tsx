import "../styles/globals.scss";
import type { AppProps } from "next/app";
import Link from "next/link";
import styles from "./_app.module.scss";
import Head from "next/head";
import GoogleAnalytics from "../components/GoogleAnalytics";
import "highlight.js/styles/default.css";

function App({ Component, pageProps, router }: AppProps) {
  return (
    <div className={styles.container}>
      <GoogleAnalytics />
      <Head>
        <link rel="icon" href="/images/profile.png" type="image/png" />
      </Head>
      <header
        className={`${styles.header} ${
          router.asPath === "/" ? styles.homeHeader : ""
        }`}
      >
        <Link href="/">Tkr Blog</Link>
      </header>
      <Component {...pageProps} />
      <footer className={styles.footer}>
        <Link href="/privacy-policy">プライバシーポリシー</Link>
      </footer>
    </div>
  );
}

export default App;
