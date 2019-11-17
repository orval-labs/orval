/**
 * Example config for `yarn example:advanced`
 */

module.exports = {
  "petstore-file": {
    file: "examples/petstore.yaml",
    output: "examples/petstoreFromFileSpecWithConfig.tsx",
  },
  "petstore-github": {
    github: "OAI:OpenAPI-Specification:master:examples/v3.0/petstore.yaml",
    output: "examples/petstoreFromGithubSpecWithConfig.tsx",
  },
};
