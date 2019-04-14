const moment = require("moment-timezone");

function postToPath(post) {
  const date = moment(post.frontmatter.date).tz("UTC");
  const name = post.frontmatter.name;
  return `/blog/${date.format("YYYY/MM/DD")}/${name}`;
}

module.exports = postToPath;