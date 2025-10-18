---
id: overview
title: Overview
---

Orval is able to generate client with appropriate type-signatures (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, in either YAML or JSON format.

## Motivation

Developers often use swagger as a contract between the frontend and backend. Before Orval, tools such as <a href="https://editor.swagger.io" target="_blank">Swagger Editor</a> or <a href="https://swagger.io/tools/swagger-codegen" target="_blank">Swagger Codegen</a> did the job. But that is not enough for modern development needs. Enter Orval.

Main goals:

- Generate TypeScript models
- Generate HTTP request functions
- Generate mocks with <a href="https://mswjs.io/" target="_blank">MSW</a>

The default generated clients use Axios, but you may configure any client and underlying HTTP client, for your project needs. Orval supports most major JavaScript frameworks such as Angular, React or Vue. [Learn more about configuring Orval](./guides/basics)

Orval can also generate the following client:

- [React query with Axios](./guides/react-query)
- [Angular with HttpClient](./guides/angular)
