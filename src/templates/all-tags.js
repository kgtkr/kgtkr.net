import React from 'react';
import Link from 'gatsby-link';
import Layout from "../components/layout"
import SEO from "../components/seo"

const AllTags = ({ pathContext, location, data }) => {
  const { tags } = pathContext;

  if (tags) {
    return (
      <Layout location={location} title={data.site.siteMetadata.title}>
        <SEO
          title={"All tags"}
          description={"tags list"}
        />
        <div>
          <ul>
            {tags.map(tag => {
              return (
                <li>
                  <Link to={`/tags/${tag}`}>
                    {tag}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Layout>
    );
  }
};

export default AllTags;

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
  }`