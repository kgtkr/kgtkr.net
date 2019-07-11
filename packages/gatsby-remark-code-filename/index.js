// https://github.com/DSchau/gatsby-remark-code-titles/blob/master/src/index.js

const visit = require(`unist-util-visit`)

module.exports = function gatsbyRemarkCodeFilename({ markdownAST }) {
  visit(markdownAST, "code", (node, index, parent) => {
    const [language, filename] = (node.lang || "").split(":")

    if (filename !== undefined) {
      const filenameNode = {
        type: "html",
        value: `
<div class="gatsby-remark-code-filename">${filename}</div>
      `.trim(),
      }

      parent.children.splice(index, 0, filenameNode)
    }

    if (language) {
      node.lang = language
    } else {
      node.lang = undefined
    }
  })

  return markdownAST
}
