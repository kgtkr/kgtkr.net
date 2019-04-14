const moment = require("moment-timezone");

function postToPath(post) {
  const date = moment(post.frontmatter.date).tz("UTC");
  const name = post.frontmatter.name;
  const lang = post.frontmatter.lang || "ja";
  return `/blog/${date.format("YYYY/MM/DD")}/${name}${post.frontmatter.lang !== "ja" ? `/${post.frontmatter.lang}` : ""}`;
}

module.exports = postToPath;