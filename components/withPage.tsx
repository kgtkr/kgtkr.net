import Link from "next/link";
import styles from "./withPage.module.scss";

export default function withPage<A>({
  pageSize,
  pageToPath,
}: {
  pageSize: number;
  pageToPath: (page: number) => string;
}) {
  return {
    getStaticProps: (allItems: A[], { page }: { page: number }) => {
      const items = allItems.slice(page * pageSize, (page + 1) * pageSize);
      return {
        items,
        totalPages: Math.ceil(allItems.length / pageSize),
      };
    },
    getStaticPaths: (allItems: A[]) => {
      return Array.from(
        { length: Math.ceil(allItems.length / pageSize) },
        (_, i) => pageToPath(i),
      );
    },
    paginationView: ({
      currentPage,
      totalPages,
    }: {
      currentPage: number;
      totalPages: number;
    }) => {
      return (
        <div className={styles.pages}>
          {currentPage > 0 ? (
            <Link href={pageToPath(currentPage - 1)}>Prev</Link>
          ) : null}
          {Array.from({ length: totalPages }, (_, i) =>
            i === currentPage ? (
              <span key={i}>{i + 1}</span>
            ) : (
              <Link key={i} href={pageToPath(i)}>
                {i + 1}
              </Link>
            ),
          )}
          {currentPage < totalPages - 1 ? (
            <Link href={pageToPath(currentPage + 1)}>Next</Link>
          ) : null}
        </div>
      );
    },
  };
}
